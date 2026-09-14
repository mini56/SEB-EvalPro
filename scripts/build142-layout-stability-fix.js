const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const preloadPath = path.join(root, 'src', 'preload.js');
if (!fs.existsSync(preloadPath)) {
  console.error('SEB EvalPro Build #142: src/preload.js introuvable.');
  process.exit(2);
}

let text = fs.readFileSync(preloadPath, 'utf8').replace(/\r\n/g, '\n');

// Stabiliser la largeur utile de la fenêtre : certaines pages sont plus longues
// que d'autres et l'apparition/disparition de la barre de défilement verticale
// pouvait décaler visuellement tout le contenu. On réserve donc définitivement
// la gouttière verticale et on interdit tout déplacement horizontal parasite.
const oldCss = `    html{box-sizing:border-box}\n    body{padding-top:0 !important;box-sizing:border-box}`;
const newCss = `    html{box-sizing:border-box;overflow-y:scroll;overflow-x:hidden;scrollbar-gutter:stable}\n    body{padding-top:0 !important;box-sizing:border-box;overflow-x:hidden}`;

if (!text.includes(oldCss)) {
  console.error('SEB EvalPro Build #142: CSS shell attendu introuvable.');
  process.exit(3);
}
text = text.replace(oldCss, newCss);

// Si Chromium conserve malgré tout une ancienne position scrollX après le
// changement d'une page, la remettre à zéro sans toucher au scroll vertical.
const marker = `  updateAdminButtons();\n  hideBar();\n}`;
const replacement = `  updateAdminButtons();\n  hideBar();\n\n  const lockHorizontalPosition = () => {\n    if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);\n  };\n  window.addEventListener('scroll', lockHorizontalPosition, { passive: true });\n  window.addEventListener('resize', lockHorizontalPosition, { passive: true });\n  setTimeout(lockHorizontalPosition, 0);\n}`;

if (!text.includes(marker)) {
  console.error('SEB EvalPro Build #142: point de verrouillage horizontal introuvable.');
  process.exit(4);
}
text = text.replace(marker, replacement);

for (const token of [
  'overflow-y:scroll;overflow-x:hidden;scrollbar-gutter:stable',
  'body{padding-top:0 !important;box-sizing:border-box;overflow-x:hidden}',
  'if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);'
]) {
  if (!text.includes(token)) {
    console.error('SEB EvalPro Build #142: contrôle final absent: ' + token);
    process.exit(5);
  }
}

fs.writeFileSync(preloadPath, text, 'utf8');
console.log('SEB EvalPro Build #142: affichage stabilisé — plus de dérive horizontale lors des changements de page ou de scrollbar.');
