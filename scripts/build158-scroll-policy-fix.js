const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error('SEB EvalPro Build #158 scroll policy: ' + message);
  process.exit(code);
}

function read(relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) fail(`fichier introuvable: ${relativePath}`);
  return { file, text: fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') };
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

function checkJs(text, label) {
  try { new vm.Script(text); }
  catch (error) { fail(`${label} invalide: ${error.message}`, 9); }
}

// -----------------------------------------------------------------------------
// 1. Politique unique de scrollbar pour toute l'application.
//    - Parcours candidat : la page reste scrollable à la molette/clavier mais la
//      barre verticale native est invisible, donc elle ne peut plus faire varier
//      la largeur du viewport à chaque reflow/clic.
//    - Résultats stagiaire : barre verticale visible et PERMANENTE.
//    - Bilan/Admin : barre verticale visible et PERMANENTE.
//
// Le défaut des builds précédents venait du fait que nous avions stabilisé les
// overlays, mais laissé le document principal en overflow automatique. Un simple
// reflow de cellule pouvait donc faire basculer la scrollbar racine entre présente
// et absente. Cette politique ne change plus pendant les clics : elle ne change
// qu'au passage vers/depuis la page Résultats.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/preload.js');
  let out = text;

  if (!out.includes('// SEB_SCROLL_POLICY_158')) {
    const marker = "window.addEventListener('DOMContentLoaded', async () => {";
    if (!out.includes(marker)) fail('DOMContentLoaded du preload introuvable', 3);

    const helper = `// SEB_SCROLL_POLICY_158\nfunction installSebScrollbarPolicy() {\n  if (!document.documentElement) return;\n\n  let style = document.getElementById('seb-evalpro-scroll-policy');\n  if (!style) {\n    style = document.createElement('style');\n    style.id = 'seb-evalpro-scroll-policy';\n    style.textContent = \`\n      html.seb-candidate-scrollbar-hidden,\n      html.seb-candidate-scrollbar-hidden body,\n      html.seb-candidate-scrollbar-hidden .page { scrollbar-width:none!important; }\n      html.seb-candidate-scrollbar-hidden::-webkit-scrollbar,\n      html.seb-candidate-scrollbar-hidden body::-webkit-scrollbar,\n      html.seb-candidate-scrollbar-hidden .page::-webkit-scrollbar { width:0!important;height:0!important;display:none!important; }\n      html.seb-stable-root-scroll { overflow-y:scroll!important;overflow-x:hidden!important; }\n      html.seb-stable-root-scroll body { overflow-x:hidden!important; }\n    \`;\n    (document.head || document.documentElement).appendChild(style);\n  }\n\n  const root = document.documentElement;\n  const sync = () => {\n    const currentFile = pageName().toLowerCase();\n    const isAdmin = isAdminBilanPage(currentFile);\n    const isQcm = currentFile === 'qcmv1.0.html';\n    const finalPage = isQcm ? document.getElementById('pageFinale') : null;\n    const isResults = !!(finalPage && finalPage.classList.contains('visible'));\n    const stableVisibleScroll = isAdmin || isResults;\n\n    root.classList.toggle('seb-stable-root-scroll', stableVisibleScroll);\n    root.classList.toggle('seb-candidate-scrollbar-hidden', !stableVisibleScroll);\n  };\n\n  sync();\n\n  if (pageName().toLowerCase() === 'qcmv1.0.html') {\n    const observer = new MutationObserver((mutations) => {\n      if (mutations.some((m) => m.type === 'attributes' && m.attributeName === 'class')) sync();\n    });\n    document.querySelectorAll('.page').forEach((page) => {\n      observer.observe(page, { attributes: true, attributeFilter: ['class'] });\n    });\n  }\n}\n\n`;
    out = out.replace(marker, helper + marker);
  }

  if (!out.includes('installSebScrollbarPolicy();')) {
    const marker = '  injectAdminBar();';
    if (!out.includes(marker)) fail('appel injectAdminBar introuvable', 4);
    out = out.replace(marker, marker + '\n  installSebScrollbarPolicy();');
  }

  for (const token of [
    '// SEB_SCROLL_POLICY_158',
    'seb-candidate-scrollbar-hidden',
    'seb-stable-root-scroll',
    "const isResults = !!(finalPage && finalPage.classList.contains('visible'));",
    'installSebScrollbarPolicy();'
  ]) if (!out.includes(token)) fail('politique scrollbar incomplète: ' + token, 5);

  checkJs(out, 'src/preload.js');
  write(file, out);
}

// -----------------------------------------------------------------------------
// 2. Ouvrir un ancien bilan : la carte avait seulement max-height:90vh.
//    Dans un flex sans hauteur réellement fixée, Chromium pouvait laisser la
//    liste grandir sans donner une zone scrollable fiable. On fixe la hauteur de
//    la carte et on donne tout l'espace restant à la zone de liste.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/bilan-history-preload.js');
  let out = text;

  const oldCard = '.seb-bh-card{width:min(1040px,96vw);max-height:90vh;min-height:0;background:#fff;border-radius:10px;box-shadow:0 16px 50px rgba(0,0,0,.4);display:flex;flex-direction:column;overflow:hidden}';
  const newCard = '.seb-bh-card{width:min(1040px,96vw);height:90vh;max-height:90vh;min-height:0;background:#fff;border-radius:10px;box-shadow:0 16px 50px rgba(0,0,0,.4);display:flex;flex-direction:column;overflow:hidden}';
  if (!out.includes(oldCard)) fail('carte du sélecteur historique introuvable', 6);
  out = out.replace(oldCard, newCard);

  const oldBody = '.seb-bh-body{flex:1;min-height:0;min-width:0;padding:15px;overflow-y:scroll;overflow-x:hidden;overscroll-behavior:contain;background:#f5f7fb}';
  const newBody = '.seb-bh-body{flex:1 1 0;min-height:0;min-width:0;padding:15px;overflow-y:scroll!important;overflow-x:hidden;overscroll-behavior:contain;background:#f5f7fb}';
  if (!out.includes(oldBody)) fail('zone scroll du sélecteur historique introuvable', 6);
  out = out.replace(oldBody, newBody);

  const oldEditorBody = '.seb-bh-editor-body{flex:1;min-height:0;min-width:0;overflow-y:scroll;overflow-x:hidden;overscroll-behavior:contain;padding:16px;background:#fff}';
  const newEditorBody = '.seb-bh-editor-body{flex:1 1 0;min-height:0;min-width:0;overflow-y:scroll!important;overflow-x:hidden;overscroll-behavior:contain;padding:16px;background:#fff}';
  if (!out.includes(oldEditorBody)) fail('zone scroll éditeur historique introuvable', 6);
  out = out.replace(oldEditorBody, newEditorBody);

  for (const token of [
    'height:90vh;max-height:90vh',
    '.seb-bh-body{flex:1 1 0;',
    'overflow-y:scroll!important',
    '.seb-bh-editor-body{flex:1 1 0;'
  ]) if (!out.includes(token)) fail('scroll historique non garanti: ' + token, 7);

  checkJs(out, 'src/bilan-history-preload.js');
  write(file, out);
}

console.log('SEB EvalPro Build #158: scrollbar du parcours masquée sans bloquer le défilement; scrollbar permanente uniquement Résultats/Admin; sélecteur et éditeur d’anciens bilans avec scroll interne garanti.');
