// Ferramentas usadas pelo app e pelo painel de administração.

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
let pdfjsLoading = null;

export function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfjsLoading) {
    pdfjsLoading = new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = PDFJS;
      sc.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; resolve(window.pdfjsLib); };
      sc.onerror = () => { pdfjsLoading = null; reject(new Error('Não foi possível carregar o leitor de PDF.')); };
      document.head.appendChild(sc);
    });
  }
  return pdfjsLoading;
}

// Texto da prova, página por página (provas das bancas costumam ser PDF de texto).
export async function extractPdfText(buffer) {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const parts = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const tc = await page.getTextContent();
    let line = '';
    const lines = [];
    for (const it of tc.items) {
      line += it.str;
      if (it.hasEOL) { lines.push(line); line = ''; } else if (it.str && !/\s$/.test(it.str)) line += ' ';
    }
    if (line) lines.push(line);
    parts.push(`[página ${n}]\n${lines.join('\n')}`);
  }
  return { text: parts.join('\n\n'), pages: doc.numPages };
}

// Reduz a imagem no aparelho (até 1600 px, JPEG) antes de enviar.
export async function shrinkImage(file, max = 1600) {
  const img = await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível abrir a imagem.')); };
    im.src = url;
  });
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.naturalWidth * scale);
  cv.height = Math.round(img.naturalHeight * scale);
  const g = cv.getContext('2d');
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, cv.width, cv.height);
  g.drawImage(img, 0, 0, cv.width, cv.height);
  return new Promise((resolve) => cv.toBlob(resolve, 'image/jpeg', 0.86));
}

// Arquivo para base64 (sem o prefixo data:).
export function fileToB64(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => resolve('');
    r.readAsDataURL(file);
  });
}
