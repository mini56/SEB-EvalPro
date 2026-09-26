const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error('SEB EvalPro garde Tri: ' + message);
  process.exit(2);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const html = read('app/web/tri_de_cheville.html');
const page = read('app/web/js/tri-page.js');
const parcours = read('app/web/js/seb-parcours.js');
const qcm = read('app/web/qcmv1.0.html');

const protectedText = [
  'Le tri de chevillles',
  'Une mauvaise manipulation a provoqué la chute d’une caisse entière de chevilles au chargement du camion',
  'Chacun des employés doit trier de trois à cinq boîtes de chevilles',
  'Autoévaluation personnelle',
  'Je me suis senti(e) à l’aise dans les exercices proposés.',
  'J’ai rencontré des difficultés.',
  'Je pense avoir progressé dans mes temps.',
  'Cette activité m’a donné mal au dos ou au bras.',
  'Je me suis senti(e) stressé(e) ou bloqué(e) à certains moments.',
  'Valider mon autoévaluation'
];
for (const token of protectedText) {
  if (!html.includes(token)) fail('contenu validé modifié: ' + token);
}

for (const token of [
  'Démarrer le chronomètre',
  'Arrêter le chronomètre',
  'Le temps est automatiquement reporté dans les cases Minutes et Secondes.',
  'Le curseur se place ensuite dans la case <strong>Erreurs</strong>',
  'Après la saisie des erreurs, le chronomètre revient à <strong>00:00</strong>',
  'Effectuez entre <strong>3 et 5 tris</strong>',
  'Voir les résultats'
]) {
  if (!html.includes(token)) fail('nouveau fonctionnement Tri absent: ' + token);
}

const chronoBlock = html.match(/<div class="chrono-buttons">([\s\S]*?)<\/div>/);
if (!chronoBlock) fail('bloc boutons chrono absent');
const chronoButtons = chronoBlock[1].match(/<button\b/g) || [];
if (chronoButtons.length !== 2) fail('le chronomètre doit avoir exactement 2 boutons, trouvé: ' + chronoButtons.length);
if (!html.includes('id="startBtn"') || !html.includes('id="stopBtn"')) fail('boutons Démarrer/Arrêter absents');
if (html.includes('id="resetBtn"')) fail('ancien troisième bouton chrono réintroduit');

for (let i = 1; i <= 5; i += 1) {
  if (!new RegExp('id="m' + i + '"[^>]*readonly').test(html)) fail('Minutes tri ' + i + ' non verrouillées');
  if (!new RegExp('id="s' + i + '"[^>]*readonly').test(html)) fail('Secondes tri ' + i + ' non verrouillées');
  if (!new RegExp('id="e' + i + '"[^>]*min="0"').test(html)) fail('Erreurs tri ' + i + ' non protégées');
}

if (!html.includes('<script src="js/seb-parcours.js"></script>') ||
    !html.includes('<script src="js/tri-page.js"></script>')) {
  fail('scripts modulaires Tri absents');
}
if (/function\s+(?:startChrono|stopChrono|calcMoyenne|resetChrono|saveTriResultsToQCM)\s*\(/.test(html)) {
  fail('ancien moteur Tri réintroduit dans le HTML');
}

for (const token of [
  "const DATA_KEY = 'tri_cheville_data';",
  "const AUTO_KEY = 'autoEvaltri_resultats';",
  "const READY_KEY = 'seb_tri_navigation_ready';",
  "const LIVE_KEY = 'seb_evalpro_tri_live_chrono';",
  'const MIN_TRIS = 3;',
  'const MAX_TRIS = 5;',
  'function startChrono()',
  'function stopChrono()',
  'awaitingError = currentTri;',
  'errorInput.focus();',
  'function finalizeError(index)',
  'chronoSeconds = 0;',
  "sessionStorage.setItem(LIVE_KEY, '0');",
  'function minimumTrisDone()',
  'function validateAutoEvaluation(event)',
  "sessionStorage.setItem(DATA_KEY, JSON.stringify(data));",
  "sessionStorage.setItem(AUTO_KEY, JSON.stringify(data));",
  "window.sebParcours.goNext('tri-de-cheville')",
  'window.sebEvalProTriNavigationReady = navigationReady;',
  'function ensureDicteeCompleted()',
  "window.location.replace('dictee.html')"
]) {
  if (!page.includes(token)) fail('contrat Tri modulaire absent: ' + token);
}

if (/nwtexte\.html/i.test(page)) fail('couplage direct Tri -> nwtexte réintroduit');

const triPos = parcours.indexOf("id:'tri-de-cheville'");
const nwPos = parcours.indexOf("id:'nwtexte'");
if (triPos < 0 || nwPos <= triPos) fail('ordre Tri -> nwtexte absent');

for (const token of [
  "storage:'tri_cheville_data'",
  "autoStorage:'autoEvaltri_resultats'"
]) {
  if (!parcours.includes(token)) fail('contrat Résultats Tri absent du registre: ' + token);
}

for (const token of [
  'sessionStorage.getItem("tri_cheville_data")',
  'const trisRealises = Array.isArray(triData.tris)',
  'Moyenne des tris réalisés',
  'sessionStorage.getItem("autoEvaltri_resultats")'
]) {
  if (!qcm.includes(token)) fail('page Résultats ne récupère plus correctement le Tri: ' + token);
}

console.log('SEB EvalPro garde Tri: 2 boutons chrono, 3-5 tris, erreurs explicites, reprise, Résultats et navigation centrale — OK.');
