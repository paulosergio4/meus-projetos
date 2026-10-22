// Estado do app, salvo no próprio aparelho (localStorage).
// Se o armazenamento não estiver disponível, o app funciona só na memória.
import { SEED_CARDS } from './data.js';
import { QUESTIONS } from './questions.js';
import { DAY_MS, newCardState, scheduleAll } from './fsrs.js';
import { buildPlan } from './plan.js';

const STORAGE_KEY = 'sinapse:v1';

export const DEFAULT_SETTINGS = {
  typeAnswers: true,    // digitar a resposta nas lacunas
  newPerDayAuto: true,  // cards novos por dia calculados pelo cronograma
  newPerDay: 15,
  questionsPerDay: 10,
  palette: 'azul',      // azul | violeta | verde | magenta
};

function emptyState() {
  return {
    user: null,       // { name, email, picture, provider: 'google' | 'demo' | 'guest' }
    profile: null,    // { nome, fase, prova, dataProva }
    settings: { ...DEFAULT_SETTINGS },
    sched: {},        // id do card -> estado FSRS
    custom: [],       // cards criados pelo usuário (inclui os do caderno de erros)
    log: [],          // revisões de cards: { id, g, t, p? } (p = prática, não altera agenda)
    qlog: [],         // questões respondidas: { id, ok, t, mode }
    errors: {},       // caderno de erros: id da questão -> { count, solved, t, cardId }
    cases: {},        // casos clínicos: id -> { best, total, t }
    simulados: [],    // { t, total, correct, seconds, byArea }
    offsetDays: 0,    // avanço de dias para testar o agendamento
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const saved = JSON.parse(raw);
    const base = emptyState();
    return { ...base, ...saved, settings: { ...base.settings, ...(saved.settings || {}) } };
  } catch (e) {
    return emptyState();
  }
}

export const store = {
  data: load(),

  onSave: null, // chamado depois de salvar (o app usa para sincronizar com a nuvem)

  save() {
    this.data.savedAt = Date.now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch (e) { /* sem armazenamento */ }
    if (this.onSave) this.onSave();
  },

  // Dados para a nuvem: tudo menos a sessão de login e o relógio de teste.
  exportData() {
    const { user, offsetDays, ...rest } = this.data;
    return rest;
  },

  // Troca o progresso local pelo da nuvem, mantendo quem está logado.
  importData(remote) {
    const base = emptyState();
    this.data = { ...base, ...remote, settings: { ...base.settings, ...(remote.settings || {}) }, user: this.data.user, offsetDays: this.data.offsetDays };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch (e) { /* sem armazenamento */ }
  },

  reset() {
    this.data = emptyState();
    this.save();
  },

  setSetting(key, value) {
    this.data.settings[key] = value;
    this.save();
  },

  signIn(user) {
    this.data.user = user;
    if (user.name && this.data.profile && !this.data.profile.nome) {
      this.data.profile.nome = user.name.split(' ')[0];
    }
    this.save();
  },

  // Sair mantém o progresso salvo neste aparelho.
  signOut() {
    this.data.user = null;
    this.save();
  },

  now() {
    return Date.now() + this.data.offsetDays * DAY_MS;
  },

  advanceDay() {
    this.data.offsetDays += 1;
    this.save();
  },

  // Deck oficial: um card por questão publicada do banco (montado pelo app ao carregar o banco).
  // Enquanto não há banco, ficam os cards de exemplo.
  deckCards: [],

  allCards() {
    const base = this.deckCards.length ? this.deckCards : SEED_CARDS;
    // Se a pessoa já tem o card dessa questão pelo caderno de erros, fica só o dela (com o histórico).
    const mine = new Set();
    for (const c of this.data.custom) if (c.origin) mine.add(c.origin);
    return (mine.size ? base.filter((c) => !c.qref || !mine.has(c.qref)) : base).concat(this.data.custom);
  },

  deckCardFor(questionId) {
    return this.deckCards.find((c) => c.qref === questionId) || null;
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

  isToday(t) {
    return this.dayKey(t) === this.dayKey(this.now());
  },

  reviewsToday() {
    return this.data.log.filter((l) => !l.p && this.isToday(l.t));
  },

  questionsToday() {
    return this.data.qlog.filter((l) => this.isToday(l.t));
  },

  newStudiedToday() {
    const firstSeen = new Map();
    for (const l of this.data.log) if (!l.p && !firstSeen.has(l.id)) firstSeen.set(l.id, l.t);
    let n = 0;
    for (const t of firstSeen.values()) if (this.isToday(t)) n += 1;
    return n;
  },

  newCardsLeft() {
    return this.allCards().filter((c) => this.stateOf(c.id).state === 'new').length;
  },

  plan() {
    const p = this.data.profile;
    if (!p || !p.dataProva) return null;
    // Conta os cards novos de hoje como ainda pendentes, para a meta não mudar ao longo do dia.
    return buildPlan({ now: this.now(), examDate: p.dataProva, newLeft: this.newCardsLeft() + this.newStudiedToday() });
  },

  // Teto de cards novos por dia do plano (Infinity enquanto a cobrança está desligada).
  capNew: Infinity,

  newPerDay() {
    return Math.min(this.newPerDayRaw(), this.capNew);
  },

  newPerDayRaw() {
    const s = this.data.settings;
    if (s.newPerDayAuto) {
      const plan = this.plan();
      if (plan && plan.phase !== 'past') return plan.phase === 'final' ? 0 : plan.newPerDay;
    }
    return s.newPerDay;
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
    // Cards que a pessoa criou ou gerou com IA vêm antes dos decks prontos entre os novos.
    fresh.sort((a, b) => (b.custom ? 1 : 0) - (a.custom ? 1 : 0));
    const newLeft = Math.max(0, this.newPerDay() - this.newStudiedToday());
    return due.concat(fresh.slice(0, newLeft)).slice(0, limit);
  },

  // Cards que a pessoa já errou alguma vez (para o modo Reforço).
  weakCards() {
    const lastGrade = new Map();
    for (const l of this.data.log) lastGrade.set(l.id, l.g);
    return this.allCards().filter((c) => this.stateOf(c.id).lapses > 0 || lastGrade.get(c.id) === 1);
  },

  answer(id, grade) {
    const now = this.now();
    const next = scheduleAll(this.stateOf(id), now)[grade];
    this.data.sched[id] = next;
    this.data.log.push({ id, g: grade, t: now });
    this.save();
    return next;
  },

  // Revisão de prática: registra acerto ou erro sem mexer na agenda.
  practice(id, ok) {
    this.data.log.push({ id, g: ok ? 3 : 1, t: this.now(), p: true });
    this.save();
  },

  streak() {
    const days = new Set(this.data.log.map((l) => this.dayKey(l.t)).concat(this.data.qlog.map((l) => this.dayKey(l.t))));
    let n = 0;
    let t = this.now();
    if (!days.has(this.dayKey(t))) t -= DAY_MS; // hoje ainda não estudou: conta a partir de ontem
    while (days.has(this.dayKey(t))) { n += 1; t -= DAY_MS; }
    return n;
  },

  // Acerto nos cards, por filtro (área, subtema).
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

  questionById(id) {
    return QUESTIONS.find((q) => q.id === id);
  },

  // Acerto nas questões, por filtro.
  questionAccuracy(filter = () => true) {
    let total = 0;
    let ok = 0;
    for (const l of this.data.qlog) {
      const q = this.questionById(l.id);
      if (!q || !filter(q)) continue;
      total += 1;
      if (l.ok) ok += 1;
    }
    return { total, pct: total ? Math.round((ok / total) * 100) : null };
  },

  // Registra a resposta; errar manda a questão para o caderno e cria um card com o conceito.
  answerQuestion(id, ok, mode) {
    this.data.qlog.push({ id, ok, t: this.now(), mode });
    const q = this.questionById(id);
    const entry = this.data.errors[id];
    let createdCard = false;
    if (!ok) {
      if (entry) {
        entry.count += 1;
        entry.solved = false;
        entry.t = this.now();
      } else if (this.deckCardFor(id) && !this.data.custom.some((c) => c.origin === id)) {
        // O card dessa questão já está no deck oficial: em vez de criar outro, traz ele para hoje.
        const cardId = this.deckCardFor(id).id;
        if (this.stateOf(cardId).state === 'new') this.data.sched[cardId] = { ...scheduleAll(this.stateOf(cardId), this.now())[1], due: this.now() };
        this.data.errors[id] = { count: 1, solved: false, t: this.now(), cardId };
        createdCard = true;
      } else if (q.fact && q.fact.front && q.fact.back) {
        const cardId = this.addCustom({ type: 'basic', front: q.fact.front, back: q.fact.back, area: q.area, sub: q.sub, extra: 'Criado pelo caderno de erros.', origin: id }, false);
        this.data.errors[id] = { count: 1, solved: false, t: this.now(), cardId };
        createdCard = true;
      } else {
        this.data.errors[id] = { count: 1, solved: false, t: this.now(), cardId: null };
      }
    } else if (entry && !entry.solved) {
      entry.solved = true;
    }
    this.save();
    return { createdCard };
  },

  openErrors() {
    // Só questões que ainda existem no banco (as de exemplo saem quando entram as oficiais).
    return Object.entries(this.data.errors).filter(([id, e]) => !e.solved && this.questionById(id)).sort((a, b) => b[1].t - a[1].t);
  },

  saveSimulado(result) {
    this.data.simulados.push(result);
    this.save();
  },

  saveCase(id, score, total) {
    const prev = this.data.cases[id];
    this.data.cases[id] = { best: Math.max(prev ? prev.best : 0, score), total, t: this.now() };
    this.save();
  },

  addCustom(card, persist = true) {
    const id = `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    this.data.custom.push({ ...card, id, custom: true });
    if (persist) this.save();
    return id;
  },
};
