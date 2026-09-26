const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'app', 'web', 'qcmv1.0.html');
if (!fs.existsSync(target)) {
  console.error('SEB EvalPro Brique résultat: qcmv1.0.html introuvable');
  process.exit(2);
}

let html = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');

const pattern = /(<div style="margin:5px 0;">)\s*\$\{selections\.length \? selections\.join\("<br>"\) : "<em>Aucune case cochée\.<\/em>"\}\s*(<\/div>)/;

if (!pattern.test(html)) {
  console.error('SEB EvalPro Brique résultat: bloc autoévaluation introuvable');
  process.exit(3);
}

html = html.replace(
  pattern,
  '$1${selections.length ? selections.join("<br>") : "<em>Aucune case cochée.</em>"}$2'
);

if (/margin:5px 0;">\s+\$\{selections\.length/.test(html)) {
  console.error('SEB EvalPro Brique résultat: espaces avant la première réponse encore présents');
  process.exit(4);
}

fs.writeFileSync(target, html, 'utf8');
console.log('SEB EvalPro Brique résultat: première réponse alignée avec les suivantes.');
