const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCandidateTransfer } = require('../src/candidate-transfer-main');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seb-evalpro-candidate-transfer-'));
const pc1Documents = path.join(root, 'PC1', 'Documents');
const pc2Documents = path.join(root, 'PC2', 'Documents');
const adminDocuments = path.join(root, 'ADMIN', 'Documents');
const usbRoot = path.join(root, 'USB');
const fixedNow = new Date('2026-09-19T06:00:00.000Z');

function makeCandidate(parent, folderName, candidateId, marker, candidat) {
  const dir = path.join(parent, folderName);
  fs.mkdirSync(path.join(dir, 'donnees'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'resultats'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'replay'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'bilan', 'historique'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'bilan', 'exports'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    schemaVersion: 1,
    candidateId,
    folderName,
    status: 'SESSION_FERMEE',
    updatedAt: fixedNow.toISOString(),
    candidat
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'donnees', 'marker.txt'), marker, 'utf8');
  return dir;
}

try {
  const pc1 = createCandidateTransfer({ documentsPath: pc1Documents, now: () => new Date(fixedNow) });
  fs.mkdirSync(pc1.paths.candidatesRoot, { recursive: true });

  makeCandidate(pc1.paths.candidatesRoot, 'OLD_DUPONT_FOLDER', 'candidate-1', 'pc1-v1', {
    nom: 'DUPONT', 'prénom': 'Jean', lieu: 'Lorient', groupe: '7', date: '2026-09-18'
  });
  makeCandidate(pc1.paths.candidatesRoot, 'OLD_MARTIN_FOLDER', 'candidate-2', 'pc1-v1', {
    nom: 'MARTIN', 'prénom': 'Léa', lieu: 'Lorient', groupe: '7', date: '2026-09-18'
  });

  fs.mkdirSync(usbRoot, { recursive: true });
  const firstExport = pc1.exportAll(usbRoot);
  assert.strictEqual(firstExport.total, 2);
  assert.strictEqual(firstExport.added, 2);
  assert.strictEqual(firstExport.updated, 0);
  assert.strictEqual(firstExport.destinationRoot, path.resolve(usbRoot));

  const usbCandidates1 = pc1.listCandidateRecords(usbRoot, false);
  assert.strictEqual(usbCandidates1.length, 2);
  assert(usbCandidates1.some((r) => r.folderName === 'DUPONT_Jean_Lorient_7'));
  assert(usbCandidates1.some((r) => r.folderName === 'MARTIN_Lea_Lorient_7'));

  fs.writeFileSync(path.join(pc1.paths.candidatesRoot, 'OLD_DUPONT_FOLDER', 'donnees', 'marker.txt'), 'pc1-v2', 'utf8');
  const secondExport = pc1.exportAll(usbRoot);
  assert.strictEqual(secondExport.total, 2);
  assert.strictEqual(secondExport.added, 0);
  assert.strictEqual(secondExport.updated, 2, 'Un second export ne doit pas créer de doublons.');

  const dupontUsb = pc1.listCandidateRecords(usbRoot, false).find((item) => item.candidateId === 'candidate-1');
  assert.strictEqual(fs.readFileSync(path.join(dupontUsb.candidateDir, 'donnees', 'marker.txt'), 'utf8'), 'pc1-v2');

  const pc2 = createCandidateTransfer({ documentsPath: pc2Documents, now: () => new Date(fixedNow) });
  fs.mkdirSync(pc2.paths.candidatesRoot, { recursive: true });
  makeCandidate(pc2.paths.candidatesRoot, 'ANY_OLD_NAME', 'candidate-3', 'pc2-v1', {
    nom: 'LE GOFF', 'prénom': 'Anne', lieu: 'Vannes', groupe: '4', date: '2026-09-18'
  });
  const anotherExport = pc2.exportAll(usbRoot);
  assert.strictEqual(anotherExport.total, 1);
  assert.strictEqual(pc1.listCandidateRecords(usbRoot, false).length, 3, 'La même clé doit accumuler les candidats de plusieurs PC.');

  const admin = createCandidateTransfer({ documentsPath: adminDocuments, now: () => new Date(fixedNow) });
  const imported = admin.importAll(usbRoot);
  assert.strictEqual(imported.total, 3);
  assert.strictEqual(imported.added, 3);
  assert.strictEqual(imported.destinationRoot, path.join(adminDocuments, 'SEB EvalPro', 'Candidats'));
  assert.strictEqual(admin.listCandidateRecords(imported.destinationRoot, false).length, 3);

  const dupontAdmin = admin.listCandidateRecords(imported.destinationRoot, false).find((item) => item.candidateId === 'candidate-1');
  fs.writeFileSync(path.join(dupontAdmin.candidateDir, 'bilan', 'historique', 'admin-only.json'), '{"admin":true}', 'utf8');

  const importedAgain = admin.importAll(usbRoot);
  assert.strictEqual(importedAgain.total, 3);
  assert.strictEqual(importedAgain.added, 0);
  assert.strictEqual(importedAgain.updated, 3, 'Un nouvel import doit fusionner sans dupliquer.');
  assert.strictEqual(admin.listCandidateRecords(importedAgain.destinationRoot, false).length, 3);
  assert(fs.existsSync(path.join(dupontAdmin.candidateDir, 'bilan', 'historique', 'admin-only.json')), 'Les données créées sur le PC Admin doivent être conservées.');

  console.log('Candidate Transfer Test #2: OK');
  console.log(firstExport.destinationRoot);
  console.log(imported.destinationRoot);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
