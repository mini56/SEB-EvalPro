const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCandidateStore } = require('../src/candidate-store-main');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seb-evalpro-candidate-store-'));
const documentsPath = path.join(root, 'Documents');
const userDataPath = path.join(root, 'AppData');
const fixedNow = new Date('2026-09-18T18:00:00.000Z');

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
        nom: 'DUPONT',
        'prénom': 'Jean',
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
  assert.strictEqual(first.folderName, 'DUPONT_Jean_Lorient_7');
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
  assert.strictEqual(second.candidateId, first.candidateId, 'Une reprise doit réutiliser le même candidat.');
  assert.strictEqual(second.candidateDir, first.candidateDir, 'Une reprise ne doit pas créer un doublon.');

  const active = store.getActiveCandidate();
  assert(active && active.displayName === 'Jean DUPONT');
  assert.strictEqual(store.getActiveExportDir(), path.join(first.candidateDir, 'bilan', 'exports'));

  const closed = store.closeActiveCandidate({
    ...state,
    lastPage: 'pageFinale.html',
    lastEvaluationPage: 'pageFinale.html'
  });
  assert(closed && closed.status === 'SESSION_FERMEE');
  assert.strictEqual(store.getActiveCandidate(), null, 'Le pointeur actif doit être supprimé après fermeture.');

  const manifest = JSON.parse(fs.readFileSync(path.join(first.candidateDir, 'manifest.json'), 'utf8'));
  assert.strictEqual(manifest.status, 'SESSION_FERMEE');
  assert(manifest.closedAt, 'La date de fermeture doit être enregistrée.');
  assert(fs.existsSync(first.candidateDir), 'Le dossier candidat ne doit jamais être supprimé à la fermeture.');

  console.log('Candidate Store Test #1: OK');
  console.log(first.folderName);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
