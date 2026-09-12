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

// La page source est conservée en payload texte compact pour rester transportable
// par l'API GitHub. Le build la reconstruit en HTML normal dans app/web.
const htmlPayload = path.join(webRoot, 'dictee.html.gz.b64');
const htmlTarget = path.join(webRoot, 'dictee.html');
decodeGzipBase64File(htmlPayload, htmlTarget);
fs.unlinkSync(htmlPayload);

// Reconstituer exactement l'audio OGG Opus issu de l'enregistrement fourni.
// L'ordre est explicite et les deux morceaux midfix remplacent le fragment central
// volontairement scindé pour fiabiliser son transport via GitHub.
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
  if (!fs.existsSync(path.join(webRoot, name))) fail(`fragment audio introuvable: ${name}`);
}
const audioBase64 = audioParts.map(name => fs.readFileSync(path.join(webRoot, name), 'utf8').trim()).join('');
const audioTarget = path.join(webRoot, 'dictee-reclamation-client.ogg');
fs.writeFileSync(audioTarget, Buffer.from(audioBase64, 'base64'));

// Supprimer tous les fragments de transport du dossier final, y compris un éventuel
// fragment historique inutilisé. L'application embarque uniquement le fichier OGG final.
fs.readdirSync(webRoot)
  .filter(name => /^dictee-audio-.*\.b64$/.test(name))
  .forEach(name => fs.unlinkSync(path.join(webRoot, name)));

const audioBytes = fs.readFileSync(audioTarget);
const audioSha256 = crypto.createHash('sha256').update(audioBytes).digest('hex');
const expectedAudioSha256 = 'afebb2303efbd704b3564984f6e5090d42af36998aa3c111c90eb18eb26315b1';
if (audioBytes.length !== 38932) fail(`taille audio incorrecte: ${audioBytes.length}`);
if (audioSha256 !== expectedAudioSha256) fail(`SHA-256 audio incorrect: ${audioSha256}`);

// Exécuter le patch d'intégration puis supprimer le fichier temporaire.
const patchPayload = path.join(__dirname, 'dictee-patch.js.gz.b64');
const patchTemp = path.join(__dirname, '.dictee-patch.generated.js');
decodeGzipBase64File(patchPayload, patchTemp);
try {
  require(patchTemp);
} finally {
  try { fs.unlinkSync(patchTemp); } catch (_) {}
}

console.log(`SEB EvalPro dictée: page et audio vérifiés (${audioBytes.length} octets, SHA-256 ${audioSha256}).`);
