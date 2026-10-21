// Sinapse — protótipo. Interface em JavaScript puro, sem dependências.
import { AREAS, PROVAS, FASES, ECG_REGIONS, IA_DEMO } from './data.js';
import { QUESTIONS, CASES } from './questions.js';
import { store } from './store.js';
import { scheduleAll, formatInterval, DAY_MS } from './fsrs.js';
import { checkAnswer, parseCloze } from './match.js';
import { daysBetween } from './plan.js';
import { GOOGLE_CLIENT_ID } from './config.js';
import { startSynapseFx } from './fx.js';

function homeView() {
  if (!store.data.user) return 'login';
  return store.data.profile ? 'home' : 'onboarding';
}

const ui = {
  view: homeView(),
  stopFx: null,       // encerra a animação do login
  session: null,      // revisão: { title, queue, done, correct, practice, quick, retried }
  revealed: false,
  typed: null,        // resposta digitada: { values, results, allOk }
  iaCards: null,      // sugestões da demonstração
  selectedCell: null, // subtema escolhido no mapa
  confirmReset: false,
  onbProva: null,
  createType: 'cloze',
  qArea: 'all',       // filtro do treino de questões
  qCount: 10,
  simSize: 10,
  quiz: null,         // treino, simulado ou caderno de erros em andamento
  quizTimer: 0,
  caseRun: null,      // caso clínico em andamento
  cardAnim: null,     // animação do card na próxima renderização: enter | flip-in
  animating: false,
};

const PALETTES = [
  { id: 'azul', name: 'Azul e laranja', main: '#3D8BFF', acc: '#FF9F43' },
  { id: 'violeta', name: 'Violeta e âmbar', main: '#7C5CFF', acc: '#FFB23F' },
  { id: 'verde', name: 'Verde-água e coral', main: '#14B8A6', acc: '#FF8A5B' },
  { id: 'magenta', name: 'Magenta e amarelo', main: '#EC4899', acc: '#FFC94A' },
];

function applyPalette() {
  document.documentElement.dataset.palette = store.data.settings.palette || 'azul';
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Roda a animação de saída do card e só depois troca o conteúdo.
function animateCard(cls, ms, then) {
  const el = root.querySelector('.flash');
  if (!el || reduceMotion()) { then(); return; }
  ui.animating = true;
  el.classList.remove('enter', 'flip-in');
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => { ui.animating = false; then(); }, ms);
}

const APP_VERSION = '0.5';
const root = document.getElementById('app');

// ---------- utilitários ----------
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function areaById(id) { return AREAS.find((a) => a.id === id); }

function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmtDate(d) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 2400);
}

const icons = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 18l6-6-6-6"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 3-5 5-5 8 0 4 3 7 7 7z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  x: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  cards: '<rect x="6" y="3" width="14" height="18" rx="3"/><path d="M4 7v12a2 2 0 0 0 2 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  quiz: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  steth: '<path d="M6 3v6a5 5 0 0 0 10 0V3"/><path d="M11 14v2a5 5 0 0 0 10 0v-3"/><circle cx="21" cy="11" r="2"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  layers: '<path d="M12 3 2 8l10 5 10-5z"/><path d="M2 16l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h8"/>',
};

function icon(name, size = 20) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
}

// ---------- conteúdo dos cards ----------
function clozeHtml(text, reveal) {
  const { parts, gaps } = parseCloze(text);
  return parts.map((p) => {
    if (p.text != null) return esc(p.text);
    return reveal ? `<mark class="gap gap-open">${esc(gaps[p.gap].display)}</mark>` : '<span class="gap" aria-label="lacuna">[...]</span>';
  }).join('');
}

// Lacunas com campo para digitar a resposta.
function clozeInputHtml(text) {
  const { parts, gaps } = parseCloze(text);
  return parts.map((p) => {
    if (p.text != null) return esc(p.text);
    const size = Math.min(22, Math.max(6, gaps[p.gap].display.length + 2));
    return `<input class="gap-input" id="gap-${p.gap}" name="gap" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" size="${size}" aria-label="Lacuna ${p.gap + 1}" placeholder="...">`;
  }).join('');
}

// Lacunas corrigidas: mostra o que a pessoa digitou e a resposta certa.
function clozeCheckedHtml(text, typed) {
  const { parts, gaps } = parseCloze(text);
  return parts.map((p) => {
    if (p.text != null) return esc(p.text);
    const r = typed.results[p.gap];
    const value = typed.values[p.gap];
    const right = esc(gaps[p.gap].display);
    if (r.ok && !r.close) return `<mark class="gap gap-ok">${right}</mark>`;
    if (r.ok) return `<mark class="gap gap-ok">${right}</mark><span class="typed-note"> (você: ${esc(value)})</span>`;
    return `<span class="typed-wrong">${value ? esc(value) : 'em branco'}</span> <mark class="gap gap-bad">${right}</mark>`;
  }).join('');
}

function ecgSvg(ask, reveal) {
  const boxes = ECG_REGIONS.map((r) => {
    if (r.n === ask && reveal) {
      return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="12" fill="none" stroke="var(--amber)" stroke-width="2" stroke-dasharray="5 4"/>`;
    }
    const active = r.n === ask;
    return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${active ? 12 : 10}" fill="${active ? 'var(--violet-strong)' : 'var(--occlude)'}" ${active ? 'stroke="var(--violet-ink)" stroke-width="2"' : ''}/>
      <text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 + (active ? 8 : 5)}" text-anchor="middle" font-size="${active ? 22 : 14}" font-weight="${active ? 800 : 600}" fill="${active ? '#fff' : 'var(--occlude-ink)'}">${r.n}</text>`;
  }).join('');
  return `<svg class="ecg" role="img" aria-label="Traçado de ECG com regiões cobertas" viewBox="0 0 318 200">
    <g stroke="var(--grid)" stroke-width="1"><path d="M0 20H318M0 50H318M0 80H318M0 110H318M0 140H318M0 170H318M20 0V200M50 0V200M80 0V200M110 0V200M140 0V200M170 0V200M200 0V200M230 0V200M260 0V200M290 0V200"/></g>
    <path d="M0 130 H30 C40 130 45 108 58 108 C71 108 76 130 86 130 H112 L118 142 L132 26 L146 158 L154 130 H182 C196 130 202 92 222 92 C242 92 248 130 262 130 H318" fill="none" stroke="var(--good)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${boxes}
  </svg>`;
}

function typeLabel(c) {
  return { basic: 'Frente e verso', cloze: 'Lacuna', occlusion: 'Oclusão de imagem' }[c.type];
}

function typingOn(card) {
  return card.type === 'cloze' && store.data.settings.typeAnswers && ui.session && !ui.session.quick;
}

function cardBody(c, reveal) {
  if (c.type === 'cloze') {
    if (!reveal && typingOn(c)) {
      return `<p class="label">Digite a resposta</p>
        <form id="type-form" class="q type-q" autocomplete="off">${clozeInputHtml(c.text)}<button type="submit" hidden>Conferir</button></form>`;
    }
    if (reveal && ui.typed) {
      const ok = ui.typed.results.filter((r) => r.ok).length;
      const total = ui.typed.results.length;
      const close = ui.typed.results.some((r) => r.close && r.ok);
      return `<p class="verdict ${ui.typed.allOk ? 'good' : 'bad'}">${icon(ui.typed.allOk ? 'check' : 'x', 18)} ${ui.typed.allOk
        ? (close ? 'Certo, com pequena diferença na escrita' : 'Você acertou')
        : (total > 1 ? `Você acertou ${ok} de ${total} lacunas` : 'Não foi dessa vez')}</p>
        <p class="q">${clozeCheckedHtml(c.text, ui.typed)}</p>
        ${c.extra ? `<p class="extra">${esc(c.extra)}</p>` : ''}`;
    }
    return `<p class="label">${reveal ? 'Resposta' : 'Complete'}</p>
      <p class="q">${clozeHtml(c.text, reveal)}</p>
      ${reveal && c.extra ? `<p class="extra">${esc(c.extra)}</p>` : ''}`;
  }
  if (c.type === 'occlusion') {
    const r = ECG_REGIONS.find((x) => x.n === c.ask);
    return `<p class="q">O que está oculto na região ${c.ask}?</p>
      <div class="figure">${ecgSvg(c.ask, reveal)}</div>
      ${reveal ? `<p class="answer">${esc(r.label)}</p><p class="extra">${esc(r.detail)}</p>` : ''}`;
  }
  return `<p class="label">Pergunta</p><p class="q">${esc(c.front)}</p>
    ${reveal ? `<hr><p class="label">Resposta</p><p class="answer">${esc(c.back)}</p>${c.extra ? `<p class="extra">${esc(c.extra)}</p>` : ''}` : ''}`;
}

// ---------- login ----------
const GOOGLE_G = `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

let googleReady = null;

// Carrega o Google Identity Services só quando há Client ID configurado.
function loadGoogle() {
  if (!GOOGLE_CLIENT_ID) return Promise.resolve(false);
  if (googleReady) return googleReady;
  googleReady = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => {
      try {
        window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onGoogleCredential, ux_mode: 'popup' });
        resolve(true);
      } catch (e) { resolve(false); }
    };
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return googleReady;
}

function decodeJwt(token) {
  const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '=')), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

// Protótipo: os dados do token são lidos no aparelho. No MVP o token será validado no backend (Supabase Auth).
function onGoogleCredential(resp) {
  try {
    const p = decodeJwt(resp.credential);
    finishLogin({ name: p.name || '', email: p.email || '', picture: p.picture || '', provider: 'google' });
  } catch (e) {
    toast('Não foi possível entrar com o Google. Tente de novo.');
  }
}

function finishLogin(user) {
  store.signIn(user);
  toast(user.name ? `Olá, ${user.name.split(' ')[0]}!` : 'Bem-vindo ao Sinapse!');
  go(store.data.profile ? 'home' : 'onboarding');
}

function viewLogin() {
  return `<div class="login">
    <canvas class="login-fx" id="login-fx" aria-hidden="true"></canvas>
    <div class="login-glow" aria-hidden="true"></div>
    <section class="login-hero">
      <svg class="login-logo" viewBox="0 0 512 512" role="img" aria-label="Logotipo do Sinapse">
        <rect width="512" height="512" rx="120" class="logo-bg"/>
        <path class="logo-line" d="M96 296 H176 L208 232 L256 360 L304 152 L336 296 H416" pathLength="100"/>
        <circle class="logo-dot" cx="416" cy="296" r="30"/>
      </svg>
      <h1 class="login-title">Sinapse</h1>
      <p class="login-tagline">Revise no momento certo e chegue à prova lembrando de tudo.</p>
      <ul class="login-points">
        <li>Repetição espaçada</li><li>Cards gerados por IA</li><li>Do 1º período à residência</li>
      </ul>
    </section>
    <section class="login-sheet" aria-label="Entrar">
      <div id="gsi-slot" class="gsi-slot" hidden></div>
      <button class="btn google big" id="google-btn" data-act="google">${GOOGLE_G} Entrar com Google</button>
      <button class="btn ghost big" data-act="guest">Continuar sem conta</button>
      <p class="login-legal">Ao entrar, você concorda com os Termos de Uso e a Política de Privacidade. Seu progresso fica salvo neste aparelho.</p>
    </section>
  </div>`;
}

function mountLogin() {
  ui.stopFx = startSynapseFx(document.getElementById('login-fx'));
  loadGoogle().then((ok) => {
    if (!ok || ui.view !== 'login') return;
    // Com Client ID, usa o botão oficial do Google.
    const slot = document.getElementById('gsi-slot');
    const own = document.getElementById('google-btn');
    if (!slot || !own) return;
    slot.hidden = false;
    own.hidden = true;
    window.google.accounts.id.renderButton(slot, {
      type: 'standard', theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', locale: 'pt-BR', width: Math.min(400, slot.clientWidth || 320),
    });
  });
}

// ---------- telas ----------
function viewOnboarding() {
  const p = store.data.profile || {};
  const prova = ui.onbProva ?? p.prova ?? 'ENARE';
  return `<form class="screen stack" id="onb" novalidate>
    <header class="stack-sm">
      <h1>Vamos montar seu estudo</h1>
      <p class="muted">O app organiza os cards e o cronograma de acordo com a sua fase e a sua prova.</p>
    </header>
    <label class="field" for="onb-nome">Como quer ser chamado?
      <input id="onb-nome" name="nome" type="text" autocomplete="given-name" value="${esc(p.nome || (store.data.user?.name || '').split(' ')[0])}" placeholder="Seu nome">
    </label>
    <fieldset class="stack-sm">
      <legend>Em que fase você está?</legend>
      ${FASES.map((f) => `<label class="option" for="fase-${f.id}">
        <input type="radio" id="fase-${f.id}" name="fase" value="${f.id}" ${(p.fase || 'residencia') === f.id ? 'checked' : ''}>
        <span><strong>${f.name}</strong><small>${f.hint}</small></span>
      </label>`).join('')}
    </fieldset>
    <fieldset class="stack-sm">
      <legend>Qual prova você vai fazer?</legend>
      <div class="chips">${PROVAS.map((x) => `<button type="button" class="chip ${x === prova ? 'on' : ''}" data-act="onb-prova" data-v="${x}" aria-pressed="${x === prova}">${x}</button>`).join('')}</div>
    </fieldset>
    <label class="field" for="onb-data">Data da prova
      <input id="onb-data" name="dataProva" type="date" value="${esc(p.dataProva || '')}">
    </label>
    <button class="btn primary big" type="submit">${store.data.profile ? 'Salvar' : 'Começar a estudar'}</button>
  </form>`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}


// ---------- início ----------
function deckList() {
  const today = store.dueQueue();
  return AREAS.map((a) => {
    const cards = store.allCards().filter((c) => c.area === a.id);
    const studied = cards.filter((c) => store.stateOf(c.id).state !== 'new').length;
    const due = today.filter((c) => c.area === a.id).length;
    const acc = store.accuracy((c) => c.area === a.id).pct;
    const tone = acc == null ? 'violet' : acc >= 75 ? 'good' : acc >= 60 ? 'amber' : 'bad';
    return `<button class="deck" data-act="start-area" data-v="${a.id}">
      <span class="row"><strong>${a.name}</strong><span class="muted">${due ? `${due} para hoje` : 'em dia'}</span></span>
      <span class="bar"><span class="fill ${tone}" style="width:${Math.round((studied / cards.length) * 100)}%"></span></span>
      <span class="row small muted"><span>${studied} de ${cards.length} cards estudados</span><span>${acc == null ? 'sem revisões' : `${acc}% de acerto`}</span></span>
    </button>`;
  }).join('');
}

function goalRow(label, done, total, act, cta) {
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 100;
  const complete = total ? done >= total : true;
  return `<div class="goal">
    <div class="row"><span class="goal-label">${complete ? icon('check', 18) : ''}${label}</span><span class="muted small strong">${done}/${total}</span></div>
    <span class="bar"><span class="fill ${complete ? 'good' : 'violet'}" style="width:${pct}%"></span></span>
    ${!complete && act ? `<button class="link-btn" data-act="${act}">${cta} ${icon('next', 16)}</button>` : ''}
  </div>`;
}

function viewHome() {
  const p = store.data.profile;
  const queue = store.dueQueue();
  const done = store.reviewsToday().length;
  const total = done + queue.length;
  const pct = total ? Math.round((done / total) * 100) : 100;
  const circ = 2 * Math.PI * 40;
  const fase = FASES.find((f) => f.id === p.fase);
  const dias = daysBetween(store.now(), p.dataProva);
  const minutes = Math.max(1, Math.round(queue.length * 0.45));
  const qDone = store.questionsToday().length;
  const qGoal = store.data.settings.questionsPerDay;
  const plan = store.plan();

  return `<div class="screen stack">
    <header class="row top">
      <div class="stack-xs">
        <p class="muted small">${esc(fase ? fase.name : '')} · ${esc(p.prova)}</p>
        <h1>${greeting()}${p.nome ? `, ${esc(p.nome)}` : ''}</h1>
      </div>
    </header>

    <section class="panel hero" aria-label="Revisões de hoje">
      <div class="row gap-lg">
        <svg class="ring" role="img" aria-label="${pct}% das revisões de hoje feitas" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="40" class="ring-track"/>
          ${pct ? `<circle cx="48" cy="48" r="40" class="ring-fill" stroke-dasharray="${(pct / 100) * circ} ${circ}" transform="rotate(-90 48 48)"/>` : ''}
          <text x="48" y="55" text-anchor="middle">${pct}%</text>
        </svg>
        <div class="stack-xs">
          <p class="muted small">Revisões de hoje</p>
          <p class="big-num">${plural(queue.length, 'card', 'cards')}</p>
          <p class="muted small">${queue.length ? `cerca de ${minutes} min · ${done} já feitos` : `${done} feitos hoje`}</p>
        </div>
      </div>
      ${queue.length
        ? `<button class="btn primary big" data-act="start-all">${icon('play', 18)} ${done ? 'Continuar revisão' : 'Começar revisão'}</button>`
        : '<p class="done-note">Tudo revisado por hoje. Que tal algumas questões? Para testar o agendamento, avance um dia em Ajustes.</p>'}
    </section>

    <section class="panel stack-sm" aria-label="Plano de hoje">
      <div class="row"><h2>Plano de hoje</h2><button class="link-btn" data-act="go" data-v="plan">Cronograma ${icon('next', 16)}</button></div>
      ${goalRow('Revisões', done, total, queue.length ? 'start-all' : '', 'Revisar')}
      ${goalRow('Questões', Math.min(qDone, qGoal), qGoal, 'start-daily-q', 'Resolver questões')}
      ${plan && plan.phase === 'final' ? '<p class="muted small">Reta final: sem cards novos. Foque em revisões, questões e simulados.</p>' : ''}
    </section>

    <div class="grid-2">
      <div class="panel tile"><span class="badge amber">${icon('flame')}</span><p class="mid-num">${plural(store.streak(), 'dia', 'dias')}</p><p class="muted small">sequência de estudo</p></div>
      <button class="panel tile tile-btn" data-act="go" data-v="plan"><span class="badge violet">${icon('calendar')}</span>
        ${dias == null ? '<p class="mid-num">—</p><p class="muted small">defina a data da prova</p>'
          : `<p class="mid-num">${dias < 0 ? 'Passou' : plural(dias, 'dia', 'dias')}</p><p class="muted small">até a prova ${esc(p.prova)}</p>`}
      </button>
    </div>

    <button class="btn quick" data-act="start-quick" ${queue.length ? '' : 'disabled'}>
      <span class="row gap-sm">${icon('bolt')} Modo 5 minutos</span><span class="small">10 cards</span>
    </button>

    <section class="stack-sm" aria-label="Decks">
      <h2>Grandes áreas</h2>
      ${deckList()}
    </section>
  </div>`;
}

// ---------- estudar ----------
function modeRow(act, ic, title, desc, badge, tone = 'violet', disabled = false, v = '') {
  return `<button class="mode" data-act="${act}" ${v ? `data-v="${v}"` : ''} ${disabled ? 'disabled' : ''}>
    <span class="badge ${tone}">${icon(ic)}</span>
    <span class="stack-xs grow"><strong>${title}</strong><span class="muted small">${desc}</span></span>
    ${badge != null ? `<span class="count">${badge}</span>` : ''}
  </button>`;
}

function viewStudy() {
  const due = store.dueQueue().length;
  const weak = store.weakCards().length;
  return `<div class="screen stack">
    <header class="stack-xs"><h1>Estudar</h1><p class="muted">Escolha como revisar seus cards.</p></header>
    <section class="stack-sm" aria-label="Modos de revisão">
      ${modeRow('start-all', 'cards', 'Revisão do dia', 'Cards vencidos e novos do cronograma', due, 'violet', !due)}
      ${modeRow('start-quick', 'bolt', 'Modo 5 minutos', '10 cards rápidos, sem digitar', Math.min(10, due), 'amber', !due)}
      ${modeRow('start-weak', 'repeat', 'Reforço dos erros', 'Cards que você já errou. Não altera a agenda', weak, 'bad', !weak)}
    </section>
    <section class="stack-sm" aria-label="Por grande área">
      <h2>Por grande área</h2>
      ${deckList()}
    </section>
    <section class="stack-sm" aria-label="Ferramentas">
      <h2>Ferramentas</h2>
      ${modeRow('go', 'plus', 'Criar card', 'Lacuna ou frente e verso, do seu jeito', null, 'violet', false, 'create')}
      ${modeRow('go', 'spark', 'Gerar com IA', 'Cards a partir de PDF, slide ou resumo', null, 'amber', false, 'ia')}
    </section>
  </div>`;
}

// ---------- revisão ----------
function gradeButtons(card) {
  const now = store.now();
  const next = scheduleAll(store.stateOf(card.id), now);
  const names = { 1: 'De novo', 2: 'Difícil', 3: 'Bom', 4: 'Fácil' };
  const tones = { 1: 'bad', 2: 'amber', 3: 'primary', 4: 'good' };
  const suggested = ui.typed ? (ui.typed.allOk ? 3 : 1) : null;
  return `<div class="grades">${[1, 2, 3, 4].map((g) => `<button class="grade ${tones[g]} ${suggested === g ? 'suggested' : ''}" data-act="grade" data-v="${g}">
    ${suggested === g ? '<em>sugerido</em>' : ''}<strong>${names[g]}</strong><span>${formatInterval(next[g].due - now)}</span></button>`).join('')}</div>`;
}

function viewReview() {
  const s = ui.session;
  if (!s || !s.queue.length) return viewSessionDone();
  const card = store.cardById(s.queue[0]);
  const area = areaById(card.area);
  const progress = Math.round((s.done / (s.done + s.queue.length)) * 100);
  const typing = !ui.revealed && typingOn(card);
  const anim = ui.cardAnim || '';
  ui.cardAnim = null;
  let actions;
  if (!ui.revealed) {
    actions = typing
      ? '<div class="grid-2"><button class="btn ghost big" data-act="dont-know">Não sei</button><button class="btn primary big" data-act="check-typed">Conferir <kbd>enter</kbd></button></div>'
      : '<button class="btn primary big" data-act="reveal">Mostrar resposta <kbd>espaço</kbd></button>';
  } else if (s.practice) {
    const sug = ui.typed ? (ui.typed.allOk ? 'ok' : 'bad') : '';
    actions = `<div class="grid-2"><button class="grade bad ${sug === 'bad' ? 'suggested' : ''}" data-act="practice" data-v="0">${sug === 'bad' ? '<em>sugerido</em>' : ''}<strong>Errei</strong><span>volta nesta sessão</span></button>
      <button class="grade good ${sug === 'ok' ? 'suggested' : ''}" data-act="practice" data-v="1">${sug === 'ok' ? '<em>sugerido</em>' : ''}<strong>Acertei</strong><span>próximo card</span></button></div>`;
  } else {
    actions = gradeButtons(card);
  }
  return `<div class="screen stack review">
    <div class="row gap-md">
      <button class="icon-btn" data-act="end-session" aria-label="Encerrar sessão">${icon('close')}</button>
      <div class="bar grow" role="progressbar" aria-label="Progresso da sessão" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><span class="fill violet" style="width:${progress}%"></span></div>
      <span class="muted strong">${s.done + 1}/${s.done + s.queue.length}</span>
    </div>
    <div class="row gap-sm wrap">
      <span class="tag violet">${esc(area.short)} · ${esc(card.sub)}</span>
      <span class="tag">${typeLabel(card)}</span>
      ${s.practice ? '<span class="tag amber">Reforço</span>' : ''}
      ${card.origin ? '<span class="tag">Caderno de erros</span>' : ''}
      <button class="skip-btn" data-act="skip" aria-label="Pular este card">Pular ${icon('next', 16)}</button>
    </div>
    <article class="panel flash ${ui.revealed ? 'revealed' : ''} ${anim}" aria-live="polite">
      ${cardBody(card, ui.revealed)}
      ${ui.revealed ? `<div class="row card-tools"><button class="btn ghost small" data-act="report">${icon('flag', 16)} Reportar erro</button></div>` : ''}
    </article>
    <div class="actions">${actions}</div>
    <p class="hint">${ui.revealed && !s.practice ? 'Atalhos: 1 De novo · 2 Difícil · 3 Bom · 4 Fácil · P pular' : 'Atalhos: espaço mostra a resposta · P pula o card'}</p>
  </div>`;
}

function viewSessionDone() {
  const s = ui.session;
  const pct = s && s.done ? Math.round((s.correct / s.done) * 100) : 0;
  return `<div class="screen stack center">
    <div class="badge good xl">${icon('check', 36)}</div>
    <h1>Sessão concluída</h1>
    <p class="muted">${s ? `${plural(s.done, 'revisão', 'revisões')} nesta sessão, ${pct}% de acerto.` : ''}${s && s.leftOut ? ` ${plural(s.leftOut, 'card ficou', 'cards ficaram')} para depois.` : ''}</p>
    <button class="btn primary big" data-act="go" data-v="home">Voltar ao início</button>
    <button class="btn ghost" data-act="go" data-v="questions">Resolver questões</button>
  </div>`;
}

function areaOptions(selected) {
  return AREAS.map((a) => `<optgroup label="${a.name}">${a.subtemas.map((s) => {
    const v = `${a.id}|${s}`;
    return `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(s)}</option>`;
  }).join('')}</optgroup>`).join('');
}

function viewCreate() {
  const t = ui.createType;
  return `<form class="screen stack" id="create" novalidate>
    <header class="stack-xs"><h1>Criar card</h1><p class="muted">Escreva do seu jeito. O card entra na fila de revisão hoje.</p></header>
    <div class="segmented" role="group" aria-label="Tipo de card">
      <button type="button" class="${t === 'cloze' ? 'on' : ''}" data-act="create-type" data-v="cloze" aria-pressed="${t === 'cloze'}">Lacuna</button>
      <button type="button" class="${t === 'basic' ? 'on' : ''}" data-act="create-type" data-v="basic" aria-pressed="${t === 'basic'}">Frente e verso</button>
    </div>
    ${t === 'cloze' ? `<label class="field" for="cr-text">Texto
        <textarea id="cr-text" name="text" rows="4" placeholder="A droga de escolha na crise convulsiva da eclâmpsia é o {{sulfato de magnésio|MgSO4}}."></textarea>
        <small class="muted">Coloque a parte escondida entre chaves duplas: {{assim}}. Para aceitar sinônimos ao digitar, separe com barra: {{CVE sincronizada|cardioversão sincronizada}}.</small>
      </label>`
      : `<label class="field" for="cr-front">Frente<textarea id="cr-front" name="front" rows="3" placeholder="Pergunta"></textarea></label>
      <label class="field" for="cr-back">Verso<textarea id="cr-back" name="back" rows="3" placeholder="Resposta"></textarea></label>`}
    <label class="field" for="cr-extra">Observação (opcional)<input id="cr-extra" name="extra" type="text" placeholder="Fonte, mnemônico, detalhe"></label>
    <label class="field" for="cr-area">Subtema<select id="cr-area" name="area">${areaOptions('clinica|Cardiologia')}</select></label>
    <p class="error" id="cr-error" hidden></p>
    <button class="btn primary big" type="submit">Salvar card</button>
    ${store.data.custom.length ? `<p class="muted small">Você já criou ${store.data.custom.length} ${store.data.custom.length === 1 ? 'card' : 'cards'}.</p>` : ''}
  </form>`;
}

function viewIA() {
  if (!ui.iaCards) {
    return `<div class="screen stack">
      <header class="stack-xs"><h1>Gerar com IA</h1><p class="muted">Envie um PDF, slide ou resumo e a IA sugere cards para você aprovar.</p></header>
      <div class="panel note"><strong>Modo demonstração.</strong> Neste protótipo a geração usa um material de exemplo. A leitura de arquivos com IA entra no MVP.</div>
      <button class="panel upload" data-act="ia-demo">
        <span class="file-badge">PDF</span>
        <span class="stack-xs grow"><strong>${esc(IA_DEMO.source)}</strong><span class="muted small">${IA_DEMO.pages} páginas · material de exemplo</span></span>
        <span class="btn primary">Gerar</span>
      </button>
    </div>`;
  }
  const pending = ui.iaCards.filter((c) => c.status === 'pending').length;
  const approved = ui.iaCards.filter((c) => c.status === 'approved').length;
  return `<div class="screen stack">
    <div class="row top"><button class="icon-btn" data-act="ia-back" aria-label="Voltar">${icon('back')}</button><h1 class="grow center-text h-sm">Gerar com IA</h1><span class="icon-spacer"></span></div>
    <div class="panel upload static"><span class="file-badge">PDF</span><span class="stack-xs grow"><strong>${esc(IA_DEMO.source)}</strong><span class="muted small">${IA_DEMO.pages} páginas · lido agora</span></span><span class="ok">${icon('check', 22)}</span></div>
    <div class="row"><h2>${ui.iaCards.length} cards sugeridos</h2><span class="muted small">${approved} aprovados · ${pending} pendentes</span></div>
    ${ui.iaCards.map((c, i) => `<article class="panel sug ${c.status}">
      <div class="row"><span class="eyebrow">${typeLabel(c)}</span><span class="small status">${c.status === 'approved' ? 'Aprovado' : c.status === 'discarded' ? 'Descartado' : ''}</span></div>
      ${c.type === 'cloze' ? `<p class="q-sm">${clozeHtml(c.text, true)}</p>` : `<p class="q-sm">${esc(c.front)}</p><p class="muted">${esc(c.back)}</p>`}
      ${c.status === 'pending' ? `<div class="grid-2"><button class="btn ghost bad-ink" data-act="ia-discard" data-v="${i}">Descartar</button><button class="btn good-solid" data-act="ia-approve" data-v="${i}">Aprovar</button></div>` : ''}
    </article>`).join('')}
    <button class="btn primary big" data-act="ia-save" ${approved + pending ? '' : 'disabled'}>Aprovar pendentes e salvar em Cardiologia</button>
  </div>`;
}


// ---------- questões ----------
const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const SECONDS_PER_QUESTION = 180; // ritmo típico das provas de residência

function chipGroup(act, current, items) {
  return `<div class="chips">${items.map(([v, label]) =>
    `<button type="button" class="chip ${String(current) === String(v) ? 'on' : ''}" data-act="${act}" data-v="${v}" aria-pressed="${String(current) === String(v)}">${label}</button>`).join('')}</div>`;
}

function viewQuestions() {
  const acc = store.questionAccuracy();
  const qDone = store.questionsToday().length;
  const qGoal = store.data.settings.questionsPerDay;
  const errors = store.openErrors().length;
  const casesDone = Object.keys(store.data.cases).length;
  const pool = ui.qArea === 'all' ? QUESTIONS.length : QUESTIONS.filter((q) => q.area === ui.qArea).length;
  return `<div class="screen stack">
    <header class="stack-xs"><h1>Questões</h1><p class="muted">Questões autorais no estilo das provas de residência, com comentário em cada alternativa certa.</p></header>

    <div class="grid-3">
      <div class="panel tile"><p class="mid-num">${acc.pct == null ? '—' : `${acc.pct}%`}</p><p class="muted small">acerto geral</p></div>
      <div class="panel tile"><p class="mid-num violet-ink">${Math.min(qDone, qGoal)}/${qGoal}</p><p class="muted small">meta de hoje</p></div>
      <div class="panel tile"><p class="mid-num amber-ink">${store.data.simulados.length}</p><p class="muted small">simulados feitos</p></div>
    </div>

    <section class="panel stack-sm" aria-label="Treino">
      <div class="row gap-md"><span class="badge violet">${icon('target')}</span><div class="stack-xs grow"><h2>Treino</h2><p class="muted small">Correção e comentário logo após cada questão.</p></div></div>
      <p class="small strong">Área</p>
      ${chipGroup('q-area', ui.qArea, [['all', 'Todas']].concat(AREAS.map((a) => [a.id, a.short])))}
      <p class="small strong">Quantidade</p>
      ${chipGroup('q-count', ui.qCount, [[5, '5'], [10, '10'], [20, '20']])}
      <button class="btn primary big" data-act="start-treino">Começar treino · ${plural(Math.min(ui.qCount, pool), 'questão', 'questões')}</button>
    </section>

    <section class="panel stack-sm" aria-label="Simulado">
      <div class="row gap-md"><span class="badge amber">${icon('clock')}</span><div class="stack-xs grow"><h2>Simulado</h2><p class="muted small">Cronômetro de 3 min por questão e correção só no fim, como na prova.</p></div></div>
      ${chipGroup('sim-size', ui.simSize, [[10, '10 questões · 30 min'], [QUESTIONS.length, `${QUESTIONS.length} questões · ${QUESTIONS.length * 3} min`]])}
      <button class="btn ghost big" data-act="start-simulado">Iniciar simulado</button>
    </section>

    ${modeRow('go', 'book', 'Caderno de erros', errors ? `${plural(errors, 'questão', 'questões')} para refazer` : 'Questões que você errar aparecem aqui', errors, 'bad', false, 'errors')}
    ${modeRow('go', 'steth', 'Casos clínicos', `${CASES.length} casos em etapas, decidindo a conduta`, casesDone ? `${casesDone}/${CASES.length}` : null, 'good', false, 'cases')}
  </div>`;
}

function pickQuestions(ids, n) {
  // Prioriza questões nunca feitas, depois as erradas, depois as demais.
  const seen = new Set(store.data.qlog.map((l) => l.id));
  const fresh = shuffle(ids.filter((id) => !seen.has(id)));
  const wrong = shuffle(ids.filter((id) => seen.has(id) && store.data.errors[id] && !store.data.errors[id].solved));
  const rest = shuffle(ids.filter((id) => seen.has(id) && !(store.data.errors[id] && !store.data.errors[id].solved)));
  return fresh.concat(wrong, rest).slice(0, n);
}

function startQuiz(mode, ids, title) {
  if (!ids.length) { toast('Nenhuma questão disponível.'); return; }
  const orders = {};
  for (const id of ids) orders[id] = optionOrder(store.questionById(id));
  ui.quiz = { mode, title, ids, orders, idx: 0, picks: {}, confirmed: {}, created: {}, startedAt: store.now(), realStart: Date.now(), finished: false, confirmSubmit: false, result: null, reviewIdx: null };
  if (mode === 'simulado') ui.quiz.deadline = Date.now() + ids.length * SECONDS_PER_QUESTION * 1000;
  go('quiz');
}

function letterOf(order, i) { return LETTERS[order.indexOf(i)]; }

function optionOrder(q) {
  const base = q.options.map((_, i) => i);
  return q.keepOrder ? base : shuffle(base);
}

// order = posição de cada alternativa original na tela (as alternativas são embaralhadas a cada tentativa).
function optionList(q, pick, showResult, act, order) {
  return `<div class="options" role="group" aria-label="Alternativas">${order.map((i, pos) => {
    const o = q.options[i];
    let cls = '';
    if (showResult) {
      if (i === q.answer) cls = 'right';
      else if (i === pick) cls = 'wrong';
      else cls = 'dim';
    } else if (i === pick) cls = 'picked';
    return `<button class="option-btn ${cls}" data-act="${act}" data-v="${i}" ${showResult ? 'disabled' : ''} aria-pressed="${i === pick}">
      <span class="letter">${LETTERS[pos]}</span><span class="grow">${esc(o)}</span>
      ${showResult && i === q.answer ? icon('check', 18) : ''}${showResult && i === pick && i !== q.answer ? icon('x', 18) : ''}
    </button>`;
  }).join('')}</div>`;
}

function questionHeader(q) {
  const a = areaById(q.area);
  return `<div class="row gap-sm wrap"><span class="tag violet">${esc(a.short)} · ${esc(q.sub)}</span><span class="tag">Questão autoral</span></div>`;
}

function viewQuiz() {
  const z = ui.quiz;
  if (!z) return viewQuestions();
  if (z.finished) return z.reviewIdx != null ? viewQuizReview() : viewQuizResult();
  const id = z.ids[z.idx];
  const q = store.questionById(id);
  const pick = z.picks[id];
  const sim = z.mode === 'simulado';
  const confirmed = !sim && z.confirmed[id];
  const answered = Object.keys(z.picks).length;
  const progress = Math.round(((sim ? answered : z.idx) / z.ids.length) * 100);

  let footer;
  if (sim) {
    footer = z.confirmSubmit
      ? `<div class="panel stack-sm confirm"><p><strong>Entregar o simulado?</strong> ${answered < z.ids.length ? `Faltam ${plural(z.ids.length - answered, 'questão', 'questões')} sem resposta, que contarão como erro.` : 'Todas as questões foram respondidas.'}</p>
          <div class="grid-2"><button class="btn ghost" data-act="sim-cancel">Continuar</button><button class="btn primary" data-act="sim-finish">Entregar</button></div></div>`
      : `<div class="grid-2"><button class="btn ghost big" data-act="q-prev" ${z.idx === 0 ? 'disabled' : ''}>${icon('back', 18)} Anterior</button>
          ${z.idx < z.ids.length - 1 ? `<button class="btn primary big" data-act="q-next">Próxima ${icon('next', 18)}</button>` : '<button class="btn primary big" data-act="sim-submit">Entregar</button>'}</div>
          <div class="qgrid" aria-label="Ir para a questão">${z.ids.map((qid, i) => `<button class="qnum ${z.picks[qid] != null ? 'done' : ''} ${i === z.idx ? 'current' : ''}" data-act="q-go" data-v="${i}" aria-label="Questão ${i + 1}${z.picks[qid] != null ? ', respondida' : ''}">${i + 1}</button>`).join('')}</div>
          <button class="link-btn center-self" data-act="sim-submit">Entregar simulado</button>`;
  } else if (!confirmed) {
    footer = `<button class="btn primary big" data-act="q-confirm" ${pick == null ? 'disabled' : ''}>Confirmar resposta</button>`;
  } else {
    const ok = pick === q.answer;
    footer = `<div class="panel stack-sm feedback ${ok ? 'good' : 'bad'}">
        <p class="verdict ${ok ? 'good' : 'bad'}">${icon(ok ? 'check' : 'x', 18)} ${ok ? 'Resposta correta' : `Resposta correta: ${letterOf(z.orders[id], q.answer)}`}</p>
        <p>${esc(q.explanation)}</p>
        ${!ok && z.created[id] ? `<p class="muted small">${icon('book', 16)} A questão foi para o caderno de erros e virou um card de revisão.</p>` : ''}
      </div>
      <button class="btn primary big" data-act="q-next">${z.idx < z.ids.length - 1 ? 'Próxima questão' : 'Ver resultado'}</button>`;
  }

  return `<div class="screen stack quiz">
    <div class="row gap-md">
      <button class="icon-btn" data-act="quiz-exit" aria-label="Sair">${icon('close')}</button>
      <div class="bar grow" role="progressbar" aria-label="Progresso" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><span class="fill ${sim ? 'amber' : 'violet'}" style="width:${progress}%"></span></div>
      ${sim ? `<span class="timer" id="quiz-timer" role="timer" aria-label="Tempo restante">${fmtClock((z.deadline - Date.now()) / 1000)}</span>` : `<span class="muted strong">${z.idx + 1}/${z.ids.length}</span>`}
    </div>
    <p class="eyebrow">${esc(z.title)}${sim ? ` · questão ${z.idx + 1} de ${z.ids.length}` : ''}</p>
    ${questionHeader(q)}
    <p class="stem">${esc(q.stem)}</p>
    ${optionList(q, pick, confirmed, 'q-pick', z.orders[id])}
    <div class="stack-sm">${footer}</div>
  </div>`;
}

function finishQuiz() {
  const z = ui.quiz;
  if (!z || z.finished) return;
  if (z.mode === 'simulado') {
    for (const id of z.ids) {
      const q = store.questionById(id);
      store.answerQuestion(id, z.picks[id] === q.answer, 'simulado');
    }
  }
  const byArea = {};
  let correct = 0;
  for (const id of z.ids) {
    const q = store.questionById(id);
    const ok = z.picks[id] === q.answer;
    if (ok) correct += 1;
    byArea[q.area] = byArea[q.area] || { total: 0, correct: 0 };
    byArea[q.area].total += 1;
    if (ok) byArea[q.area].correct += 1;
  }
  const seconds = Math.round((Date.now() - z.realStart) / 1000);
  z.result = { total: z.ids.length, correct, seconds, byArea };
  z.finished = true;
  z.confirmSubmit = false;
  if (z.mode === 'simulado') store.saveSimulado({ t: store.now(), ...z.result });
  stopQuizTimer();
}

function viewQuizResult() {
  const z = ui.quiz;
  const r = z.result;
  const pct = Math.round((r.correct / r.total) * 100);
  const tone = pct >= 75 ? 'good' : pct >= 60 ? 'amber' : 'bad';
  const rows = AREAS.filter((a) => r.byArea[a.id]).map((a) => {
    const x = r.byArea[a.id];
    const p = Math.round((x.correct / x.total) * 100);
    return `<div class="area-row"><span>${a.short}</span><span class="bar grow"><span class="fill ${p >= 75 ? 'good' : p >= 60 ? 'amber' : 'bad'}" style="width:${p}%"></span></span><span class="small strong">${x.correct}/${x.total}</span></div>`;
  }).join('');
  const wrong = z.ids.filter((id) => z.picks[id] !== store.questionById(id).answer).length;
  return `<div class="screen stack">
    <header class="stack-xs"><p class="eyebrow">${esc(z.title)}</p><h1>Resultado</h1></header>
    <section class="panel result">
      <div class="score ${tone}"><span class="big-num">${pct}%</span><span class="muted small">${r.correct} de ${r.total} certas</span></div>
      <div class="stack-xs"><span class="muted small">Tempo</span><strong>${fmtClock(r.seconds)}</strong>${z.mode === 'simulado' ? `<span class="muted small">média de ${fmtClock(r.seconds / r.total)} por questão</span>` : ''}</div>
    </section>
    <section class="panel stack-sm"><h2>Por grande área</h2>${rows}</section>
    ${wrong ? `<p class="panel note">${icon('book', 16)} ${plural(wrong, 'questão errada foi', 'questões erradas foram')} para o caderno de erros, cada uma com um card de revisão do conceito.</p>` : ''}
    <section class="stack-sm" aria-label="Gabarito">
      <h2>Gabarito comentado</h2>
      ${z.ids.map((id, i) => {
        const q = store.questionById(id);
        const ok = z.picks[id] === q.answer;
        return `<button class="mode" data-act="q-review" data-v="${i}">
          <span class="badge ${ok ? 'good' : 'bad'}">${icon(ok ? 'check' : 'x')}</span>
          <span class="stack-xs grow"><strong>Questão ${i + 1} · ${esc(areaById(q.area).short)}</strong><span class="muted small clamp-1">${esc(q.stem)}</span></span>
          ${icon('next', 18)}
        </button>`;
      }).join('')}
    </section>
    <button class="btn primary big" data-act="quiz-exit">Voltar às questões</button>
  </div>`;
}

function viewQuizReview() {
  const z = ui.quiz;
  const id = z.ids[z.reviewIdx];
  const q = store.questionById(id);
  const pick = z.picks[id];
  const ok = pick === q.answer;
  return `<div class="screen stack quiz">
    <div class="row top"><button class="icon-btn" data-act="q-review-back" aria-label="Voltar ao resultado">${icon('back')}</button><p class="grow center-text strong">Questão ${z.reviewIdx + 1} de ${z.ids.length}</p><span class="icon-spacer"></span></div>
    ${questionHeader(q)}
    <p class="stem">${esc(q.stem)}</p>
    ${optionList(q, pick, true, 'noop', z.orders[id])}
    <div class="panel stack-sm feedback ${ok ? 'good' : 'bad'}">
      <p class="verdict ${ok ? 'good' : 'bad'}">${icon(ok ? 'check' : 'x', 18)} ${ok ? 'Você acertou' : pick == null ? `Sem resposta. Correta: ${letterOf(z.orders[id], q.answer)}` : `Você marcou ${letterOf(z.orders[id], pick)}. Correta: ${letterOf(z.orders[id], q.answer)}`}</p>
      <p>${esc(q.explanation)}</p>
    </div>
    <div class="grid-2">
      <button class="btn ghost big" data-act="q-review" data-v="${z.reviewIdx - 1}" ${z.reviewIdx === 0 ? 'disabled' : ''}>${icon('back', 18)} Anterior</button>
      <button class="btn primary big" data-act="q-review" data-v="${z.reviewIdx + 1}" ${z.reviewIdx === z.ids.length - 1 ? 'disabled' : ''}>Próxima ${icon('next', 18)}</button>
    </div>
  </div>`;
}

function startQuizTimer() {
  if (ui.quizTimer) return;
  ui.quizTimer = setInterval(() => {
    const z = ui.quiz;
    if (!z || z.finished || z.mode !== 'simulado') { stopQuizTimer(); return; }
    const left = (z.deadline - Date.now()) / 1000;
    const el = document.getElementById('quiz-timer');
    if (el) {
      el.textContent = fmtClock(left);
      el.classList.toggle('low', left < 120);
    }
    if (left <= 0) {
      finishQuiz();
      toast('Tempo esgotado. O simulado foi entregue.');
      render();
    }
  }, 1000);
}

function stopQuizTimer() {
  clearInterval(ui.quizTimer);
  ui.quizTimer = 0;
}

// ---------- caderno de erros ----------
function viewErrors() {
  const open = store.openErrors();
  const solved = Object.values(store.data.errors).filter((e) => e.solved).length;
  return `<div class="screen stack">
    <div class="row top"><button class="icon-btn" data-act="go" data-v="questions" aria-label="Voltar">${icon('back')}</button><h1 class="grow center-text h-sm">Caderno de erros</h1><span class="icon-spacer"></span></div>
    <p class="muted">Cada questão errada fica aqui até você acertá-la de novo, e o conceito vira um card na sua revisão.${solved ? ` ${plural(solved, 'questão já resolvida', 'questões já resolvidas')}.` : ''}</p>
    ${open.length ? `<button class="btn primary big" data-act="start-errors">${icon('repeat', 18)} Refazer ${plural(open.length, 'questão', 'questões')}</button>
      <div class="stack-sm">${open.map(([id, e]) => {
        const q = store.questionById(id);
        return `<article class="panel err">
          <div class="row"><span class="tag violet">${esc(areaById(q.area).short)} · ${esc(q.sub)}</span><span class="small bad-ink strong">errou ${e.count}x</span></div>
          <p class="clamp-2">${esc(q.stem)}</p>
          <p class="muted small">${icon('cards', 14)} Card criado: ${esc(q.fact.front)}</p>
        </article>`;
      }).join('')}</div>`
      : `<div class="panel empty stack-sm center-text"><span class="badge good xl center-self">${icon('check', 32)}</span><h2>Nenhuma questão pendente</h2><p class="muted small">Quando você errar uma questão no treino ou no simulado, ela aparece aqui.</p><button class="btn primary" data-act="go" data-v="questions">Resolver questões</button></div>`}
  </div>`;
}

// ---------- casos clínicos ----------
function viewCases() {
  return `<div class="screen stack">
    <div class="row top"><button class="icon-btn" data-act="go" data-v="questions" aria-label="Voltar">${icon('back')}</button><h1 class="grow center-text h-sm">Casos clínicos</h1><span class="icon-spacer"></span></div>
    <p class="muted">O caso se revela em etapas. Em cada uma, você decide a conduta antes de ver o que acontece.</p>
    ${CASES.map((c) => {
      const best = store.data.cases[c.id];
      return `<article class="panel stack-sm">
        <div class="row"><span class="tag violet">${esc(areaById(c.area).short)}</span><span class="muted small">${c.stages.length} etapas</span></div>
        <h2>${esc(c.title)}</h2>
        <p class="muted small clamp-2">${esc(c.intro)}</p>
        <div class="row"><span class="small ${best ? 'good-ink strong' : 'muted'}">${best ? `Melhor resultado: ${best.best}/${best.total}` : 'Ainda não resolvido'}</span>
        <button class="btn primary" data-act="start-case" data-v="${c.id}">${best ? 'Refazer' : 'Começar'}</button></div>
      </article>`;
    }).join('')}
  </div>`;
}

function viewCase() {
  const r = ui.caseRun;
  const c = CASES.find((x) => x.id === r.id);
  if (r.done) {
    const pct = Math.round((r.score / c.stages.length) * 100);
    return `<div class="screen stack center">
      <div class="badge ${pct >= 75 ? 'good' : 'amber'} xl">${icon('steth', 34)}</div>
      <h1>Caso concluído</h1>
      <p class="muted">${esc(c.title)}: ${r.score} de ${c.stages.length} decisões certas.</p>
      <button class="btn primary big" data-act="go" data-v="cases">Outros casos</button>
      <button class="btn ghost" data-act="start-case" data-v="${c.id}">Refazer este caso</button>
    </div>`;
  }
  const st = c.stages[r.stage];
  const timeline = c.stages.slice(0, r.stage).map((s, i) => `<li class="done">
      ${s.info ? `<p class="small">${esc(s.info)}</p>` : ''}
      <p class="small"><span class="${r.hits[i] ? 'good-ink' : 'bad-ink'} strong">${r.hits[i] ? 'Acertou' : 'Errou'}:</span> ${esc(s.options[s.answer])}</p>
    </li>`).join('');
  const ok = r.pick === st.answer;
  return `<div class="screen stack quiz">
    <div class="row gap-md">
      <button class="icon-btn" data-act="go" data-v="cases" aria-label="Sair do caso">${icon('close')}</button>
      <div class="steps grow" aria-label="Etapa ${r.stage + 1} de ${c.stages.length}">${c.stages.map((_, i) => `<span class="${i < r.stage ? 'done' : i === r.stage ? 'current' : ''}"></span>`).join('')}</div>
      <span class="muted strong">${r.stage + 1}/${c.stages.length}</span>
    </div>
    <p class="eyebrow">${esc(c.title)}</p>
    <section class="panel case-intro"><p>${esc(c.intro)}</p></section>
    ${timeline ? `<ol class="timeline">${timeline}</ol>` : ''}
    ${st.info ? `<section class="panel new-info"><p class="label">Nova informação</p><p>${esc(st.info)}</p></section>` : ''}
    <p class="stem">${esc(st.question)}</p>
    ${optionList(st, r.pick, r.confirmed, 'case-pick', r.orders[r.stage])}
    ${r.confirmed
      ? `<div class="panel stack-sm feedback ${ok ? 'good' : 'bad'}"><p class="verdict ${ok ? 'good' : 'bad'}">${icon(ok ? 'check' : 'x', 18)} ${ok ? 'Boa decisão' : `Melhor conduta: ${letterOf(r.orders[r.stage], st.answer)}`}</p><p>${esc(st.explanation)}</p></div>
         <button class="btn primary big" data-act="case-next">${r.stage < c.stages.length - 1 ? 'Continuar o caso' : 'Ver resultado'}</button>`
      : `<button class="btn primary big" data-act="case-confirm" ${r.pick == null ? 'disabled' : ''}>Confirmar conduta</button>`}
  </div>`;
}

// ---------- cronograma ----------
function weakestAreas() {
  return AREAS.map((a) => {
    const c = store.accuracy((x) => x.area === a.id);
    const q = store.questionAccuracy((x) => x.area === a.id);
    const total = c.total + q.total;
    const pct = total ? Math.round(((c.pct ?? 0) * c.total + (q.pct ?? 0) * q.total) / total) : null;
    const fresh = store.allCards().filter((x) => x.area === a.id && store.stateOf(x.id).state === 'new').length;
    return { area: a, pct, fresh };
  }).sort((x, y) => (x.pct ?? 101) - (y.pct ?? 101) || y.fresh - x.fresh).slice(0, 2);
}

function viewPlan() {
  const p = store.data.profile;
  const plan = store.plan();
  const back = `<div class="row top"><button class="icon-btn" data-act="go" data-v="home" aria-label="Voltar">${icon('back')}</button><h1 class="grow center-text h-sm">Cronograma</h1><span class="icon-spacer"></span></div>`;
  if (!plan) {
    return `<div class="screen stack">${back}
      <div class="panel empty stack-sm center-text"><span class="badge violet xl center-self">${icon('calendar', 32)}</span><h2>Defina a data da prova</h2><p class="muted small">Com a data, o app distribui o conteúdo novo até uma semana antes e reserva a reta final para revisão e simulados.</p><button class="btn primary" data-act="go" data-v="onboarding">Definir data</button></div>
    </div>`;
  }
  const total = store.allCards().length;
  const studied = total - store.newCardsLeft();
  const studiedPct = Math.round((studied / total) * 100);
  const [y, m, d] = p.dataProva.split('-').map(Number);
  const exam = new Date(y, m - 1, d);
  const due = store.dueQueue().length;
  const npd = store.newPerDay();
  const focus = weakestAreas();
  const phaseText = { content: 'Fase de conteúdo', final: 'Reta final', past: 'Prova realizada' }[plan.phase];
  const elapsedRatio = plan.phase === 'past' ? 1 : Math.max(0.03, 1 - plan.daysLeft / Math.max(plan.daysLeft, 60));
  return `<div class="screen stack">
    ${back}
    <section class="panel plan-hero">
      <p class="eyebrow amber-ink">${phaseText}</p>
      <p class="huge-num">${plan.daysLeft < 0 ? 'Passou' : plan.daysLeft}</p>
      <p class="muted">${plan.daysLeft < 0 ? '' : `${plan.daysLeft === 1 ? 'dia' : 'dias'} até a prova ${esc(p.prova)} · ${exam.toLocaleDateString('pt-BR')}`}</p>
      <div class="phase-track" aria-hidden="true"><span class="ph content"></span><span class="ph final"></span><span class="today" style="left:${Math.round(elapsedRatio * 100)}%"></span></div>
      <div class="row small muted"><span>Hoje</span><span>Reta final ${fmtDate(plan.finalStart)}</span><span>Prova</span></div>
    </section>

    <section class="panel stack-sm">
      <h2>Meta diária</h2>
      <div class="grid-3">
        <div class="metric"><p class="mid-num violet-ink">${npd}</p><p class="muted small">cards novos</p></div>
        <div class="metric"><p class="mid-num">${due}</p><p class="muted small">revisões hoje</p></div>
        <div class="metric"><p class="mid-num amber-ink">${store.data.settings.questionsPerDay}</p><p class="muted small">questões</p></div>
      </div>
      <p class="muted small">${store.data.settings.newPerDayAuto ? 'Os cards novos por dia são recalculados automaticamente conforme você avança.' : 'Cards novos por dia definidos manualmente em Ajustes.'}</p>
    </section>

    <section class="panel stack-sm">
      <div class="row"><h2>Conteúdo</h2><span class="small strong">${studied} de ${total} cards</span></div>
      <span class="bar"><span class="fill violet" style="width:${studiedPct}%"></span></span>
      <p class="muted small">${store.newCardsLeft() === 0 ? 'Todo o conteúdo já foi visto. Agora é revisar e fazer questões.'
        : plan.onTrack ? `No ritmo atual, você vê todo o conteúdo até ${fmtDate(plan.newEnds)}, antes da reta final.` : 'O prazo está curto: mesmo com o máximo de cards por dia, parte do conteúdo ficará para a reta final.'}</p>
    </section>

    <section class="panel stack-sm">
      <h2>Foco sugerido</h2>
      ${focus.map((f) => `<div class="focus-row">
        <div class="stack-xs grow"><strong>${f.area.name}</strong><span class="muted small">${f.pct == null ? `${plural(f.fresh, 'card novo', 'cards novos')}, ainda sem desempenho` : `${f.pct}% de acerto`}</span></div>
        <button class="btn ghost small" data-act="start-area" data-v="${f.area.id}">Cards</button>
        <button class="btn primary small" data-act="start-treino-area" data-v="${f.area.id}">Questões</button>
      </div>`).join('')}
    </section>

    <section class="panel stack-sm">
      <h2>Como o cronograma funciona</h2>
      <ol class="how small muted">
        <li>Até ${fmtDate(plan.finalStart)}: conteúdo novo todos os dias, mais as revisões que vencerem.</li>
        <li>Na última semana: só revisões, caderno de erros e simulados.</li>
        <li>Se você atrasar, a meta de cards novos sobe para compensar, até 40 por dia.</li>
      </ol>
    </section>
  </div>`;
}

// ---------- desempenho ----------
function heatTone(pct) {
  if (pct == null) return 'none';
  return pct < 60 ? 'bad' : pct < 75 ? 'amber' : pct < 85 ? 'good-soft' : 'good';
}

function viewStats() {
  const since = store.now() - 30 * DAY_MS;
  const recent = store.data.log.filter((l) => l.t >= since);
  const acc = recent.length ? Math.round((recent.filter((l) => l.g > 1).length / recent.length) * 100) : null;
  const studied = store.allCards().filter((c) => store.stateOf(c.id).state !== 'new').length;
  const mature = store.allCards().filter((c) => store.stateOf(c.id).s >= 21).length;

  const cells = [];
  for (const a of AREAS) for (const s of a.subtemas) {
    const r = store.accuracy((c) => c.area === a.id && c.sub === s);
    cells.push({ area: a, sub: s, ...r, key: `${a.id}|${s}` });
  }
  const withData = cells.filter((c) => c.pct != null);
  const weakest = withData.slice().sort((x, y) => x.pct - y.pct)[0];
  const sel = cells.find((c) => c.key === ui.selectedCell) || weakest || null;

  const rows = AREAS.map((a) => `<div class="heat-row">
    <span class="heat-label">${a.short}</span>
    <div class="heat-cells">${cells.filter((c) => c.area.id === a.id).map((c) => `<button class="cell ${heatTone(c.pct)} ${sel && sel.key === c.key ? 'sel' : ''}" data-act="cell" data-v="${esc(c.key)}" aria-label="${esc(c.sub)}: ${c.pct == null ? 'sem revisões' : `${c.pct}% de acerto`}">${c.pct == null ? '–' : c.pct}</button>`).join('')}</div>
  </div>`).join('');

  const qAcc = store.questionAccuracy();
  const qRows = AREAS.map((a) => {
    const r = store.questionAccuracy((q) => q.area === a.id);
    return `<div class="area-row"><span>${a.short}</span><span class="bar grow"><span class="fill ${r.pct == null ? 'violet' : r.pct >= 75 ? 'good' : r.pct >= 60 ? 'amber' : 'bad'}" style="width:${r.pct ?? 0}%"></span></span><span class="small strong">${r.pct == null ? '—' : `${r.pct}%`}</span></div>`;
  }).join('');
  const sims = store.data.simulados.slice(-5).reverse();

  return `<div class="screen stack">
    <header><h1>Desempenho</h1></header>
    <h2 class="section-title">Cards</h2>
    <div class="grid-3">
      <div class="panel tile"><p class="mid-num">${acc == null ? '—' : `${acc}%`}</p><p class="muted small">acerto em 30 dias</p></div>
      <div class="panel tile"><p class="mid-num violet-ink">${store.data.log.length}</p><p class="muted small">revisões feitas</p></div>
      <div class="panel tile"><p class="mid-num amber-ink">${studied}</p><p class="muted small">cards estudados${mature ? ` · ${mature} maduros` : ''}</p></div>
    </div>
    <section class="panel stack-sm" aria-label="Mapa por grande área">
      <div class="row"><h2>Mapa por grande área</h2><span class="muted small">1 quadro = 1 subtema</span></div>
      <div class="heat">${rows}</div>
      <div class="legend small muted"><span><i class="bad"></i>abaixo de 60%</span><span><i class="amber"></i>60 a 74%</span><span><i class="good-soft"></i>75 a 84%</span><span><i class="good"></i>85% ou mais</span></div>
    </section>
    ${sel ? `<section class="panel next stack-sm">
      <p class="eyebrow violet-ink">${sel === weakest && !ui.selectedCell ? 'Revisar a seguir' : 'Subtema selecionado'}</p>
      <p class="q-sm">${esc(sel.area.short)} · ${esc(sel.sub)}</p>
      <p class="muted small">${sel.pct == null ? 'Ainda sem revisões' : `${sel.pct}% de acerto em ${plural(sel.total, 'revisão', 'revisões')}`}</p>
      <button class="btn primary" data-act="start-sub" data-v="${esc(sel.key)}">Reforçar este subtema</button>
    </section>` : '<p class="panel note">Faça algumas revisões para o mapa mostrar seus pontos fortes e fracos.</p>'}

    <h2 class="section-title">Questões</h2>
    <div class="grid-3">
      <div class="panel tile"><p class="mid-num">${qAcc.pct == null ? '—' : `${qAcc.pct}%`}</p><p class="muted small">acerto</p></div>
      <div class="panel tile"><p class="mid-num violet-ink">${qAcc.total}</p><p class="muted small">respondidas</p></div>
      <div class="panel tile"><p class="mid-num bad-ink">${store.openErrors().length}</p><p class="muted small">no caderno de erros</p></div>
    </div>
    <section class="panel stack-sm"><h2>Acerto por grande área</h2>${qRows}</section>
    <section class="panel stack-sm">
      <h2>Últimos simulados</h2>
      ${sims.length ? sims.map((s) => `<div class="row"><span class="small">${new Date(s.t).toLocaleDateString('pt-BR')} · ${plural(s.total, 'questão', 'questões')}</span><span class="strong">${Math.round((s.correct / s.total) * 100)}% <span class="muted small">em ${fmtClock(s.seconds)}</span></span></div>`).join('')
        : '<p class="muted small">Nenhum simulado ainda.</p><button class="btn ghost" data-act="go" data-v="questions">Fazer um simulado</button>'}
    </section>
  </div>`;
}

// ---------- ajustes ----------
function accountPanel() {
  const u = store.data.user || {};
  const label = { google: 'Conta Google', demo: 'Google (modo demonstração)', guest: 'Sem conta' }[u.provider] || 'Sem conta';
  const initial = (u.name || store.data.profile?.nome || '').trim().charAt(0).toUpperCase();
  const avatar = u.picture
    ? `<img class="avatar" src="${esc(u.picture)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="avatar">${initial ? esc(initial) : icon('user', 24)}</span>`;
  return `<section class="panel stack-sm">
    <div class="row gap-md">${avatar}<div class="stack-xs grow"><strong>${esc(u.name || store.data.profile?.nome || 'Visitante')}</strong><span class="muted small">${esc(u.email || label)}</span></div></div>
    <button class="btn ghost" data-act="logout">Sair</button>
  </section>`;
}

function viewSettings() {
  const p = store.data.profile;
  const s = store.data.settings;
  const fase = FASES.find((f) => f.id === p.fase);
  const newOpts = [['auto', 'Automático (cronograma)'], ['5', '5'], ['10', '10'], ['15', '15'], ['20', '20'], ['30', '30']];
  const curNew = s.newPerDayAuto ? 'auto' : String(s.newPerDay);
  return `<div class="screen stack">
    <header><h1>Ajustes</h1></header>
    ${accountPanel()}
    <section class="panel stack-sm">
      <h2>Cores do app</h2>
      <div class="palettes" role="group" aria-label="Paleta de cores">${PALETTES.map((pl) => `<button class="palette ${(s.palette || 'azul') === pl.id ? 'on' : ''}" data-act="palette" data-v="${pl.id}" aria-pressed="${(s.palette || 'azul') === pl.id}">
        <span class="swatch" aria-hidden="true"><i style="background:${pl.main}"></i><i style="background:${pl.acc}"></i></span>${pl.name}</button>`).join('')}</div>
    </section>
    <section class="panel stack-sm">
      <h2>Estudo</h2>
      <label class="switch-row" for="set-type">
        <span class="stack-xs grow"><strong>Digitar a resposta nas lacunas</strong><span class="muted small">O app confere o que você escreveu, aceita sinônimos e pequenos erros de digitação, e sugere a nota.</span></span>
        <input type="checkbox" id="set-type" class="switch" data-set="typeAnswers" ${s.typeAnswers ? 'checked' : ''}>
      </label>
      <label class="field" for="set-new">Cards novos por dia
        <select id="set-new" data-set="newPerDay">${newOpts.map(([v, l]) => `<option value="${v}" ${v === curNew ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </label>
      <label class="field" for="set-q">Meta de questões por dia
        <select id="set-q" data-set="questionsPerDay">${[5, 10, 20, 30].map((v) => `<option value="${v}" ${v === s.questionsPerDay ? 'selected' : ''}>${v}</option>`).join('')}</select>
      </label>
    </section>
    <section class="panel stack-sm">
      <h2>Seu perfil</h2>
      <dl class="kv"><dt>Nome</dt><dd>${esc(p.nome || '—')}</dd><dt>Fase</dt><dd>${esc(fase ? fase.name : '—')}</dd><dt>Prova</dt><dd>${esc(p.prova)}</dd><dt>Data da prova</dt><dd>${p.dataProva ? esc(p.dataProva.split('-').reverse().join('/')) : '—'}</dd></dl>
      <button class="btn ghost" data-act="go" data-v="onboarding">Editar perfil</button>
    </section>
    <section class="panel stack-sm">
      <h2>Modo de teste</h2>
      <p class="muted small">Avance o relógio do app para ver os cards voltarem nas datas que o algoritmo calculou.${store.data.offsetDays ? ` Relógio adiantado em ${plural(store.data.offsetDays, 'dia', 'dias')}.` : ''}</p>
      <button class="btn primary" data-act="advance">Avançar 1 dia</button>
    </section>
    <section class="panel stack-sm">
      <h2>Dados</h2>
      <p class="muted small">Seu progresso fica salvo só neste aparelho e neste navegador.</p>
      ${ui.confirmReset
        ? '<p class="small">Apagar todo o progresso, cards criados, questões e perfil?</p><div class="grid-2"><button class="btn ghost" data-act="reset-cancel">Cancelar</button><button class="btn bad-solid" data-act="reset-do">Apagar tudo</button></div>'
        : '<button class="btn ghost bad-ink" data-act="reset-ask">Apagar progresso</button>'}
    </section>
    <section class="panel stack-sm">
      <h2>Versão</h2>
      <p class="muted small">Sinapse · protótipo ${APP_VERSION} · algoritmo FSRS-4.5. O app se atualiza sozinho ao abrir; se algo parecer antigo, busque a atualização.</p>
      <button class="btn ghost" data-act="force-update">Buscar atualização</button>
    </section>
  </div>`;
}

// ---------- navegação ----------
const TAB_OF = { home: 'home', plan: 'home', study: 'study', create: 'study', ia: 'study', review: 'study', questions: 'questions', quiz: 'questions', errors: 'questions', cases: 'questions', case: 'questions', stats: 'stats', settings: 'settings' };

// Cabeçalho fixo com a logo; o traçado do batimento se desenha em looping.
function appbar() {
  return `<header class="appbar">
    <button class="brand" data-act="go" data-v="${store.data.profile ? 'home' : ui.view}" aria-label="Sinapse, ir para o início">
      <svg class="brand-logo" viewBox="0 0 512 512" aria-hidden="true">
        <rect width="512" height="512" rx="120" class="logo-bg"/>
        <path class="brand-line-track" d="M96 296 H176 L208 232 L256 360 L304 152 L336 296 H416"/>
        <path class="brand-line" d="M96 296 H176 L208 232 L256 360 L304 152 L336 296 H416" pathLength="100"/>
        <circle class="brand-ring" cx="416" cy="296" r="30"/>
        <circle class="brand-dot" cx="416" cy="296" r="30"/>
      </svg>
      <span class="brand-name">Sinapse</span>
    </button>
  </header>`;
}

function nav() {
  const current = TAB_OF[ui.view];
  const items = [['home', 'Início', 'home'], ['study', 'Estudar', 'cards'], ['questions', 'Questões', 'quiz'], ['stats', 'Desempenho', 'chart'], ['settings', 'Ajustes', 'gear']];
  return `<nav class="tabbar" aria-label="Navegação principal">${items.map(([v, label, ic]) =>
    `<button class="${current === v ? 'on' : ''}" data-act="go" data-v="${v}" ${current === v ? 'aria-current="page"' : ''}>${icon(ic, 22)}<span>${label}</span></button>`).join('')}</nav>`;
}

const FULLSCREEN = ['login', 'onboarding', 'review', 'quiz', 'case'];

function render() {
  const views = { login: viewLogin, onboarding: viewOnboarding, home: viewHome, study: viewStudy, review: viewReview, create: viewCreate, ia: viewIA, questions: viewQuestions, quiz: viewQuiz, errors: viewErrors, cases: viewCases, case: viewCase, plan: viewPlan, stats: viewStats, settings: viewSettings };
  if (ui.stopFx) { ui.stopFx(); ui.stopFx = null; }
  const showNav = !FULLSCREEN.includes(ui.view) || (ui.view === 'quiz' && ui.quiz && ui.quiz.finished);
  const showBar = ui.view !== 'login';
  root.innerHTML = (showBar ? appbar() : '') + views[ui.view]() + (showNav ? nav() : '');
  document.body.classList.toggle('has-bar', showBar);
  document.body.classList.toggle('has-nav', showNav);
  document.body.classList.toggle('on-login', ui.view === 'login');
  if (ui.view === 'login') mountLogin();
  if (ui.view === 'quiz' && ui.quiz && ui.quiz.mode === 'simulado' && !ui.quiz.finished) startQuizTimer();
  else stopQuizTimer();
  const first = root.querySelector('.gap-input');
  if (first) first.focus({ preventScroll: true });
}

function go(view) {
  ui.view = view;
  ui.confirmReset = false;
  render();
  window.scrollTo(0, 0);
}

function startSession(title, ids, opts = {}) {
  if (!ids.length) { toast('Nada para revisar agora.'); return; }
  ui.session = { title, queue: ids, done: 0, correct: 0, retried: {}, practice: !!opts.practice, quick: !!opts.quick };
  ui.revealed = false;
  ui.typed = null;
  ui.cardAnim = 'enter';
  go('review');
}

function nextCard() {
  ui.revealed = false;
  ui.typed = null;
  ui.cardAnim = 'enter';
  render();
  window.scrollTo(0, 0);
}

// Vira o card: metade da volta, troca para o verso e completa a volta.
function flipToAnswer(prepare) {
  animateCard('flip-out', 160, () => {
    prepare();
    ui.revealed = true;
    ui.cardAnim = 'flip-in';
    render();
  });
}

function grade(g) {
  animateCard(g === 1 ? 'leave-left' : 'leave-right', 230, () => {
    const s = ui.session;
    const id = s.queue.shift();
    const next = store.answer(id, g);
    s.done += 1;
    if (g > 1) s.correct += 1;
    // Card errado volta ainda nesta sessão.
    if (next.state === 'learning') s.queue.push(id);
    nextCard();
  });
}

function practiceAnswer(ok) {
  animateCard(ok ? 'leave-right' : 'leave-left', 230, () => {
    const s = ui.session;
    const id = s.queue.shift();
    store.practice(id, ok);
    s.done += 1;
    if (ok) s.correct += 1;
    else if (!s.retried[id]) { s.retried[id] = true; s.queue.push(id); }
    nextCard();
  });
}

// Pular não mexe na agenda: na primeira vez o card vai para o fim da sessão;
// se pular de novo (ou for o último), ele fica para depois.
function skipCard() {
  const s = ui.session;
  const id = s.queue[0];
  s.skipped = s.skipped || {};
  animateCard('leave-up', 230, () => {
    s.queue.shift();
    if (!s.skipped[id] && s.queue.length) {
      s.skipped[id] = true;
      s.queue.push(id);
      toast('Card pulado. Ele volta no fim da sessão.');
    } else {
      s.leftOut = (s.leftOut || 0) + 1;
      toast('Card deixado para depois. Ele continua na sua revisão.');
    }
    nextCard();
  });
}

function checkTyped() {
  const s = ui.session;
  const card = store.cardById(s.queue[0]);
  const { gaps } = parseCloze(card.text);
  const values = gaps.map((_, i) => {
    const el = document.getElementById(`gap-${i}`);
    return el ? el.value.trim() : '';
  });
  const results = gaps.map((g, i) => checkAnswer(values[i], g.answers));
  const typed = { values, results, allOk: results.every((r) => r.ok) };
  flipToAnswer(() => { ui.typed = typed; });
}

const actions = {
  'onb-prova': (v) => { ui.onbProva = v; render(); },
  go: (v) => {
    if (v === 'questions' || v === 'errors' || v === 'cases') { ui.quiz = null; ui.caseRun = null; }
    go(v);
  },
  noop: () => {},
  'start-all': () => startSession('Revisão do dia', store.dueQueue().map((c) => c.id)),
  'start-quick': () => startSession('Modo 5 minutos', store.dueQueue({ limit: 10 }).map((c) => c.id), { quick: true }),
  'start-weak': () => startSession('Reforço dos erros', shuffle(store.weakCards().map((c) => c.id)), { practice: true }),
  'start-area': (v) => {
    const due = store.dueQueue().filter((c) => c.area === v).map((c) => c.id);
    if (due.length) startSession(areaById(v).name, due);
    else startSession(`${areaById(v).name} · reforço`, shuffle(store.allCards().filter((c) => c.area === v).map((c) => c.id)).slice(0, 15), { practice: true });
  },
  'start-sub': (v) => {
    const [a, sub] = v.split('|');
    startSession(sub, shuffle(store.allCards().filter((c) => c.area === a && c.sub === sub).map((c) => c.id)), { practice: true });
  },
  reveal: () => flipToAnswer(() => {}),
  skip: () => skipCard(),
  palette: (v) => { store.setSetting('palette', v); applyPalette(); render(); toast('Cores atualizadas.'); },
  'check-typed': () => checkTyped(),
  'dont-know': () => {
    const card = store.cardById(ui.session.queue[0]);
    const { gaps } = parseCloze(card.text);
    flipToAnswer(() => { ui.typed = { values: gaps.map(() => ''), results: gaps.map(() => ({ ok: false })), allOk: false }; });
  },
  grade: (v) => grade(Number(v)),
  practice: (v) => practiceAnswer(v === '1'),
  'end-session': () => { ui.session = null; go('home'); },
  report: () => toast('Obrigado. O erro foi anotado para revisão.'),
  'create-type': (v) => { ui.createType = v; render(); },
  'ia-demo': () => { ui.iaCards = IA_DEMO.cards.map((c) => ({ ...c, status: 'pending' })); render(); },
  'ia-back': () => { ui.iaCards = null; render(); },
  'ia-approve': (v) => { ui.iaCards[v].status = 'approved'; render(); },
  'ia-discard': (v) => { ui.iaCards[v].status = 'discarded'; render(); },
  'ia-save': () => {
    const keep = ui.iaCards.filter((c) => c.status !== 'discarded');
    keep.forEach(({ status, ...c }) => store.addCustom({ ...c, area: IA_DEMO.area, sub: IA_DEMO.sub }));
    ui.iaCards = null;
    toast(`${plural(keep.length, 'card salvo', 'cards salvos')} em Cardiologia.`);
    go('home');
  },
  cell: (v) => { ui.selectedCell = v; render(); },

  // questões
  'q-area': (v) => { ui.qArea = v; render(); },
  'q-count': (v) => { ui.qCount = Number(v); render(); },
  'sim-size': (v) => { ui.simSize = Number(v); render(); },
  'start-treino': () => {
    const ids = QUESTIONS.filter((q) => ui.qArea === 'all' || q.area === ui.qArea).map((q) => q.id);
    const title = ui.qArea === 'all' ? 'Treino' : `Treino · ${areaById(ui.qArea).short}`;
    startQuiz('treino', pickQuestions(ids, ui.qCount), title);
  },
  'start-treino-area': (v) => startQuiz('treino', pickQuestions(QUESTIONS.filter((q) => q.area === v).map((q) => q.id), 10), `Treino · ${areaById(v).short}`),
  'start-daily-q': () => {
    const left = Math.max(1, store.data.settings.questionsPerDay - store.questionsToday().length);
    startQuiz('treino', pickQuestions(QUESTIONS.map((q) => q.id), left), 'Questões do dia');
  },
  'start-simulado': () => startQuiz('simulado', shuffle(QUESTIONS.map((q) => q.id)).slice(0, ui.simSize), `Simulado ${ui.simSize} questões`),
  'start-errors': () => startQuiz('erros', shuffle(store.openErrors().map(([id]) => id)), 'Caderno de erros'),
  'q-pick': (v) => {
    const z = ui.quiz;
    const id = z.ids[z.idx];
    if (z.mode !== 'simulado' && z.confirmed[id]) return;
    z.picks[id] = Number(v);
    render();
  },
  'q-confirm': () => {
    const z = ui.quiz;
    const id = z.ids[z.idx];
    if (z.picks[id] == null) return;
    z.confirmed[id] = true;
    const ok = z.picks[id] === store.questionById(id).answer;
    const res = store.answerQuestion(id, ok, z.mode);
    z.created[id] = res.createdCard || !ok;
    render();
  },
  'q-next': () => {
    const z = ui.quiz;
    if (z.idx < z.ids.length - 1) { z.idx += 1; render(); window.scrollTo(0, 0); return; }
    finishQuiz();
    render();
    window.scrollTo(0, 0);
  },
  'q-prev': () => { const z = ui.quiz; if (z.idx > 0) { z.idx -= 1; render(); window.scrollTo(0, 0); } },
  'q-go': (v) => { ui.quiz.idx = Number(v); render(); window.scrollTo(0, 0); },
  'sim-submit': () => { ui.quiz.confirmSubmit = true; render(); },
  'sim-cancel': () => { ui.quiz.confirmSubmit = false; render(); },
  'sim-finish': () => { finishQuiz(); render(); window.scrollTo(0, 0); },
  'q-review': (v) => { ui.quiz.reviewIdx = Number(v); render(); window.scrollTo(0, 0); },
  'q-review-back': () => { ui.quiz.reviewIdx = null; render(); },
  'quiz-exit': () => {
    const z = ui.quiz;
    // Treino interrompido: as respostas já confirmadas ficam salvas.
    if (z && z.mode === 'simulado' && !z.finished) toast('Simulado cancelado. Nada foi salvo.');
    ui.quiz = null;
    stopQuizTimer();
    go('questions');
  },

  // casos clínicos
  'start-case': (v) => {
    const c = CASES.find((x) => x.id === v);
    ui.caseRun = { id: v, stage: 0, pick: null, confirmed: false, score: 0, hits: [], done: false, orders: c.stages.map(optionOrder) };
    go('case');
  },
  'case-pick': (v) => { if (!ui.caseRun.confirmed) { ui.caseRun.pick = Number(v); render(); } },
  'case-confirm': () => {
    const r = ui.caseRun;
    const c = CASES.find((x) => x.id === r.id);
    if (r.pick == null) return;
    r.confirmed = true;
    const ok = r.pick === c.stages[r.stage].answer;
    r.hits.push(ok);
    if (ok) r.score += 1;
    render();
  },
  'case-next': () => {
    const r = ui.caseRun;
    const c = CASES.find((x) => x.id === r.id);
    if (r.stage < c.stages.length - 1) {
      r.stage += 1;
      r.pick = null;
      r.confirmed = false;
    } else {
      r.done = true;
      store.saveCase(r.id, r.score, c.stages.length);
    }
    render();
    window.scrollTo(0, 0);
  },

  'force-update': () => forceUpdate(),
  advance: () => { store.advanceDay(); toast('Relógio adiantado em 1 dia.'); render(); },
  'reset-ask': () => { ui.confirmReset = true; render(); },
  'reset-cancel': () => { ui.confirmReset = false; render(); },
  'reset-do': () => { store.reset(); ui.session = null; ui.quiz = null; ui.confirmReset = false; go('login'); },
  google: () => {
    if (GOOGLE_CLIENT_ID && window.google && window.google.accounts) {
      window.google.accounts.id.prompt();
      return;
    }
    toast('Modo demonstração: o login do Google ainda não foi configurado.');
    finishLogin({ name: '', email: '', picture: '', provider: 'demo' });
  },
  guest: () => finishLogin({ name: '', email: '', picture: '', provider: 'guest' }),
  logout: () => {
    try { if (window.google && window.google.accounts) window.google.accounts.id.disableAutoSelect(); } catch (e) { /* sem Google */ }
    store.signOut();
    ui.session = null;
    ui.quiz = null;
    go('login');
  },
};

root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || ui.animating) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el.dataset.v);
});

root.addEventListener('change', (e) => {
  const el = e.target.closest('[data-set]');
  if (!el) return;
  const key = el.dataset.set;
  if (key === 'typeAnswers') store.setSetting('typeAnswers', el.checked);
  if (key === 'questionsPerDay') store.setSetting('questionsPerDay', Number(el.value));
  if (key === 'newPerDay') {
    if (el.value === 'auto') store.setSetting('newPerDayAuto', true);
    else { store.setSetting('newPerDayAuto', false); store.setSetting('newPerDay', Number(el.value)); }
  }
  toast('Ajuste salvo.');
});

root.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id === 'type-form') { if (!ui.animating) checkTyped(); return; }
  const f = new FormData(e.target);
  if (e.target.id === 'onb') {
    const wasNew = !store.data.profile;
    store.data.profile = {
      nome: String(f.get('nome') || '').trim(),
      fase: f.get('fase') || 'residencia',
      prova: ui.onbProva || store.data.profile?.prova || 'ENARE',
      dataProva: f.get('dataProva') || '',
    };
    store.save();
    toast(wasNew ? 'Tudo pronto. Bons estudos!' : 'Perfil salvo.');
    go(wasNew ? 'home' : 'settings');
  }
  if (e.target.id === 'create') {
    const err = document.getElementById('cr-error');
    const [area, sub] = String(f.get('area')).split('|');
    const extra = String(f.get('extra') || '').trim();
    let card;
    if (ui.createType === 'cloze') {
      const text = String(f.get('text') || '').trim();
      if (!/\{\{.+?\}\}/.test(text)) {
        err.textContent = 'Marque a parte escondida com chaves duplas, por exemplo {{resposta}}.';
        err.hidden = false;
        return;
      }
      card = { type: 'cloze', text };
    } else {
      const front = String(f.get('front') || '').trim();
      const back = String(f.get('back') || '').trim();
      if (!front || !back) {
        err.textContent = 'Preencha a frente e o verso do card.';
        err.hidden = false;
        return;
      }
      card = { type: 'basic', front, back };
    }
    store.addCustom({ ...card, area, sub, ...(extra ? { extra } : {}) });
    toast('Card salvo. Ele aparece na revisão de hoje.');
    render();
  }
});

document.addEventListener('keydown', (e) => {
  const inField = e.target.closest && e.target.closest('input, textarea, select');
  if (ui.animating) return;
  if (ui.view === 'review' && ui.session && ui.session.queue.length) {
    if (inField) return; // Enter dentro da lacuna envia o formulário
    if (e.key === 'p' || e.key === 'P') { skipCard(); return; }
    if (!ui.revealed && (e.code === 'Space' || e.key === 'Enter')) {
      e.preventDefault();
      if (typingOn(store.cardById(ui.session.queue[0]))) checkTyped(); else actions.reveal();
    } else if (ui.revealed && !ui.session.practice && ['1', '2', '3', '4'].includes(e.key)) grade(Number(e.key));
    return;
  }
  if (ui.view === 'quiz' && ui.quiz && !ui.quiz.finished && !inField) {
    const k = e.key.toUpperCase();
    const pos = LETTERS.indexOf(k);
    if (pos >= 0) actions['q-pick'](String(ui.quiz.orders[ui.quiz.ids[ui.quiz.idx]][pos]));
    else if (e.key === 'Enter' && ui.quiz.mode !== 'simulado') {
      const id = ui.quiz.ids[ui.quiz.idx];
      if (ui.quiz.confirmed[id]) actions['q-next'](); else actions['q-confirm']();
    }
  }
});

applyPalette();
render();

// Atualização automática: quando sai uma versão nova, o service worker novo assume
// e a página recarrega uma vez, sem precisar limpar nada no celular.
if ('serviceWorker' in navigator && /^(https:|http:\/\/localhost|http:\/\/127\.0\.0\.1)/.test(location.href)) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
    const check = () => reg.update().catch(() => {});
    check();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  }).catch(() => {});
}

// Ajustes → "Buscar atualização": apaga a cópia guardada e recarrega.
async function forceUpdate() {
  toast('Buscando a versão mais recente...');
  try {
    if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
    if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  } catch (e) { /* segue para o recarregamento */ }
  location.reload();
}
