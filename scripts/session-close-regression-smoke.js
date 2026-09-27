const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCandidateStore } = require('../src/candidate-store-main');
const { configureLocalKey, readJsonFile } = require('../src/candidate-data-crypto');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seb-evalpro-session-close-'));
const documentsPath = path.join(root, 'Documents');
const userDataPath = path.join(root, 'AppData');
configureLocalKey(Buffer.alloc(32, 16));

try {
  const store = createCandidateStore({
    documentsPath,
    userDataPath,
    now: () => new Date('2026-09-27T18:40:00.000Z')
  });

  const state = {
    version: 1,
    sessionStorage: {
      candidat_data: JSON.stringify({
        nom: 'XX',
        'prénom': 'YY',
        lieu: 'Lorient',
        groupe: '7',
        date: '2026-09-27'
      }),
      reponses_data: JSON.stringify({ dictee: 'texte en cours' }),
      scores_data: '{}'
    },
    localStorage: {},
    lastPage: 'dictee.html',
    lastEvaluationPage: 'dictee.html'
  };

  const saved = store.saveSnapshot(state);
  assert(saved, 'Le parcours actif doit exister avant Fermer la session.');
  assert(store.getActiveCandidate(), 'Le pointeur actif doit exister avant Fermer la session.');

  const completed = store.completeActiveCandidate(state, 'admin-session-close');
  assert(completed && completed.status === 'TERMINE', 'Fermer la session doit terminer le parcours actif.');
  assert.strictEqual(store.getActiveCandidate(), null, 'Fermer la session doit supprimer le pointeur actif.');
  assert.strictEqual(fs.existsSync(store.paths.activePointerPath), false, 'Le pointeur actif principal doit être supprimé.');
  assert.strictEqual(fs.existsSync(store.paths.activePointerBackupPath), false, 'La copie du pointeur actif doit être supprimée.');
  assert(fs.existsSync(saved.candidateDir), 'Le dossier candidat doit être conservé.');

  const manifest = readJsonFile(path.join(saved.candidateDir, 'manifest.json'));
  assert.strictEqual(manifest.status, 'TERMINE', 'Le manifeste doit être TERMINE après Fermer la session.');
  assert.strictEqual(manifest.completionReason, 'admin-session-close', 'Le motif de clôture doit tracer Fermer la session.');

  const preload = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload.js'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  const sessionClose = fs.readFileSync(path.join(__dirname, '..', 'src', 'session-close.js'), 'utf8');

  assert(preload.includes("ipcRenderer.invoke('candidate:complete-active', 'admin-session-close')"), 'Le bouton Fermer la session doit appeler la clôture du candidat.');
  assert(!preload.includes("il restera reprenable au prochain démarrage"), 'Le texte obsolète de reprise ne doit plus exister.');
  assert(!preload.includes("Cette action ne termine pas le parcours du candidat"), 'Le texte obsolète disant que le parcours reste actif doit être supprimé.');
  assert(preload.includes("Le parcours en cours ne pourra plus être repris."), 'La confirmation doit annoncer la fin définitive du parcours.');

  const freeze = preload.indexOf('closingSession = true;', preload.indexOf("closeSessionButton.addEventListener"));
  const complete = preload.indexOf("ipcRenderer.invoke('candidate:complete-active', 'admin-session-close')");
  assert(freeze >= 0 && complete >= 0 && freeze < complete, 'Les autosaves doivent être gelés avant la clôture du candidat.');

  assert(main.includes("'admin-session-close'"), 'Le moteur principal doit autoriser le mode admin-session-close.');
  assert(main.includes('writeState(defaultState());'), 'La clôture doit remettre l’état global à l’accueil.');
  assert(!sessionClose.includes('reste intact et reprenable'), 'Le module de fermeture ne doit plus documenter une reprise du parcours.');

  console.log('SESSION_CLOSE_ENDS_ACTIVE_PARCOURS: OK');
  console.log('SESSION_CLOSE_REMOVES_ACTIVE_POINTER: OK');
  console.log('SESSION_CLOSE_RESETS_RESTART_STATE: OK');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
