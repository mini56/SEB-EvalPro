const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCandidateStore } = require('../src/candidate-store-main');
const { configureLocalKey, readJsonFile, LOCAL_PREFIX } = require('../src/candidate-data-crypto');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seb-evalpro-candidate-store-'));
const documentsPath = path.join(root, 'Documents');
const userDataPath = path.join(root, 'AppData');
const fixedNow = new Date('2026-09-18T18:00:00.000Z');
configureLocalKey(Buffer.alloc(32, 7));

try {
  const store = createCandidateStore({
    documentsPath,
    userDataPath,
    now: () => new Date(fixedNow)
  });

  const state = {
    version: 1,
    sessionStorage: {
      candidat_data: JSON.stringify({
        nom: 'XXNOMSECRET',
        'prénom': 'YYPRENOMSECRET',
        lieu: 'Lorient',
        groupe: '7',
        date: '2026-09-18'
      }),
      reponses_data: JSON.stringify({ q1: '1020' }),
      scores_data: JSON.stringify({ page2: 5 })
    },
    localStorage: {},
    lastPage: 'page2.html',
    lastEvaluationPage: 'page2.html'
  };

  const first = store.saveSnapshot(state);
  assert(first, 'Le dossier candidat doit être créé.');
  assert(/^CAND-[A-F0-9]{12}(?:_\d+)?$/.test(first.folderName), 'Le dossier candidat doit utiliser uniquement un identifiant technique CAND-.');
  assert(fs.existsSync(path.join(first.candidateDir, 'manifest.json')));
  assert(fs.existsSync(path.join(first.candidateDir, 'donnees', 'candidat.json')));
  assert(fs.existsSync(path.join(first.candidateDir, 'donnees', 'evaluation-state.json')));
  assert(fs.existsSync(path.join(first.candidateDir, 'donnees', 'progression.json')));
  assert(fs.existsSync(path.join(first.candidateDir, 'resultats', 'reponses.json')));
  assert(fs.existsSync(path.join(first.candidateDir, 'resultats', 'scores.json')));
  assert(fs.existsSync(path.join(first.candidateDir, 'replay')));
  assert(fs.existsSync(path.join(first.candidateDir, 'bilan', 'historique')));
  assert(fs.existsSync(path.join(first.candidateDir, 'bilan', 'exports')));

  const second = store.saveSnapshot({
    ...state,
    lastPage: 'page3.html',
    lastEvaluationPage: 'page3.html'
  });
  assert.strictEqual(second.candidateId, first.candidateId, 'Les sauvegardes successives du parcours actif doivent garder le même candidat.');
  assert.strictEqual(second.candidateDir, first.candidateDir, 'Une sauvegarde suivante ne doit pas créer de doublon.');

  const active = store.getActiveCandidate();
  assert(active && active.displayName === 'YYPRENOMSECRET XXNOMSECRET');
  assert.strictEqual(store.getActiveExportDir(), path.join(first.candidateDir, 'bilan', 'exports'));
  assert(fs.existsSync(store.paths.activePointerPath), 'Le pointeur actif principal doit exister.');
  assert(fs.existsSync(store.paths.activePointerBackupPath), 'La copie de récupération du pointeur actif doit exister dans Documents.');

  // Simulation d'un nettoyage AppData pendant une mise à jour.
  fs.rmSync(store.paths.activePointerPath, { force:true });
  assert.strictEqual(fs.existsSync(store.paths.activePointerPath), false);
  const recoveredActive = store.getActiveCandidate();
  assert(recoveredActive && recoveredActive.candidateId === first.candidateId, 'Le parcours actif doit être restauré depuis Documents.');
  assert(fs.existsSync(store.paths.activePointerPath), 'Le pointeur AppData doit être recréé depuis sa sauvegarde.');

  const closed = store.completeActiveCandidate({
    ...state,
    lastPage: 'pageFinale.html',
    lastEvaluationPage: 'pageFinale.html'
  });
  assert(closed && closed.status === 'TERMINE');
  assert.strictEqual(store.getActiveCandidate(), null, 'Le pointeur actif doit être supprimé après fermeture.');
  assert.strictEqual(fs.existsSync(store.paths.activePointerPath), false, 'Le pointeur AppData doit être supprimé après fin du parcours.');
  assert.strictEqual(fs.existsSync(store.paths.activePointerBackupPath), false, 'La copie de récupération doit aussi être supprimée après fin du parcours.');

  const rawManifest = fs.readFileSync(path.join(first.candidateDir, 'manifest.json'), 'utf8');
  assert(rawManifest.startsWith(LOCAL_PREFIX), 'Le manifeste candidat doit être chiffré sur disque.');
  assert(!rawManifest.includes('Lorient') && !rawManifest.includes('YYPRENOMSECRET') && !rawManifest.includes('XXNOMSECRET'), 'Aucune identité candidat ne doit rester en clair dans le manifeste.');
  const manifest = readJsonFile(path.join(first.candidateDir, 'manifest.json'));
  assert.strictEqual(manifest.status, 'TERMINE');
  assert(manifest.closedAt, 'La date de fermeture doit être enregistrée.');
  assert(fs.existsSync(first.candidateDir), 'Le dossier candidat ne doit jamais être supprimé à la fermeture.');

  const candidateFolders = fs.readdirSync(store.paths.candidatesRoot, { withFileTypes:true }).filter((entry) => entry.isDirectory());
  assert.strictEqual(candidateFolders.length, 1, 'La fin de parcours ne doit pas créer de dossier supplémentaire.');

  console.log('Candidate Store Test #1: OK');
  console.log(first.folderName);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
