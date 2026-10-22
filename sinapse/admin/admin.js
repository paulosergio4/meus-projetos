// Painel de administração do Sinapse (para usar no computador).
// Mesma conta Google do app; só entra quem está na tabela de administradores.
import {
  loadCloud, signInWithGoogle, signOutCloud, currentSessionUser, checkIsAdmin,
  callImportarProva, adminQuestions, adminProvas, adminUpdateQuestion, adminDeleteQuestion,
  uploadQuestionImage, adminList, adminAdd, adminRemove, adminSearchQuestions, callOrganizarPasta, adminReports, adminResolveReport, adminOpenReportsCount, adminSubscribers, adminGrant, adminRevoke,
} from '../js/cloud.js';
import { extractPdfText, shrinkImage, fileToB64 } from '../js/tools.js';
import { AREAS } from '../js/data.js';

const root = document.getElementById('adm');
const LETTERS = 'ABCDEFGH';
const MAX_PDF = 10 * 1024 * 1024;
const APP_URL = new URL('../', location.href).href;

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const areaName = (id) => (AREAS.find((a) => a.id === id) || {}).name || id;

const ICONS = {
  upload: '<path d="M12 16V4m0 0l-5 5m5-5l5 5M4 20h16"/>',
  drafts: '<path d="M4 4h12l4 4v12H4z"/><path d="M8 12h8M8 16h5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
  out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  phone: '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M11 18.5h2"/>',
};
const icon = (n, s = 20) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;

const LOGO = `<svg class="brand-logo" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="120" class="logo-bg"/><path class="brand-line-track" d="M96 296 H176 L208 232 L256 360 L304 152 L336 296 H416" pathLength="100"/><path class="brand-line" d="M96 296 H176 L208 232 L256 360 L304 152 L336 296 H416" pathLength="100"/><circle class="brand-ring" cx="416" cy="296" r="30"/><circle class="brand-dot" cx="416" cy="296" r="30"/></svg>`;

let toastTimer = 0;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 4200);
}

const st = {
  phase: 'loading', // loading | login | denied | ready
  user: null,
  view: 'lote',
  imp: { step: 'form', banca: '', prova: '', ano: String(new Date().getFullYear() - 1), tipo: '', provaFile: null, gabFile: null, definitivo: false, gab: null, progress: null, summary: null },
  drafts: null,
  provas: null,
  q: { prova: '', area: '', text: '', page: 0, rows: null, count: 0, open: null, edit: null },
  admins: null,
  confirm: null,
  pasteTarget: null,
  subs: null,
  reports: null, reportsTab: 'aberto', openReports: 0, repEdit: null,
  lote: { step: 'pick', files: null, fila: null, ignorados: [], jaImportadas: new Set(), running: false, stop: false, log: [], startedAt: 0, totals: { provas: 0, publicadas: 0, rascunhos: 0 } },
};

// ---------- início ----------
async function boot() {
  const c = await loadCloud();
  if (!c) { st.phase = 'login'; render(); toast('Não foi possível conectar ao servidor.'); return; }
  st.user = await currentSessionUser();
  if (!st.user) { st.phase = 'login'; render(); return; }
  st.phase = (await checkIsAdmin()) ? 'ready' : 'denied';
  const v = (location.hash || '').slice(1);
  if (['acessos', 'lote', 'importar', 'relatos', 'rascunhos', 'questoes', 'provas', 'admins'].includes(v)) st.view = v;
  render();
  if (st.phase === 'ready') adminOpenReportsCount().then((n) => { st.openReports = n; render(); });
}

// ---------- telas ----------
function render() {
  if (st.phase === 'loading') { root.innerHTML = '<div class="adm-center"><p class="muted">Carregando…</p></div>'; return; }
  if (st.phase === 'login' || st.phase === 'denied') { root.innerHTML = viewLogin(); return; }
  const nav = [['lote', 'folder', 'Importar pasta'], ['importar', 'upload', 'Importar uma prova'], ['relatos', 'flag', 'Relatos'], ['rascunhos', 'drafts', 'Rascunhos'], ['questoes', 'list', 'Questões publicadas'], ['provas', 'book', 'Provas'], ['acessos', 'key', 'Acessos e assinantes'], ['admins', 'users', 'Administradores']];
  const m = st.user.user_metadata || {};
  root.innerHTML = `<aside class="adm-side">
      <div class="adm-brand">${LOGO}<span><strong>Sinapse</strong><small>Painel</small></span></div>
      <nav class="adm-nav">${nav.map(([v, ic, l]) => `<button class="${st.view === v ? 'on' : ''}" data-act="view" data-v="${v}">${icon(ic)} ${l}${v === 'relatos' && st.openReports ? `<span class="adm-badge">${st.openReports}</span>` : ''}</button>`).join('')}</nav>
      <div class="adm-me">
        <a class="adm-link" href="${APP_URL}" target="_blank" rel="noopener">${icon('phone', 18)} Abrir o app</a>
        <span class="muted small">${esc(m.full_name || m.name || '')}<br>${esc(st.user.email)}</span>
        <button class="btn ghost" data-act="logout">${icon('out', 18)} Sair</button>
      </div>
    </aside>
    <main class="adm-main">${({ acessos: viewAcessos, relatos: viewReports, lote: viewLote, importar: viewImport, rascunhos: viewDrafts, questoes: viewQuestions, provas: viewProvas, admins: viewAdmins })[st.view]()}</main>`;
}

function viewLogin() {
  const denied = st.phase === 'denied';
  return `<div class="adm-center"><section class="panel stack adm-login">
    <div class="adm-brand big">${LOGO}<span><strong>Sinapse</strong><small>Painel de administração</small></span></div>
    ${denied
      ? `<p>A conta <strong>${esc(st.user.email)}</strong> não é administradora.</p><p class="muted small">Peça para um administrador adicionar o seu e-mail em "Administradores".</p><button class="btn ghost big" data-act="logout">Sair e entrar com outra conta</button>`
      : `<p class="muted">Entre com a sua conta Google de administrador.</p><button class="btn google big" data-act="login"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg> Entrar com Google</button>`}
  </section></div>`;
}

function head(title, sub) {
  return `<header class="adm-head"><h1>${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</header>`;
}

// ----- importar prova -----
function dropZone(kind, file, title, hint) {
  return `<label class="adm-drop ${file ? 'has' : ''}" data-drop="${kind}">
    <span class="file-badge ${kind === 'gab' ? 'good' : ''}">${kind === 'gab' ? 'GAB' : 'PDF'}</span>
    <span class="stack-xs grow"><strong>${file ? esc(file.name) : title}</strong><span class="muted small">${file ? (file.pages ? `${file.pages} páginas lidas` : 'pronto') : hint}</span></span>
    <span class="btn ghost">${file ? 'Trocar' : 'Escolher'}</span>
    <input type="file" accept="application/pdf,.pdf" class="visually-hidden" data-file="${kind}">
  </label>`;
}

function gabNumbers(g) {
  return [...new Set([...Object.keys(g.respostas).map(Number), ...g.anuladas])].sort((a, b) => a - b);
}

function viewImport() {
  const s = st.imp;
  const h = head('Importar prova', 'Só prova já aplicada, com gabarito oficial definitivo. A resposta de cada questão vem do gabarito; a IA só separa o texto, classifica e comenta.');
  if (s.step === 'reading' || s.step === 'importing') {
    const p = s.progress || { done: 0, total: 1 };
    const pct = Math.round((p.done / Math.max(1, p.total)) * 100);
    return `${h}<section class="panel stack-sm adm-progress">
      <h2>${s.step === 'reading' ? 'Lendo o gabarito oficial…' : `Importando: ${p.done} de ${p.total} questões`}</h2>
      <span class="bar"><span class="fill violet" style="width:${pct}%"></span></span>
      <p class="muted small">${s.step === 'reading' ? 'Leva alguns segundos.' : 'A IA separa 10 questões por vez. Deixe esta aba aberta.'}</p>
    </section>`;
  }
  if (s.step === 'gabarito' && s.gab) {
    const nums = gabNumbers(s.gab);
    const anul = new Set(s.gab.anuladas);
    return `${h}<section class="panel stack-sm">
      <h2>Confira o gabarito oficial</h2>
      <p class="muted small">${nums.length} questões · ${anul.size} anuladas${s.gab.observacao ? ` · ${esc(s.gab.observacao)}` : ''}. Compare com o PDF; clique numa questão para trocar a letra (A → B → … → anulada).</p>
      <div class="gab-grid wide">${nums.map((n) => `<button class="gab-cell ${anul.has(n) ? 'anul' : ''}" data-act="gab-cycle" data-v="${n}"><span>${n}</span><strong>${anul.has(n) ? '✕' : esc(s.gab.respostas[n] || '?')}</strong></button>`).join('')}</div>
      <div class="row adm-actions"><button class="btn ghost" data-act="imp-back">Voltar</button><button class="btn primary" data-act="imp-run">Está certo, importar ${nums.length} questões</button></div>
    </section>`;
  }
  if (s.step === 'done' && s.summary) {
    const r = s.summary;
    return `${h}<section class="panel stack-sm">
      <h2>${esc(s.prova)} importada</h2>
      <p><strong>${r.publicadas}</strong> ${r.publicadas === 1 ? 'questão publicada' : 'questões publicadas'} no app.</p>
      ${r.rascunhos.length ? `<p>${r.rascunhos.length} em rascunho (imagem ou sem gabarito): ${r.rascunhos.join(', ')}. <button class="link-btn" data-act="view" data-v="rascunhos">Ver rascunhos</button></p>` : ''}
      ${r.anuladas.length ? `<p class="muted">Anuladas, fora do app: ${r.anuladas.join(', ')}.</p>` : ''}
      ${r.faltando.length ? `<p class="bad-ink">Não encontradas no texto do PDF: ${r.faltando.join(', ')}.</p>` : ''}
      ${r.erro ? `<p class="bad-ink">${esc(r.erro)}</p><button class="btn ghost" data-act="imp-resume">Continuar de onde parou</button>` : ''}
      <div class="row adm-actions"><button class="btn primary" data-act="imp-new">Importar outra prova</button></div>
    </section>`;
  }
  return `${h}<form class="panel stack adm-form" id="imp-form" novalidate>
    <div class="adm-grid-3">
      <label class="field">Banca ou instituição<input type="text" list="bancas" value="${esc(s.banca)}" placeholder="ENARE, AREMG, INEP…" data-imp="banca"></label>
      <label class="field">Nome da prova<input type="text" value="${esc(s.prova)}" placeholder="Ex.: ENARE 2025 · Acesso direto" data-imp="prova"></label>
      <label class="field">Ano<input type="number" min="2000" max="2100" value="${esc(s.ano)}" data-imp="ano"></label>
    </div>
    <datalist id="bancas">${['ENARE', 'AREMG', 'INEP', 'USP', 'SUS-SP', 'UNIFESP', 'UNICAMP', 'SES-DF', 'PSU-GO', 'UFRJ', 'HCPA'].map((b) => `<option value="${b}">`).join('')}</datalist>
    <label class="field">Tipo de caderno (opcional)<input type="text" value="${esc(s.tipo)}" placeholder="Se o gabarito tiver mais de um tipo ou cor de prova" data-imp="tipo"></label>
    <div class="adm-grid-2">
      ${dropZone('prova', s.provaFile, 'PDF da prova', 'Arraste aqui ou clique · caderno de questões')}
      ${dropZone('gab', s.gabFile, 'PDF do gabarito definitivo', 'Arraste aqui ou clique · depois dos recursos')}
    </div>
    <label class="switch-row"><span class="grow">É o gabarito <strong>definitivo</strong>, já com os recursos julgados</span><input type="checkbox" class="switch" data-imp="definitivo" ${s.definitivo ? 'checked' : ''}></label>
    <div class="row adm-actions"><button type="button" class="btn primary big" data-act="imp-read">Ler gabarito</button></div>
  </form>`;
}

async function setFile(kind, f) {
  if (!f) return;
  if (!/\.pdf$/i.test(f.name) && !/pdf$/i.test(f.type)) { toast('Escolha um arquivo PDF.'); return; }
  const s = st.imp;
  if (kind === 'gab') {
    if (f.size > MAX_PDF) { toast('O gabarito passa de 10 MB.'); return; }
    const b64 = await fileToB64(f);
    if (!b64) { toast('Não foi possível ler o arquivo.'); return; }
    s.gabFile = { name: f.name, size: f.size, b64 };
  } else {
    toast('Lendo o texto da prova…');
    try {
      const { text, pages } = await extractPdfText(await f.arrayBuffer());
      if (text.replace(/\[página \d+\]/g, '').trim().length < 500) { toast('Este PDF parece escaneado (sem texto). Use o PDF original da banca.'); return; }
      s.provaFile = { name: f.name, size: f.size, text, pages };
    } catch (e) { toast(e.message || 'Não foi possível ler o PDF.'); return; }
  }
  render();
}

async function runImport(startAt) {
  const s = st.imp;
  const nums = gabNumbers(s.gab);
  const first = startAt || nums[0];
  const last = nums[nums.length - 1];
  if (!startAt) s.summary = { publicadas: 0, rascunhos: [], anuladas: [], faltando: [], erro: '', next: null };
  s.summary.erro = '';
  s.step = 'importing';
  s.progress = { done: nums.filter((n) => n < first).length, total: nums.length };
  render();
  for (let de = first; de <= last; de += 10) {
    const ate = Math.min(last, de + 9);
    const body = { action: 'questoes', banca: s.banca.trim(), prova: s.prova.trim(), ano: Number(s.ano), de, ate, texto: s.provaFile.text, respostas: s.gab.respostas, anuladas: s.gab.anuladas };
    let r = null;
    for (let t = 0; t < 2 && !r; t += 1) {
      try { r = await callImportarProva(body); } catch (e) { if (t === 1) { s.summary.erro = `Parou nas questões ${de} a ${ate}: ${e.message}`; s.summary.next = de; } }
    }
    if (!r) break;
    s.summary.publicadas += r.publicadas;
    s.summary.rascunhos.push(...r.rascunhos);
    s.summary.anuladas.push(...r.anuladas);
    s.summary.faltando.push(...r.nao_encontradas.filter((n) => nums.includes(n)));
    s.progress.done = nums.filter((n) => n <= ate).length;
    render();
  }
  s.step = 'done';
  st.drafts = null;
  st.provas = null;
  render();
}

// ----- rascunhos -----
function load(key, fn) {
  if (st[`${key}Loading`]) return;
  st[`${key}Loading`] = true;
  fn().then((v) => { st[key] = v; }).catch(() => { st[key] = []; toast('Não foi possível carregar.'); })
    .finally(() => { st[`${key}Loading`] = false; render(); });
}

function questionBlock(q) {
  return `<p class="adm-stem">${esc(q.stem)}</p>
    <ol class="adm-opts">${q.options.map((o, i) => `<li class="${i === q.answer ? 'right' : ''}">${esc(o)}</li>`).join('')}</ol>`;
}

function viewDrafts() {
  const h = head('Rascunhos', 'Questões que precisam de imagem ou estão sem gabarito. Arraste a imagem para o quadro, ou clique no quadro e cole com Ctrl+V.');
  if (!st.drafts) { load('drafts', () => adminQuestions('rascunho')); return `${h}<p class="muted">Carregando…</p>`; }
  if (!st.drafts.length) return `${h}<div class="panel note">Nenhuma questão em rascunho.</div>`;
  return `${h}<div class="adm-cards">${st.drafts.map((q) => `<article class="panel stack-sm">
      <div class="row wrap gap-sm"><span class="tag">${esc(q.prova)} ${q.ano} · Q${q.numero}</span><span class="tag violet">${esc(areaName(q.area))} · ${esc(q.sub)}</span><span class="tag ${q.needs_image ? 'amber' : 'bad'}">${q.needs_image ? 'Precisa da imagem' : 'Sem gabarito'}</span></div>
      ${questionBlock(q)}
      ${q.needs_image ? imageZone(q) : ''}
      <div class="row adm-actions">
        <button class="btn ghost bad-ink" data-act="del" data-v="${q.id}">${icon('trash', 18)} ${st.confirm === q.id ? 'Clique de novo para apagar' : 'Apagar'}</button>
        <button class="btn good-solid" data-act="publish" data-v="${q.id}" ${q.answer == null ? 'disabled' : ''}>${icon('check', 18)} Publicar</button>
      </div>
    </article>`).join('')}</div>`;
}

function imageZone(q) {
  return `<div class="adm-drop img ${st.pasteTarget === q.id ? 'target' : ''}" data-drop-img="${q.id}" tabindex="0" aria-label="Imagem da questão ${q.numero}">
    ${q.image_url ? `<img src="${esc(q.image_url)}" alt="Imagem da questão ${q.numero}">` : `<span class="adm-drop-empty">${icon('image', 28)}<span>Arraste a imagem aqui, ou clique neste quadro e cole com Ctrl+V</span></span>`}
    <label class="btn ghost small">${q.image_url ? 'Trocar imagem' : 'Escolher arquivo'}<input type="file" accept="image/*" class="visually-hidden" data-img="${q.id}"></label>
  </div>`;
}

async function setImage(id, file) {
  if (!file || !/^image\//.test(file.type)) { toast('Escolha uma imagem.'); return; }
  toast('Enviando a imagem…');
  try {
    const url = await uploadQuestionImage(id, await shrinkImage(file));
    await adminUpdateQuestion(id, { image_url: url });
    for (const list of [st.drafts, st.q.rows]) (list || []).forEach((q) => { if (q.id === id) q.image_url = url; });
    if (st.q.edit && st.q.edit.id === id) st.q.edit.image_url = url;
    toast('Imagem adicionada.');
    render();
  } catch (e) {
    toast('Não foi possível enviar. Confira se o SQL das imagens foi rodado no Supabase.');
  }
}

// ----- questões publicadas -----
function viewQuestions() {
  const q = st.q;
  const h = head('Questões publicadas', 'Busque, corrija o texto e marque o comentário como revisado.');
  if (!st.provas) load('provas', adminProvas);
  if (!q.rows && !st.qLoading) searchQuestions();
  const pages = Math.max(1, Math.ceil(q.count / 50));
  return `${h}<div class="panel adm-filters">
      <label class="field">Prova<select data-qf="prova"><option value="">Todas</option>${(st.provas || []).map((p) => `<option value="${esc(`${p.prova}|${p.ano}`)}" ${q.prova === `${p.prova}|${p.ano}` ? 'selected' : ''}>${esc(p.prova)} ${p.ano}</option>`).join('')}</select></label>
      <label class="field">Área<select data-qf="area"><option value="">Todas</option>${AREAS.map((a) => `<option value="${a.id}" ${q.area === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
      <label class="field grow">Buscar no enunciado<input type="search" value="${esc(q.text)}" placeholder="Palavra do enunciado" data-qf="text"></label>
    </div>
    ${!q.rows ? '<p class="muted">Carregando…</p>' : !q.rows.length ? '<div class="panel note">Nenhuma questão encontrada.</div>' : `
    <p class="muted small">${q.count} ${q.count === 1 ? 'questão' : 'questões'}</p>
    <div class="adm-list">${q.rows.map((r) => q.open === r.id ? editor(q.edit) : `<button class="adm-row" data-act="q-open" data-v="${r.id}">
        <span class="tag">${esc(r.prova)} ${r.ano} · Q${r.numero}</span>
        <span class="grow clamp-2">${esc(r.stem)}</span>
        <span class="tag violet">${esc(areaName(r.area))}</span>
        <span class="tag ${r.explanation_ai === false ? 'good' : 'amber'}">${r.explanation_ai === false ? 'Revisada' : 'Comentário IA'}</span>
      </button>`).join('')}</div>
    ${pages > 1 ? `<div class="row adm-actions"><button class="btn ghost" data-act="q-page" data-v="${q.page - 1}" ${q.page === 0 ? 'disabled' : ''}>Anterior</button><span class="muted">Página ${q.page + 1} de ${pages}</span><button class="btn ghost" data-act="q-page" data-v="${q.page + 1}" ${q.page >= pages - 1 ? 'disabled' : ''}>Próxima</button></div>` : ''}`}`;
}

function editor(e) {
  const subs = (AREAS.find((a) => a.id === e.area) || AREAS[0]).subtemas;
  return `<article class="panel stack-sm adm-editor">
    <div class="row wrap gap-sm"><span class="tag">${esc(e.prova)} ${e.ano} · Q${e.numero}</span><span class="grow"></span><button class="btn ghost" data-act="q-close">Fechar</button></div>
    <div class="adm-grid-2">
      <label class="field">Área<select data-ed="area">${AREAS.map((a) => `<option value="${a.id}" ${e.area === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
      <label class="field">Subtema<select data-ed="sub">${(subs.includes(e.sub) ? subs : [e.sub, ...subs]).map((s) => `<option ${e.sub === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
    </div>
    <label class="field">Enunciado<textarea rows="7" data-ed="stem">${esc(e.stem)}</textarea></label>
    ${e.options.map((o, i) => `<label class="field adm-opt ${i === e.answer ? 'right' : ''}"><span>Alternativa ${LETTERS[i]}${i === e.answer ? ' · resposta do gabarito' : ''}</span><textarea rows="2" data-ed-opt="${i}">${esc(o)}</textarea></label>`).join('')}
    <label class="field">Resposta (gabarito oficial)<select data-ed="answer">${e.options.map((_, i) => `<option value="${i}" ${i === e.answer ? 'selected' : ''}>${LETTERS[i]}</option>`).join('')}</select><small class="muted">Só mude se o gabarito definitivo foi corrigido pela banca.</small></label>
    <label class="field">Comentário<textarea rows="6" data-ed="explanation">${esc(e.explanation || '')}</textarea></label>
    <label class="switch-row"><span class="grow">Comentário <strong>revisado</strong> (tira o aviso "gerado por IA" no app)</span><input type="checkbox" class="switch" data-ed="reviewed" ${e.explanation_ai === false ? 'checked' : ''}></label>
    ${imageZone(e)}
    <div class="row adm-actions">
      <button class="btn ghost" data-act="q-draft">Voltar para rascunho</button>
      <button class="btn primary" data-act="q-save">${icon('check', 18)} Salvar</button>
    </div>
  </article>`;
}

let searchTimer = 0;
function searchQuestions() {
  const q = st.q;
  st.qLoading = true;
  adminSearchQuestions({ prova: q.prova, area: q.area, text: q.text.trim(), from: q.page * 50, size: 50 })
    .then(({ rows, count }) => { q.rows = rows; q.count = count; })
    .catch(() => { q.rows = []; q.count = 0; toast('Não foi possível buscar.'); })
    .finally(() => { st.qLoading = false; render(); });
}

// ----- provas -----
function viewProvas() {
  const h = head('Provas', 'Tudo o que já foi importado.');
  if (!st.provas) { load('provas', adminProvas); return `${h}<p class="muted">Carregando…</p>`; }
  if (!st.provas.length) return `${h}<div class="panel note">Nenhuma prova importada ainda.</div>`;
  return `${h}<div class="panel"><table class="adm-table"><thead><tr><th>Prova</th><th>Banca</th><th>Ano</th><th>Publicadas</th><th>Rascunhos</th><th>Anuladas</th><th></th></tr></thead><tbody>
    ${st.provas.map((p) => `<tr><td><strong>${esc(p.prova)}</strong></td><td>${esc(p.banca)}</td><td>${p.ano}</td><td>${p.publicada}</td><td>${p.rascunho || '—'}</td><td>${p.anulada || '—'}</td>
      <td><button class="link-btn" data-act="see-prova" data-v="${esc(`${p.prova}|${p.ano}`)}">Ver questões</button></td></tr>`).join('')}
  </tbody></table></div>`;
}

// ----- administradores -----
function viewAdmins() {
  const h = head('Administradores', 'Quem pode entrar neste painel e no banco de questões do app.');
  if (!st.admins) { load('admins', adminList); return `${h}<p class="muted">Carregando…</p>`; }
  return `${h}<div class="panel stack-sm">
      ${st.admins.map((a) => `<div class="row adm-admin"><span class="avatar sm">${esc((a.name || a.email || '?').trim().charAt(0).toUpperCase())}</span><span class="stack-xs grow"><strong>${esc(a.name || a.email)}</strong><span class="muted small">${esc(a.email)}</span></span>
        ${a.user_id === st.user.id ? '<span class="tag">Você</span>' : `<button class="btn ghost bad-ink" data-act="adm-remove" data-v="${a.user_id}">${st.confirm === a.user_id ? 'Clique de novo para remover' : 'Remover'}</button>`}</div>`).join('')}
    </div>
    <form class="panel stack-sm" id="add-admin" novalidate>
      <h2>Adicionar administrador</h2>
      <p class="muted small">A pessoa precisa ter entrado no app pelo menos uma vez com a conta Google desse e-mail.</p>
      <div class="row gap-sm"><input type="email" id="new-admin" class="grow" placeholder="email@gmail.com" autocomplete="off"><button class="btn primary" type="submit">Adicionar</button></div>
    </form>`;
}

// ----- acessos e assinantes -----
const PLAN_LABEL = { pro: 'Pro', residencia: 'Residência', gratis: 'Grátis' };

function viewAcessos() {
  const h = head('Acessos e assinantes', 'Libere o app sem pagar para quem você quiser (cortesia, monitores, parceiros) e veja quem está pagando.');
  const form = `<form class="panel stack-sm" id="grant" novalidate>
    <h2>Liberar acesso sem pagar</h2>
    <p class="muted small">A pessoa precisa ter entrado no app pelo menos uma vez com a conta Google desse e-mail.</p>
    <div class="adm-grid-3 grant">
      <label class="field">E-mail<input type="email" id="g-email" placeholder="email@gmail.com" autocomplete="off"></label>
      <label class="field">Plano<select id="g-plan"><option value="residencia">Residência (tudo)</option><option value="pro">Pro</option></select></label>
      <label class="field">Por quanto tempo<select id="g-time" data-gtime="1"><option value="sem">Sem prazo</option><option value="1">1 mês</option><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option><option value="data">Até uma data…</option></select></label>
    </div>
    <div class="adm-grid-2"><label class="field" id="g-date-wrap" hidden>Até o dia<input type="date" id="g-date"></label><label class="field">Observação (opcional)<input type="text" id="g-note" placeholder="Ex.: cortesia, monitora, parceria"></label></div>
    <div class="row adm-actions"><button class="btn primary" type="submit">${icon('key', 18)} Liberar acesso</button></div>
  </form>`;
  if (!st.subs) { load('subs', adminSubscribers); return `${h}${form}<p class="muted">Carregando…</p>`; }
  const now = Date.now();
  const rows = st.subs.map((u) => {
    const exp = u.valid_until ? new Date(u.valid_until) : null;
    const vencido = exp && exp.getTime() < now;
    return `<tr><td><strong>${esc(u.name || u.email)}</strong><br><span class="muted small">${esc(u.email)}</span></td>
      <td>${PLAN_LABEL[u.plan] || u.plan}</td>
      <td><span class="tag ${u.source === 'pagamento' ? 'good' : 'violet'}">${u.source === 'pagamento' ? 'Pagante' : 'Liberado'}</span>${u.auto_renew ? ' <span class="tag amber">Renova no cartão</span>' : ''}</td>
      <td>${exp ? `<span class="${vencido ? 'bad-ink' : ''}">${vencido ? 'Venceu em ' : ''}${exp.toLocaleDateString('pt-BR')}</span>` : 'Sem prazo'}</td>
      <td class="muted small">${esc(u.note || '')}</td>
      <td>${u.source === 'pagamento' ? '' : `<button class="link-btn bad-ink" data-act="revoke" data-v="${u.user_id}">${st.confirm === u.user_id ? 'Clique de novo' : 'Revogar'}</button>`}</td></tr>`;
  }).join('');
  return `${h}${form}<section class="panel stack-sm"><h2>Quem tem plano</h2>
    ${st.subs.length ? `<table class="adm-table"><thead><tr><th>Pessoa</th><th>Plano</th><th>Origem</th><th>Válido até</th><th>Observação</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="muted">Ninguém com plano ainda.</p>'}
  </section>`;
}

// ----- relatos de erro -----
const REASON_LABEL = { gabarito: 'Gabarito errado', enunciado: 'Enunciado/alternativas', comentario: 'Comentário', imagem: 'Imagem', outro: 'Outro' };

function viewReports() {
  const h = head('Relatos de erro', 'O que os alunos reportaram nas questões e nos cards. Corrija a questão aqui mesmo e marque como resolvido.');
  const tabs = `<div class="segmented three adm-tabs-sm" role="group">${[['aberto', 'Abertos'], ['resolvido', 'Resolvidos'], ['descartado', 'Descartados']].map(([v, l]) => `<button type="button" class="${st.reportsTab === v ? 'on' : ''}" data-act="rep-tab" data-v="${v}">${l}</button>`).join('')}</div>`;
  if (!st.reports) { load('reports', () => adminReports(st.reportsTab)); return `${h}${tabs}<p class="muted">Carregando…</p>`; }
  if (!st.reports.length) return `${h}${tabs}<div class="panel note">${st.reportsTab === 'aberto' ? 'Nenhum relato aberto.' : 'Nada por aqui.'}</div>`;
  return `${h}${tabs}<div class="adm-list">${st.reports.map((r) => {
    const q = r.questions;
    const editing = st.repEdit === r.id && st.q.edit;
    return `<article class="panel stack-sm">
      <div class="row wrap gap-sm"><span class="tag bad">${REASON_LABEL[r.reason] || r.reason}</span>${q ? `<span class="tag">${esc(q.prova)} ${q.ano} · Q${q.numero}</span>` : `<span class="tag">${esc(r.ref || 'Card')}</span>`}<span class="grow"></span><span class="muted small">${new Date(r.created_at).toLocaleString('pt-BR')}</span></div>
      ${r.message ? `<p class="adm-msg">“${esc(r.message)}”</p>` : '<p class="muted small">Sem descrição.</p>'}
      ${editing ? editor(st.q.edit) : q ? `${questionBlock(q)}${q.explanation ? `<p class="muted small"><strong>Comentário:</strong> ${esc(q.explanation)}</p>` : ''}` : r.ref_text ? `<p class="adm-stem">${esc(r.ref_text)}</p>` : ''}
      ${st.reportsTab === 'aberto' && !editing ? `<div class="row adm-actions">
        ${q ? `<button class="btn ghost" data-act="rep-edit" data-v="${r.id}">Corrigir questão</button>` : ''}
        <button class="btn ghost" data-act="rep-set" data-v="${r.id}|descartado">Descartar</button>
        <button class="btn good-solid" data-act="rep-set" data-v="${r.id}|resolvido">${icon('check', 18)} Resolvido</button>
      </div>` : ''}
    </article>`;
  }).join('')}</div>`;
}

// ----- importar pasta inteira -----
const LOTE_KEY = 'sinapse:lote';
const loteSaved = () => { try { return JSON.parse(localStorage.getItem(LOTE_KEY) || '{}'); } catch (e) { return {}; } };
const loteSave = (map) => { try { localStorage.setItem(LOTE_KEY, JSON.stringify(map)); } catch (e) { /* sem armazenamento */ } };
const fmtMin = (ms) => { const m = Math.round(ms / 60000); return m < 1 ? 'menos de 1 min' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };

function viewLote() {
  const L = st.lote;
  const h = head('Importar pasta inteira', 'Escolha a pasta das provas baixada do Drive. A IA junta cada prova ao seu gabarito oficial, importa tudo sozinha e deixa em rascunho as questões que precisam de imagem.');
  if (L.step === 'pick') {
    return `${h}<label class="adm-drop big-drop" for="lote-dir">
        <span class="adm-drop-empty">${icon('folder', 36)}<strong>Escolher a pasta</strong><span>No Drive: botão direito na pasta → Fazer download. Descompacte e escolha a pasta aqui.</span></span>
        <input id="lote-dir" type="file" webkitdirectory directory multiple class="visually-hidden" data-lote-dir="1">
      </label>
      <div class="panel note"><strong>Regras automáticas:</strong> só provas objetivas; a resposta vem do gabarito oficial (arquivo separado ou no fim do PDF); prova sem gabarito ou com gabarito preliminar fica de fora; anuladas não entram; prova já importada é pulada.</div>`;
  }
  if (L.step === 'organizing') return `${h}<section class="panel stack-sm adm-progress"><h2>Organizando ${L.files.size} PDFs…</h2><span class="bar"><span class="fill violet indeterminate"></span></span><p class="muted small">A IA está lendo os nomes dos arquivos e juntando prova com gabarito.</p></section>`;
  const fila = L.fila || [];
  const saved = loteSaved();
  const done = fila.filter((j) => j.status === 'ok').length;
  const pend = fila.filter((j) => !['ok', 'pulada', 'erro'].includes(j.status)).length;
  const elapsed = L.startedAt ? Date.now() - L.startedAt : 0;
  const processed = fila.filter((j) => ['ok', 'pulada', 'erro'].includes(j.status) && j.ranNow).length;
  const eta = L.running && processed ? (elapsed / processed) * pend : 0;
  const statusTag = (j) => ({ fila: '<span class="tag">Na fila</span>', lendo: '<span class="tag violet">Lendo…</span>', gabarito: '<span class="tag violet">Lendo gabarito…</span>', importando: `<span class="tag violet">Importando ${j.done || 0}/${j.total || '?'}</span>`, ok: `<span class="tag good">${j.pub} publicadas${j.ras ? ` · ${j.ras} rascunho` : ''}</span>`, pulada: `<span class="tag amber">${esc(j.motivo)}</span>`, erro: `<span class="tag bad">${esc(j.motivo)}</span>` })[j.status] || '';
  return `${h}<section class="panel stack-sm">
      <div class="row wrap gap-sm"><h2 class="grow">${fila.length} provas objetivas encontradas</h2>
        ${L.running ? `<span class="muted small">${fmtMin(elapsed)} rodando${eta ? ` · faltam ~${fmtMin(eta)}` : ''}</span><button class="btn ghost" data-act="lote-stop" ${L.stop ? 'disabled' : ''}>${L.stop ? 'Parando…' : 'Pausar'}</button>`
          : pend ? `<button class="btn primary" data-act="lote-run">${icon('upload', 18)} Importar ${pend} ${pend === 1 ? 'prova' : 'provas'}</button>` : '<span class="tag good">Concluído</span>'}
        ${L.running ? '' : '<button class="btn ghost" data-act="lote-reset">Escolher outra pasta</button>'}</div>
      <p class="muted small">${done} importadas · ${L.totals.publicadas} questões publicadas · ${L.totals.rascunhos} em rascunho${Object.keys(saved).length ? ' · o progresso fica salvo neste computador' : ''}</p>
      <div class="adm-list">${fila.map((j) => `<div class="adm-row static"><span class="stack-xs grow"><strong>${esc(j.prova)}</strong><span class="muted small">${esc(j.arquivo_prova)}${j.arquivo_gabarito ? ` + ${esc(j.arquivo_gabarito.split('/').pop())}` : ' · gabarito: procurar no próprio PDF'}${j.tipo ? ` · ${esc(j.tipo)}` : ''}</span></span>${statusTag(j)}</div>`).join('')}</div>
    </section>
    ${L.ignorados.length ? `<details class="panel"><summary><strong>${L.ignorados.length} ${L.ignorados.length === 1 ? 'arquivo ignorado' : 'arquivos ignorados'}</strong> <span class="muted small">(discursivas, habilidades clínicas, versões repetidas…)</span></summary><ul class="adm-ign">${L.ignorados.map((i) => `<li><span>${esc(i.arquivo)}</span><span class="muted small">${esc(i.motivo)}</span></li>`).join('')}</ul></details>` : ''}`;
}

async function loteOrganize(fileList) {
  const L = st.lote;
  const files = new Map();
  for (const f of fileList) if (/\.pdf$/i.test(f.name)) files.set(f.webkitRelativePath || f.name, f);
  if (!files.size) { toast('Nenhum PDF nessa pasta.'); return; }
  L.files = files;
  L.step = 'organizing';
  render();
  try {
    const [org, provas] = await Promise.all([callOrganizarPasta([...files.keys()]), adminProvas().catch(() => [])]);
    const ja = new Set(provas.filter((p) => p.publicada + p.rascunho > 0).map((p) => `${p.prova}|${p.ano}`));
    const saved = loteSaved();
    L.fila = org.provas.map((p) => {
      const key = p.arquivo_prova;
      const prev = saved[key];
      if (prev && prev.status === 'ok') return { ...p, ...prev };
      if (ja.has(`${p.prova}|${p.ano}`)) return { ...p, status: 'pulada', motivo: 'Já importada' };
      return { ...p, status: 'fila' };
    });
    L.ignorados = org.ignorados || [];
    L.totals = { provas: 0, publicadas: L.fila.reduce((a, j) => a + (j.pub || 0), 0), rascunhos: L.fila.reduce((a, j) => a + (j.ras || 0), 0) };
    L.step = 'list';
  } catch (e) {
    L.step = 'pick';
    toast(e.message);
  }
  render();
}

function pagesOf(text) {
  return text.split(/\[página \d+\]\n?/).filter((x) => x.trim());
}

async function loteJob(j) {
  const L = st.lote;
  const file = L.files.get(j.arquivo_prova);
  j.ranNow = true;
  j.status = 'lendo'; render();
  let text;
  try { ({ text } = await extractPdfText(await file.arrayBuffer())); } catch (e) { j.status = 'erro'; j.motivo = 'Não abriu o PDF'; return; }
  if (text.replace(/\[página \d+\]/g, '').trim().length < 800) { j.status = 'erro'; j.motivo = 'PDF escaneado (sem texto)'; return; }

  // Gabarito oficial: arquivo separado ou as últimas páginas do próprio PDF (só se falarem em gabarito).
  j.status = 'gabarito'; render();
  let gab;
  try {
    if (j.arquivo_gabarito) {
      const gf = L.files.get(j.arquivo_gabarito);
      if (gf.size > MAX_PDF) { j.status = 'erro'; j.motivo = 'Gabarito com mais de 10 MB'; return; }
      gab = await callImportarProva({ action: 'gabarito', pdf: await fileToB64(gf), tipo: j.tipo || '' });
    } else {
      const tail = pagesOf(text).slice(-8).join('\n');
      if (!/gabarito/i.test(tail)) { j.status = 'pulada'; j.motivo = 'Sem gabarito oficial'; return; }
      gab = await callImportarProva({ action: 'gabarito', text: tail, tipo: j.tipo || '' });
    }
  } catch (e) { j.status = 'erro'; j.motivo = e.message.slice(0, 60); return; }
  const nums = [...new Set([...Object.keys(gab.respostas).map(Number), ...gab.anuladas])].sort((a, b) => a - b);
  if (nums.length < 5) { j.status = 'pulada'; j.motivo = 'Sem gabarito oficial'; return; }
  if (/prelimin/i.test(gab.observacao || '') && !/definitiv/i.test(gab.observacao || '')) { j.status = 'pulada'; j.motivo = 'Gabarito preliminar'; return; }

  // Questões em lotes de 10, três ao mesmo tempo.
  j.status = 'importando'; j.total = nums.length; j.done = 0; j.pub = 0; j.ras = 0; render();
  const chunks = [];
  for (let i = 0; i < nums.length; i += 10) chunks.push(nums.slice(i, i + 10));
  let falhas = 0;
  const runChunk = async () => {
    const c = chunks.shift();
    const body = { action: 'questoes', banca: j.banca, prova: j.prova, ano: j.ano, de: c[0], ate: c[c.length - 1], texto: text, respostas: gab.respostas, anuladas: gab.anuladas };
    let r = null;
    for (let t = 0; t < 2 && !r; t += 1) { try { r = await callImportarProva(body); } catch (e) { if (t === 1) falhas += 1; } }
    if (r) { j.pub += r.publicadas; j.ras += r.rascunhos.length; L.totals.publicadas += r.publicadas; L.totals.rascunhos += r.rascunhos.length; }
    j.done += c.length;
    render();
  };
  const worker1 = async () => { if (chunks.length && !L.stop) await runChunk(); };
  const worker = async () => { while (chunks.length && !L.stop) await runChunk(); };
  // O 1º lote vai sozinho para a IA guardar a prova no cache; os outros aproveitam em paralelo.
  await worker1();
  await Promise.all([worker(), worker(), worker()]);
  if (L.stop && chunks.length) { j.status = 'fila'; return; }
  j.status = falhas && !j.pub ? 'erro' : 'ok';
  if (j.status === 'erro') j.motivo = 'Falhou na importação';
  else if (falhas) j.motivo = `${falhas} lote(s) falharam`;
}

async function loteRun() {
  const L = st.lote;
  L.running = true; L.stop = false; L.startedAt = Date.now();
  render();
  for (const j of L.fila) {
    if (L.stop) break;
    if (j.status !== 'fila') continue;
    await loteJob(j);
    if (['ok', 'pulada', 'erro'].includes(j.status)) {
      const saved = loteSaved();
      saved[j.arquivo_prova] = { status: j.status, pub: j.pub || 0, ras: j.ras || 0, motivo: j.motivo || '' };
      loteSave(saved);
    }
    render();
  }
  L.running = false; L.stop = false;
  st.drafts = null; st.provas = null;
  render();
  toast(L.fila.some((j) => j.status === 'fila') ? 'Importação pausada.' : 'Importação concluída.');
}

// ---------- eventos ----------
const actions = {
  revoke: async (uid) => {
    if (st.confirm !== uid) { st.confirm = uid; render(); return; }
    st.confirm = null;
    try { await adminRevoke(uid); toast('Acesso revogado. A pessoa volta ao Grátis.'); } catch (e) { toast(e.message); return; }
    st.subs = null;
    render();
  },
  'rep-tab': (v) => { st.reportsTab = v; st.reports = null; st.repEdit = null; st.q.edit = null; render(); },
  'rep-edit': (id) => {
    const r = st.reports.find((x) => x.id === id);
    st.repEdit = id;
    st.q.open = null;
    st.q.edit = JSON.parse(JSON.stringify(r.questions));
    render();
  },
  'rep-set': async (v) => {
    const [id, status] = v.split('|');
    try { await adminResolveReport(id, status); } catch (e) { toast('Não foi possível atualizar.'); return; }
    st.reports = st.reports.filter((r) => r.id !== id);
    st.openReports = Math.max(0, st.openReports - 1);
    toast(status === 'resolvido' ? 'Relato resolvido.' : 'Relato descartado.');
    render();
  },
  'lote-run': () => { if (!st.lote.running) loteRun(); },
  'lote-stop': () => { st.lote.stop = true; render(); },
  'lote-reset': () => { Object.assign(st.lote, { step: 'pick', files: null, fila: null, ignorados: [] }); render(); },
  login: async () => {
    try { localStorage.setItem('sinapse:goAdmin', String(Date.now())); } catch (e) { /* segue */ }
    try { await signInWithGoogle(APP_URL); } catch (e) { toast(e.message); }
  },
  logout: async () => { await signOutCloud().catch(() => {}); st.user = null; st.phase = 'login'; render(); },
  view: (v) => { st.view = v; st.confirm = null; if (v === 'acessos') st.subs = null; if (v === 'relatos') { st.reports = null; st.repEdit = null; } history.replaceState(null, '', `#${v}`); if (v === 'rascunhos') st.drafts = null; if (v === 'provas') st.provas = null; if (v === 'admins') st.admins = null; render(); window.scrollTo(0, 0); },
  'imp-read': async () => {
    const s = st.imp;
    if (!s.banca.trim() || !s.prova.trim() || !/^\d{4}$/.test(String(s.ano))) { toast('Preencha banca, nome da prova e ano.'); return; }
    if (!s.provaFile) { toast('Escolha o PDF da prova.'); return; }
    if (!s.gabFile) { toast('Escolha o PDF do gabarito.'); return; }
    if (!s.definitivo) { toast('Confirme que é o gabarito definitivo. Questões sem gabarito oficial não entram.'); return; }
    s.step = 'reading';
    render();
    try { s.gab = await callImportarProva({ action: 'gabarito', pdf: s.gabFile.b64, tipo: s.tipo }); s.step = 'gabarito'; } catch (e) { s.step = 'form'; toast(e.message); }
    render();
  },
  'gab-cycle': (v) => {
    const g = st.imp.gab;
    const n = Number(v);
    const order = ['A', 'B', 'C', 'D', 'E', 'X'];
    const cur = g.anuladas.includes(n) ? 'X' : (g.respostas[n] || 'X');
    const next = order[(order.indexOf(cur) + 1) % order.length];
    g.anuladas = g.anuladas.filter((x) => x !== n);
    delete g.respostas[n];
    if (next === 'X') g.anuladas.push(n); else g.respostas[n] = next;
    render();
  },
  'imp-back': () => { st.imp.step = 'form'; render(); },
  'imp-run': () => runImport(),
  'imp-resume': () => runImport(st.imp.summary.next),
  'imp-new': () => { Object.assign(st.imp, { step: 'form', prova: '', tipo: '', provaFile: null, gabFile: null, definitivo: false, gab: null, summary: null, progress: null }); render(); },
  publish: async (id) => {
    try { await adminUpdateQuestion(id, { status: 'publicada' }); } catch (e) { toast('Não foi possível publicar.'); return; }
    st.drafts = st.drafts.filter((q) => q.id !== id);
    toast('Questão publicada.');
    render();
  },
  del: async (id) => {
    if (st.confirm !== id) { st.confirm = id; render(); return; }
    st.confirm = null;
    try { await adminDeleteQuestion(id); } catch (e) { toast('Não foi possível apagar.'); return; }
    st.drafts = st.drafts.filter((q) => q.id !== id);
    toast('Questão apagada.');
    render();
  },
  'q-open': (id) => { const r = st.q.rows.find((x) => x.id === id); st.q.open = id; st.q.edit = JSON.parse(JSON.stringify(r)); render(); },
  'q-close': () => { st.q.open = null; st.q.edit = null; st.repEdit = null; render(); },
  'q-page': (v) => { st.q.page = Math.max(0, Number(v)); st.q.rows = null; render(); },
  'q-save': async () => {
    const e = st.q.edit;
    const options = e.options.map((o) => o.trim());
    if (!e.stem.trim() || options.some((o) => !o)) { toast('Enunciado e alternativas não podem ficar vazios.'); return; }
    const patch = { area: e.area, sub: e.sub, stem: e.stem.trim(), options, answer: Number(e.answer), explanation: (e.explanation || '').trim() || null, explanation_ai: e.explanation_ai !== false };
    try { await adminUpdateQuestion(e.id, patch); } catch (err) { toast('Não foi possível salvar.'); return; }
    const i = (st.q.rows || []).findIndex((x) => x.id === e.id);
    if (i >= 0) st.q.rows[i] = { ...st.q.rows[i], ...patch };
    for (const r of st.reports || []) if (r.questions && r.questions.id === e.id) r.questions = { ...r.questions, ...patch };
    st.repEdit = null;
    st.q.open = null;
    st.q.edit = null;
    toast('Questão salva. No app, aparece na próxima abertura.');
    render();
  },
  'q-draft': async () => {
    const e = st.q.edit;
    try { await adminUpdateQuestion(e.id, { status: 'rascunho' }); } catch (err) { toast('Não foi possível mudar.'); return; }
    st.q.rows = (st.q.rows || []).filter((x) => x.id !== e.id);
    st.q.count = Math.max(0, st.q.count - 1);
    st.repEdit = null;
    st.q.open = null;
    st.q.edit = null;
    st.drafts = null;
    toast('A questão saiu do app e foi para os rascunhos.');
    render();
  },
  'see-prova': (v) => { Object.assign(st.q, { prova: v, area: '', text: '', page: 0, rows: null, open: null }); actions.view('questoes'); },
  'adm-remove': async (uid) => {
    if (st.confirm !== uid) { st.confirm = uid; render(); return; }
    st.confirm = null;
    try { await adminRemove(uid); toast('Administrador removido.'); } catch (e) { toast(e.message); return; }
    st.admins = null;
    render();
  },
};

root.addEventListener('click', (e) => {
  const imgZone = e.target.closest('[data-drop-img]');
  if (imgZone) { st.pasteTarget = imgZone.dataset.dropImg; document.querySelectorAll('[data-drop-img]').forEach((z) => z.classList.toggle('target', z === imgZone)); }
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el.dataset.v); }
});

root.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.imp && t.type !== 'checkbox') st.imp[t.dataset.imp] = t.value;
  if (t.dataset.qf === 'text') { st.q.text = t.value; clearTimeout(searchTimer); searchTimer = setTimeout(() => { st.q.page = 0; st.q.open = null; searchQuestions(); }, 400); }
  if (st.q.edit) {
    if (t.dataset.ed && ['stem', 'explanation'].includes(t.dataset.ed)) st.q.edit[t.dataset.ed] = t.value;
    if (t.dataset.edOpt != null) st.q.edit.options[Number(t.dataset.edOpt)] = t.value;
  }
});

root.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.imp === 'definitivo') st.imp.definitivo = t.checked;
  if (t.dataset.gtime) { const w = document.getElementById('g-date-wrap'); if (w) w.hidden = t.value !== 'data'; }
  if (t.dataset.loteDir) loteOrganize([...(t.files || [])]);
  if (t.dataset.file) setFile(t.dataset.file, t.files && t.files[0]);
  if (t.dataset.img) setImage(t.dataset.img, t.files && t.files[0]);
  if (t.dataset.qf && t.dataset.qf !== 'text') { st.q[t.dataset.qf] = t.value; st.q.page = 0; st.q.open = null; st.q.rows = null; render(); }
  if (st.q.edit && t.dataset.ed) {
    const e2 = st.q.edit;
    if (t.dataset.ed === 'area') { e2.area = t.value; e2.sub = (AREAS.find((a) => a.id === t.value) || AREAS[0]).subtemas[0]; render(); }
    if (t.dataset.ed === 'sub') e2.sub = t.value;
    if (t.dataset.ed === 'answer') { e2.answer = Number(t.value); render(); }
    if (t.dataset.ed === 'reviewed') e2.explanation_ai = !t.checked;
  }
});

root.addEventListener('submit', async (e) => {
  if (e.target.id === 'grant') {
    e.preventDefault();
    const email = document.getElementById('g-email').value.trim();
    const plan = document.getElementById('g-plan').value;
    const time = document.getElementById('g-time').value;
    const note = document.getElementById('g-note').value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Digite um e-mail válido.'); return; }
    let until = null;
    if (time === 'data') {
      const d = document.getElementById('g-date').value;
      if (!d) { toast('Escolha a data.'); return; }
      until = new Date(`${d}T23:59:59-03:00`).toISOString();
    } else if (time !== 'sem') {
      const d = new Date();
      d.setMonth(d.getMonth() + Number(time));
      until = d.toISOString();
    }
    try { await adminGrant(email, plan, until, note); } catch (err) { toast(err.message); return; }
    toast(`Acesso ${PLAN_LABEL[plan]} liberado para ${email}.`);
    st.subs = null;
    render();
    return;
  }
  if (e.target.id !== 'add-admin') return;
  e.preventDefault();
  const email = document.getElementById('new-admin').value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Digite um e-mail válido.'); return; }
  try { await adminAdd(email); toast('Administrador adicionado.'); } catch (err) { toast(err.message); return; }
  st.admins = null;
  render();
});

// Arrastar e soltar PDFs e imagens.
root.addEventListener('dragover', (e) => {
  const z = e.target.closest('[data-drop], [data-drop-img]');
  if (!z) return;
  e.preventDefault();
  z.classList.add('over');
});
root.addEventListener('dragleave', (e) => { const z = e.target.closest('[data-drop], [data-drop-img]'); if (z) z.classList.remove('over'); });
root.addEventListener('drop', (e) => {
  const z = e.target.closest('[data-drop], [data-drop-img]');
  if (!z) return;
  e.preventDefault();
  z.classList.remove('over');
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (z.dataset.drop) setFile(z.dataset.drop, f);
  else setImage(z.dataset.dropImg, f);
});

// Colar imagem (Ctrl+V) no quadro selecionado.
document.addEventListener('paste', (e) => {
  if (!st.pasteTarget || !document.querySelector(`[data-drop-img="${st.pasteTarget}"]`)) return;
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (!item) return;
  e.preventDefault();
  setImage(st.pasteTarget, item.getAsFile());
});

window.addEventListener('beforeunload', (e) => { if (st.lote.running || st.imp.step === 'importing') { e.preventDefault(); e.returnValue = ''; } });

render();
boot();
