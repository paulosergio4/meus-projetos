// Sinapse · importar-prova (só administradores)
// 1) action "gabarito": lê o gabarito oficial e devolve { respostas: { "1": "B", ... }, anuladas: [..] }
//    para o administrador conferir antes de importar.
// 2) action "questoes": recebe o texto da prova, uma faixa de números e o gabarito já conferido;
//    a IA separa enunciado e alternativas, classifica e comenta; A RESPOSTA VEM SEMPRE DO GABARITO.
// 5) action "casos": gera casos clínicos em etapas a partir de questões publicadas (rascunho).
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

// Garante área e subtema da lista do app (o subtema decide a área quando a IA erra a área).
const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
function classificar(areaIA: string, subIA: string): { area: string; sub: string } {
  const s = norm(subIA);
  const todas = Object.entries(AREAS).flatMap(([id, subs]) => subs.map((x) => ({ id, x })));
  const exata = todas.filter((t) => norm(t.x) === s);
  if (exata.length) return { area: (exata.find((t) => t.id === areaIA) || exata[0]).id, sub: (exata.find((t) => t.id === areaIA) || exata[0]).x };
  const parcial = todas.find((t) => s && (s.includes(norm(t.x)) || norm(t.x).includes(s)));
  if (parcial) return { area: parcial.id, sub: parcial.x };
  // Sem correspondência: mantém o texto da IA em vez de chutar um subtema errado.
  const area = AREAS[areaIA] ? areaIA : 'clinica';
  return { area, sub: subIA.trim().slice(0, 60) || 'Geral' };
}

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
  const u = out.usage || {};
  console.log('uso', JSON.stringify({ in: u.input_tokens, out: u.output_tokens, cache_escrita: u.cache_creation_input_tokens, cache_leitura: u.cache_read_input_tokens }));
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

// Flashcard do deck oficial: tem que fazer sentido sozinho, sem a questão ao lado.
const CARD_FRENTE = 'Flashcard autônomo: pergunta curta (até 150 caracteres) com o fato médico principal da questão. Não cite alternativas, letras, "a questão", "o caso acima" nem figuras.';
const CARD_VERSO = 'Resposta curta e autônoma (até 150 caracteres), sem letra de alternativa.';

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
            card_frente: { type: 'string', description: CARD_FRENTE },
            card_verso: { type: 'string', description: CARD_VERSO },
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
- Classifique em uma área e um subtema EXATAMENTE como escritos nesta lista (use o id da área; não invente subtemas):
${LISTA_AREAS}`;
      const content = [
        // Cache: o texto da prova é igual em todos os lotes; a partir do 2º lote a releitura custa 10%.
        { type: 'text', text: `TEXTO DA PROVA (${prova}):\n${texto.slice(0, 400_000)}`, cache_control: { type: 'ephemeral' } },
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
        const { area, sub } = classificar(String(q.area || ''), String(q.subtema || ''));
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
          fact: front && back ? { front: front.slice(0, 300), back: back.slice(0, 300), v: 2 } : null,
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

    // 4) action "cards": reescreve o flashcard de questões já publicadas para fazer sentido sozinho
    //    e grava direto no banco (fact v2). Recebe só os ids; lê o resto do banco.
    if (body.action === 'cards') {
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).slice(0, 20);
      if (!ids.length) return json(400, { error: 'dados', message: 'Sem questões.' });
      const { data: qs, error } = await admin.from('questions').select('id, stem, options, answer, explanation, sub').in('id', ids);
      if (error || !qs?.length) return json(400, { error: 'dados', message: 'Questões não encontradas.' });
      const lista = qs.filter((q: any) => q.answer != null && q.options?.[q.answer]).map((q: any, i: number) =>
        `### ${i + 1}\nSubtema: ${q.sub}\nEnunciado: ${String(q.stem).slice(0, 1500)}\nResposta certa: ${q.options[q.answer]}\nComentário: ${String(q.explanation || '').slice(0, 800)}`).join('\n\n');
      const tool = {
        name: 'entregar_cards',
        description: 'Um flashcard por questão, na mesma ordem.',
        input_schema: {
          type: 'object',
          properties: { cards: { type: 'array', items: { type: 'object', properties: { n: { type: 'integer', description: 'Número da questão na lista (### n).' }, frente: { type: 'string', description: CARD_FRENTE }, verso: { type: 'string', description: CARD_VERSO } }, required: ['n', 'frente', 'verso'] } } },
          required: ['cards'],
        },
      };
      const validas = qs.filter((q: any) => q.answer != null && q.options?.[q.answer]);
      const { input } = await claude(apiKey,
        `Você escreve flashcards de medicina em português do Brasil para revisão espaçada de residência médica.
Para cada questão, extraia o FATO MÉDICO de maior rendimento que ela cobra e escreva um card que faça sentido sozinho, sem a questão ao lado:
- A frente traz o contexto mínimo necessário (ex.: "Gestante com diabetes gestacional controlado com dieta: conduta?") e pede uma única coisa.
- O verso responde direto, com o conceito, não com a letra.
- Proibido citar alternativas, letras, "a questão", "o caso", "as opções", "a imagem" ou "a figura". Se a questão depende de uma imagem, escreva o fato que a imagem ilustra (ex.: achado clássico → diagnóstico).
- Use somente o que está no enunciado, na resposta certa e no comentário; não invente valores.`,
        [{ type: 'text', text: lista }, { type: 'text', text: 'Entregue um card para cada questão pela ferramenta.' }], tool, 6000);
      let gravados = 0;
      for (const c of (input.cards || []) as any[]) {
        const q = validas[Number(c.n) - 1];
        const front = String(c.frente || '').trim().slice(0, 300), back = String(c.verso || '').trim().slice(0, 300);
        if (!q || !front || !back) continue;
        const { error: e2 } = await admin.from('questions').update({ fact: { front, back, v: 2 } }).eq('id', q.id);
        if (!e2) gravados += 1;
      }
      return json(200, { gravados });
    }

    // 5) action "casos": transforma questões longas já publicadas em casos clínicos em etapas.
    //    Grava como rascunho em clinical_cases para o administrador revisar e publicar.
    if (body.action === 'casos') {
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).slice(0, 3);
      if (!ids.length) return json(400, { error: 'dados', message: 'Sem questões.' });
      const { data: qs, error } = await admin.from('questions').select('id, prova, ano, numero, area, sub, stem, options, answer, explanation').in('id', ids);
      if (error || !qs?.length) return json(400, { error: 'dados', message: 'Questões não encontradas.' });
      const validas = qs.filter((q: any) => q.answer != null && q.options?.[q.answer]);
      const lista = validas.map((q: any, i: number) =>
        `### ${i + 1}\nÁrea: ${q.area} · ${q.sub}\nEnunciado: ${String(q.stem).slice(0, 3000)}\nAlternativas: ${q.options.map((o: string, k: number) => `${LETRAS[k]}) ${o}`).join(' | ')}\nResposta oficial: ${LETRAS[q.answer]}) ${q.options[q.answer]}\nComentário: ${String(q.explanation || '').slice(0, 1500)}`).join('\n\n');
      const etapa = {
        type: 'object',
        properties: {
          info: { type: 'string', description: 'Nova informação revelada nesta etapa (exame físico, resultado de exame, evolução). Vazio na primeira etapa se a introdução já basta.' },
          pergunta: { type: 'string', description: 'Decisão que o aluno precisa tomar agora (próximo exame, diagnóstico, conduta, droga, via...).' },
          alternativas: { type: 'array', items: { type: 'string' }, description: 'Exatamente 5 alternativas plausíveis, sem letras.' },
          certa: { type: 'integer', description: 'Índice (0 a 4) da alternativa certa.' },
          explicacao: { type: 'string', description: 'Por que a certa é a melhor e por que as principais erradas não são. 1 a 3 frases.' },
        },
        required: ['info', 'pergunta', 'alternativas', 'certa', 'explicacao'],
      };
      const tool = {
        name: 'entregar_casos',
        description: 'Um caso clínico em etapas para cada questão, na mesma ordem.',
        input_schema: {
          type: 'object',
          properties: { casos: { type: 'array', items: { type: 'object', properties: {
            n: { type: 'integer', description: 'Número da questão na lista (### n).' },
            titulo: { type: 'string', description: 'Título curto e sem spoiler do diagnóstico (ex.: "Dor abdominal no idoso").' },
            introducao: { type: 'string', description: 'Apresentação inicial do paciente: idade, sexo, queixa, tempo de evolução, antecedentes relevantes, sinais vitais se houver. 2 a 4 frases.' },
            etapas: { type: 'array', items: etapa, description: '3 a 5 etapas em ordem cronológica de atendimento.' },
          }, required: ['n', 'titulo', 'introducao', 'etapas'] } } },
          required: ['casos'],
        },
      };
      const { input } = await claude(apiKey,
        `Você é professor de medicina e transforma questões de prova de residência em casos clínicos interativos em português do Brasil.
Para cada questão, monte um caso que se revela em etapas, como um atendimento real: apresentação → exame/investigação → diagnóstico → conduta (adapte à questão).
Regras:
- A etapa final (ou a mais importante) deve cobrar exatamente o ponto da questão original, com a mesma resposta oficial.
- Use os dados do enunciado. Você pode distribuí-los entre as etapas (ex.: o exame físico só aparece na etapa 2).
- Etapas extras só podem cobrar condutas consagradas e consistentes com o enunciado e o comentário; nada controverso, nada de valores inventados que mudem a conduta.
- Cada pergunta tem 5 alternativas plausíveis e uma só correta. Não use "todas/nenhuma das anteriores".
- O título não pode entregar o diagnóstico.
- Linguagem clara, frases curtas, sem citar "a questão", "a prova" ou letras.`,
        [{ type: 'text', text: lista }, { type: 'text', text: 'Entregue um caso para cada questão pela ferramenta.' }], tool, 8000);
      let gravados = 0;
      for (const c of (input.casos || []) as any[]) {
        const q = validas[Number(c.n) - 1];
        if (!q) continue;
        const stages = (Array.isArray(c.etapas) ? c.etapas : []).map((e: any) => ({
          info: String(e.info || '').trim().slice(0, 800),
          question: String(e.pergunta || '').trim().slice(0, 400),
          options: (Array.isArray(e.alternativas) ? e.alternativas : []).map((o: any) => String(o).trim().slice(0, 300)).filter(Boolean).slice(0, 5),
          answer: Number(e.certa),
          explanation: String(e.explicacao || '').trim().slice(0, 900),
        })).filter((e: any) => e.question && e.options.length >= 4 && Number.isInteger(e.answer) && e.answer >= 0 && e.answer < e.options.length);
        const title = String(c.titulo || '').trim().slice(0, 120), intro = String(c.introducao || '').trim().slice(0, 1500);
        if (stages.length < 2 || !title || !intro) continue;
        const source = `${q.prova}${String(q.prova).includes(String(q.ano)) ? '' : ` ${q.ano}`} · Q${q.numero}`;
        const { error: e2 } = await admin.from('clinical_cases').upsert({ question_id: q.id, area: q.area, sub: q.sub, title, intro, stages, source, status: 'rascunho', updated_at: new Date().toISOString() }, { onConflict: 'question_id' });
        if (!e2) gravados += 1; else console.error('caso', e2.message);
      }
      return json(200, { gravados });
    }

    // 3) action "figuras": recebe a foto de uma página da prova com as imagens do PDF marcadas em
    //    caixas numeradas e diz qual figura é de qual questão (ou a área, se a figura for desenhada).
    if (body.action === 'figuras') {
      const img = String(body.imagem || '');
      if (!img || img.length > 6_000_000) return json(400, { error: 'imagem', message: 'Página inválida.' });
      const qs = (Array.isArray(body.questoes) ? body.questoes : []).slice(0, 12).map((q: any) => ({
        numero: Number(q.numero), inicio: String(q.inicio || '').slice(0, 160), continua: Boolean(q.continua),
      })).filter((q: any) => Number.isInteger(q.numero));
      if (!qs.length) return json(400, { error: 'dados', message: 'Sem questões.' });
      const caixas = Number(body.caixas) || 0;
      const lista = qs.map((q: any) => `- Questão ${q.numero}${q.continua ? ' (começou na página anterior; aqui pode estar só o fim dela)' : ''}: começa com "${q.inicio}"`).join('\n');
      const content = [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } },
        {
          type: 'text',
          text: `Esta é uma página de prova de residência médica. ${caixas ? `As imagens embutidas no PDF estão marcadas com caixas vermelhas numeradas de 1 a ${caixas}.` : 'Não há imagens embutidas marcadas nesta página.'}
Questões que precisam de figura (foto, ECG, radiografia, tomografia, gráfico, tabela, esquema):
${lista}
Para cada questão, diga onde está a figura DELA nesta página:
- "caixas": os números das caixas vermelhas que são a figura dessa questão (pode ser mais de uma, ex.: imagens A e B).
- Se a figura existe na página mas não está em nenhuma caixa (tabela ou gráfico desenhado, ou a página é toda escaneada), deixe "caixas" vazio e dê "area" com x, y, largura e altura em frações da página (0 a 1, origem no canto superior esquerdo), cobrindo a figura inteira com legendas, sem pegar o texto das alternativas.
- Se a figura dessa questão não está nesta página, "encontrada": false.
Use a posição na página: a figura de uma questão fica entre o início dela e o início da próxima questão, normalmente logo após o enunciado. Não atribua a mesma caixa a duas questões. Entregue pela ferramenta.`,
        },
      ];
      const tool = {
        name: 'entregar_figuras',
        description: 'Onde está a figura de cada questão nesta página.',
        input_schema: {
          type: 'object',
          properties: {
            figuras: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  numero: { type: 'integer' },
                  encontrada: { type: 'boolean' },
                  caixas: { type: 'array', items: { type: 'integer' } },
                  area: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' } } },
                },
                required: ['numero', 'encontrada'],
              },
            },
          },
          required: ['figuras'],
        },
      };
      const { input } = await claude(apiKey, 'Você localiza figuras em páginas de provas médicas com precisão. Responda só pelo que vê na página.', content, tool, 1500);
      const nums = new Set(qs.map((q: any) => q.numero));
      const clamp = (v: unknown) => Math.max(0, Math.min(1, Number(v) || 0));
      const figuras = ((input.figuras || []) as any[]).filter((f) => nums.has(Number(f.numero))).map((f) => {
        const cx = (Array.isArray(f.caixas) ? f.caixas : []).map(Number).filter((n: number) => Number.isInteger(n) && n >= 1 && n <= caixas);
        const a = f.area && typeof f.area === 'object' ? { x: clamp(f.area.x), y: clamp(f.area.y), w: clamp(f.area.w), h: clamp(f.area.h) } : null;
        return { numero: Number(f.numero), encontrada: Boolean(f.encontrada) && (cx.length > 0 || Boolean(a && a.w > 0.03 && a.h > 0.02)), caixas: cx, area: cx.length ? null : a };
      });
      return json(200, { figuras });
    }

    return json(400, { error: 'acao', message: 'Ação desconhecida.' });
  } catch (e) {
    return json(502, { error: 'ia', message: e instanceof Error ? e.message : 'Falha na IA.' });
  }
});
