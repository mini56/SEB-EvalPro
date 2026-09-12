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
// Les fragments centraux sont volontairement plus petits afin de fiabiliser leur transport.
const prefixParts = [0, 1, 2, 3].map(i => `dictee-audio-${String(i).padStart(2, '0')}.b64`);
const middleParts = fs.readdirSync(webRoot)
  .filter(name => /^dictee-audio-mid-\d{2}\.b64$/.test(name))
  .sort();
const suffixParts = ['dictee-audio-06.b64'];
const audioParts = [...prefixParts, ...middleParts, ...suffixParts];
if (middleParts.length !== 8) fail(`nombre de fragments audio centraux incorrect: ${middleParts.length}`);
for (const name of audioParts) {
  if (!fs.existsSync(path.join(webRoot, name))) fail(`fragment audio introuvable: ${name}`);
}
const audioBase64 = audioParts.map(name => fs.readFileSync(path.join(webRoot, name), 'utf8').trim()).join('');
const audioTarget = path.join(webRoot, 'dictee-reclamation-client.ogg');
fs.writeFileSync(audioTarget, Buffer.from(audioBase64, 'base64'));
audioParts.forEach(name => fs.unlinkSync(path.join(webRoot, name)));

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
