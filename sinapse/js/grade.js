// Correção de resposta escrita por palavras-chave (casos clínicos em modo discursivo).
// keywords = lista de grupos; cada grupo aceita sinônimos ("rm de sela" ou "ressonancia").
// Um grupo conta como encontrado se qualquer sinônimo aparece na resposta.

export function normText(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// Tira zeros à esquerda de números ("07" = "7").
const tok = (w) => (/^\d+$/.test(w) ? String(Number(w)) : w);

// Palavra da chave bate com uma palavra da resposta: igual, ou mesmo radical em palavras longas
// ("catarata" ~ "cataratas", "reabsorcao" ~ "reabsorção"). Chaves curtas exigem palavra exata.
function wordHit(w, tokens) {
  // Siglas e genes com número (col1a1, col1a2) só batem por inteiro.
  if (w.length < 5 || /\d/.test(w)) return tokens.includes(w);
  const stem = w.slice(0, Math.max(5, w.length - 2));
  return tokens.some((t) => t === w || t.startsWith(stem));
}

export function phraseHit(phrase, tokens, joined) {
  const words = normText(phrase).split(' ').filter(Boolean).map(tok);
  if (!words.length) return false;
  // Sem espaço também vale ("fib4" = "fib 4", "l1l4" = "l1 l4").
  if (words.length > 1 && joined.includes(words.join(''))) return true;
  return words.every((w) => wordHit(w, tokens));
}

// avoid = trechos que tornam a resposta errada mesmo com as palavras-chave
// (ex.: "levotiroxina primeiro"). Conferidos como trecho contínuo.
export function gradeAnswer(text, keywords, min, avoid) {
  const tokens = normText(text).split(' ').filter(Boolean).map(tok);
  const joined = tokens.join('');
  const groups = (keywords || []).map((g) => (Array.isArray(g) ? g : [g]));
  const found = groups.map((g) => g.some((p) => phraseHit(p, tokens, joined)));
  const n = groups.length;
  const need = Math.min(n, Number.isInteger(min) && min > 0 ? min : (n <= 2 ? n : Math.ceil(n * 0.6)));
  const hits = found.filter(Boolean).length;
  const padded = ` ${tokens.join(' ')} `;
  const wrong = (avoid || []).filter((a) => a && padded.includes(` ${normText(a).split(' ').map(tok).join(' ')} `));
  return { ok: n > 0 && hits >= need && !wrong.length, hits, need, total: n, found, wrong };
}

export function hasWritten(stage) {
  return Array.isArray(stage.keywords) && stage.keywords.length > 0;
}
