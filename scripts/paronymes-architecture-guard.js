const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
function fail(message) {
  console.error('SEB EvalPro garde paronymes: ' + message);
  process.exit(2);
}
function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const source = read('source/paronymes.html');
const html = read('app/web/paronymes.html');
const page = read('app/web/js/paronymes-page.js');
const parcours = read('app/web/js/seb-parcours.js');
const qcm = read('app/web/qcmv1.0.html');

const expectedRows = [
  '<tr><td class="paronyme">Apitoiement</td><td data-correct="true">Pitié</td><td>Appétence</td><td>Indifférence</td><td>Capiteux</td><td>Piété</td></tr>',
  '<tr><td class="paronyme">Idéaux</td><td>Rêves</td><td>Idées</td><td>Pensées</td><td>Géniaux</td><td data-correct="true">Parfaits</td></tr>',
  '<tr><td class="paronyme">Enseignent</td><td>Disent</td><td>Marquent</td><td>Saignent</td><td data-correct="true">Instruisent</td><td>Assignent</td></tr>',
  '<tr><td class="paronyme">Arboré</td><td>Abhorré</td><td>Planté</td><td>Détesté</td><td data-correct="true">Boisé</td><td>Orée</td></tr>',
  '<tr><td class="paronyme">Glorieux</td><td data-correct="true">Prestigieux</td><td>Ordinaire</td><td>Méritant</td><td>Glossaire</td><td>Fort</td></tr>',
  '<tr><td class="paronyme">Maugréer</td><td>Maudire</td><td>Chanter mal</td><td data-correct="true">Râler</td><td>Agréer</td><td>Souffrir</td></tr>',
  '<tr><td class="paronyme">Pilier</td><td>Piller</td><td>Voler</td><td data-correct="true">Colonne</td><td>Piler</td><td>Épiler</td></tr>',
  '<tr><td class="paronyme">Monopole</td><td>Jeu</td><td data-correct="true">Exclusivité</td><td>Acropole</td><td>Un seul pôle</td><td>Solitude</td></tr>',
  '<tr><td class="paronyme">Luire</td><td>Nuire</td><td>Polir</td><td>Éclairer</td><td>Étoiler</td><td data-correct="true">Briller</td></tr>',
  '<tr><td class="paronyme">Quittance</td><td>Paye</td><td>Facture</td><td data-correct="true">Reçu</td><td>Prix</td><td>Quitter</td></tr>',
  '<tr><td class="paronyme">Proscrire</td><td>Inscrire</td><td>Déduire</td><td>Reproduire</td><td>Souscrire</td><td data-correct="true">Interdire</td></tr>',
  '<tr><td class="paronyme">Guenille</td><td>Hayon</td><td>Ailleurs</td><td data-correct="true">Haillon</td><td>Singe</td><td>Haleur</td></tr>',
  '<tr><td class="paronyme">Verbal</td><td>Conjugué</td><td>Éloquent</td><td>Buccal</td><td data-correct="true">Oral</td><td>Écrit</td></tr>',
  '<tr><td class="paronyme">Effectif</td><td data-correct="true">Concret</td><td>Affecté</td><td>Affectueux</td><td>Compte</td><td>Réactif</td></tr>',
  '<tr><td class="paronyme">Abréger</td><td>Abrevoir</td><td>Aberration</td><td>Aboutir</td><td data-correct="true">Réduire</td><td>Déplacer</td></tr>',
  '<tr><td class="paronyme">Synonyme</td><td>Signaler</td><td data-correct="true">Pareil</td><td>Anonyme</td><td>Signifier</td><td>Canoniser</td></tr>',
  '<tr><td class="paronyme">Mobiliser</td><td>Aménager</td><td>Immobilier</td><td>Verbaliser</td><td>Signifier</td><td data-correct="true">Appeler</td></tr>',
  '<tr><td class="paronyme">Différend</td><td>Prétend</td><td data-correct="true">Conflit</td><td>Vérifier</td><td>Argent</td><td>Éloquent</td></tr>',
  '<tr><td class="paronyme">Lucratif</td><td>Luxueux</td><td>Création</td><td data-correct="true">Rentable</td><td>Gratuit</td><td>Généreux</td></tr>',
  '<tr><td class="paronyme">Raboter</td><td>Robotiser</td><td data-correct="true">Revoir</td><td>Cuisiner</td><td>Aboutir</td><td>Dérober</td></tr>'
];

for (const row of expectedRows) {
  if (!source.includes(row)) fail('tableau source modifié: ' + row);
  if (!html.includes(row)) fail('tableau généré modifié: ' + row);
}
if (expectedRows.length !== 20) fail('référence tableau différente de 20 lignes');

const sourceRows=(source.match(/<tr>[\s\S]*?<\/tr>/g)||[]).filter((row)=>row.includes('class="paronyme"'));
if(sourceRows.length!==20) fail('source Paronymes: '+sourceRows.length+' lignes au lieu de 20');
sourceRows.forEach((row,index)=>{
  const count=(row.match(/data-correct="true"/g)||[]).length;
  if(count!==1) fail('source Paronymes ligne '+(index+1)+': '+count+' réponse(s) correcte(s)');
});

if (!source.includes('<script src="js/seb-parcours.js"></script>') ||
    !source.includes('<script src="js/paronymes-page.js"></script>')) fail('scripts modulaires Paronymes absents');
if (/onclick\s*=\s*["'][^"']*(?:verifierReponses|carre\.html)/i.test(source)) fail('navigation ou vérification inline réintroduite');
if (/function\s+verifierReponses\s*\(/.test(source)) fail('ancien moteur inline Paronymes réintroduit');

for (const token of [
  "const SCORE_KEY = 'paronymes_score'",
  "const RESPONSES_KEY = 'paronymes_reponses'",
  "const ERRORS_KEY = 'paronymes_erreurs_detail'",
  "const DONE_KEY = 'seb_paronymes_validated'",
  'isCorrect = corrects.includes(selected)',
  "sessionStorage.setItem(ERRORS_KEY, JSON.stringify(responses.filter((response) => !response.correct)))",
  "window.sebParcours.goNext('paronymes')",
  'window.sebParonymes = api'
]) if (!page.includes(token)) fail('contrat module Paronymes absent: '+token);

if (/carre\.html/i.test(page)) fail('couplage direct Paronymes -> Carré réintroduit');

const p=parcours.indexOf("id:'paronymes'");
const c=parcours.indexOf("id:'carre'");
if(p<0||c<=p) fail('ordre Paronymes -> Carré absent');

for (const token of [
  "sessionStorage.getItem('paronymes_score')",
  "sessionStorage.getItem('paronymes_reponses')"
]) if(!qcm.includes(token)) fail('page Résultats ne récupère plus Paronymes: '+token);

console.log('SEB EvalPro garde Paronymes: 20 lignes figées, barème, reprise, Résultats et navigation centrale — OK.');
