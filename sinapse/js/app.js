// Sinapse — protótipo. Interface em JavaScript puro, sem dependências.
import { AREAS, PROVAS, FASES, ECG_REGIONS, IA_DEMO } from './data.js';
import { store } from './store.js';
import { scheduleAll, formatInterval, DAY_MS } from './fsrs.js';

const ui = {
  view: store.data.profile ? 'home' : 'onboarding',
  session: null,      // { title, queue: [ids], done, total }
  revealed: false,
  iaCards: null,      // sugestões da demonstração
  selectedCell: null, // subtema escolhido no mapa
  confirmReset: false,
  onbProva: null,
  createType: 'cloze',
};

const root = document.getElementById('app');

// ---------- utilitários ----------
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function areaById(id) { return AREAS.find((a) => a.id === id); }

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 2200);
}

const icons = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 3-5 5-5 8 0 4 3 7 7 7z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
};

function icon(name, size = 20) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
}

// ---------- conteúdo dos cards ----------
function clozeHtml(text, reveal) {
  return esc(text).replace(/\{\{(.+?)\}\}/g, (_, ans) =>
    reveal ? `<mark class="gap gap-open">${ans}</mark>` : '<span class="gap" aria-label="lacuna">[...]</span>');
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

function cardBody(c, reveal) {
  if (c.type === 'cloze') {
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

// ---------- telas ----------
function viewOnboarding() {
  const p = store.data.profile || {};
  const prova = ui.onbProva ?? p.prova ?? 'ENARE';
  return `<form class="screen stack" id="onb" novalidate>
    <header class="stack-sm">
      <p class="eyebrow">Sinapse</p>
      <h1>Vamos montar seu estudo</h1>
      <p class="muted">O app organiza os cards e o cronograma de acordo com a sua fase e a sua prova.</p>
    </header>
    <label class="field" for="onb-nome">Como quer ser chamado?
      <input id="onb-nome" name="nome" type="text" autocomplete="given-name" value="${esc(p.nome || '')}" placeholder="Seu nome">
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

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const today = new Date(store.now()); today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / DAY_MS);
}

function viewHome() {
  const p = store.data.profile;
  const queue = store.dueQueue();
  const done = store.reviewsToday().length;
  const total = done + queue.length;
  const pct = total ? Math.round((done / total) * 100) : 100;
  const circ = 2 * Math.PI * 40;
  const fase = FASES.find((f) => f.id === p.fase);
  const dias = daysUntil(p.dataProva);
  const minutes = Math.max(1, Math.round(queue.length * 0.45));

  const decks = AREAS.map((a) => {
    const cards = store.allCards().filter((c) => c.area === a.id);
    const studied = cards.filter((c) => store.stateOf(c.id).state !== 'new').length;
    const due = store.dueQueue({ filter: (c) => c.area === a.id }).length;
    const acc = store.accuracy((c) => c.area === a.id).pct;
    const tone = acc == null ? 'violet' : acc >= 75 ? 'good' : acc >= 60 ? 'amber' : 'bad';
    return `<button class="deck" data-act="start-area" data-v="${a.id}">
      <span class="row"><strong>${a.name}</strong><span class="muted">${due ? `${due} para hoje` : 'em dia'}</span></span>
      <span class="bar"><span class="fill ${tone}" style="width:${Math.round((studied / cards.length) * 100)}%"></span></span>
      <span class="row small muted"><span>${studied} de ${cards.length} cards estudados</span><span>${acc == null ? 'sem revisões' : `${acc}% de acerto`}</span></span>
    </button>`;
  }).join('');

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
          <p class="big-num">${queue.length} ${queue.length === 1 ? 'card' : 'cards'}</p>
          <p class="muted small">${queue.length ? `cerca de ${minutes} min · ${done} já feitos` : `${done} feitos hoje`}</p>
        </div>
      </div>
      ${queue.length
        ? `<button class="btn primary big" data-act="start-all">${icon('play', 18)} ${done ? 'Continuar revisão' : 'Começar revisão'}</button>`
        : '<p class="done-note">Tudo revisado por hoje. Para testar o agendamento, avance um dia em Ajustes.</p>'}
    </section>

    <div class="grid-2">
      <div class="panel tile"><span class="badge amber">${icon('flame')}</span><p class="mid-num">${store.streak()} ${store.streak() === 1 ? 'dia' : 'dias'}</p><p class="muted small">sequência de estudo</p></div>
      <div class="panel tile"><span class="badge violet">${icon('calendar')}</span>
        ${dias == null ? '<p class="mid-num">—</p><p class="muted small">defina a data da prova em Ajustes</p>'
          : `<p class="mid-num">${dias < 0 ? 'Passou' : `${dias} ${dias === 1 ? 'dia' : 'dias'}`}</p><p class="muted small">até a prova ${esc(p.prova)}</p>`}
      </div>
    </div>

    <button class="btn quick" data-act="start-quick" ${queue.length ? '' : 'disabled'}>
      <span class="row gap-sm">${icon('bolt')} Modo 5 minutos</span><span class="small">10 cards</span>
    </button>

    <section class="stack-sm" aria-label="Decks">
      <h2>Grandes áreas</h2>
      ${decks}
    </section>
  </div>`;
}

function viewReview() {
  const s = ui.session;
  if (!s || !s.queue.length) return viewSessionDone();
  const card = store.cardById(s.queue[0]);
  const area = areaById(card.area);
  const progress = Math.round((s.done / (s.done + s.queue.length)) * 100);
  let actions;
  if (!ui.revealed) {
    actions = '<button class="btn primary big" data-act="reveal">Mostrar resposta <kbd>espaço</kbd></button>';
  } else {
    const now = store.now();
    const next = scheduleAll(store.stateOf(card.id), now);
    const names = { 1: 'De novo', 2: 'Difícil', 3: 'Bom', 4: 'Fácil' };
    const tones = { 1: 'bad', 2: 'amber', 3: 'primary', 4: 'good' };
    actions = `<div class="grades">${[1, 2, 3, 4].map((g) => `<button class="grade ${tones[g]}" data-act="grade" data-v="${g}">
      <strong>${names[g]}</strong><span>${formatInterval(next[g].due - now)}</span></button>`).join('')}</div>`;
  }
  return `<div class="screen stack review">
    <div class="row gap-md">
      <button class="icon-btn" data-act="end-session" aria-label="Encerrar sessão">${icon('close')}</button>
      <div class="bar grow" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><span class="fill violet" style="width:${progress}%"></span></div>
      <span class="muted strong">${s.done + 1}/${s.done + s.queue.length}</span>
    </div>
    <div class="row gap-sm wrap">
      <span class="tag violet">${esc(area.short)} · ${esc(card.sub)}</span>
      <span class="tag">${typeLabel(card)}</span>
    </div>
    <article class="panel flash ${ui.revealed ? 'revealed' : ''}" aria-live="polite">
      ${cardBody(card, ui.revealed)}
      ${ui.revealed ? `<div class="row card-tools"><button class="btn ghost small" data-act="report">${icon('flag', 16)} Reportar erro</button></div>` : ''}
    </article>
    <div class="actions">${actions}</div>
    ${ui.revealed ? '<p class="hint">Atalhos: 1 De novo · 2 Difícil · 3 Bom · 4 Fácil</p>' : ''}
  </div>`;
}

function viewSessionDone() {
  const s = ui.session;
  const today = store.reviewsToday();
  const ok = today.filter((l) => l.g > 1).length;
  return `<div class="screen stack center">
    <div class="badge good xl">${icon('check', 36)}</div>
    <h1>Sessão concluída</h1>
    <p class="muted">${s ? `${s.done} ${s.done === 1 ? 'revisão' : 'revisões'} nesta sessão.` : ''} Hoje: ${today.length} revisões, ${today.length ? Math.round((ok / today.length) * 100) : 0}% de acerto.</p>
    <button class="btn primary big" data-act="go" data-v="home">Voltar ao início</button>
    <button class="btn ghost" data-act="go" data-v="stats">Ver desempenho</button>
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
        <textarea id="cr-text" name="text" rows="4" placeholder="A droga de escolha na crise convulsiva da eclâmpsia é o {{sulfato de magnésio}}."></textarea>
        <small class="muted">Coloque a parte escondida entre chaves duplas: {{assim}}.</small>
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

  return `<div class="screen stack">
    <header><h1>Desempenho</h1></header>
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
      <p class="muted small">${sel.pct == null ? 'Ainda sem revisões' : `${sel.pct}% de acerto em ${sel.total} ${sel.total === 1 ? 'revisão' : 'revisões'}`}</p>
      <button class="btn primary" data-act="start-sub" data-v="${esc(sel.key)}">Revisar este subtema</button>
    </section>` : '<p class="panel note">Faça algumas revisões para o mapa mostrar seus pontos fortes e fracos.</p>'}
  </div>`;
}

function viewSettings() {
  const p = store.data.profile;
  const fase = FASES.find((f) => f.id === p.fase);
  return `<div class="screen stack">
    <header><h1>Ajustes</h1></header>
    <section class="panel stack-sm">
      <h2>Seu perfil</h2>
      <dl class="kv"><dt>Nome</dt><dd>${esc(p.nome || '—')}</dd><dt>Fase</dt><dd>${esc(fase ? fase.name : '—')}</dd><dt>Prova</dt><dd>${esc(p.prova)}</dd><dt>Data da prova</dt><dd>${p.dataProva ? esc(p.dataProva.split('-').reverse().join('/')) : '—'}</dd></dl>
      <button class="btn ghost" data-act="go" data-v="onboarding">Editar perfil</button>
    </section>
    <section class="panel stack-sm">
      <h2>Modo de teste</h2>
      <p class="muted small">Avance o relógio do app para ver os cards voltarem nas datas que o algoritmo calculou.${store.data.offsetDays ? ` Relógio adiantado em ${store.data.offsetDays} ${store.data.offsetDays === 1 ? 'dia' : 'dias'}.` : ''}</p>
      <button class="btn primary" data-act="advance">Avançar 1 dia</button>
    </section>
    <section class="panel stack-sm">
      <h2>Dados</h2>
      <p class="muted small">Seu progresso fica salvo só neste aparelho e neste navegador.</p>
      ${ui.confirmReset
        ? '<p class="small">Apagar todo o progresso, cards criados e perfil?</p><div class="grid-2"><button class="btn ghost" data-act="reset-cancel">Cancelar</button><button class="btn bad-solid" data-act="reset-do">Apagar tudo</button></div>'
        : '<button class="btn ghost bad-ink" data-act="reset-ask">Apagar progresso</button>'}
    </section>
    <p class="muted small center-text">Sinapse · protótipo 0.1 · algoritmo FSRS-4.5</p>
  </div>`;
}

function nav() {
  const items = [['home', 'Início', 'home'], ['create', 'Criar', 'plus'], ['ia', 'IA', 'spark'], ['stats', 'Desempenho', 'chart'], ['settings', 'Ajustes', 'gear']];
  return `<nav class="tabbar" aria-label="Navegação principal">${items.map(([v, label, ic]) =>
    `<button class="${ui.view === v ? 'on' : ''}" data-act="go" data-v="${v}" ${ui.view === v ? 'aria-current="page"' : ''}>${icon(ic, 22)}<span>${label}</span></button>`).join('')}</nav>`;
}

// ---------- render e eventos ----------
function render() {
  const views = { onboarding: viewOnboarding, home: viewHome, review: viewReview, create: viewCreate, ia: viewIA, stats: viewStats, settings: viewSettings };
  const showNav = !['onboarding', 'review'].includes(ui.view);
  root.innerHTML = views[ui.view]() + (showNav ? nav() : '');
  document.body.classList.toggle('has-nav', showNav);
}

function go(view) {
  ui.view = view;
  ui.confirmReset = false;
  render();
  window.scrollTo(0, 0);
}

function startSession(title, ids) {
  if (!ids.length) { toast('Nada para revisar agora.'); return; }
  ui.session = { title, queue: ids, done: 0 };
  ui.revealed = false;
  go('review');
}

function grade(g) {
  const s = ui.session;
  const id = s.queue.shift();
  const next = store.answer(id, g);
  s.done += 1;
  // Card errado volta ainda nesta sessão.
  if (next.state === 'learning') s.queue.push(id);
  ui.revealed = false;
  render();
}

const actions = {
  'onb-prova': (v) => { ui.onbProva = v; render(); },
  go: (v) => go(v),
  'start-all': () => startSession('Revisão do dia', store.dueQueue().map((c) => c.id)),
  'start-quick': () => startSession('Modo 5 minutos', store.dueQueue({ limit: 10 }).map((c) => c.id)),
  'start-area': (v) => startSession(areaById(v).name, store.dueQueue({ filter: (c) => c.area === v }).map((c) => c.id)),
  'start-sub': (v) => {
    const [a, sub] = v.split('|');
    const ids = store.allCards().filter((c) => c.area === a && c.sub === sub).map((c) => c.id);
    startSession(sub, ids);
  },
  reveal: () => { ui.revealed = true; render(); },
  grade: (v) => grade(Number(v)),
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
    toast(`${keep.length} cards salvos em Cardiologia.`);
    go('home');
  },
  cell: (v) => { ui.selectedCell = v; render(); },
  advance: () => { store.advanceDay(); toast('Relógio adiantado em 1 dia.'); render(); },
  'reset-ask': () => { ui.confirmReset = true; render(); },
  'reset-cancel': () => { ui.confirmReset = false; render(); },
  'reset-do': () => { store.reset(); ui.session = null; ui.confirmReset = false; go('onboarding'); },
};

root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el.dataset.v);
});

root.addEventListener('submit', (e) => {
  e.preventDefault();
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
  if (ui.view !== 'review' || !ui.session || !ui.session.queue.length) return;
  if (e.target.closest && e.target.closest('input, textarea, select')) return;
  if (!ui.revealed && (e.code === 'Space' || e.key === 'Enter')) { e.preventDefault(); actions.reveal(); }
  else if (ui.revealed && ['1', '2', '3', '4'].includes(e.key)) grade(Number(e.key));
});

render();

if ('serviceWorker' in navigator && /^(https:|http:\/\/localhost|http:\/\/127\.0\.0\.1)/.test(location.href)) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
