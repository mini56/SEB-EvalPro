const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createCandidateStore } = require('../src/candidate-store-main');
const { createCandidateTransfer } = require('../src/candidate-transfer-main');
const { configureLocalKey, writeJsonFile } = require('../src/candidate-data-crypto');
const { codedFolderName } = require('../src/candidate-folder-utils');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seb-evalpro-loss-prevention-'));
const sourceDocuments = path.join(root, 'SOURCE', 'Documents');
const sourceUserData = path.join(root, 'SOURCE', 'AppData');
const targetDocuments = path.join(root, 'TARGET', 'Documents');
const targetUserData = path.join(root, 'TARGET', 'AppData');
const usbRoot = path.join(root, 'USB');
const password = 'Protection-Export-2026!';
const now = () => new Date('2026-09-24T18:30:00.000Z');

function state(candidate, marker) {
  return {
    version:1,
    sessionStorage:{
      candidat_data:JSON.stringify(candidate),
      reponses_data:JSON.stringify({ marker, q1:'1020' }),
      scores_data:JSON.stringify({ marker, page2:5 })
    },
    localStorage:{},
    lastPage:'pageFinale.html',
    lastEvaluationPage:'pageFinale.html'
  };
}

function finish(store, candidate, marker) {
  const saved = store.saveSnapshot(state(candidate, marker));
  const done = store.completeActiveCandidate(state(candidate, marker), 'candidate-final-page');
  assert(done && done.status === 'TERMINE');
  return saved;
}

try {
  fs.mkdirSync(usbRoot, { recursive:true });
  configureLocalKey(Buffer.alloc(32, 71));

  const store = createCandidateStore({ documentsPath:sourceDocuments, userDataPath:sourceUserData, now });
  const c1 = { nom:'XXLOSS1', 'prénom':'YYLOSS1', lieu:'Lorient', groupe:'A', date:'2026-09-24' };
  const first = finish(store, c1, 'ONE');

  const transfer = createCandidateTransfer({ documentsPath:sourceDocuments, userDataPath:sourceUserData, now });

  // Un dossier terminé incomplet doit bloquer AVANT le premier fichier .seb.
  const missingScores = path.join(first.candidateDir, 'resultats', 'scores.json');
  fs.rmSync(missingScores, { force:true });
  assert.throws(
    () => transfer.exportAll(usbRoot, password),
    /terminé incomplet|Fichier candidat illisible/i
  );
  assert.strictEqual(fs.readdirSync(usbRoot).filter((name) => name.endsWith('.seb')).length, 0, 'Aucun export partiel ne doit être créé si un dossier terminé est incomplet.');

  // Réparer le fichier puis ajouter un second candidat pour tester le rollback import.
  writeJsonFile(missingScores, { marker:'ONE', page2:5 });
  const c2 = { nom:'XXLOSS2', 'prénom':'YYLOSS2', lieu:'Vannes', groupe:'B', date:'2026-09-24' };
  const second = finish(store, c2, 'TWO');

  const exported = transfer.exportAll(usbRoot, password);
  assert.strictEqual(exported.total, 2);
  assert.strictEqual(exported.added, 2);

  configureLocalKey(Buffer.alloc(32, 72));
  const targetTransfer = createCandidateTransfer({ documentsPath:targetDocuments, userDataPath:targetUserData, now });

  // Simuler une panne disque au renommage final du deuxième candidat.
  const secondTarget = path.join(targetDocuments, 'SEB EvalPro', 'Candidats', codedFolderName(second.candidateId, second.shortId));
  const originalRename = fs.renameSync;
  fs.renameSync = function patchedRename(oldPath, newPath) {
    if (path.resolve(String(newPath)) === path.resolve(secondTarget)) {
      const error = new Error('CI simulated disk failure on second candidate');
      error.code = 'EIO';
      throw error;
    }
    return originalRename.apply(fs, arguments);
  };

  try {
    assert.throws(
      () => targetTransfer.importAll(usbRoot, password),
      /Aucun nouvel import de cette opération n’a été conservé|simulated disk failure/i
    );
  } finally {
    fs.renameSync = originalRename;
  }

  const afterFailedImport = targetTransfer.listCandidateRecords(targetTransfer.paths.candidatesRoot, false);
  assert.strictEqual(afterFailedImport.length, 0, 'Un import multi-candidat interrompu doit revenir à zéro nouvel import.');

  const imported = targetTransfer.importAll(usbRoot, password);
  assert.strictEqual(imported.added, 2, 'Après disparition de la panne, les deux candidats doivent être importés.');
  assert.strictEqual(targetTransfer.listCandidateRecords(targetTransfer.paths.candidatesRoot, false).length, 2);

  console.log('EXPORT_INCOMPLETE_CANDIDATE_FAILS_BEFORE_COPY=OK');
  console.log('IMPORT_MULTI_CANDIDATE_ROLLBACK=OK');
  console.log('Candidate Loss Prevention Test: OK');
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
