const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'app', 'web', 'brique.html');

if (!fs.existsSync(target)) {
  console.error('SEB EvalPro: brique.html généré introuvable pour la correction autoévaluation.');
  process.exit(2);
}

let html = fs.readFileSync(target, 'utf8');

if (html.includes('js/brique-page.js')) {
  const modulePath = path.join(root, 'app', 'web', 'js', 'brique-page.js');
  if (!fs.existsSync(modulePath)) {
    console.error('SEB EvalPro: module brique-page.js introuvable.');
    process.exit(3);
  }
  const moduleText = fs.readFileSync(modulePath, 'utf8').replace(/\r\n/g, '\n');

  for (const [id, expectedFor] of [
    ['ease_br','ease_br'],
    ['difficulties_br','difficulties_br'],
    ['progress_br','progress_br'],
    ['motivation_br','motivation_br'],
    ['stress_br','stress_br']
  ]) {
    if (!html.includes('id="' + id + '"') || !html.includes('for="' + expectedFor + '"')) {
      console.error('SEB EvalPro: contrat label Brique modulaire absent: ' + id);
      process.exit(4);
    }
  }

  for (const token of [
    '.map((cb) => cb.value);',
    "sessionStorage.setItem(AUTO_KEY, JSON.stringify(data));",
    'persistCandidate();',
    "window.sebParcours.goNext('brique')"
  ]) {
    if (!moduleText.includes(token)) {
      console.error('SEB EvalPro: contrat autoévaluation Brique modulaire absent: ' + token);
      process.exit(5);
    }
  }

  console.log('SEB EvalPro: autoévaluation Brique modulaire validée (valeurs, labels, persistance et navigation centrale).');
} else {
  // Compatibilité avec l'ancienne page inline.
  const oldSerializer = '.map(cb => cb.name);';
  const newSerializer = '.map(cb => cb.value);';

  if (html.includes(oldSerializer)) {
    html = html.replace(oldSerializer, newSerializer);
  } else if (!html.includes(newSerializer)) {
    console.error('SEB EvalPro: sérialisation de l’autoévaluation Brique introuvable.');
    process.exit(3);
  }

  const labelFixes = [
    ['for="ease"', 'for="ease_br"'],
    ['for="difficulties"', 'for="difficulties_br"'],
    ['for="progress"', 'for="progress_br"'],
    ['for="motivation"', 'for="motivation_br"'],
    ['for="stress"', 'for="stress_br"']
  ];
  for (const [from, to] of labelFixes) html = html.split(from).join(to);

  const saveLine = 'sessionStorage.setItem("eval_brique_auto", JSON.stringify(autoEvalData));';
  const persistedSave = `${saveLine}\n  if (window.sebEvalPro?.save) window.sebEvalPro.save();`;
  if (html.includes(saveLine) && !html.includes(persistedSave)) html = html.replace(saveLine, persistedSave);

  fs.writeFileSync(target, html, 'utf8');
  console.log('SEB EvalPro: autoévaluation Brique corrigée (valeurs, labels et persistance immédiate).');
}
