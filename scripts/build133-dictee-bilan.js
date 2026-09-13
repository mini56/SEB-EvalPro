const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'app', 'web', 'admin-bilan.html');

function fail(message) {
  console.error('SEB EvalPro Build #133 - dictée dans le bilan : ' + message);
  process.exit(2);
}

if (!fs.existsSync(target)) fail('admin-bilan.html généré introuvable');

let html = fs.readFileSync(target, 'utf8');

const startMarker = "const exp=Object.hasOwn(sc,'pageTexteTrous')||sessionStorage.getItem('paronymes_total')!==null||sessionStorage.getItem('erreurs_exercice')!==null;";
const endMarker = '\nlet e=0,he=false;';
const start = html.indexOf(startMarker);
if (start < 0) fail('bloc Expression écrite du Build #132 introuvable');
if (html.indexOf(startMarker, start + 1) >= 0) fail('bloc Expression écrite présent plusieurs fois');
const end = html.indexOf(endMarker, start);
if (end < 0) fail('fin du bloc Expression écrite introuvable');

const replacement = `const dictee=json('dictee_data',null);const dicteeOK=dictee?.status==='verified'&&Number.isFinite(+dictee.scoreSur20);
const exp=Object.hasOwn(sc,'pageTexteTrous')||sessionStorage.getItem('paronymes_total')!==null||sessionStorage.getItem('erreurs_exercice')!==null||dicteeOK;if(exp){const tr=+sc.pageTexteTrous||0,p=+sessionStorage.getItem('paronymes_score')||0,pt=+sessionStorage.getItem('paronymes_total')||0,g=Math.max(0,20-(+sessionStorage.getItem('erreurs_exercice')||0)),d=dicteeOK?Math.max(0,Math.min(20,+dictee.scoreSur20)):0,tt=15+pt+20+(dicteeOK?20:0),v=tr+p+g+d,pc=tt?Math.round(v/tt*100):0;apply('expression',pc>=70?'I':pc>=45?'II':'III','- '+v+' / '+tt+' point(s) ('+pc+' %)'+(dicteeOK?' — Dictée : '+d+' / 20':''))}`;

html = html.slice(0, start) + replacement + html.slice(end);

if (!html.includes("json('dictee_data',null)")) fail('lecture dictee_data absente après correction');
if (!html.includes("dictee?.status==='verified'")) fail('contrôle de validation de la dictée absent');
if (!html.includes("+dictee.scoreSur20")) fail('scoreSur20 de la dictée absent du calcul');
if (!html.includes("tt=15+pt+20+(dicteeOK?20:0)")) fail('barème +20 de la dictée absent');
if (!html.includes("v=tr+p+g+d")) fail('score de dictée non additionné à Expression écrite');

// Contrôle arithmétique : la dictée ajoute 20 points uniquement lorsqu'elle est validée.
function calc(tr, p, pt, g, dicteeScore, verified) {
  const d = verified ? Math.max(0, Math.min(20, dicteeScore)) : 0;
  const total = 15 + pt + 20 + (verified ? 20 : 0);
  const value = tr + p + g + d;
  return { value, total, percent: total ? Math.round(value / total * 100) : 0 };
}
const perfect = calc(15, 20, 20, 20, 20, true);
if (perfect.value !== 75 || perfect.total !== 75 || perfect.percent !== 100) fail('test 75/75 incorrect');
const halfDictee = calc(15, 20, 20, 20, 10, true);
if (halfDictee.value !== 65 || halfDictee.total !== 75 || halfDictee.percent !== 87) fail('test dictée 10/20 incorrect');
const legacy = calc(15, 20, 20, 20, 0, false);
if (legacy.value !== 55 || legacy.total !== 55 || legacy.percent !== 100) fail('régression du calcul sans dictée');

// Vérifier la syntaxe de tous les scripts de la page finale réellement produite.
const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let scriptNo = 0;
while ((match = scriptRe.exec(html))) {
  scriptNo += 1;
  const code = match[1].trim();
  if (!code) continue;
  try {
    new vm.Script(code);
  } catch (error) {
    fail('JavaScript admin-bilan invalide après correction (script ' + scriptNo + ') : ' + error.message);
  }
}

fs.writeFileSync(target, html, 'utf8');
console.log('SEB EvalPro Build #133 : dictée intégrée au bilan Expression écrite — jusqu’à 20 points ajoutés, total 75 points lorsque les 4 composantes sont présentes; seuils I/II/III inchangés.');
