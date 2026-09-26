const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCandidateStore } = require('../src/candidate-store-main');
const { createCandidateTransfer } = require('../src/candidate-transfer-main');
const { configureLocalKey, readJsonFile } = require('../src/candidate-data-crypto');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seb-evalpro-lifecycle-'));
const documentsPath = path.join(root, 'Documents');
const userDataPath = path.join(root, 'AppData');
const usbRoot = path.join(root, 'USB');
const fixedNow = new Date('2026-09-24T16:00:00.000Z');
configureLocalKey(Buffer.alloc(32, 31));

function state(lastPage = 'page3.html') {
  return {
    version:1,
    sessionStorage:{
      candidat_data:JSON.stringify({ nom:'XX', 'prénom':'YY', lieu:'Lorient', groupe:'7', date:'2026-09-24' }),
      reponses_data:JSON.stringify({ q1:'1020' }),
      scores_data:JSON.stringify({ page2:5 })
    },
    localStorage:{},
    lastPage,
    lastEvaluationPage:lastPage
  };
}

try {
  fs.mkdirSync(usbRoot, { recursive:true });
  const store = createCandidateStore({ documentsPath, userDataPath, now:() => new Date(fixedNow) });
  const first = store.saveSnapshot(state());
  assert(first && store.getActiveCandidate(), 'Le parcours doit rester actif pendant l’évaluation.');

  const transfer = createCandidateTransfer({ documentsPath, userDataPath, now:() => new Date(fixedNow) });
  const before = transfer.exportAll(usbRoot, 'MotDePasse-2026!');
  assert.strictEqual(before.total, 0, 'Un parcours actif ne doit jamais être exporté.');

  const reopenedStore = createCandidateStore({ documentsPath, userDataPath, now:() => new Date(fixedNow) });
  const resumed = reopenedStore.getActiveCandidate();
  assert(resumed && resumed.candidateId === first.candidateId, 'Un parcours non terminé doit rester reprenable après redémarrage.');

  const completed = reopenedStore.completeActiveCandidate(state('qcmv1.0.html'), 'admin-manual');
  assert(completed && completed.status === 'TERMINE', 'La fin Admin doit rendre le parcours terminé.');
  assert.strictEqual(reopenedStore.getActiveCandidate(), null, 'Un parcours terminé ne doit plus être reprenable.');

  const manifest = readJsonFile(path.join(first.candidateDir, 'manifest.json'));
  assert.strictEqual(manifest.status, 'TERMINE');
  assert.strictEqual(manifest.completionReason, 'admin-manual');

  const after = transfer.exportAll(usbRoot, 'MotDePasse-2026!');
  assert.strictEqual(after.total, 1, 'Un parcours terminé doit devenir exportable.');
  assert.strictEqual(after.added, 1);
  assert(fs.readdirSync(usbRoot).some((name) => name.endsWith('.seb')), 'Le fichier chiffré .seb doit être créé.');

  console.log('Candidate Lifecycle Test: OK');
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
