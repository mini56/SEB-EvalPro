const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { createCandidateTransfer } = require('../src/candidate-transfer-main');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seb-evalpro-secure-transfer-'));
const pc1Documents = path.join(root, 'PC1', 'Documents');
const adminDocuments = path.join(root, 'ADMIN', 'Documents');
const usbRoot = path.join(root, 'USB');
const fixedNow = new Date('2026-09-24T12:00:00.000Z');
const password = 'USB-Test-2026!';

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function makeCandidate(parent, folderName, candidateId, candidat, status = 'SESSION_FERMEE') {
  const dir = path.join(parent, folderName);
  for (const rel of ['donnees','resultats','replay',path.join('bilan','historique'),path.join('bilan','exports')]) {
    fs.mkdirSync(path.join(dir, rel), { recursive:true });
  }
  writeJson(path.join(dir, 'manifest.json'), {
    schemaVersion:1,
    candidateId,
    shortId:candidateId.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase(),
    folderName,
    status,
    updatedAt:fixedNow.toISOString(),
    candidat
  });
  writeJson(path.join(dir, 'donnees', 'candidat.json'), candidat);
  writeJson(path.join(dir, 'donnees', 'evaluation-state.json'), {
    version:1,
    sessionStorage:{
      candidat_data:JSON.stringify(candidat),
      reponses_data:JSON.stringify({ q1:'1020' }),
      scores_data:JSON.stringify({ page2:5 })
    },
    localStorage:{},
    lastPage:'pageFinale.html',
    lastEvaluationPage:'pageFinale.html'
  });
  writeJson(path.join(dir, 'donnees', 'progression.json'), { lastPage:'pageFinale.html', lastEvaluationPage:'pageFinale.html' });
  writeJson(path.join(dir, 'resultats', 'reponses.json'), { q1:'1020' });
  writeJson(path.join(dir, 'resultats', 'scores.json'), { page2:5 });
  fs.writeFileSync(path.join(dir, 'replay', 'probe.txt'), 'replay', 'utf8');
  return dir;
}

function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

try {
  const pc1 = createCandidateTransfer({ documentsPath:pc1Documents, now:() => new Date(fixedNow) });
  fs.mkdirSync(pc1.paths.candidatesRoot, { recursive:true });

  makeCandidate(pc1.paths.candidatesRoot, 'ANCIEN_DOSSIER_1', 'candidate-1', {
    nom:'XX', 'prénom':'YY', lieu:'Lorient', groupe:'7', date:'2026-09-18'
  });
  makeCandidate(pc1.paths.candidatesRoot, 'ANCIEN_DOSSIER_2', 'candidate-2', {
    nom:'ZZ', 'prénom':'WW', lieu:'Vannes', groupe:'4', date:'2026-09-18'
  });
  makeCandidate(pc1.paths.candidatesRoot, 'EN_COURS_LOCAL', 'candidate-active', {
    nom:'VV', 'prénom':'UU', lieu:'Auray', groupe:'2', date:'2026-09-18'
  }, 'EN_COURS');

  fs.mkdirSync(usbRoot, { recursive:true });
  const firstExport = pc1.exportAll(usbRoot, password);
  assert.strictEqual(firstExport.total, 2, 'Seules les sessions fermées doivent être exportées.');
  assert.strictEqual(firstExport.added, 2);
  assert.strictEqual(firstExport.skipped, 0);
  assert.strictEqual(firstExport.passwordProtected, true);

  const usbEntries = fs.readdirSync(usbRoot, { withFileTypes:true });
  assert.strictEqual(usbEntries.filter((entry) => entry.isFile() && entry.name.endsWith('.seb')).length, 2);
  assert.strictEqual(usbEntries.filter((entry) => entry.isDirectory()).length, 0, 'Aucun dossier candidat en clair ne doit être créé sur la clé.');
  for (const entry of usbEntries.filter((item) => item.isFile())) {
    const raw = fs.readFileSync(path.join(usbRoot, entry.name), 'utf8');
    assert(raw.includes('SEB-EVALPRO-USB-1'), 'Le conteneur sécurisé doit être identifiable.');
    assert(!raw.includes('Lorient') && !raw.includes('Vannes'), 'Aucune identité/localisation ne doit apparaître en clair dans le fichier USB.');
  }

  const beforeHashes = new Map(usbEntries.filter((e) => e.isFile()).map((e) => [e.name, sha(path.join(usbRoot, e.name))]));
  const secondExport = pc1.exportAll(usbRoot, password);
  assert.strictEqual(secondExport.added, 0);
  assert.strictEqual(secondExport.skipped, 2);

  const admin = createCandidateTransfer({ documentsPath:adminDocuments, now:() => new Date(fixedNow) });
  assert.throws(
    () => admin.importAll(usbRoot, 'Mauvais-2026!'),
    /Mot de passe incorrect|endommagé/,
    'Un mauvais mot de passe doit refuser tout import.'
  );
  assert.strictEqual(admin.listCandidateRecords(admin.paths.candidatesRoot, false).length, 0, 'Aucun candidat ne doit être copié après un mauvais mot de passe.');
  for (const [name, digest] of beforeHashes) {
    assert.strictEqual(sha(path.join(usbRoot, name)), digest, 'Un import refusé ne doit jamais modifier la clé USB.');
  }

  const imported = admin.importAll(usbRoot, password);
  assert.strictEqual(imported.total, 2);
  assert.strictEqual(imported.added, 2);
  assert.strictEqual(imported.skipped, 0);
  assert.strictEqual(imported.passwordProtected, true);
  const records = admin.listCandidateRecords(imported.destinationRoot, false);
  assert.strictEqual(records.length, 2);
  assert(records.every((record) => /^CAND-/i.test(record.folderName)), 'Les dossiers importés doivent rester codés.');

  const importedAgain = admin.importAll(usbRoot, password);
  assert.strictEqual(importedAgain.added, 0);
  assert.strictEqual(importedAgain.skipped, 2, 'Un candidat déjà présent ne doit jamais être écrasé.');

  console.log('Candidate Secure USB Transfer Test: OK');
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
