const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCandidateStore } = require('../src/candidate-store-main');
const { configureLocalKey, readJsonFile } = require('../src/candidate-data-crypto');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seb-evalpro-admin-quit-'));
const documentsPath = path.join(root, 'Documents');
const userDataPath = path.join(root, 'AppData');
configureLocalKey(Buffer.alloc(32, 17));

try {
  const store = createCandidateStore({
    documentsPath,
    userDataPath,
    now: () => new Date('2026-09-27T19:00:00.000Z')
  });

  const dicteeState = {
    version: 1,
    sessionStorage: {
      candidat_data: JSON.stringify({
        nom: 'XX',
        'prénom': 'YY',
        lieu: 'Lorient',
        groupe: '7',
        date: '2026-09-27'
      }),
      reponses_data: JSON.stringify({ dictee: 'texte partiel' }),
      scores_data: '{}'
    },
    localStorage: {},
    lastPage: 'dictee.html',
    lastEvaluationPage: 'dictee.html'
  };

  const saved = store.saveSnapshot(dicteeState);
  assert(saved, 'Le candidat actif doit être créé.');
  const activeBeforeQuit = store.getActiveCandidate();
  assert(activeBeforeQuit && activeBeforeQuit.status === 'EN_COURS', 'Le candidat doit être EN_COURS avant Quitter.');

  // Simuler exactement le rôle du nouveau bouton Quitter :
  // aucune clôture candidat, aucun retrait du pointeur actif.
  // Au redémarrage, un nouveau store retrouve le même pointeur et le même état.
  const restartedStore = createCandidateStore({
    documentsPath,
    userDataPath,
    now: () => new Date('2026-09-27T19:05:00.000Z')
  });
  const activeAfterRestart = restartedStore.getActiveCandidate();
  assert(activeAfterRestart, 'Quitter doit laisser le candidat actif pour le prochain démarrage.');
  assert.strictEqual(activeAfterRestart.candidateId, activeBeforeQuit.candidateId, 'Quitter doit conserver le même candidat actif.');
  assert.strictEqual(activeAfterRestart.status, 'EN_COURS', 'Quitter ne doit jamais marquer le candidat TERMINE.');

  const restored = readJsonFile(path.join(saved.candidateDir, 'donnees', 'evaluation-state.json'));
  assert(restored, 'L’état du candidat doit rester disponible après Quitter.');
  assert.strictEqual(restored.lastPage, 'dictee.html', 'La dernière page doit rester la Dictée.');
  assert.strictEqual(restored.lastEvaluationPage, 'dictee.html', 'La page de reprise doit rester la Dictée.');

  const preload = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload.js'), 'utf8');
  const sessionClose = fs.readFileSync(path.join(__dirname, '..', 'src', 'session-close.js'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');

  assert(preload.includes('id="seb-evalpro-quit-application"'), 'Le bouton Quitter doit être présent dans la barre Admin.');
  assert(preload.includes('>Quitter</button>'), 'Le bouton doit afficher Quitter.');
  assert(preload.includes('>Fermer la session active</button>'), 'Le bouton destructif doit afficher Fermer la session active.');
  assert(preload.includes("ipcRenderer.invoke('admin:quit-application')"), 'Quitter doit utiliser son IPC séparé.');
  assert(preload.includes("const saved = saveNow(true);"), 'Quitter doit sauvegarder avant fermeture.');
  assert(preload.includes('Aucun appel à candidate:complete-active ici'), 'La séparation fonctionnelle Quitter / clôture doit être documentée.');

  const quitHandlerStart = preload.indexOf("quitApplicationButton.addEventListener('click'");
  const closeHandlerStart = preload.indexOf("closeSessionButton.addEventListener('click'");
  assert(quitHandlerStart >= 0 && closeHandlerStart > quitHandlerStart, 'Les deux actions doivent être distinctes.');
  const quitHandler = preload.slice(quitHandlerStart, closeHandlerStart);
  assert(!quitHandler.includes("ipcRenderer.invoke('candidate:complete-active'"), 'Quitter ne doit jamais appeler la clôture du parcours actif.');
  assert(!quitHandler.includes('ensureFinalArchive'), 'Quitter ne doit pas finaliser le Replay.');

  assert(sessionClose.includes("ipcMain.handle('admin:quit-application'"), 'Le moteur doit exposer une fermeture non destructive.');
  const quitIpcStart = sessionClose.indexOf("ipcMain.handle('admin:quit-application'");
  const closeIpcStart = sessionClose.indexOf("ipcMain.handle('admin:close-session'");
  const quitIpc = sessionClose.slice(quitIpcStart, closeIpcStart);
  assert(!quitIpc.includes('clearStorageData'), 'Quitter ne doit pas effacer le stockage de session.');
  assert(!quitIpc.includes('setAdminUnlocked(false)'), 'Quitter ne doit pas basculer vers le chemin de clôture de session.');

  assert(main.includes("mainWindow.loadFile(existingWebPage(state.lastEvaluationPage || state.lastPage));"), 'Le démarrage doit reprendre la dernière page enregistrée.');

  console.log('ADMIN_QUIT_PRESERVES_ACTIVE_CANDIDATE: OK');
  console.log('ADMIN_QUIT_PRESERVES_LAST_PAGE: dictee.html');
  console.log('ADMIN_QUIT_SEPARATE_FROM_SESSION_CLOSE: OK');
  console.log('ADMIN_CLOSE_LABEL: Fermer la session active');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
