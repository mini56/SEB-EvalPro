const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error('SEB EvalPro garde parcours: ' + message);
  process.exit(2);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const source = read('app/web/js/seb-parcours.js');
const sandbox = { window:{ location:{ href:'' } }, encodeURIComponent };
vm.runInNewContext(source, sandbox, { filename:'seb-parcours.js' });

const api = sandbox.window.sebParcours;
if (!api || !Array.isArray(api.steps)) fail('API sebParcours absente ou invalide');

const expectedIds = [
  'qcm-1','qcm-2','qcm-2_1','qcm-3','qcm-texte-trous','qcm-4','qcm-5','qcm-5_1','qcm-6',
  'autoeval1','introbrique','brique','stock','planning','genrenombres','dictee','tri-de-cheville',
  'nwtexte','nvmail','autoeval2','paronymes','carre','qcm-11','qcm-finale'
];

const ids = Array.from(api.steps, (step) => String(step.id));
if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) {
  fail('ordre du parcours validé modifié: ' + JSON.stringify(ids));
}
if (new Set(ids).size !== ids.length) fail('identifiant de parcours dupliqué');

for (const step of api.steps) {
  if (!step.file || !/\.html(?:$|[?#])/i.test(String(step.file))) {
    fail('fichier de parcours invalide pour ' + step.id);
  }
  const localFile = path.join(root, 'app', 'web', String(step.file).split(/[?#]/)[0]);
  if (!fs.existsSync(localFile)) fail('page de parcours absente: ' + step.file);
}

// Dictée obligatoire entre Genre/Nombre et Tri.
if (api.nextFile('genrenombres') !== 'dictee.html') fail('genrenombres -> dictee modifié');
if (api.nextFile('dictee') !== 'tri_de_cheville.html') fail('dictee -> tri modifié');
const dicteeContract = api.resultContractFor('dictee');
if (!dicteeContract || dicteeContract.storage !== 'dictee_data') fail('contrat Résultats dictée modifié');

// Ordre actuellement validé autour du traitement de texte.
if (api.nextFile('tri-de-cheville') !== 'nwtexte.html') fail('tri -> nwtexte modifié');
if (api.nextFile('nwtexte') !== 'nvmail.html') fail('nwtexte -> nvmail modifié');
if (api.nextFile('nvmail') !== 'autoeval2.html') fail('nvmail -> autoeval2 modifié');

// Retour du carré vers la page 11 du QCM, puis page de fin.
if (api.nextUrl('carre') !== 'qcmv1.0.html?page=11#page11') fail('carre -> QCM page 11 modifié');
if (api.nextUrl('qcm-11') !== 'qcmv1.0.html?page=finale#pageFinale') fail('QCM page 11 -> fin modifié');

// Le contrat Résultats historique nwtexte doit rester lisible sans renommage.
const nw = api.resultContractFor('nwtexte');
if (!nw || nw.scoreStorage !== 'scores_data' || nw.scoreKey !== 'page7' ||
    nw.responseStorage !== 'reponses_data' || nw.responseKey !== 'page7_analyse') {
  fail('contrat Résultats nwtexte modifié');
}
const mail = api.resultContractFor('nvmail');
if (!mail || mail.storage !== 'page8_data' || mail.scoreKey !== 'score_total') {
  fail('contrat Résultats nvmail modifié');
}

// Vérification directe de la page Résultats générée.
const qcm = read('app/web/qcmv1.0.html');
for (const token of [
  "if (reponses['page7_analyse'])",
  "scores['page7']",
  'const scoreMax = 8;',
  'Enregistrement conforme',
  "sessionStorage.getItem('page8_data')"
]) {
  if (!qcm.includes(token)) fail('récupération Résultats absente: ' + token);
}

// Le pilote nwtexte doit continuer à naviguer par identifiant et jamais connaître nvmail.
const nwPage = read('app/web/js/nwtexte-page.js');
if (!nwPage.includes("sebParcours.goNext('nwtexte')")) fail('nwtexte ne passe plus par le registre');
if (/nvmail\.html/i.test(nwPage)) fail('couplage direct nwtexte -> nvmail réintroduit');

console.log('SEB EvalPro garde parcours: ordre complet, destinations et contrats Résultats — OK.');
