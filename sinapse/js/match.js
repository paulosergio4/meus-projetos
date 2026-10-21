// Correção tolerante das respostas digitadas nas lacunas.
// Sintaxe da lacuna: {{resposta principal|sinônimo|outro sinônimo}}

const ARTICLES = /^(o|a|os|as|um|uma|uns|umas|no|na|ao|do|da) /;

export function normalizeAnswer(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[^a-z0-9.%]+/g, ' ')
    .replace(/\.(?!\d)/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(ARTICLES, '');
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Respostas com números ou muito curtas precisam ser exatas; nas demais
// aceitamos até ~15% de diferença (erros de digitação).
export function checkAnswer(input, accepted) {
  const typed = normalizeAnswer(input);
  if (!typed) return { ok: false, close: false, empty: true };
  let best = 0;
  for (const raw of accepted) {
    const target = normalizeAnswer(raw);
    if (typed === target) return { ok: true, close: false, exact: true };
    const strict = /\d/.test(target) || target.length < 5;
    if (strict) continue;
    const sim = 1 - levenshtein(typed, target) / Math.max(typed.length, target.length);
    best = Math.max(best, sim);
  }
  if (best >= 0.85) return { ok: true, close: true };
  return { ok: false, close: best >= 0.7 };
}

// Divide o texto da lacuna em trechos de texto e lacunas.
export function parseCloze(text) {
  const parts = [];
  const gaps = [];
  let last = 0;
  const re = /\{\{(.+?)\}\}/g;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    const answers = m[1].split('|').map((s) => s.trim()).filter(Boolean);
    parts.push({ gap: gaps.length });
    gaps.push({ display: answers[0], answers });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return { parts, gaps };
}
