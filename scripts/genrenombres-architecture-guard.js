const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error('SEB EvalPro garde Genre-Nombre: ' + message);
  process.exit(2);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const html = read('app/web/genrenombres.html');
const page = read('app/web/js/genrenombres-page.js');
const parcours = read('app/web/js/seb-parcours.js');
const resume = read('app/web/js/seb-page-draft-resume.js');
const qcm = read('app/web/qcmv1.0.html');

const answerInputs = html.match(/input type="text" data-answer="[^"]+"/g) || [];
if (answerInputs.length !== 20) fail('20 champs Genre/Nombre attendus, trouvé ' + answerInputs.length);

for (const token of [
  'data-answer="Un taux"',
  'data-answer="Des messieurs"',
  'data-answer="Des chevaux"',
  'data-answer="Des gaz"',
  'data-answer="Un ciel"',
  'data-answer="Des portails"',
  'data-answer="Un œil|un oeil"',
  'data-answer="Des Peugeot"',
  'data-answer="Des chefs-d’œuvre|Des chefs-d\'oeuvre"'.replace('’','’'),
  'data-answer="Des faire-part"',
  'data-answer="Public"',
  'data-answer="Heureux"',
  'data-answer="Blanche"',
  'data-answer="Fini"',
  'data-answer="Comédienne"',
  'data-answer="Ministre"',
  'data-answer="Compagne"',
  'data-answer="Mutuel"',
  'data-answer="Fausse"',
  'data-answer="Minette"',
  'id="btnCheck"',
  'id="btnNextGenreNombre"',
  '<script src="js/seb-parcours.js"></script>',
  '<script src="js/genrenombres-page.js"></script>'
]) {
  if (!html.includes(token)) fail('structure/barème Genre/Nombre absent: ' + token);
}

if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) fail('ancien JavaScript Genre/Nombre inline réintroduit');

for (const token of [
  "const ANSWERS_KEY = 'user_genrenombres';",
  "const ERRORS_KEY = 'erreurs_exercice';",
  "const DONE_KEY = 'seb_genrenombres_validated';",
  "const STATE_KEY = 'seb_evalpro_genrenombres_state';",
  'const TOTAL = 20;',
  ".replace(/\\u00A0/g, ' ')",
  ".replace(/[’‘]/g, \"'\")",
  ".replace(/\\s+/g, ' ')",
  ".toLocaleLowerCase('fr-FR')",
  'function evaluate(values)',
  'function restoreState()',
  'function verify()',
  "sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(result.answers));",
  "sessionStorage.setItem(ERRORS_KEY, String(result.errors));",
  "sessionStorage.setItem(DONE_KEY, '1');",
  "check.style.setProperty('display', 'none', 'important');",
  "next.style.setProperty('display', 'inline-flex', 'important');",
  "window.sebParcours.goNext('genrenombres')",
  'window.sebGenreNombre = Object.freeze({'
]) {
  if (!page.includes(token)) fail('contrat Genre/Nombre modulaire absent: ' + token);
}
if (/tri_de_cheville\.html/.test(page)) fail('couplage direct Genre/Nombre -> Tri réintroduit');
if (/removeItem\(['"]erreurs_exercice/.test(page)) fail('effacement destructif erreurs_exercice réintroduit');

const resumeToken = "if (page === 'genrenombres.html' && window.sebGenreNombre) return;";
if ((resume.match(/page === 'genrenombres\.html' && window\.sebGenreNombre/g) || []).length < 2) {
  fail('double moteur de reprise Genre/Nombre encore actif');
}

const genrePos = parcours.indexOf("id:'genrenombres'");
const triPos = parcours.indexOf("id:'tri-de-cheville'");
if (genrePos < 0 || triPos <= genrePos) fail('ordre genrenombres -> tri-de-cheville absent du registre');

for (const token of [
  "answersStorage:'user_genrenombres'",
  "errorStorage:'erreurs_exercice'",
  "stateStorage:'seb_evalpro_genrenombres_state'",
  "validatedStorage:'seb_genrenombres_validated'"
]) {
  if (!parcours.includes(token)) fail('contrat Résultats Genre/Nombre absent du registre: ' + token);
}

for (const token of [
  "sessionStorage.getItem('erreurs_exercice')",
  "sessionStorage.getItem('user_genrenombres')",
  'const scoreGN = 20 - erreurs'
]) {
  if (!qcm.includes(token)) fail('page Résultats ne récupère plus Genre/Nombre: ' + token);
}

console.log('SEB EvalPro garde Genre-Nombre: 20 réponses, normalisation contrôlée, reprise, validation unique, Résultats et navigation centrale — OK.');
