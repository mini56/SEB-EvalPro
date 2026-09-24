const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const { createCandidateStore } = require('../src/candidate-store-main');
const { createCandidateTransfer } = require('../src/candidate-transfer-main');
const {
  configureLocalKey,
  encodeJson,
  readJsonFile,
  LOCAL_PREFIX
} = require('../src/candidate-data-crypto');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seb-evalpro-full-cycle-'));
const sourceDocuments = path.join(root, 'PC-SOURCE', 'Documents');
const sourceUserData = path.join(root, 'PC-SOURCE', 'AppData');
const targetDocuments = path.join(root, 'PC-CIBLE', 'Documents');
const targetUserData = path.join(root, 'PC-CIBLE', 'AppData');
const usbRoot = path.join(root, 'CLE-USB');
const password = 'Transfert-Test-2026!';
const fixedNow = new Date('2026-09-24T17:30:00.000Z');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function writeEncryptedJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  fs.writeFileSync(file, encodeJson(value), 'utf8');
}

function candidateState(candidate, lastPage, marker) {
  return {
    version:1,
    sessionStorage:{
      candidat_data:JSON.stringify(candidate),
      reponses_data:JSON.stringify({ marker, q1:'1020', page:lastPage }),
      scores_data:JSON.stringify({ marker, score:5 })
    },
    localStorage:{ testMarker:marker },
    lastPage,
    lastEvaluationPage:lastPage
  };
}

function writeLegacyCandidate(parent, folderName, candidateId, candidate, status, partial = true) {
  const dir = path.join(parent, folderName);
  fs.mkdirSync(dir, { recursive:true });
  writeEncryptedJson(path.join(dir, 'manifest.json'), {
    schemaVersion:1,
    candidateId,
    shortId:candidateId.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase(),
    folderName,
    status,
    createdAt:'2026-08-01T08:00:00.000Z',
    updatedAt:'2026-08-02T17:00:00.000Z',
    closedAt:status === 'SESSION_FERMEE' ? '2026-08-02T17:00:00.000Z' : null,
    candidat:candidate
  });
  if (!partial) {
    for (const rel of ['donnees','resultats','replay',path.join('bilan','historique'),path.join('bilan','exports')]) {
      fs.mkdirSync(path.join(dir, rel), { recursive:true });
    }
    writeEncryptedJson(path.join(dir, 'donnees', 'candidat.json'), candidate);
    writeEncryptedJson(path.join(dir, 'donnees', 'evaluation-state.json'), candidateState(candidate, 'pageFinale.html', candidateId));
    writeEncryptedJson(path.join(dir, 'donnees', 'progression.json'), { lastPage:'pageFinale.html', lastEvaluationPage:'pageFinale.html' });
    writeEncryptedJson(path.join(dir, 'resultats', 'reponses.json'), { legacy:candidateId });
    writeEncryptedJson(path.join(dir, 'resultats', 'scores.json'), { legacy:5 });
  }
  return dir;
}

try {
  fs.mkdirSync(usbRoot, { recursive:true });
  const unrelatedUsbFile = path.join(usbRoot, 'DOCUMENT_EXISTANT.txt');
  fs.writeFileSync(unrelatedUsbFile, 'NE PAS MODIFIER', 'utf8');
  const unrelatedUsbHash = sha256(unrelatedUsbFile);

  // PC source : clé locale propre au PC A.
  configureLocalKey(Buffer.alloc(32, 41));

  const sourceStore = createCandidateStore({
    documentsPath:sourceDocuments,
    userDataPath:sourceUserData,
    now:() => new Date(fixedNow)
  });

  // Candidat 1 : fin normale du parcours.
  const c1 = { nom:'XXA', 'prénom':'YYA', lieu:'Lorient', groupe:'1', date:'2026-09-24' };
  const c1First = sourceStore.saveSnapshot(candidateState(c1, 'page2.html', 'NORMAL'));
  sourceStore.saveSnapshot(candidateState(c1, 'pageFinale.html', 'NORMAL'));
  const c1Done = sourceStore.completeActiveCandidate(candidateState(c1, 'pageFinale.html', 'NORMAL'), 'candidate-final-page');
  assert(c1Done && c1Done.status === 'TERMINE');

  // Ajouter des éléments réalistes : replay, bilan et Word.
  fs.writeFileSync(path.join(c1First.candidateDir, 'replay', 'replay-final.txt'), 'REPLAY-NORMAL', 'utf8');
  writeEncryptedJson(path.join(c1First.candidateDir, 'bilan', 'historique', 'bilan-R00.json'), {
    candidate:c1,
    revision:0,
    synthesis:'Bilan test normal'
  });
  fs.writeFileSync(path.join(c1First.candidateDir, 'bilan', 'exports', 'Evaluation_XXA_YYA.docx'), 'WORD-TEST-NORMAL', 'utf8');

  // Candidat 2 : parcours interrompu, fermeture/redémarrage, reprise, puis fin Admin.
  const c2 = { nom:'XXB', 'prénom':'YYB', lieu:'Vannes', groupe:'2', date:'2026-09-24' };
  const c2First = sourceStore.saveSnapshot(candidateState(c2, 'page3.html', 'REPRISE'));
  assert(sourceStore.getActiveCandidate(), 'Le candidat 2 doit être actif avant la simulation de redémarrage.');

  const sourceStoreAfterRestart = createCandidateStore({
    documentsPath:sourceDocuments,
    userDataPath:sourceUserData,
    now:() => new Date(fixedNow)
  });
  const resumed = sourceStoreAfterRestart.getActiveCandidate();
  assert(resumed && resumed.candidateId === c2First.candidateId, 'Le candidat interrompu doit être repris après redémarrage.');
  sourceStoreAfterRestart.saveSnapshot(candidateState(c2, 'page5.html', 'REPRISE'));
  const c2Done = sourceStoreAfterRestart.completeActiveCandidate(candidateState(c2, 'page5.html', 'REPRISE'), 'admin-manual');
  assert(c2Done && c2Done.status === 'TERMINE');

  // Candidat 3 : ancien dossier unique incomplet, sans statut moderne.
  const legacyCandidateRoot = path.join(sourceDocuments, 'SEB EvalPro', 'Candidats');
  writeLegacyCandidate(
    legacyCandidateRoot,
    'ANCIEN_DOSSIER_UNIQUE',
    'legacy-candidate-3',
    { nom:'XXC', 'prénom':'YYC', lieu:'Auray', groupe:'3', date:'2026-08-02' },
    'TERMINE',
    false
  );

  // Candidat 4 : ancien stockage Admin, session fermée, structure partielle.
  const legacyAdminRoot = path.join(sourceDocuments, 'SEB EvalPro', 'Admin', 'AncienneSession');
  writeLegacyCandidate(
    legacyAdminRoot,
    'ANCIEN_ADMIN',
    'legacy-candidate-4',
    { nom:'XXD', 'prénom':'YYD', lieu:'Pontivy', groupe:'4', date:'2026-08-03' },
    'SESSION_FERMEE',
    true
  );

  // Candidat 5 : ancien dossier explicitement terminé.
  writeLegacyCandidate(
    legacyCandidateRoot,
    'ANCIEN_TERMINE',
    'legacy-candidate-5',
    { nom:'XXE', 'prénom':'YYE', lieu:'Hennebont', groupe:'5', date:'2026-08-04' },
    'TERMINE',
    false
  );

  // Candidat 7 : EN_COURS sans pointeur actif. Il ne doit JAMAIS être converti
  // automatiquement en terminé ni partir dans un export.
  writeLegacyCandidate(
    legacyCandidateRoot,
    'EN_COURS_SANS_POINTEUR',
    'orphan-active-candidate-7',
    { nom:'XXG', 'prénom':'YYG', lieu:'Ploemeur', groupe:'7', date:'2026-09-23' },
    'EN_COURS',
    false
  );

  // Candidat 6 : parcours réellement actif au moment du premier export.
  const c6 = { nom:'XXF', 'prénom':'YYF', lieu:'Lorient', groupe:'6', date:'2026-09-24' };
  const c6First = sourceStoreAfterRestart.saveSnapshot(candidateState(c6, 'page4.html', 'ACTIF'));
  assert(sourceStoreAfterRestart.getActiveCandidate().candidateId === c6First.candidateId);

  const sourceTransfer = createCandidateTransfer({
    documentsPath:sourceDocuments,
    userDataPath:sourceUserData,
    now:() => new Date(fixedNow)
  });

  // Premier export : 5 terminés/anciens, le candidat 6 actif doit rester sur le PC.
  const exportWhileActive = sourceTransfer.exportAll(usbRoot, password);
  if (exportWhileActive.total !== 5) {
    const required = [
      'manifest.json',
      path.join('donnees', 'candidat.json'),
      path.join('donnees', 'evaluation-state.json'),
      path.join('donnees', 'progression.json'),
      path.join('resultats', 'reponses.json'),
      path.join('resultats', 'scores.json')
    ];
    const debugRecords = sourceTransfer.listCandidateRecords(sourceTransfer.paths.candidatesRoot, false).map((record) => ({
      id:record.candidateId,
      folder:record.folderName,
      status:String(record.manifest && record.manifest.status || ''),
      nom:record.candidate && record.candidate.nom,
      missing:required.filter((rel) => !fs.existsSync(path.join(record.candidateDir, rel)))
    }));
    console.log('FULL_CYCLE_DEBUG_RECORDS=' + JSON.stringify(debugRecords));
  }
  assert.strictEqual(exportWhileActive.total, 5, 'Avec un parcours actif, seuls les 5 dossiers terminés doivent être exportés.');
  assert.strictEqual(exportWhileActive.added, 5);
  assert.strictEqual(fs.readdirSync(usbRoot).filter((name) => name.endsWith('.seb')).length, 5);
  assert.strictEqual(sha256(unrelatedUsbFile), unrelatedUsbHash, 'Le fichier déjà présent sur la clé ne doit jamais être modifié.');

  // Le candidat 6 est ensuite terminé par l'Admin.
  const c6Done = sourceStoreAfterRestart.completeActiveCandidate(candidateState(c6, 'page4.html', 'ACTIF'), 'admin-manual');
  assert(c6Done && c6Done.status === 'TERMINE');
  assert.strictEqual(sourceStoreAfterRestart.getActiveCandidate(), null);

  // Deuxième export : 6 dossiers source = 6 fichiers USB. Les 5 précédents sont ignorés, 1 nouveau est ajouté.
  const finalExport = sourceTransfer.exportAll(usbRoot, password);
  assert.strictEqual(finalExport.total, 6, 'Après la fin du dernier parcours, les 6 candidats doivent être exportables.');
  assert.strictEqual(finalExport.added, 1);
  assert.strictEqual(finalExport.skipped, 5);

  const usbSebFiles = fs.readdirSync(usbRoot).filter((name) => name.toLowerCase().endsWith('.seb')).sort();
  assert.strictEqual(usbSebFiles.length, 6, 'La clé doit contenir exactement 6 fichiers candidats .seb.');
  assert.strictEqual(sha256(unrelatedUsbFile), unrelatedUsbHash, 'Le fichier déjà présent sur la clé doit rester intact après deux exports.');

  const usbHashes = new Map(usbSebFiles.map((name) => [name, sha256(path.join(usbRoot, name))]));

  // Six candidats terminés sont transférés. Le septième, EN_COURS sans pointeur,
  // doit rester local, non modifié et non exporté.
  const sourceRecords = sourceTransfer.listCandidateRecords(sourceTransfer.paths.candidatesRoot, false);
  assert.strictEqual(sourceRecords.length, 7, 'Le PC source doit conserver les 7 dossiers candidats, y compris le parcours EN_COURS protégé.');
  const orphan = sourceRecords.find((r) => String(r.candidateId) === 'orphan-active-candidate-7');
  assert(orphan && String(orphan.manifest.status) === 'EN_COURS', 'Un EN_COURS sans pointeur ne doit jamais être transformé automatiquement en TERMINE.');
  const sourceIds = sourceRecords
    .filter((r) => String(r.manifest.status) === 'TERMINE')
    .map((r) => String(r.candidateId))
    .sort();
  assert.strictEqual(sourceIds.length, 6, 'Exactement 6 parcours terminés doivent être exportables.');

  // PC cible : autre clé locale.
  configureLocalKey(Buffer.alloc(32, 52));
  const targetTransfer = createCandidateTransfer({
    documentsPath:targetDocuments,
    userDataPath:targetUserData,
    now:() => new Date(fixedNow)
  });

  // Mauvais mot de passe : aucun import, aucune modification USB.
  assert.throws(
    () => targetTransfer.importAll(usbRoot, 'Mauvais-Mot-De-Passe!'),
    /Mot de passe incorrect|endommagé/
  );
  assert.strictEqual(targetTransfer.listCandidateRecords(targetTransfer.paths.candidatesRoot, false).length, 0);
  for (const [name, digest] of usbHashes) {
    assert.strictEqual(sha256(path.join(usbRoot, name)), digest, 'Un import refusé ne doit pas modifier ' + name);
  }
  assert.strictEqual(sha256(unrelatedUsbFile), unrelatedUsbHash);

  // Bon mot de passe : les 6 candidats sont importés sur le PC B.
  const imported = targetTransfer.importAll(usbRoot, password);
  assert.strictEqual(imported.total, 6);
  assert.strictEqual(imported.added, 6);
  assert.strictEqual(imported.skipped, 0);

  const targetRecords = targetTransfer.listCandidateRecords(targetTransfer.paths.candidatesRoot, false);
  assert.strictEqual(targetRecords.length, 6, 'Le PC cible doit retrouver les 6 candidats.');
  const targetIds = targetRecords.map((r) => String(r.candidateId)).sort();
  assert.deepStrictEqual(targetIds, sourceIds, 'Les IDs candidats source/import doivent correspondre exactement.');

  for (const record of targetRecords) {
    assert(/^CAND-/i.test(record.folderName), 'Les dossiers importés doivent avoir un nom technique CAND-.');
    const rawManifest = fs.readFileSync(path.join(record.candidateDir, 'manifest.json'), 'utf8');
    assert(rawManifest.startsWith(LOCAL_PREFIX), 'Le candidat importé doit être rechiffré avec la clé locale du PC cible.');
    const manifest = readJsonFile(path.join(record.candidateDir, 'manifest.json'));
    assert.strictEqual(manifest.status, 'TERMINE', 'Un candidat importé doit rester non reprenable.');
  }

  // Vérifier quelques données significatives, dont replay/bilan/Word.
  const importedC1 = targetRecords.find((r) => r.candidateId === c1First.candidateId);
  assert(importedC1, 'Le candidat terminé normalement doit être présent sur le PC cible.');
  assert(fs.existsSync(path.join(importedC1.candidateDir, 'replay', 'replay-final.txt')), 'Le replay doit suivre le candidat.');
  assert(fs.existsSync(path.join(importedC1.candidateDir, 'bilan', 'historique', 'bilan-R00.json')), 'Le bilan historique doit suivre le candidat.');
  assert(fs.existsSync(path.join(importedC1.candidateDir, 'bilan', 'exports', 'Evaluation_XXA_YYA.docx')), 'Le Word doit suivre le candidat.');

  const targetStore = createCandidateStore({
    documentsPath:targetDocuments,
    userDataPath:targetUserData,
    now:() => new Date(fixedNow)
  });
  assert.strictEqual(targetStore.getActiveCandidate(), null, 'Aucun candidat importé ne doit devenir un parcours actif/reprenable.');

  // Réimport : aucun écrasement.
  const importedAgain = targetTransfer.importAll(usbRoot, password);
  assert.strictEqual(importedAgain.added, 0);
  assert.strictEqual(importedAgain.skipped, 6);

  console.log('FULL_CYCLE_SOURCE_VISIBLE=6');
  console.log('FULL_CYCLE_USB_FILES=6');
  console.log('FULL_CYCLE_TARGET_IMPORTED=6');
  console.log('FULL_CYCLE_EXISTING_USB_FILE_PRESERVED=OK');
  console.log('FULL_CYCLE_WRONG_PASSWORD_NO_IMPORT=OK');
  console.log('FULL_CYCLE_RESTART_RESUME=OK');
  console.log('FULL_CYCLE_LEGACY_MIGRATION=OK');
  console.log('FULL_CYCLE_ORPHAN_EN_COURS_NOT_EXPORTED=OK');
  console.log('Candidate Full Cycle GitHub Simulation: OK');
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
