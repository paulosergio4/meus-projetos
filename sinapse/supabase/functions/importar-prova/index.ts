// Sinapse · importar-prova (só administradores)
// 1) action "gabarito": lê o gabarito oficial e devolve { respostas: { "1": "B", ... }, anuladas: [..] }
//    para o administrador conferir antes de importar.
// 2) action "questoes": recebe o texto da prova, uma faixa de números e o gabarito já conferido;
//    a IA separa enunciado e alternativas, classifica e comenta; A RESPOSTA VEM SEMPRE DO GABARITO.
// Segredo: ANTHROPIC_API_KEY. Opcional: AI_MODEL.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const AREAS: Record<string, string[]> = {
  basico: ['Anatomia', 'Histologia', 'Embriologia', 'Fisiologia', 'Bioquímica', 'Biologia celular e molecular', 'Genética', 'Imunologia', 'Microbiologia', 'Parasitologia', 'Patologia', 'Farmacologia', 'Semiologia', 'Psicologia médica', 'Bioética'],
  clinica: ['Cardiologia', 'Pneumologia', 'Gastroenterologia', 'Hepatologia', 'Nefrologia', 'Endocrinologia', 'Reumatologia', 'Hematologia', 'Oncologia', 'Infectologia', 'Neurologia', 'Psiquiatria', 'Dermatologia', 'Geriatria', 'Alergia e imunologia clínica', 'Medicina intensiva', 'Emergência', 'Toxicologia', 'Nutrologia', 'Radiologia e imagem', 'Medicina laboratorial', 'Cuidados paliativos'],
  cirurgia: ['Cirurgia geral', 'Trauma', 'Abdome agudo', 'Pré e pós-operatório', 'Hérnias e parede abdominal', 'Cirurgia do aparelho digestivo', 'Coloproctologia', 'Cirurgia vascular', 'Cirurgia torácica', 'Cirurgia cardiovascular', 'Cirurgia de cabeça e pescoço', 'Cirurgia pediátrica', 'Cirurgia plástica', 'Queimaduras', 'Urologia', 'Ortopedia e traumatologia', 'Neurocirurgia', 'Otorrinolaringologia', 'Oftalmologia', 'Anestesiologia', 'Cirurgia oncológica'],
  go: ['Pré-natal', 'Hipertensão na gestação', 'Sangramentos', 'Diabetes na gestação', 'Parto e assistência ao parto', 'Puerpério e amamentação', 'Medicina fetal', 'Infecções na gestação', 'Abortamento', 'Planejamento familiar', 'Ciclo menstrual e amenorreias', 'Endocrinologia ginecológica', 'Climatério', 'Infecções genitais e ISTs', 'Oncologia ginecológica', 'Mastologia', 'Uroginecologia', 'Infertilidade', 'Violência sexual'],
  pediatria: ['Neonatologia', 'Puericultura', 'Crescimento e desenvolvimento', 'Aleitamento e nutrição infantil', 'Imunização', 'Infectologia pediátrica', 'Doenças exantemáticas', 'Respiratório', 'Gastroenterologia pediátrica', 'Nefrologia pediátrica', 'Cardiologia pediátrica', 'Neurologia pediátrica', 'Endocrinologia pediátrica', 'Hematologia e oncologia pediátrica', 'Reumatologia', 'Emergências pediátricas', 'Adolescência', 'Genética e síndromes'],
  preventiva: ['Epidemiologia', 'Bioestatística', 'SUS', 'Políticas de saúde', 'Medicina de família e comunidade', 'Atenção primária', 'Vigilância em saúde', 'Saúde do trabalhador', 'Medicina baseada em evidências', 'Rastreamento e prevenção', 'Ética médica', 'Medicina legal', 'Saúde mental na atenção básica', 'Saúde do idoso', 'Saúde indígena e populações vulneráveis'],
};
const LISTA_AREAS = Object.entries(AREAS).map(([id, subs]) => `${id}: ${subs.join('; ')}`).join('\n');
const LETRAS = 'ABCDEFGH';

async function claude(apiKey: string, system: string, content: unknown[], tool: Record<string, unknown>, maxTokens: number) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('AI_MODEL') || 'claude-haiku-5-5',
      max_tokens: maxTokens,
      system,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [{ role: 'user', content }],
    }),
  });
  if (!resp.ok) {
    const detalhe = await resp.text();
    console.error('anthropic', resp.status, detalhe.slice(0, 500));
    const msg = resp.status === 401 ? 'A chave da IA no servidor é inválida.'
      : resp.status === 429 ? 'A IA está ocupada. Tente de novo em instantes.'
      : /credit|billing/i.test(detalhe) ? 'A conta da IA está sem créditos.'
      : 'A IA não conseguiu ler este material.';
    throw new Error(msg);
  }
  const out = await resp.json();
  const t = (out.content || []).find((b: { type: string }) => b.type === 'tool_use');
  return { input: t?.input ?? {}, truncated: out.stop_reason === 'max_tokens' };
}

const TOOL_GABARITO = {
  name: 'entregar_gabarito',
  description: 'Gabarito oficial lido do documento.',
  input_schema: {
    type: 'object',
    properties: {
      respostas: { type: 'array', items: { type: 'object', properties: { numero: { type: 'integer' }, letra: { type: 'string', description: 'Letra oficial (A a E). Vazio se anulada.' }, anulada: { type: 'boolean' } }, required: ['numero'] } },
      observacao: { type: 'string', description: 'Ex.: se é gabarito preliminar ou definitivo, ou se há mais de um tipo de prova.' },
    },
    required: ['respostas'],
  },
};

const TOOL_QUESTOES = {
  name: 'entregar_questoes',
  description: 'Questões separadas do texto da prova.',
  input_schema: {
    type: 'object',
    properties: {
      questoes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            numero: { type: 'integer' },
            enunciado: { type: 'string', description: 'Enunciado completo, fiel ao texto da prova.' },
            alternativas: { type: 'array', items: { type: 'string' }, description: 'Texto de cada alternativa na ordem A, B, C..., sem a letra.' },
            depende_de_imagem: { type: 'boolean', description: 'true se a questão cita figura, imagem, foto, ECG, radiografia ou tabela que não está no texto.' },
            area: { type: 'string' },
            subtema: { type: 'string' },
            comentario: { type: 'string', description: 'Comentário curto (3 a 6 frases) explicando por que a alternativa oficial está certa e as outras não.' },
            card_frente: { type: 'string', description: 'Pergunta curta com o fato principal da questão.' },
            card_verso: { type: 'string', description: 'Resposta curta.' },
          },
          required: ['numero', 'enunciado', 'alternativas'],
        },
      },
    },
    required: ['questoes'],
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'metodo' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return json(401, { error: 'login', message: 'Entre com sua conta.' });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: isAdmin } = await admin.from('admins').select('user_id').eq('user_id', who.user.id).maybeSingle();
  if (!isAdmin) return json(403, { error: 'admin', message: 'Só administradores podem importar provas.' });

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json(503, { error: 'sem_chave', message: 'A IA ainda não foi ligada no servidor.' });

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json(400, { error: 'corpo', message: 'Pedido inválido.' }); }

  try {
    if (body.action === 'gabarito') {
      const content: unknown[] = [];
      if (typeof body.pdf === 'string' && body.pdf) {
        if (body.pdf.length > 14_000_000) return json(413, { error: 'grande', message: 'O PDF do gabarito passa de 10 MB.' });
        content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: body.pdf } });
      } else if (typeof body.text === 'string' && body.text.trim()) {
        content.push({ type: 'text', text: `GABARITO:\n${body.text.slice(0, 60_000)}` });
      } else return json(400, { error: 'vazio', message: 'Envie o gabarito.' });
      const tipo = typeof body.tipo === 'string' && body.tipo.trim() ? ` Se houver mais de um tipo de prova (caderno, cor ou versão), use SOMENTE: ${body.tipo.slice(0, 40)}.` : '';
      content.push({ type: 'text', text: `Transcreva o gabarito oficial: para cada número de questão, a letra correta. Marque as anuladas.${tipo} Não deduza respostas: só o que está escrito no documento.` });
      const { input } = await claude(apiKey, 'Você transcreve gabaritos oficiais de provas de residência médica com exatidão absoluta.', content, TOOL_GABARITO, 8000);
      const respostas: Record<string, string> = {};
      const anuladas: number[] = [];
      for (const r of (input.respostas || []) as { numero: number; letra?: string; anulada?: boolean }[]) {
        const n = Number(r.numero);
        if (!Number.isInteger(n) || n < 1 || n > 400) continue;
        const letra = String(r.letra || '').trim().toUpperCase().slice(0, 1);
        if (r.anulada || !letra) anuladas.push(n);
        else if (LETRAS.includes(letra)) respostas[n] = letra;
      }
      return json(200, { respostas, anuladas: [...new Set(anuladas)].sort((a, b) => a - b), observacao: String(input.observacao || '').slice(0, 300) });
    }

    if (body.action === 'questoes') {
      const banca = String(body.banca || '').trim().slice(0, 60);
      const prova = String(body.prova || '').trim().slice(0, 120);
      const ano = Number(body.ano);
      const de = Number(body.de), ate = Number(body.ate);
      const texto = String(body.texto || '');
      const respostas: Record<string, string> = body.respostas || {};
      const anuladas = new Set<number>((body.anuladas || []).map(Number));
      if (!banca || !prova || !Number.isInteger(ano) || !Number.isInteger(de) || !Number.isInteger(ate) || ate < de || ate - de > 14) {
        return json(400, { error: 'dados', message: 'Preencha banca, prova e ano.' });
      }
      if (texto.length < 200) return json(400, { error: 'vazio', message: 'Não foi possível ler o texto da prova.' });

      const nums = Array.from({ length: ate - de + 1 }, (_, i) => de + i);
      const oficiais = nums.map((n) => `${n}: ${anuladas.has(n) ? 'ANULADA' : respostas[n] || 'sem gabarito'}`).join(', ');
      const system = `Você organiza questões de provas de residência médica do Brasil para um banco de questões.
- Copie enunciado e alternativas FIELMENTE do texto da prova, só corrigindo quebras de linha e hifenização da extração do PDF.
- NUNCA decida a resposta: a letra correta é a do gabarito oficial informado. Escreva o comentário justificando essa letra.
- Se a alternativa oficial parecer errada para você, ainda assim comente a oficial e não altere nada.
- Classifique em uma área e um subtema desta lista (use o id da área):
${LISTA_AREAS}`;
      const content = [
        { type: 'text', text: `TEXTO DA PROVA (${prova}):\n${texto.slice(0, 400_000)}` },
        { type: 'text', text: `Separe as questões de número ${de} a ${ate}. Gabarito oficial dessas questões: ${oficiais}. Para as anuladas ou sem gabarito, deixe o comentário vazio. Entregue pela ferramenta.` },
      ];
      const { input, truncated } = await claude(apiKey, system, content, TOOL_QUESTOES, 16000);

      const rows: Record<string, unknown>[] = [];
      for (const q of (input.questoes || []) as any[]) {
        const numero = Number(q.numero);
        if (!nums.includes(numero)) continue;
        const options = Array.isArray(q.alternativas) ? q.alternativas.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 8) : [];
        const stem = String(q.enunciado || '').trim();
        if (!stem || options.length < 2) continue;
        const letra = respostas[numero];
        const answer = letra ? LETRAS.indexOf(letra) : -1;
        const area = AREAS[q.area] ? q.area : 'clinica';
        const sub = String(q.subtema || '').trim().slice(0, 60) || AREAS[area][0];
        const needsImage = Boolean(q.depende_de_imagem);
        let status = 'publicada';
        if (anuladas.has(numero)) status = 'anulada';
        else if (answer < 0 || answer >= options.length || needsImage) status = 'rascunho';
        const front = String(q.card_frente || '').trim(), back = String(q.card_verso || '').trim();
        rows.push({
          banca, prova, ano, numero, area, sub, stem, options,
          answer: answer >= 0 && answer < options.length ? answer : null,
          explanation: status === 'anulada' ? null : String(q.comentario || '').trim().slice(0, 2000) || null,
          explanation_ai: true,
          fact: front && back ? { front: front.slice(0, 300), back: back.slice(0, 300) } : null,
          needs_image: needsImage,
          status,
          created_by: who.user.id,
          updated_at: new Date().toISOString(),
        });
      }
      if (rows.length) {
        const { error } = await admin.from('questions').upsert(rows, { onConflict: 'prova,ano,numero' });
        if (error) { console.error('upsert', error.message); return json(500, { error: 'banco', message: 'Não foi possível salvar as questões.' }); }
      }
      const achadas = new Set(rows.map((r) => r.numero as number));
      return json(200, {
        salvas: rows.length,
        publicadas: rows.filter((r) => r.status === 'publicada').length,
        rascunhos: rows.filter((r) => r.status === 'rascunho').map((r) => r.numero),
        anuladas: rows.filter((r) => r.status === 'anulada').map((r) => r.numero),
        nao_encontradas: nums.filter((n) => !achadas.has(n)),
        truncado: truncated,
      });
    }

    return json(400, { error: 'acao', message: 'Ação desconhecida.' });
  } catch (e) {
    return json(502, { error: 'ia', message: e instanceof Error ? e.message : 'Falha na IA.' });
  }
});
