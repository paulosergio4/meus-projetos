// FSRS-4.5 — agendamento de revisão espaçada.
// Referência: https://github.com/open-spaced-repetition/fsrs4anki (algoritmo e pesos padrão).

export const FSRS_W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
  0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
];

export const DAY_MS = 86400000;
export const MIN_MS = 60000;
const DECAY = -0.5;
const FACTOR = 19 / 81;
export const TARGET_RETENTION = 0.9;
const MAX_INTERVAL_DAYS = 3650;

// Notas: 1 = De novo, 2 = Difícil, 3 = Bom, 4 = Fácil
export const GRADES = [1, 2, 3, 4];

const clampNum = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function retrievability(elapsedDays, stability) {
  if (!stability) return 0;
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY);
}

function initDifficulty(g) {
  return clampNum(FSRS_W[4] - (g - 3) * FSRS_W[5], 1, 10);
}

function nextDifficulty(d, g) {
  const updated = d - FSRS_W[6] * (g - 3);
  return clampNum(FSRS_W[7] * initDifficulty(3) + (1 - FSRS_W[7]) * updated, 1, 10);
}

function recallStability(d, s, r, g) {
  const hard = g === 2 ? FSRS_W[15] : 1;
  const easy = g === 4 ? FSRS_W[16] : 1;
  return s * (1 + Math.exp(FSRS_W[8]) * (11 - d) * Math.pow(s, -FSRS_W[9]) *
    (Math.exp(FSRS_W[10] * (1 - r)) - 1) * hard * easy);
}

function forgetStability(d, s, r) {
  const next = FSRS_W[11] * Math.pow(d, -FSRS_W[12]) *
    (Math.pow(s + 1, FSRS_W[13]) - 1) * Math.exp(FSRS_W[14] * (1 - r));
  return Math.min(next, s);
}

export function intervalDays(stability) {
  const raw = (stability / FACTOR) * (Math.pow(TARGET_RETENTION, 1 / DECAY) - 1);
  return clampNum(Math.round(raw), 1, MAX_INTERVAL_DAYS);
}

export function newCardState() {
  return { state: 'new', due: 0, s: 0, d: 0, reps: 0, lapses: 0, last: 0 };
}

// Calcula o próximo estado do card para cada uma das 4 notas.
// Garante que Difícil < Bom < Fácil em dias, como o usuário espera ver nos botões.
export function scheduleAll(card, now) {
  const c = card || newCardState();
  const out = {};
  for (const g of GRADES) out[g] = scheduleOne(c, g, now);

  const days = (x) => (x.state === 'review' ? Math.round((x.due - now) / DAY_MS) : 0);
  if (out[2].state === 'review' && out[3].state === 'review' && days(out[3]) <= days(out[2])) {
    out[3] = { ...out[3], due: now + (days(out[2]) + 1) * DAY_MS };
  }
  if (out[3].state === 'review' && out[4].state === 'review' && days(out[4]) <= days(out[3])) {
    out[4] = { ...out[4], due: now + (days(out[3]) + 1) * DAY_MS };
  }
  return out;
}

function scheduleOne(c, g, now) {
  const base = { ...c, reps: c.reps + 1, last: now };

  if (c.state === 'new') {
    const s = FSRS_W[g - 1];
    const d = initDifficulty(g);
    if (g === 1) return { ...base, state: 'learning', s, d, due: now + MIN_MS };
    return { ...base, state: 'review', s, d, due: now + intervalDays(s) * DAY_MS };
  }

  const elapsed = c.last ? (now - c.last) / DAY_MS : 0;
  const r = retrievability(elapsed, c.s);
  const d = nextDifficulty(c.d, g);

  if (c.state === 'learning') {
    // Card que acabou de ser errado: volta em minutos até o aluno acertar.
    if (g === 1) return { ...base, state: 'learning', d, due: now + MIN_MS };
    const s = g === 4 ? c.s * FSRS_W[16] : c.s;
    return { ...base, state: 'review', s, d, due: now + intervalDays(s) * DAY_MS };
  }

  if (g === 1) {
    const s = forgetStability(c.d, c.s, r);
    return { ...base, state: 'learning', s, d, lapses: c.lapses + 1, due: now + 5 * MIN_MS };
  }
  const s = recallStability(c.d, c.s, r, g);
  return { ...base, state: 'review', s, d, due: now + intervalDays(s) * DAY_MS };
}

export function formatInterval(ms) {
  const min = Math.max(1, Math.round(ms / MIN_MS));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const days = Math.round(ms / DAY_MS);
  if (days < 31) return days === 1 ? '1 dia' : `${days} dias`;
  const months = Math.round(days / 30);
  if (months < 12) return months === 1 ? '1 mês' : `${months} meses`;
  const years = Math.round((days / 365) * 10) / 10;
  return `${String(years).replace('.', ',')} ${years === 1 ? 'ano' : 'anos'}`;
}
