// Busca automática das imagens das questões em rascunho, direto do PDF da prova.
// 1) acha a página de cada questão pelo começo do enunciado;
// 2) marca as imagens embutidas no PDF daquela página em caixas numeradas;
// 3) a IA diz qual caixa (ou qual área, se a figura for desenhada) é de qual questão;
// 4) recorta da página em alta resolução, envia e grava na questão, que continua em rascunho para conferência.
import { loadPdfJs, shrinkImage } from '../js/tools.js';
import { callImportarProva, uploadQuestionImage, adminUpdateQuestion } from '../js/cloud.js';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export async function openPdf(file) {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  doc._txt = [];
  return doc;
}

// Texto da página com a posição de cada trecho (frações da página).
async function pageText(doc, n) {
  if (doc._txt[n]) return doc._txt[n];
  const page = await doc.getPage(n);
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  let flat = '';
  const at = [];
  for (const it of tc.items) {
    const t = norm(it.str);
    if (!t) continue;
    const [x, y] = vp.convertToViewportPoint(it.transform[4], it.transform[5]);
    const pos = { x: x / vp.width, y: y / vp.height };
    for (let i = 0; i < t.length; i += 1) at.push(pos);
    flat += t;
  }
  doc._txt[n] = { flat, at };
  return doc._txt[n];
}

// Página onde a questão começa (pelo começo do enunciado).
export async function locate(doc, stem) {
  const s = norm(stem);
  for (const len of [48, 28]) {
    const pre = s.slice(0, len);
    if (pre.length < 14) continue;
    for (let n = 1; n <= doc.numPages; n += 1) {
      const { flat, at } = await pageText(doc, n);
      const i = flat.indexOf(pre);
      if (i >= 0) return { page: n, y: at[i].y };
    }
  }
  return null;
}

// Imagens embutidas na página (posição em frações), sem logos de cabeçalho e sem fundo de página.
async function pageImages(page, vp) {
  const lib = await loadPdfJs();
  const O = lib.OPS;
  const U = lib.Util;
  const ops = await page.getOperatorList();
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const rects = [];
  const paint = new Set([O.paintImageXObject, O.paintInlineImageXObject, O.paintImageMaskXObject, O.paintJpegXObject].filter((v) => v != null));
  for (let i = 0; i < ops.fnArray.length; i += 1) {
    const fn = ops.fnArray[i];
    const a = ops.argsArray[i];
    if (fn === O.save) stack.push(ctm);
    else if (fn === O.restore) ctm = stack.pop() || ctm;
    else if (fn === O.transform) ctm = U.transform(ctm, a);
    else if (fn === O.paintFormXObjectBegin) { stack.push(ctm); if (Array.isArray(a && a[0]) && a[0].length === 6) ctm = U.transform(ctm, a[0]); }
    else if (fn === O.paintFormXObjectEnd) ctm = stack.pop() || ctm;
    else if (paint.has(fn)) {
      const m = U.transform(vp.transform, ctm);
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map((p) => U.applyTransform(p, m));
      const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
      const x0 = Math.max(0, Math.min(...xs) / vp.width), x1 = Math.min(1, Math.max(...xs) / vp.width);
      const y0 = Math.max(0, Math.min(...ys) / vp.height), y1 = Math.min(1, Math.max(...ys) / vp.height);
      if (x1 > x0 && y1 > y0) rects.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
  }
  // Junta pedaços colados (imagens quebradas em faixas) e tira o que não é figura.
  let list = rects.filter((r) => r.w * r.h < 0.7);
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i], b = list[j], g = 0.006;
        if (a.x <= b.x + b.w + g && b.x <= a.x + a.w + g && a.y <= b.y + b.h + g && b.y <= a.y + a.h + g) {
          const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
          list[i] = { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
          list.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }
  list = list.filter((r) => {
    const area = r.w * r.h;
    if (area < 0.004 || r.w < 0.05 || r.h < 0.03 || area > 0.7) return false;
    if (area < 0.03 && (r.y + r.h < 0.11 || r.y > 0.9)) return false; // logo de cabeçalho/rodapé
    return true;
  });
  return list.sort((a, b) => (Math.abs(a.y - b.y) < 0.02 ? a.x - b.x : a.y - b.y));
}

const toBlob = (cv, q = 0.9) => new Promise((res) => cv.toBlob(res, 'image/jpeg', q));

export async function renderPage(doc, n) {
  const page = await doc.getPage(n);
  const vp1 = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: Math.min(3, 1700 / vp1.width) });
  const cv = document.createElement('canvas');
  cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: g, viewport: vp }).promise;
  const boxes = await pageImages(page, vp1);
  return { cv, boxes };
}

// Foto menor da página, com as caixas numeradas, para a IA.
export async function aiShot(cv, boxes) {
  const W = 1100;
  const s = W / cv.width;
  const c2 = document.createElement('canvas');
  c2.width = W; c2.height = Math.round(cv.height * s);
  const g = c2.getContext('2d');
  g.drawImage(cv, 0, 0, c2.width, c2.height);
  g.lineWidth = 3; g.strokeStyle = '#E11D48'; g.font = 'bold 22px sans-serif';
  boxes.forEach((b, i) => {
    const x = b.x * c2.width, y = b.y * c2.height;
    g.strokeRect(x, y, b.w * c2.width, b.h * c2.height);
    g.fillStyle = '#E11D48'; g.fillRect(x, y, 34, 30);
    g.fillStyle = '#fff'; g.fillText(String(i + 1), x + 6, y + 23);
  });
  const blob = await toBlob(c2, 0.72);
  return new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.readAsDataURL(blob); });
}

export async function crop(cv, r, pad) {
  const x0 = Math.max(0, r.x - pad), y0 = Math.max(0, r.y - pad);
  const x1 = Math.min(1, r.x + r.w + pad), y1 = Math.min(1, r.y + r.h + pad);
  const c = document.createElement('canvas');
  c.width = Math.round((x1 - x0) * cv.width); c.height = Math.round((y1 - y0) * cv.height);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(cv, x0 * cv.width, y0 * cv.height, c.width, c.height, 0, 0, c.width, c.height);
  return shrinkImage(await toBlob(c, 0.92));
}

const union = (rs) => {
  const x = Math.min(...rs.map((r) => r.x)), y = Math.min(...rs.map((r) => r.y));
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
};

// Coloca as imagens nas questões de uma prova. drafts: [{id, numero, stem}] sem imagem.
// onStep({ numero, ok }) a cada questão resolvida. Devolve { ok, falhou }.
export async function figurasDoPdf(doc, drafts, onStep = () => {}, shouldStop = () => false) {
  const res = { ok: 0, falhou: 0 };
  const fail = (q) => { res.falhou += 1; onStep({ numero: q.numero, ok: false }); };
  const work = new Map(); // página -> { own: questões que começam nela, cont: que vieram da anterior }
  const add = (p, q, cont) => { if (!work.has(p)) work.set(p, { own: [], cont: [] }); work.get(p)[cont ? 'cont' : 'own'].push(q); };
  for (const q of drafts) {
    const loc = await locate(doc, q.stem);
    if (loc) add(loc.page, q, false); else fail(q);
  }
  while (work.size && !shouldStop()) {
    const p = Math.min(...work.keys());
    const { own, cont } = work.get(p);
    work.delete(p);
    const qs = [...cont, ...own];
    let figs = [];
    let shot = null;
    try {
      shot = await renderPage(doc, p);
      const imagem = await aiShot(shot.cv, shot.boxes);
      const r = await callImportarProva({
        action: 'figuras', imagem, caixas: shot.boxes.length,
        questoes: qs.map((q) => ({ numero: q.numero, inicio: q.stem.slice(0, 140), continua: cont.includes(q) })),
      });
      figs = r.figuras || [];
    } catch (e) { figs = []; }
    const usadas = new Set();
    for (const q of qs) {
      const f = figs.find((x) => x.numero === q.numero);
      let rect = null, pad = 0.012;
      if (shot && f && f.encontrada) {
        const cx = f.caixas.filter((n) => !usadas.has(n) && shot.boxes[n - 1]);
        if (cx.length) { cx.forEach((n) => usadas.add(n)); rect = union(cx.map((n) => shot.boxes[n - 1])); }
        else if (f.area) { rect = f.area; pad = 0.015; }
      }
      if (rect) {
        try {
          const url = await uploadQuestionImage(q.id, await crop(shot.cv, rect, pad));
          await adminUpdateQuestion(q.id, { image_url: url });
          res.ok += 1; onStep({ numero: q.numero, ok: true, id: q.id, url });
          continue;
        } catch (e) { fail(q); continue; }
      }
      // Não achou nesta página: a figura pode estar no topo da seguinte (uma tentativa só).
      if (shot && !cont.includes(q) && p < doc.numPages) add(p + 1, q, true); else fail(q);
    }
  }
  return res;
}

// Entre os PDFs da pasta, acha o da prova: o que contém o começo dos enunciados.
export async function acharPdf(files, prova, ano, drafts) {
  const tokens = String(prova).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((t) => t.length >= 3 || /^\d+$/.test(t));
  const scored = [...files.entries()].map(([path, f]) => {
    const p = norm(path);
    let s = p.includes(String(ano)) ? 3 : 0;
    for (const t of tokens) if (p.includes(t)) s += 1;
    if (/gabarito/i.test(path) && !/prova/i.test(path)) s -= 2;
    return { path, f, s };
  }).sort((a, b) => b.s - a.s).slice(0, 8);
  const amostra = drafts.slice(0, 4);
  for (const c of scored) {
    let doc;
    try { doc = await openPdf(c.f); } catch (e) { continue; }
    let hits = 0;
    for (const q of amostra) if (await locate(doc, q.stem)) hits += 1;
    if (hits >= Math.max(1, Math.ceil(amostra.length / 2))) return { doc, path: c.path };
    doc.destroy();
  }
  return null;
}
