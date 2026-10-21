// Sinapse · gerar-cards
// Recebe um PDF (base64) ou texto, confere o login e o limite do plano, pede os cards
// ao Claude e devolve a lista para a pessoa aprovar no app.
// Segredo necessário (Edge Functions → Secrets): ANTHROPIC_API_KEY.
// Opcional: AI_MODEL (padrão claude-haiku-5-5).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const LIMITES: Record<string, number> = { gratis: 10, pro: 300, residencia: 1000, teste: 1000 };
// false = fase de testes: todo mundo tem o limite do Residência. Igual a COBRANCA_ATIVA em js/config.js.
const COBRANCA_ATIVA = false;
const TESTE_GRATIS_DIAS = 7;
const MAX_PDF_B64 = 14_000_000; // ~10 MB de PDF
const MAX_TEXTO = 120_000;      // caracteres

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Mês no fuso de Brasília (o limite vira no dia 1º, à meia-noite daqui).
const mesAtual = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 7);

const SISTEMA = `Você cria flashcards de medicina em português do Brasil para estudantes e residentes.
Regras:
- Use SOMENTE o conteúdo do material enviado. Não invente doses, valores ou condutas que não estejam nele.
- Cada card cobra UMA ideia, a de maior rendimento para provas (definições, critérios, valores de corte, primeira escolha, achados clássicos, contraindicações).
- Tipo "cloze": frase completa com a lacuna entre chaves duplas, ex.: "A FEVE reduzida é menor ou igual a {{40}}%." No máximo 2 lacunas por card. Dentro da lacuna, separe respostas equivalentes com |, ex.: {{IECA|inibidor da ECA}}. A lacuna deve ser curta (1 a 4 palavras) e inequívoca.
- Tipo "basic": pergunta direta em "front" e resposta curta em "back" (até ~20 palavras).
- "extra": de onde veio no material (seção ou página) ou um detalhe curto que ajude a lembrar. Pode ficar vazio.
- Não repita o mesmo fato em dois cards. Se o material render menos cards de qualidade do que o pedido, devolva menos.
- Se o material não for de medicina ou estiver ilegível, devolva a lista vazia e explique em "aviso".`;

const FERRAMENTA = {
  name: 'salvar_cards',
  description: 'Entrega os flashcards gerados a partir do material.',
  input_schema: {
    type: 'object',
    properties: {
      titulo: { type: 'string', description: 'Título curto do material, ex.: "Insuficiência cardíaca".' },
      subtema: { type: 'string', description: 'Subtema médico principal, ex.: "Cardiologia".' },
      aviso: { type: 'string', description: 'Só se houver problema com o material.' },
      cards: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['cloze', 'basic'] },
            text: { type: 'string', description: 'Para cloze: frase com {{lacuna}}.' },
            front: { type: 'string', description: 'Para basic: pergunta.' },
            back: { type: 'string', description: 'Para basic: resposta.' },
            extra: { type: 'string' },
          },
          required: ['type'],
        },
      },
    },
    required: ['cards'],
  },
};

type Card = { type: 'cloze' | 'basic'; text?: string; front?: string; back?: string; extra?: string };

function limpar(cards: unknown, max: number): Card[] {
  if (!Array.isArray(cards)) return [];
  const out: Card[] = [];
  const vistos = new Set<string>();
  for (const c of cards as Card[]) {
    if (!c || typeof c !== 'object') continue;
    const extra = typeof c.extra === 'string' ? c.extra.trim().slice(0, 200) : '';
    if (c.type === 'cloze' && typeof c.text === 'string' && /\{\{[^}]+\}\}/.test(c.text)) {
      const text = c.text.trim().slice(0, 400);
      if (vistos.has(text)) continue;
      vistos.add(text);
      out.push({ type: 'cloze', text, extra });
    } else if (c.type === 'basic' && typeof c.front === 'string' && typeof c.back === 'string' && c.front.trim() && c.back.trim()) {
      const front = c.front.trim().slice(0, 300);
      if (vistos.has(front)) continue;
      vistos.add(front);
      out.push({ type: 'basic', front, back: c.back.trim().slice(0, 300), extra });
    }
    if (out.length >= max) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'metodo' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const auth = req.headers.get('Authorization') ?? '';
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: who, error: authErr } = await asUser.auth.getUser();
  if (authErr || !who?.user) return json(401, { error: 'login', message: 'Entre com sua conta para usar a IA.' });
  const userId = who.user.id;

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Plano vigente (sem linha ou vencido = Grátis).
  const { data: sub } = await admin.from('subscriptions').select('plan, valid_until').eq('user_id', userId).maybeSingle();
  const vigente = sub && sub.plan !== 'gratis' && (!sub.valid_until || new Date(sub.valid_until).getTime() > Date.now());
  const criada = who.user.created_at ? new Date(who.user.created_at).getTime() : 0;
  const emTeste = criada && Date.now() < criada + TESTE_GRATIS_DIAS * 86400_000;
  const plan = !COBRANCA_ATIVA ? 'teste' : vigente ? sub!.plan : emTeste ? 'residencia' : 'gratis';
  const limit = LIMITES[plan] ?? LIMITES.gratis;
  const month = mesAtual();
  const { data: uso } = await admin.from('ai_usage').select('cards').eq('user_id', userId).eq('month', month).maybeSingle();
  const used = uso?.cards ?? 0;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: 'corpo', message: 'Pedido inválido.' }); }

  // Só consulta o uso do mês (para mostrar no app).
  if (body.action === 'uso') return json(200, { plan, used, limit });

  const restante = limit - used;
  if (restante <= 0) {
    return json(402, { error: 'limite', plan, used, limit, message: `Você usou os ${limit} cards de IA do seu plano neste mês.` });
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json(503, { error: 'sem_chave', message: 'A IA ainda não foi ligada no servidor.' });

  const pedido = Math.max(1, Math.min(20, Number(body.count) || 10));
  const n = Math.min(pedido, restante);
  const tipos = body.types === 'cloze' ? 'Use só o tipo "cloze".' : body.types === 'basic' ? 'Use só o tipo "basic".' : 'Misture "cloze" e "basic", com mais cloze.';
  const area = typeof body.area === 'string' ? body.area.slice(0, 60) : '';
  const sub_ = typeof body.sub === 'string' ? body.sub.slice(0, 60) : '';
  const fase = typeof body.fase === 'string' ? body.fase.slice(0, 40) : '';

  const content: unknown[] = [];
  if (typeof body.pdf === 'string' && body.pdf) {
    if (body.pdf.length > MAX_PDF_B64) return json(413, { error: 'grande', message: 'O PDF passa de 10 MB. Envie um arquivo menor ou só as páginas da aula.' });
    content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: body.pdf } });
  } else if (typeof body.text === 'string' && body.text.trim().length >= 80) {
    content.push({ type: 'text', text: `MATERIAL:\n${body.text.slice(0, MAX_TEXTO)}` });
  } else {
    return json(400, { error: 'vazio', message: 'Envie um PDF ou cole um texto com pelo menos algumas linhas.' });
  }
  content.push({
    type: 'text',
    text: `Gere até ${n} cards deste material. ${tipos}` +
      (area ? ` Área: ${area}.` : '') + (sub_ ? ` Subtema escolhido pela pessoa: ${sub_}.` : '') +
      (fase ? ` Fase da pessoa: ${fase}.` : '') + ' Entregue pela ferramenta salvar_cards.',
  });

  const model = Deno.env.get('AI_MODEL') || 'claude-haiku-5-5';
  let resp: Response;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: SISTEMA,
        tools: [FERRAMENTA],
        tool_choice: { type: 'tool', name: 'salvar_cards' },
        messages: [{ role: 'user', content }],
      }),
    });
  } catch {
    return json(502, { error: 'ia', message: 'Não foi possível falar com a IA agora. Tente de novo.' });
  }
  if (!resp.ok) {
    const detalhe = await resp.text();
    console.error('anthropic', resp.status, detalhe.slice(0, 500));
    const msg = resp.status === 401 ? 'A chave da IA no servidor é inválida.'
      : resp.status === 429 ? 'A IA está ocupada. Tente de novo em instantes.'
      : /credit|billing/i.test(detalhe) ? 'A conta da IA está sem créditos.'
      : 'A IA não conseguiu ler este material. Tente outro arquivo ou cole o texto.';
    return json(502, { error: 'ia', message: msg });
  }

  const out = await resp.json();
  const tool = (out.content || []).find((b: { type: string }) => b.type === 'tool_use');
  const input = tool?.input ?? {};
  const cards = limpar(input.cards, n);

  let newUsed = used;
  if (cards.length) {
    const { data: total, error: rpcErr } = await admin.rpc('ai_add_usage', { p_user: userId, p_month: month, p_cards: cards.length });
    if (rpcErr) console.error('uso', rpcErr.message);
    newUsed = typeof total === 'number' ? total : used + cards.length;
  }

  return json(200, {
    cards,
    titulo: typeof input.titulo === 'string' ? input.titulo.slice(0, 80) : '',
    subtema: typeof input.subtema === 'string' ? input.subtema.slice(0, 60) : '',
    aviso: typeof input.aviso === 'string' ? input.aviso.slice(0, 300) : '',
    plan, used: newUsed, limit, model,
  });
});
