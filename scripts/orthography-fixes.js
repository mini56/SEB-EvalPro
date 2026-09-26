const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error(`SEB EvalPro orthographe: ${message}`);
  process.exit(code);
}

function load(relativePath) {
  const target = path.join(root, relativePath);
  if (!fs.existsSync(target)) fail(`fichier introuvable: ${relativePath}`);
  return { target, text: fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') };
}

function save(target, text) {
  fs.writeFileSync(target, text, 'utf8');
}

function replace(out, oldText, newText, label) {
  if (out.includes(oldText)) return out.split(oldText).join(newText);
  if (out.includes(newText)) return out;
  fail(`cible introuvable pour ${label}`, 3);
}

function replaceOptional(out, oldText, newText) {
  return out.includes(oldText) ? out.split(oldText).join(newText) : out;
}

function patch(relativePath, changes) {
  const { target, text } = load(relativePath);
  let out = text;
  for (const change of changes) {
    const [oldText, newText, label, optional] = change;
    out = optional
      ? replaceOptional(out, oldText, newText)
      : replace(out, oldText, newText, label || oldText);
  }
  save(target, out);
  return out;
}

// QCM principal : uniquement textes visibles et libellés.
let qcm = patch('app/web/qcmv1.0.html', [
  ['compétences de base indispensable dans le monde du travail', 'compétences de base indispensables dans le monde du travail', 'accueil indispensables'],
  ['12 boites</strong> de vis', '12 boîtes</strong> de vis', 'page 2 boîtes'],
  ['7 boites</strong>. Combien', '7 boîtes</strong>. Combien', 'page 2 boîtes répartition'],
  ['par boite&nbsp;?', 'par boîte&nbsp;?', 'page 2 boîte'],
  ['175 Euros', '175 euros', 'page 2 euros'],
  ['Une boite de clous', 'Une boîte de clous', 'page 2.1 boîte'],
  ['4 boites</strong>', '4 boîtes</strong>', 'page 2.1 boîtes'],
  ['service de reception et contrôle marchandises', 'service de réception et de contrôle des marchandises', 'page 3 réception'],
  ['noter chaque jour:</strong>', 'noter chaque jour :</strong>', 'page 3 ponctuation'],
  ["L'heure à la quelle vous quittez le poste.", "L'heure à laquelle vous quittez le poste.", 'page 3 laquelle'],
  ['<td class="bleu">jeudi</td>', '<td class="bleu">Jeudi</td>', 'page 3 Jeudi'],
  ['vous devrez dans certain cas, réaliser les <strong>accords sujets/verbes et genre/pluriel.</strong>', 'vous devrez, dans certains cas, réaliser les <strong>accords sujet/verbe et genre/nombre.</strong>', 'texte à trous accords'],
  ['Mots a utiliser pour compléter votre texte', 'Mots à utiliser pour compléter votre texte', 'texte à trous à'],
  ["des lots de pieces dans l'atelier. Certaines pièce sont regroupées par type et doivent être\n   emballées selon des fraction précises.", "des lots de pièces dans l'atelier. Certaines pièces sont regroupées par type et doivent être\n   emballées selon des fractions précises.", 'page 4 pièces fractions'],
  ["le nombre d'images correspondante à celle-ci.", "le nombre d'images correspondant à celle-ci.", 'page 4 correspondant'],
  ["   vérifier l'inventaire du stock à transférer.", "   Vérifier l'inventaire du stock à transférer.", 'page 5 Vérifier'],
  ["Transporter le matériel jusqu'au nouvel atelier..", "Transporter le matériel jusqu'au nouvel atelier.", 'page 5 double point'],
  ["qui n'était pas là .", "qui n'était pas là.", 'page 5.1 espace'],
  ["Vous travaillez dans un atelier d'expeditionde l'entreprise.Avant l'envois des commandes, vous devez verifier les", "Vous travaillez dans un atelier d'expédition de l'entreprise. Avant l'envoi des commandes, vous devez vérifier les", 'page 6 expédition envoi vérifier'],
  ['<strong>poids,volumes et dimensions</strong>', '<strong>poids, volumes et dimensions</strong>', 'page 6 espaces'],
  ['effectuer plusieurs conversion.', 'effectuer plusieurs conversions.', 'page 6 conversions'],
  ['<strong>7,5 litres</strong> l\'huile.', '<strong>7,5 litres</strong> d\'huile.', 'page 6 huile'],
  ['Convertissez cette longeur en centimetres.', 'Convertissez cette longueur en centimètres.', 'page 6 longueur'],
  ['<strong>5600 g</strong> Convertissez', '<strong>5600 g</strong>. Convertissez', 'page 6 ponctuation 5600'],
  ["est rempli a <strong>50%</strong>. Conbien de millilitres contient-il.", "est rempli à <strong>50 %</strong>. Combien de millilitres contient-il ?", 'page 6 pourcentage'],
  ['<strong>10. </strong>une planche', '<strong>10. </strong>Une planche', 'page 6 majuscule'],
  ['Combien de morceaux peut-on obtenir?', 'Combien de morceaux peut-on obtenir ?', 'page 6 question'],
  ['<th>Opération effectuées</th>', '<th>Opérations effectuées</th>', 'page 6 opérations'],
  ['class="suivant">suivant</button>', 'class="suivant">Suivant</button>', 'page 6 bouton'],
  ['A besoin de consignes supplémentaires pour commercer l\'exercice.', 'A besoin de consignes supplémentaires pour commencer l\'exercice.', 'bilan qcm commencer', true],
  ['Reconnait les pièces mais les assemble avec difficulté.', 'Reconnaît les pièces mais les assemble avec difficulté.', 'bilan qcm reconnaît', true],
  ["Est en difficultés pour identifier les contraintes d'un problème structuré et à établir les relations entre ses éléments.", "A des difficultés à identifier les contraintes d'un problème structuré et à établir les relations entre ses éléments.", 'bilan qcm formulation', true],
  ['Ranger le stock produit', 'Ranger le stock de produits', 'bilan qcm stock', true],
  ['Structure des phrases et orthographe grammaticale correct. Lexique approprié et précis avec des écrits /textes cohérent.', 'Structure des phrases et orthographe grammaticale correctes. Lexique approprié et précis avec des écrits/textes cohérents.', 'bilan qcm expression', true],
  ["La structure des phrases et l’orthographe grammaticale n’est pas correcte.", "La structure des phrases et l’orthographe grammaticale ne sont pas correctes.", 'bilan qcm accord', true]
]);
qcm = qcm.replace(/Scénario:/g, 'Scénario :');
save(path.join(root, 'app/web/qcmv1.0.html'), qcm);

// Traitement de texte : la source nwtexte est désormais la référence validée.
// Aucun texte de cette page ne doit être réécrit silencieusement pendant le build.
{
  const { text: nw } = load('app/web/nwtexte.html');
  const { text: nwEngine } = load('app/web/js/nwtexte-quill-engine.js');
  const required = [
    "Répondez à l'une des trois questions suivantes",
    'Quelle est mon activité préférée et pourquoi ?',
    'Quelle est mon expérience professionnelle préférée et pourquoi ?',
    'Quel est mon métier préféré et pourquoi ?',
    "Préparez votre texte à la main si besoin, puis, quand vous êtes prêt, utilisez l'éditeur dans la fenêtre de droite.",
    "Dans l'éditeur, mettez en forme votre texte",
    '<strong>Titre :</strong> Notez la question choisie, puis mettez-la en <strong>gras</strong>',
    "sous l'intitulé :</p>",
    "Ensuite, passez à l'étape suivante...",
    'Scénario :'
  ];
  for (const token of required) if (!nw.includes(token)) fail('nwtexte validé altéré: ' + token, 13);
  for (const token of [
    'Quelle est mon activité préférée et pourquoi ?',
    'Quelle est mon expérience professionnelle préférée et pourquoi ?',
    'Quel est mon métier préféré et pourquoi ?'
  ]) if (!nwEngine.includes(token)) fail('moteur nwtexte désynchronisé: ' + token, 13);
}

// Messagerie.
let mail = patch('app/web/nvmail.html', [
  ['les adresses email\n\t</strong> suivante:', 'les adresses e-mail\n\t</strong> suivantes :', 'mail adresses'],
  ['A votre conseiller:', 'À votre conseiller :', 'mail conseiller'],
  ['En copie a votre responsable de stage:', 'En copie à votre responsable de stage :', 'mail copie'],
  ['Mettre en objet:', 'Mettez en objet :', 'mail objet'],
  ['en piece jointe.', 'en pièce jointe.', 'mail pièce jointe'],
  ['sur le modèle si dessous:', 'sur le modèle ci-dessous :', 'mail ci-dessous'],
  ["Ensuite passez a l'étape suivante...", "Ensuite, passez à l'étape suivante...", 'mail ensuite']
]);
mail = mail.replace(/Scénario:/g, 'Scénario :');
save(path.join(root, 'app/web/nvmail.html'), mail);

// Construction à base de briques.
let brique = patch('app/web/brique.html', [
  ['Construction a base de briques.', 'Construction à base de briques.', 'brique titre'],
  ["Réclamer votre boite de briques et commencer l’assemblage...", "Réclamez votre boîte de briques et commencez l’assemblage...", 'brique réclamez'],
  ['Lisez les indications avant de commencer l’exercice:', 'Lisez les indications avant de commencer l’exercice :', 'brique indications'],
  ['<strong> Faite évaluer</strong> ensuite votre modèle.</strong>', '<strong> Faites évaluer</strong> ensuite votre modèle.</strong>', 'brique faites'],
  ['Quand vous avez fini appuyer sur <strong>Valider</strong>', 'Quand vous avez fini, appuyez sur <strong>Valider</strong>', 'brique appuyez'],
  ['<h2>Votre ressenti?</h2>', '<h2>Votre ressenti ?</h2>', 'brique ressenti'],
  ["Je me suis senti(e) à l’aise dans l'exercices proposés.", "Je me suis senti(e) à l’aise dans l’exercice proposé.", 'brique exercice'],
  ["J'ai pu progressé dans mon assemblage.", "J’ai pu progresser dans mon assemblage.", 'brique progresser'],
  ["j'ai été fatigué(e) par cette exercice.", "J’ai été fatigué(e) par cet exercice.", 'brique cet exercice'],
  ['Temps passé sur le modèle: :</strong>', 'Temps passé sur le modèle :</strong>', 'brique temps'],
  ["Nombre d'érreur(s) :", "Nombre d’erreur(s) :", 'brique erreurs']
]);
brique = brique.replace(/Scénario:/g, 'Scénario :').replace(/Consignes:/g, 'Consignes :');
save(path.join(root, 'app/web/brique.html'), brique);

// Tri de chevilles : le scénario principal est déjà corrigé par le patch précédent.
let tri = patch('app/web/tri_de_cheville.html', [
  ['Vous passerrez ensuite à l\'étape suivante.', 'Vous passerez ensuite à l\'étape suivante.', 'tri passerez'],
  ['<h2>Votre ressenti:</h2>', '<h2>Votre ressenti :</h2>', 'tri ressenti']
]);
tri = tri.replace(/Scénario:/g, 'Scénario :').replace(/Consignes:/g, 'Consignes :').replace(/commencer l’exercice:/g, 'commencer l’exercice :');
save(path.join(root, 'app/web/tri_de_cheville.html'), tri);

// Stock.
let stock = patch('app/web/stock.html', [
  ['Ranger les flacons , un par emplacement, selon les consignes suivantes:', 'Rangez les flacons, un par emplacement, selon les consignes suivantes :', 'stock rangez'],
  ['Les flacons en double ou ne convenant pas aux casiers 1 et 2 seront palcés en 3, selon les mémé critères.', 'Les flacons en double ou ne convenant pas aux casiers 1 et 2 seront placés dans le casier 3, selon les mêmes critères.', 'stock placés mêmes'],
  ['Casier1️⃣', 'Casier 1️⃣', 'stock casier 1'],
  ['Casier2️⃣', 'Casier 2️⃣', 'stock casier 2'],
  ['Casier3️⃣', 'Casier 3️⃣', 'stock casier 3']
]);
stock = stock.replace(/Scénario:/g, 'Scénario :').replace(/Consignes:/g, 'Consignes :');
save(path.join(root, 'app/web/stock.html'), stock);

// Planning : affichage + solution q7 restent synchronisés grâce au remplacement global.
let planning = patch('app/web/planning.html', [
  ['Renseigner les menus pour chaque jour', 'Renseignez les menus pour chaque jour', 'planning renseignez'],
  ['crème brulée', 'crème brûlée', 'planning brûlée']
]);
planning = planning.replace(/Spaghetti/g, 'Spaghettis').replace(/spaghetti/g, 'spaghettis');
save(path.join(root, 'app/web/planning.html'), planning);

// Paronymes : corrections orthographiques et accords, sans changer les 20 lignes ni le barème.
patch('app/web/paronymes.html', [
  ['>Rèves<', '>Rêves<', 'paronymes rêves'],
  ['data-correct="true">Parfait<', 'data-correct="true">Parfaits<', 'paronymes parfaits'],
  ['data-correct="true">Instruise<', 'data-correct="true">Instruisent<', 'paronymes instruisent'],
  ['>Epiler<', '>Épiler<', 'paronymes épiler'],
  ['>Un seule pôle<', '>Un seul pôle<', 'paronymes pôle'],
  ['>Eclairer<', '>Éclairer<', 'paronymes éclairer'],
  ['>Etoiler<', '>Étoiler<', 'paronymes étoiler'],
  ['>Eloquent<', '>Éloquent<', 'paronymes éloquent'],
  ['>Ecrit<', '>Écrit<', 'paronymes écrit'],
  ['>Abérration<', '>Aberration<', 'paronymes aberration'],
  ['class="paronyme">Différent<', 'class="paronyme">Différend<', 'paronymes différend']
]);

// Puzzle Gratte-ciel.
patch('app/web/carre.html', [
  ["C'est la journée de cohésion d'équipe, régulièrement l'équipe est invitée à se retrouver pour partager un moment convivial.</br>", "C'est la journée de cohésion d'équipe. Régulièrement, l'équipe est invitée à se retrouver pour partager un moment convivial.</br>", 'carré cohésion']
]);

// Bilan administrateur : orthographe des libellés institutionnels visibles.
function patchBilan(relativePath) {
  const target = path.join(root, relativePath);
  if (!fs.existsSync(target)) return;
  let out = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
  out = replaceOptional(out, "A besoin de consignes supplémentaires pour commercer l'exercice.", "A besoin de consignes supplémentaires pour commencer l'exercice.");
  out = replaceOptional(out, 'Reconnait les pièces mais les assemble avec difficulté.', 'Reconnaît les pièces mais les assemble avec difficulté.');
  out = replaceOptional(out, "Est en difficultés pour identifier les contraintes d'un problème structuré et à établir les relations entre ses éléments.", "A des difficultés à identifier les contraintes d'un problème structuré et à établir les relations entre ses éléments.");
  out = replaceOptional(out, 'Ranger le stock produit', 'Ranger le stock de produits');
  out = replaceOptional(out, 'Structure des phrases et orthographe grammaticale correct. Lexique approprié et précis avec des écrits /textes cohérent.', 'Structure des phrases et orthographe grammaticale correctes. Lexique approprié et précis avec des écrits/textes cohérents.');
  out = replaceOptional(out, 'La structure des phrases et l’orthographe grammaticale n’est pas correcte.', 'La structure des phrases et l’orthographe grammaticale ne sont pas correctes.');
  fs.writeFileSync(target, out, 'utf8');
}
patchBilan('app/web/admin-bilan.html');
patchBilan('app/web/bilan.html');

// Contrôles bloquants des corrections qui touchent les barèmes.
{
  const { text } = load('app/web/paronymes.html');
  const rows = (text.match(/<tr>[\s\S]*?<\/tr>/g) || []).filter((row) => row.includes('class="paronyme"'));
  if (rows.length !== 20) fail(`Paronymes: ${rows.length} lignes après correction, attendu 20`, 10);
  rows.forEach((row, index) => {
    const count = (row.match(/data-correct="true"/g) || []).length;
    if (count !== 1) fail(`Paronymes: ligne ${index + 1}, ${count} bonne(s) réponse(s)`, 11);
  });
}
{
  const { text } = load('app/web/planning.html');
  if (!text.includes('q7:"Spaghettis"')) fail('Planning: solution q7 non synchronisée avec Spaghettis', 12);
}
{
  const { text } = load('app/web/js/nwtexte-quill-engine.js');
  if (!text.includes('Quelle est mon activité préférée et pourquoi ?') || !text.includes('Quelle est mon expérience professionnelle préférée et pourquoi ?')) {
    fail('nwtexte: titres corrigés absents du moteur de notation', 13);
  }
}

console.log('SEB EvalPro orthographe: textes visibles corrigés, Paronymes 20/20 préservé, Planning et nwtexte synchronisés avec leurs barèmes.');
