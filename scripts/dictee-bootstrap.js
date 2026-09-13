const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const webRoot = path.join(root, 'app', 'web');

function fail(message) {
  console.error(`SEB EvalPro dictée bootstrap: ${message}`);
  process.exit(2);
}

function decodeGzipBase64File(source, target) {
  if (!fs.existsSync(source)) fail(`${path.basename(source)} introuvable`);
  const encoded = fs.readFileSync(source, 'utf8').trim();
  const decoded = zlib.gunzipSync(Buffer.from(encoded, 'base64'));
  fs.writeFileSync(target, decoded);
}

function gitBlobSha1(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(header).update(buffer).digest('hex');
}

// La page source est conservée en payload texte compact pour rester transportable
// par l'API GitHub. Le build la reconstruit en HTML normal dans app/web.
const htmlPayload = path.join(webRoot, 'dictee.html.gz.b64');
const htmlTarget = path.join(webRoot, 'dictee.html');
decodeGzipBase64File(htmlPayload, htmlTarget);
fs.unlinkSync(htmlPayload);

// Conserver temporairement l'ancien OGG pendant l'exécution du patch historique.
// Il est supprimé avant empaquetage et n'est jamais utilisé dans l'application finale.
const audioParts = [
  'dictee-audio-00.b64',
  'dictee-audio-01.b64',
  'dictee-audio-02.b64',
  'dictee-audio-03.b64',
  'dictee-audio-mid-00.b64',
  'dictee-audio-mid-01.b64',
  'dictee-audio-mid-02.b64',
  'dictee-audio-mid-03.b64',
  'dictee-audio-midfix-00.b64',
  'dictee-audio-midfix-01.b64',
  'dictee-audio-mid-05.b64',
  'dictee-audio-mid-06.b64',
  'dictee-audio-mid-07.b64',
  'dictee-audio-06.b64'
];
for (const name of audioParts) {
  if (!fs.existsSync(path.join(webRoot, name))) fail(`fragment audio historique introuvable: ${name}`);
}
const legacyBase64 = audioParts.map(name => fs.readFileSync(path.join(webRoot, name), 'utf8').trim()).join('');
const legacyTarget = path.join(webRoot, 'dictee-reclamation-client.ogg');
fs.writeFileSync(legacyTarget, Buffer.from(legacyBase64, 'base64'));
const legacyBytes = fs.readFileSync(legacyTarget);
const legacySha256 = crypto.createHash('sha256').update(legacyBytes).digest('hex');
if (legacyBytes.length !== 38932) fail(`taille audio historique incorrecte: ${legacyBytes.length}`);
if (legacySha256 !== 'afebb2303efbd704b3564984f6e5090d42af36998aa3c111c90eb18eb26315b1') {
  fail(`SHA-256 audio historique incorrect: ${legacySha256}`);
}

// Supprimer les fragments de transport du dossier final.
fs.readdirSync(webRoot)
  .filter(name => /^dictee-audio-.*\.b64$/.test(name))
  .forEach(name => fs.unlinkSync(path.join(webRoot, name)));

// Exécuter le patch d'intégration existant puis supprimer le fichier temporaire.
const patchPayload = path.join(__dirname, 'dictee-patch.js.gz.b64');
const patchTemp = path.join(__dirname, '.dictee-patch.generated.js');
decodeGzipBase64File(patchPayload, patchTemp);
try {
  require(patchTemp);
} finally {
  try { fs.unlinkSync(patchTemp); } catch (_) {}
}

// Audio définitif validé par l'utilisateur : enregistrement fixe Microsoft Julie.
// Ce fichier est embarqué dans l'application afin que la lecture ne dépende ni
// d'une voix Windows installée, ni d'Internet, ni de speechSynthesis.
const fixedSource = path.join(root, 'DICTEE', 'dictee-julie-080-pause1s.wav');
if (!fs.existsSync(fixedSource)) fail('enregistrement Julie validé introuvable dans DICTEE/');
const fixedBytes = fs.readFileSync(fixedSource);
const expectedGitBlobSha1 = '3a1cc353962a9331c728d43d1926fa9882f7a909';
const actualGitBlobSha1 = gitBlobSha1(fixedBytes);
if (actualGitBlobSha1 !== expectedGitBlobSha1) {
  fail(`enregistrement Julie modifié ou corrompu: blob ${actualGitBlobSha1} au lieu de ${expectedGitBlobSha1}`);
}
if (fixedBytes.length < 10000) fail(`enregistrement Julie anormalement petit: ${fixedBytes.length} octets`);

const fixedTarget = path.join(webRoot, 'dictee-reclamation-client.wav');
fs.writeFileSync(fixedTarget, fixedBytes);
const fixedSha256 = crypto.createHash('sha256').update(fixedBytes).digest('hex');

// Le lecteur généré doit utiliser exclusivement le WAV fixe.
let generated = fs.readFileSync(htmlTarget, 'utf8');
generated = generated.replace(/dictee-reclamation-client\.ogg/gi, 'dictee-reclamation-client.wav');
if (!generated.includes('dictee-reclamation-client.wav')) {
  fail('référence au WAV Julie absente de dictee.html');
}
if (/dictee-reclamation-client\.ogg/i.test(generated)) {
  fail('ancienne référence OGG encore présente dans dictee.html');
}
fs.writeFileSync(htmlTarget, generated, 'utf8');

// L'ancien OGG n'est pas embarqué.
try { fs.unlinkSync(legacyTarget); } catch (_) {}
if (fs.existsSync(legacyTarget)) fail('ancien OGG encore présent après remplacement');

console.log(`SEB EvalPro dictée: WAV Julie fixe embarqué (${fixedBytes.length} octets, SHA-256 ${fixedSha256}, blob ${actualGitBlobSha1}).`);
