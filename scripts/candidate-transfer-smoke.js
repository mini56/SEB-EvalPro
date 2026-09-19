const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCandidateTransfer } = require('../src/candidate-transfer-main');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seb-evalpro-candidate-transfer-'));
const documentsPath = path.join(root, 'Documents');
const usbRoot = path.join(root, 'USB');
const fixedNow = new Date('2026-09-19T06:00:00.000Z');

function makeCandidate(parent, folderName, candidateId, marker) {
  const dir = path.join(parent, folderName);
  fs.mkdirSync(path.join(dir, 'donnees'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'bilan', 'exports'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    schemaVersion: 1,
    candidateId,
    folderName,
    status: 'SESSION_FERMEE'
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'donnees', 'marker.txt'), marker, 'utf8');
  return dir;
}

try {
  const transfer = createCandidateTransfer({
    documentsPath,
    now: () => new Date(fixedNow)
  });

  fs.mkdirSync(transfer.paths.localCandidatesRoot, { recursive: true });
  makeCandidate(transfer.paths.localCandidatesRoot, 'DUPONT_Jean_Lorient_2026-09-18_A1B2C3', 'candidate-1', 'pc1-v1');
  makeCandidate(transfer.paths.localCandidatesRoot, 'MARTIN_Lea_Lorient_2026-09-18_D4E5F6', 'candidate-2', 'pc1-v1');

  const firstExport = transfer.exportAll(usbRoot);
  assert.strictEqual(firstExport.total, 2);
  assert.strictEqual(firstExport.added, 2);
  assert.strictEqual(firstExport.updated, 0);
  assert.strictEqual(firstExport.destinationRoot, path.join(usbRoot, 'SEB EvalPro', 'Candidats'));

  fs.writeFileSync(
    path.join(transfer.paths.localCandidatesRoot, 'DUPONT_Jean_Lorient_2026-09-18_A1B2C3', 'donnees', 'marker.txt'),
    'pc1-v2',
    'utf8'
  );
  const secondExport = transfer.exportAll(usbRoot);
  assert.strictEqual(secondExport.total, 2);
  assert.strictEqual(secondExport.added, 0);
  assert.strictEqual(secondExport.updated, 2, 'Un second passage ne doit pas créer de doublons.');

  const usbCandidates = transfer.listCandidateRecords(firstExport.destinationRoot);
  assert.strictEqual(usbCandidates.length, 2);
  const dupontUsb = usbCandidates.find((item) => item.candidateId === 'candidate-1');
  assert.strictEqual(fs.readFileSync(path.join(dupontUsb.candidateDir, 'donnees', 'marker.txt'), 'utf8'), 'pc1-v2');

  const anotherPcDocuments = path.join(root, 'AnotherPC', 'Documents');
  const anotherTransfer = createCandidateTransfer({ documentsPath: anotherPcDocuments, now: () => new Date(fixedNow) });
  fs.mkdirSync(anotherTransfer.paths.localCandidatesRoot, { recursive: true });
  makeCandidate(anotherTransfer.paths.localCandidatesRoot, 'LE_GOFF_Anne_Vannes_2026-09-18_112233', 'candidate-3', 'pc2-v1');
  const anotherExport = anotherTransfer.exportAll(usbRoot);
  assert.strictEqual(anotherExport.total, 1);
  assert.strictEqual(transfer.listCandidateRecords(firstExport.destinationRoot).length, 3, 'La même clé doit accumuler les candidats de plusieurs PC.');

  const imported = transfer.importAll(usbRoot, 'Lorient');
  assert.strictEqual(imported.total, 3);
  assert.strictEqual(imported.added, 3);
  assert.strictEqual(imported.destinationRoot, path.join(documentsPath, 'SEB EvalPro', 'Admin', 'Lorient'));
  assert.strictEqual(transfer.listCandidateRecords(imported.destinationRoot).length, 3);

  const importedAgain = transfer.importAll(usbRoot, 'Lorient');
  assert.strictEqual(importedAgain.total, 3);
  assert.strictEqual(importedAgain.added, 0);
  assert.strictEqual(importedAgain.updated, 3, 'Un nouvel import du même groupe doit mettre à jour sans dupliquer.');
  assert.strictEqual(transfer.listCandidateRecords(importedAgain.destinationRoot).length, 3);

  const accented = transfer.sanitizeGroupName('  Session été / A  ');
  assert.strictEqual(accented, 'Session été _ A');

  console.log('Candidate Transfer Test #1: OK');
  console.log(firstExport.destinationRoot);
  console.log(imported.destinationRoot);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
