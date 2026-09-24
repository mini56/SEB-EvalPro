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

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function makeCandidate(parent, folderName, candidateId, marker, candidat) {
  const dir = path.join(parent, folderName);
  for (const rel of ['donnees','resultats','replay',path.join('bilan','historique'),path.join('bilan','exports')]) {
    fs.mkdirSync(path.join(dir, rel), { recursive:true });
  }
  writeJson(path.join(dir, 'manifest.json'), {
    schemaVersion:1,
    candidateId,
    folderName,
    status:'SESSION_FERMEE',
    updatedAt:fixedNow.toISOString(),
    candidat
  });
  writeJson(path.join(dir, 'donnees', 'candidat.json'), candidat);
  writeJson(path.join(dir, 'donnees', 'evaluation-state.json'), { version:1, marker });
  writeJson(path.join(dir, 'donnees', 'progression.json'), { lastPage:'qcmv1.0.html' });
  writeJson(path.join(dir, 'resultats', 'reponses.json'), { marker });
  writeJson(path.join(dir, 'resultats', 'scores.json'), { marker });
  fs.writeFileSync(path.join(dir, 'donnees', 'marker.txt'), marker, 'utf8');
  return dir;
}

function tempArtifacts(rootDir) {
  const hits = [];
  if (!fs.existsSync(rootDir)) return hits;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
      const full = path.join(dir, entry.name);
      if (entry.name.includes('.seb-copy-')) hits.push(full);
      if (entry.isDirectory()) walk(full);
    }
  };
  walk(rootDir);
  return hits;
}

try {
  const pc1 = createCandidateTransfer({ documentsPath:pc1Documents, now:() => new Date(fixedNow) });
  fs.mkdirSync(pc1.paths.candidatesRoot, { recursive:true });

  makeCandidate(pc1.paths.candidatesRoot, 'OLD_XX_FOLDER', 'candidate-1', 'pc1-v1', {
    nom:'XX', 'prénom':'YY', lieu:'Lorient', groupe:'7', date:'2026-09-18'
  });
  makeCandidate(pc1.paths.candidatesRoot, 'OLD_ZZ_FOLDER', 'candidate-2', 'pc1-v1', {
    nom:'ZZ', 'prénom':'WW', lieu:'Lorient', groupe:'7', date:'2026-09-18'
  });

  fs.mkdirSync(usbRoot, { recursive:true });
  const firstExport = pc1.exportAll(usbRoot);
  assert.strictEqual(firstExport.total, 2);
  assert.strictEqual(firstExport.added, 2);
  assert.strictEqual(firstExport.updated, 0);
  assert.strictEqual(firstExport.skipped, 0);
  assert.strictEqual(firstExport.verified, true);
  assert(firstExport.verifiedFiles > 0, 'La vérification complète doit compter les fichiers.');
  assert.strictEqual(tempArtifacts(usbRoot).length, 0, 'Aucun dossier temporaire ne doit rester après une copie réussie.');

  const usbCandidates1 = pc1.listCandidateRecords(usbRoot, false);
  assert.strictEqual(usbCandidates1.length, 2);
  assert(usbCandidates1.some((r) => r.folderName === 'XX_YY_Lorient_7'));
  assert(usbCandidates1.some((r) => r.folderName === 'ZZ_Lea_Lorient_7'));

  // Un second export du même candidat doit être IGNORÉ : aucune fusion,
  // aucun écrasement, même si la copie locale a évolué.
  fs.writeFileSync(path.join(pc1.paths.candidatesRoot, 'OLD_XX_FOLDER', 'donnees', 'marker.txt'), 'pc1-v2', 'utf8');
  const secondExport = pc1.exportAll(usbRoot);
  assert.strictEqual(secondExport.total, 2);
  assert.strictEqual(secondExport.added, 0);
  assert.strictEqual(secondExport.updated, 0);
  assert.strictEqual(secondExport.skipped, 2);

  const candidateOneUsb = pc1.listCandidateRecords(usbRoot, false).find((item) => item.candidateId === 'candidate-1');
  assert.strictEqual(
    fs.readFileSync(path.join(candidateOneUsb.candidateDir, 'donnees', 'marker.txt'), 'utf8'),
    'pc1-v1',
    'Un dossier déjà présent sur la clé ne doit jamais être écrasé.'
  );

  const pc2 = createCandidateTransfer({ documentsPath:pc2Documents, now:() => new Date(fixedNow) });
  fs.mkdirSync(pc2.paths.candidatesRoot, { recursive:true });
  makeCandidate(pc2.paths.candidatesRoot, 'ANY_OLD_NAME', 'candidate-3', 'pc2-v1', {
    nom:'VV', 'prénom':'UU', lieu:'Vannes', groupe:'4', date:'2026-09-18'
  });
  const anotherExport = pc2.exportAll(usbRoot);
  assert.strictEqual(anotherExport.added, 1);
  assert.strictEqual(pc1.listCandidateRecords(usbRoot, false).length, 3, 'La clé doit accumuler les candidats de plusieurs PC.');

  // Dossier incomplet volontaire : présent à la racine mais refusé à l'import.
  const bad = path.join(usbRoot, 'INCOMPLET_TT_Lorient_9');
  fs.mkdirSync(path.join(bad, 'donnees'), { recursive:true });
  writeJson(path.join(bad, 'manifest.json'), {
    schemaVersion:1,
    candidateId:'candidate-bad',
    candidat:{ nom:'INCOMPLET', prenom:'TT', lieu:'Lorient', groupe:'9' }
  });

  const admin = createCandidateTransfer({ documentsPath:adminDocuments, now:() => new Date(fixedNow) });
  const imported = admin.importAll(usbRoot);
  assert.strictEqual(imported.total, 3, 'Le dossier incomplet ne doit pas être considéré comme candidat valide.');
  assert.strictEqual(imported.added, 3);
  assert.strictEqual(imported.updated, 0);
  assert.strictEqual(imported.skipped, 0);
  assert.strictEqual(imported.verified, true);
  assert.strictEqual(admin.listCandidateRecords(imported.destinationRoot, false).length, 3);

  const candidateOneAdmin = admin.listCandidateRecords(imported.destinationRoot, false).find((item) => item.candidateId === 'candidate-1');
  fs.writeFileSync(path.join(candidateOneAdmin.candidateDir, 'bilan', 'historique', 'admin-only.json'), '{"admin":true}', 'utf8');

  // Nouvel import : dossiers déjà présents = ignorés, sans fusion.
  const importedAgain = admin.importAll(usbRoot);
  assert.strictEqual(importedAgain.total, 3);
  assert.strictEqual(importedAgain.added, 0);
  assert.strictEqual(importedAgain.updated, 0);
  assert.strictEqual(importedAgain.skipped, 3);
  assert.strictEqual(admin.listCandidateRecords(importedAgain.destinationRoot, false).length, 3);
  assert(
    fs.existsSync(path.join(candidateOneAdmin.candidateDir, 'bilan', 'historique', 'admin-only.json')),
    'Les données créées sur le PC Admin doivent rester intactes.'
  );
  assert.strictEqual(tempArtifacts(admin.paths.candidatesRoot).length, 0);

  console.log('Candidate Transfer Verified Root USB Test: OK');
  console.log(firstExport.destinationRoot);
  console.log(imported.destinationRoot);
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
