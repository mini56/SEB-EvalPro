const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webDir = path.join(root, 'app', 'web');
const APP_NAME = 'SEB-éval-PRO';

if (!fs.existsSync(webDir)) {
  console.error('SEB-éval-PRO : dossier app/web généré introuvable.');
  process.exit(2);
}

// Correction visuelle ciblée : l'archive contient chariot.png en minuscules.
// Le nom chariot.PNG peut échouer une fois empaqueté dans app.asar.
const triPath = path.join(webDir, 'tri_de_cheville.html');
if (!fs.existsSync(triPath)) {
  console.error('SEB-éval-PRO : page Tri de chevilles introuvable.');
  process.exit(3);
}
let tri = fs.readFileSync(triPath, 'utf8');
if (tri.includes('imageqcm/chariot.PNG')) {
  tri = tri.replace(/imageqcm\/chariot\.PNG/g, 'imageqcm/chariot.png');
} else if (!tri.includes('imageqcm/chariot.png')) {
  console.error('SEB-éval-PRO : référence img_chariot introuvable.');
  process.exit(4);
}
fs.writeFileSync(triPath, tri, 'utf8');

const shellRef = '<script src="js/seb-visual-branding.js" id="seb-evalpro-visual-branding"></script>';

function injectBeforeBodyEnd(html, block) {
  const index = html.toLowerCase().lastIndexOf('</body>');
  if (index < 0) return `${html}\n${block}\n`;
  return `${html.slice(0, index)}${block}\n${html.slice(index)}`;
}

let patched = 0;
for (const entry of fs.readdirSync(webDir, { withFileTypes: true })) {
  if (!entry.isFile() || !/\.html?$/i.test(entry.name)) continue;
  const target = path.join(webDir, entry.name);
  let html = fs.readFileSync(target, 'utf8');
  if (html.includes('seb-evalpro-visual-branding')) continue;
  html = injectBeforeBodyEnd(html, shellRef);
  fs.writeFileSync(target, html, 'utf8');
  patched += 1;
}

console.log(`SEB-éval-PRO : identité visuelle appliquée à ${patched} page(s), img_chariot corrigée.`);
