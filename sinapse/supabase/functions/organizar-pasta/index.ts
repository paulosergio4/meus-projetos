// Sinapse · organizar-pasta (só administradores)
// Recebe SÓ os nomes dos arquivos de uma pasta de provas e devolve a fila de importação:
// cada prova objetiva com o arquivo de gabarito (separado, no próprio PDF, ou nenhum).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const SISTEMA = `Você organiza uma pasta de provas de residência médica, Revalida e ENADE para importação num banco de questões de múltipla escolha.
Você recebe só os caminhos dos arquivos (pasta/nome). Monte a lista de provas OBJETIVAS a importar:
- Junte cada caderno de prova objetiva ao arquivo do seu gabarito. Siglas comuns: PV = prova, GB = gabarito, PO = prova objetiva, "padrão de respostas"/"PEP" = discursiva.
- Pule (em "ignorados") provas discursivas, de habilidades clínicas, padrões de resposta, espelhos, e arquivos que não são prova.
- Quando a mesma prova tem várias cores, versões ou cadernos com as MESMAS questões em ordem diferente, escolha UMA versão (de preferência a que tem gabarito em arquivo) e informe em "tipo" qual é (ex.: "cinza", "caderno 1", "versão 1"), para ler a coluna certa do gabarito. As outras vão para "ignorados" como versão repetida.
- Cadernos diferentes com questões diferentes (ex.: R+ Clínica Médica e R+ Cirurgia, ou prova 2 e prova 3) são provas separadas.
- Se não houver arquivo de gabarito para a prova, deixe "arquivo_gabarito" vazio: o sistema vai procurar o gabarito no fim do próprio PDF.
- "banca": instituição curta (USP, UNIFESP, UNICAMP, PSU-MG, INEP, ENARE...). Revalida e ENADE são do INEP.
- "prova": nome claro para o aluno, ex.: "USP 2026 · R+ Clínica Médica", "Revalida 2023.1", "PSU-MG 2025 · Acesso direto". Inclua o ano no nome.
- "ano": ano que aparece no nome do arquivo.
Use os caminhos EXATAMENTE como recebidos.`;

const TOOL = {
  name: 'entregar_fila',
  description: 'Fila de importação montada a partir dos nomes dos arquivos.',
  input_schema: {
    type: 'object',
    properties: {
      provas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            banca: { type: 'string' },
            prova: { type: 'string' },
            ano: { type: 'integer' },
            arquivo_prova: { type: 'string' },
            arquivo_gabarito: { type: 'string', description: 'Vazio se não houver arquivo de gabarito.' },
            tipo: { type: 'string', description: 'Cor, caderno ou versão escolhida; vazio se só houver uma.' },
          },
          required: ['banca', 'prova', 'ano', 'arquivo_prova'],
        },
      },
      ignorados: {
        type: 'array',
        items: { type: 'object', properties: { arquivo: { type: 'string' }, motivo: { type: 'string' } }, required: ['arquivo', 'motivo'] },
      },
    },
    required: ['provas'],
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
  if (!isAdmin) return json(403, { error: 'admin', message: 'Só administradores.' });
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json(503, { error: 'sem_chave', message: 'A IA ainda não foi ligada no servidor.' });

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json(400, { error: 'corpo', message: 'Pedido inválido.' }); }
  const arquivos: string[] = Array.isArray(body.arquivos) ? body.arquivos.map((x: unknown) => String(x).slice(0, 300)).slice(0, 600) : [];
  if (!arquivos.length) return json(400, { error: 'vazio', message: 'Nenhum PDF na pasta.' });
  const existe = new Set(arquivos);

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('AI_MODEL_ORGANIZAR') || Deno.env.get('AI_MODEL') || 'claude-haiku-5-5',
      max_tokens: 16000,
      system: SISTEMA,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'entregar_fila' },
      messages: [{ role: 'user', content: `ARQUIVOS DA PASTA (${arquivos.length}):\n${arquivos.join('\n')}` }],
    }),
  });
  if (!resp.ok) {
    console.error('anthropic', resp.status, (await resp.text()).slice(0, 400));
    return json(502, { error: 'ia', message: 'A IA não conseguiu organizar a pasta agora. Tente de novo.' });
  }
  const out = await resp.json();
  const input = ((out.content || []).find((b: { type: string }) => b.type === 'tool_use') || {}).input || {};

  const usados = new Set<string>();
  const provas = [];
  for (const p of (input.provas || []) as any[]) {
    const prova = String(p.arquivo_prova || '');
    if (!existe.has(prova) || usados.has(prova)) continue;
    const gab = existe.has(String(p.arquivo_gabarito || '')) ? String(p.arquivo_gabarito) : '';
    usados.add(prova);
    provas.push({
      banca: String(p.banca || '').slice(0, 60) || 'Outra',
      prova: String(p.prova || '').slice(0, 120) || prova,
      ano: Number.isInteger(p.ano) ? p.ano : Number(String(prova).match(/20\d\d/)?.[0]) || new Date().getFullYear(),
      arquivo_prova: prova,
      arquivo_gabarito: gab,
      tipo: String(p.tipo || '').slice(0, 40),
    });
  }
  const ignorados = ((input.ignorados || []) as any[]).filter((i) => existe.has(String(i.arquivo))).map((i) => ({ arquivo: String(i.arquivo), motivo: String(i.motivo || '').slice(0, 120) }));
  return json(200, { provas, ignorados });
});
