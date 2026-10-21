// Estado do app, salvo no próprio aparelho (localStorage).
// Se o armazenamento não estiver disponível, o app funciona só na memória.
import { SEED_CARDS } from './data.js';
import { DAY_MS, newCardState, scheduleAll } from './fsrs.js';

const STORAGE_KEY = 'sinapse:v1';
export const NEW_PER_DAY = 15;

function emptyState() {
  return {
    profile: null, // { nome, fase, prova, dataProva }
    sched: {},     // id do card -> estado FSRS
    custom: [],    // cards criados pelo usuário
    log: [],       // { id, g, t }
    offsetDays: 0, // avanço de dias para testar o agendamento
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return { ...emptyState(), ...JSON.parse(raw) };
  } catch (e) {
    return emptyState();
  }
}

export const store = {
  data: load(),

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch (e) { /* sem armazenamento */ }
  },

  reset() {
    this.data = emptyState();
    this.save();
  },

  now() {
    return Date.now() + this.data.offsetDays * DAY_MS;
  },

  advanceDay() {
    this.data.offsetDays += 1;
    this.save();
  },

  allCards() {
    return SEED_CARDS.concat(this.data.custom);
  },

  cardById(id) {
    return this.allCards().find((c) => c.id === id);
  },

  stateOf(id) {
    return this.data.sched[id] || newCardState();
  },

  dayKey(t) {
    const d = new Date(t);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  },

  reviewsToday() {
    const today = this.dayKey(this.now());
    return this.data.log.filter((l) => this.dayKey(l.t) === today);
  },

  newStudiedToday() {
    const today = this.dayKey(this.now());
    const firstSeen = new Map();
    for (const l of this.data.log) if (!firstSeen.has(l.id)) firstSeen.set(l.id, l.t);
    let n = 0;
    for (const t of firstSeen.values()) if (this.dayKey(t) === today) n += 1;
    return n;
  },

  // Fila do dia: cards vencidos primeiro, depois cards novos até o limite diário.
  dueQueue({ filter = () => true, limit = Infinity } = {}) {
    const now = this.now();
    const cards = this.allCards().filter(filter);
    const due = [];
    const fresh = [];
    for (const c of cards) {
      const s = this.stateOf(c.id);
      if (s.state === 'new') fresh.push(c);
      else if (s.due <= now) due.push(c);
    }
    due.sort((a, b) => this.stateOf(a.id).due - this.stateOf(b.id).due);
    const newLeft = Math.max(0, NEW_PER_DAY - this.newStudiedToday());
    return due.concat(fresh.slice(0, newLeft)).slice(0, limit);
  },

  answer(id, grade) {
    const now = this.now();
    const next = scheduleAll(this.stateOf(id), now)[grade];
    this.data.sched[id] = next;
    this.data.log.push({ id, g: grade, t: now });
    this.save();
    return next;
  },

  streak() {
    const days = new Set(this.data.log.map((l) => this.dayKey(l.t)));
    let n = 0;
    let t = this.now();
    if (!days.has(this.dayKey(t))) t -= DAY_MS; // hoje ainda não estudou: conta a partir de ontem
    while (days.has(this.dayKey(t))) { n += 1; t -= DAY_MS; }
    return n;
  },

  // Acerto por área e subtema, considerando a última resposta de cada revisão.
  accuracy(filter) {
    const cards = new Map(this.allCards().map((c) => [c.id, c]));
    let total = 0;
    let ok = 0;
    for (const l of this.data.log) {
      const c = cards.get(l.id);
      if (!c || !filter(c)) continue;
      total += 1;
      if (l.g > 1) ok += 1;
    }
    return { total, pct: total ? Math.round((ok / total) * 100) : null };
  },

  addCustom(card) {
    const id = `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    this.data.custom.push({ ...card, id, custom: true });
    this.save();
    return id;
  },
};
