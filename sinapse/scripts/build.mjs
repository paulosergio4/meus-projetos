// Gera dist/sinapse.html: o app inteiro em um único arquivo HTML,
// útil para abrir sem servidor ou publicar como página única.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

// Ordem respeita as dependências entre os módulos.
const modules = ['js/config.js', 'js/cloud.js', 'js/biometric.js', 'js/fsrs.js', 'js/match.js', 'js/plan.js', 'js/plans.js', 'js/fx.js', 'js/data.js', 'js/questions.js', 'js/store.js', 'js/app.js'];
const js = modules
  .map((p) => `// ---- ${p} ----\n` + read(p)
    .replace(/^import .*?;\s*$/gm, '')
    .replace(/^export (const|function|let|class) /gm, '$1 '))
  .join('\n');

const css = read('css/styles.css');
const icon = 'data:image/svg+xml,' + encodeURIComponent(read('icons/icon.svg').trim());

const html = `<title>Sinapse</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#0A1120">
<link rel="icon" href="${icon}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap">
<style>
${css}
</style>
<main id="app"></main>
<div id="toast" class="toast" role="status" hidden></div>
<script type="module">
${js}
</script>
`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/sinapse.html'), html);
console.log(`dist/sinapse.html gerado (${(html.length / 1024).toFixed(1)} KB)`);
