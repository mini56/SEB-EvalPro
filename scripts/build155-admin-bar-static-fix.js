const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error('SEB EvalPro Build #155 Admin bar stability: ' + message);
  process.exit(code);
}

function read(relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) fail(`fichier introuvable: ${relativePath}`);
  return { file, text: fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') };
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

function checkJs(text, label) {
  try { new vm.Script(text); }
  catch (error) { fail(`${label} invalide: ${error.message}`, 9); }
}

// -----------------------------------------------------------------------------
// 1. Shell Admin : revenir à la géométrie stable du #134.
//    Les boutons ajoutés après #134 existent dès la création de la barre et ne
//    sont plus déplacés/reconstruits par les modules Replay/Historique.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/preload.js');
  let out = text;

  // Annuler le #154 : la scrollbar principale reprend le comportement natif du #134.
  out = out.replace(
    '    html{box-sizing:border-box;scrollbar-gutter:stable}',
    '    html{box-sizing:border-box}'
  );

  // Créer les deux boutons post-#134 à emplacement fixe dès l'origine.
  if (!out.includes('id="seb-evalpro-replay"')) {
    const marker = '    <button id="seb-evalpro-bilan" type="button" hidden>Bilan</button>\n';
    if (!out.includes(marker)) fail('bouton Bilan du shell introuvable', 3);
    out = out.replace(
      marker,
      marker +
      '    <button id="seb-evalpro-replay" type="button" hidden>Rejouer un parcours</button>\n' +
      '    <button id="seb-evalpro-old-bilan" type="button" hidden>Ouvrir un ancien bilan</button>\n'
    );
  }

  // Références fixes : aucune recherche/reconstruction asynchrone nécessaire.
  if (!out.includes("const replayButton = bar.querySelector('#seb-evalpro-replay');")) {
    const marker = "  const closeSessionButton = bar.querySelector('#seb-evalpro-close-session');";
    if (!out.includes(marker)) fail('références boutons shell introuvables', 4);
    out = out.replace(
      marker,
      marker +
      "\n  const replayButton = bar.querySelector('#seb-evalpro-replay');" +
      "\n  const oldBilanButton = bar.querySelector('#seb-evalpro-old-bilan');"
    );
  }

  // Une seule fonction centrale pilote TOUTE la visibilité Admin.
  if (!out.includes('replayButton.hidden = !adminUnlocked;')) {
    const marker = '    closeSessionButton.hidden = !adminUnlocked;';
    if (!out.includes(marker)) fail('updateAdminButtons introuvable', 5);
    out = out.replace(
      marker,
      marker +
      '\n    if (replayButton) replayButton.hidden = !adminUnlocked;' +
      '\n    if (oldBilanButton) oldBilanButton.hidden = !adminUnlocked;'
    );
  }

  // La barre fixe ne doit jamais agrandir le viewport/document.
  out = out.replace(
    'will-change:transform}',
    'will-change:transform;max-width:100vw;overflow-x:hidden}'
  );

  for (const token of [
    'id="seb-evalpro-replay"',
    'id="seb-evalpro-old-bilan"',
    "const replayButton = bar.querySelector('#seb-evalpro-replay');",
    'replayButton.hidden = !adminUnlocked;',
    'oldBilanButton.hidden = !adminUnlocked;',
    'max-width:100vw;overflow-x:hidden'
  ]) if (!out.includes(token)) fail('shell statique incomplet: ' + token, 6);

  if (out.includes('html{box-sizing:border-box;scrollbar-gutter:stable}')) {
    fail('gouttière globale #154 encore active', 7);
  }
  if (out.includes('lockHorizontalPosition') || out.includes('window.scrollTo(0, window.scrollY)')) {
    fail('ancien verrouillage horizontal réapparu', 7);
  }

  checkJs(out, 'src/preload.js');
  write(file, out);
}

// -----------------------------------------------------------------------------
// 2. Replay : ne plus reconstruire la barre, ne plus déplacer les boutons,
//    ne plus interroger admin:status au survol/clic/MutationObserver.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/replay-preload.js');
  let out = text;

  const start = out.indexOf('function regroupAdminButtons() {');
  const end = out.indexOf('\nfunction formatDate(', start);
  if (start < 0 || end < 0) fail('regroupAdminButtons introuvable', 10);

  const staticFunction = `function regroupAdminButtons() {
  const bar = document.getElementById('seb-evalpro-topbar');
  const replay = document.getElementById('seb-evalpro-replay');
  if (!bar || !replay) return;
  addReplayStyle();
  replay.type = 'button';
  replay.textContent = 'Rejouer un parcours';
  if (replay.dataset.sebReplayBound !== '1') {
    replay.dataset.sebReplayBound = '1';
    replay.addEventListener('click', () => createReplayChooserDialog());
  }
}
`;

  out = out.slice(0, start) + staticFunction + out.slice(end);

  const regroupStart = out.indexOf('function regroupAdminButtons() {');
  const regroupEnd = out.indexOf('\nfunction formatDate(', regroupStart);
  const segment = out.slice(regroupStart, regroupEnd);
  for (const forbidden of [
    'new MutationObserver',
    "ipcRenderer.invoke('admin:status')",
    "bar.addEventListener('mouseenter'",
    'appendChild(el)',
    "insertAdjacentElement('afterend', left)",
    'seb-admin-left-actions',
    'seb-admin-right-actions'
  ]) {
    if (segment.includes(forbidden)) fail('Replay modifie encore dynamiquement la barre: ' + forbidden, 11);
  }
  for (const token of [
    "document.getElementById('seb-evalpro-replay')",
    'sebReplayBound',
    'createReplayChooserDialog()'
  ]) if (!segment.includes(token)) fail('Replay statique incomplet: ' + token, 12);

  checkJs(out, 'src/replay-preload.js');
  write(file, out);
}

// -----------------------------------------------------------------------------
// 3. Historique : même principe. Le bouton existe déjà dans le shell ; ce module
//    ne fait qu'attacher son action, sans observer ni réorganiser la barre.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/bilan-history-preload.js');
  let out = text;

  const start = out.indexOf('function ensureAdminButton() {');
  const end = out.indexOf('\nasync function openChooser()', start);
  if (start < 0 || end < 0) fail('bloc bouton historique introuvable', 20);

  const staticBlock = `function ensureAdminButton() {
  const button = document.getElementById('seb-evalpro-old-bilan');
  if (!button) return false;
  button.type = 'button';
  button.textContent = 'Ouvrir un ancien bilan';
  if (button.dataset.sebHistoryBound !== '1') {
    button.dataset.sebHistoryBound = '1';
    button.addEventListener('click', openChooser);
  }
  return true;
}

async function refreshAdminButton(button = document.getElementById('seb-evalpro-old-bilan')) {
  return !!button;
}

function installAdminButton() {
  addStyle();
  if (!ensureAdminButton()) setTimeout(ensureAdminButton, 150);
}
`;

  out = out.slice(0, start) + staticBlock + out.slice(end);

  const staticStart = out.indexOf('function ensureAdminButton() {');
  const staticEnd = out.indexOf('\nasync function openChooser()', staticStart);
  const segment = out.slice(staticStart, staticEnd);
  for (const forbidden of [
    'new MutationObserver',
    "ipcRenderer.invoke('admin:status')",
    "closest('#seb-evalpro-admin')",
    'insertBefore(button',
    'appendChild(button)',
    "insertAdjacentElement('afterend', button)"
  ]) {
    if (segment.includes(forbidden)) fail('Historique modifie encore dynamiquement la barre: ' + forbidden, 21);
  }
  for (const token of [
    "document.getElementById('seb-evalpro-old-bilan')",
    'sebHistoryBound',
    "button.addEventListener('click', openChooser)"
  ]) if (!segment.includes(token)) fail('Historique statique incomplet: ' + token, 22);

  checkJs(out, 'src/bilan-history-preload.js');
  write(file, out);
}

console.log('SEB EvalPro Build #155: barre Admin restaurée sur une géométrie fixe type #134; Replay/Historique ne déplacent plus les boutons et aucun observer/status au survol ne peut provoquer de reflow; gouttière globale #154 retirée.');
