const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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

// Même principe pour l'audio OGG Opus issu de l'enregistrement fourni.
const audioParts = fs.readdirSync(webRoot)
  .filter(name => /^dictee-audio-\d{2}\.b64$/.test(name))
  .sort();
if (!audioParts.length) fail('fragments audio introuvables');
const audioBase64 = audioParts.map(name => fs.readFileSync(path.join(webRoot, name), 'utf8').trim()).join('');
const audioTarget = path.join(webRoot, 'dictee-reclamation-client.ogg');
fs.writeFileSync(audioTarget, Buffer.from(audioBase64, 'base64'));
audioParts.forEach(name => fs.unlinkSync(path.join(webRoot, name)));
if (fs.statSync(audioTarget).size < 30000) fail('audio reconstruit anormalement petit');

// Exécuter le patch d'intégration puis supprimer le fichier temporaire.
const patchPayload = path.join(__dirname, 'dictee-patch.js.gz.b64');
const patchTemp = path.join(__dirname, '.dictee-patch.generated.js');
decodeGzipBase64File(patchPayload, patchTemp);
try {
  require(patchTemp);
} finally {
  try { fs.unlinkSync(patchTemp); } catch (_) {}
}
