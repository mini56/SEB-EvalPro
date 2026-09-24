const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const registerCandidateCatalog = require('../src/candidate-catalog-main');
const registerBilanHistory = require('../src/bilan-history-main');
const { codedFolderName } = require('../src/candidate-folder-utils');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seb-evalpro-candidate-catalog-'));
const documentsPath = path.join(root, 'Documents');
const userDataPath = path.join(root, 'UserData');
const sebRoot = path.join(documentsPath, 'SEB EvalPro');
const legacyDir = path.join(sebRoot, 'Admin', 'Ancien groupe', 'XX_YY_ancien');
const replayRoot = path.join(sebRoot, 'parcours');
const bilanRoot = path.join(sebRoot, 'Bilans', 'Historique');

const candidate = {
  nom:'XX',
  prenom:'YY',
  lieu:'Lorient',
  groupe:'7',
  date:'2026-09-18'
};

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

try {
  for (const rel of ['donnees','resultats','replay',path.join('bilan','historique'),path.join('bilan','exports')]) {
    fs.mkdirSync(path.join(legacyDir, rel), { recursive:true });
  }

  writeJson(path.join(legacyDir, 'manifest.json'), {
    schemaVersion:1,
    candidateId:'candidate-xx',
    folderName:path.basename(legacyDir),
    status:'SESSION_FERMEE',
    updatedAt:'2026-09-18T18:00:00.000Z',
    candidat:{ ...candidate, 'prénom':candidate.prenom }
  });
  writeJson(path.join(legacyDir, 'donnees', 'evaluation-state.json'), { version:1 });

  const replayName = 'XX_JEAN_2026-09-18_BUILD-24_TEST';
  const replayDir = path.join(replayRoot, replayName);
  writeJson(path.join(replayDir, 'manifest.json'), {
    schemaVersion:2,
    type:'SEB_EVALPRO_PARCOURS_ARCHIVE',
    candidate
  });
  fs.mkdirSync(path.join(replayDir, 'slides'), { recursive:true });
  fs.writeFileSync(path.join(replayDir, 'slides', '001.png'), 'fake', 'utf8');

  const legacyWordName = 'Evaluation_XX_YY_2026-09-18.doc';
  fs.mkdirSync(path.join(sebRoot, 'Bilans'), { recursive:true });
  fs.writeFileSync(path.join(sebRoot, 'Bilans', legacyWordName), '<html><table><tr><td>ancien Word</td></tr></table></html>', 'utf8');

  const bilanName = 'XX_JEAN_2026-09-18_BUILD-24_BILAN_R00_TEST.json';
  writeJson(path.join(bilanRoot, bilanName), {
    schemaVersion:1,
    type:'SEB_EVALPRO_BILAN_ARCHIVE',
    candidate,
    revision:0,
    originalBuild:'24',
    createdAt:'2026-09-18T18:30:00.000Z',
    integritySha256:'corrompu-volontairement',
    document:{ rows:[{ kind:'item', key:'x' }] }
  });

  const handlers = new Map();
  const listeners = new Map();
  const ipcMain = {
    handle(name, fn) { handlers.set(name, fn); },
    on(name, fn) { listeners.set(name, fn); }
  };
  const app = {
    getPath(name) {
      if (name === 'documents') return documentsPath;
      if (name === 'userData') return userDataPath;
      throw new Error('Chemin non simulé: ' + name);
    }
  };

  registerCandidateCatalog({
    app,
    ipcMain,
    getAdminUnlocked:() => true,
    getActiveCandidate:() => null
  });
  registerBilanHistory({
    app,
    ipcMain,
    getAdminUnlocked:() => true,
    buildNumber:'79'
  });

  const list = handlers.get('candidate-catalog:list');
  const detail = handlers.get('candidate-catalog:detail');
  const loadBilan = handlers.get('candidate-catalog:load-bilan');
  const beginBilan = handlers.get('candidate-catalog:begin-bilan');
  const beginResults = handlers.get('candidate-catalog:begin-results');
  const endResults = handlers.get('candidate-catalog:end-results');
  const loadResultsWorkspaceSync = listeners.get('candidate-catalog:results-workspace-load-sync');
  const saveWorkspace = handlers.get('candidate-catalog:workspace-save');
  const endBilan = handlers.get('candidate-catalog:end-bilan');
  const loadWorkspaceSync = listeners.get('candidate-catalog:workspace-load-sync');
  const saveWorkspaceSync = listeners.get('candidate-catalog:workspace-save-sync');
  const sync = handlers.get('candidate-catalog:sync');
  const deleteCandidate = handlers.get('candidate-catalog:delete');
  const saveCurrentBilan = handlers.get('bilan-history:save-current');
  const saveBilanRevision = handlers.get('bilan-history:save-revision');
  assert(list && detail && loadBilan && beginBilan && beginResults && endResults && loadResultsWorkspaceSync && saveWorkspace && endBilan && loadWorkspaceSync && saveWorkspaceSync && sync && deleteCandidate && saveCurrentBilan && saveBilanRevision, 'Handlers catalogue/bilan/résultats/suppression absents.');

  const first = list();
  assert.strictEqual(first.length, 1, 'Le candidat historique doit être migré une seule fois.');
  assert.strictEqual(first[0].candidateId, 'candidate-xx');
  assert.strictEqual(first[0].replayCount, 1, 'Le parcours historique doit être rattaché au dossier candidat.');
  assert.strictEqual(first[0].bilanCount, 1, 'Le bilan historique doit être rattaché au dossier candidat.');

  const newDir = path.join(sebRoot, 'Candidats', codedFolderName('candidate-xx'));
  assert(fs.existsSync(newDir), 'La copie autonome du candidat doit exister.');
  assert(fs.existsSync(legacyDir), 'Le dossier historique Admin doit rester intact.');
  assert(fs.existsSync(path.join(newDir, 'replay', replayName)), 'Le replay doit être migré dans le dossier candidat.');
  assert(fs.existsSync(path.join(newDir, 'bilan', 'historique', bilanName)), 'Le bilan doit être migré dans le dossier candidat.');
  assert(fs.existsSync(path.join(newDir, 'bilan', 'exports', legacyWordName)), 'Un ancien Word associable sans ambiguïté doit être copié dans le dossier candidat.');
  assert(fs.existsSync(path.join(sebRoot, 'Bilans', legacyWordName)), 'L’ancien Word global doit rester intact pendant la migration de sécurité.');

  const duplicateDir = path.join(sebRoot, 'Candidats', codedFolderName('candidate-xx') + '_2');
  for (const rel of ['donnees','resultats','replay',path.join('bilan','historique'),path.join('bilan','exports')]) {
    fs.mkdirSync(path.join(duplicateDir, rel), { recursive:true });
  }
  writeJson(path.join(duplicateDir, 'manifest.json'), {
    schemaVersion:1,
    candidateId:'candidate-xx-duplicate',
    folderName:path.basename(duplicateDir),
    status:'EN_COURS',
    createdAt:'2026-09-19T08:00:00.000Z',
    updatedAt:'2026-09-19T08:00:00.000Z',
    candidat:{ ...candidate, 'prénom':candidate.prenom }
  });
  writeJson(path.join(duplicateDir, 'donnees', 'candidat.json'), { ...candidate, 'prénom':candidate.prenom });
  writeJson(path.join(duplicateDir, 'donnees', 'evaluation-state.json'), {
    version:1,
    sessionStorage:{
      candidat_data:JSON.stringify({ ...candidate, 'prénom':candidate.prenom }),
      reponses_data:JSON.stringify({ duplicate_only:'OK' }),
      scores_data:JSON.stringify({ duplicate_only:1 }),
      admin_bilan_state:JSON.stringify({ duplicate_only:true })
    },
    localStorage:{ duplicate_local:'OK' },
    lastPage:'pageFinale.html',
    lastEvaluationPage:'pageFinale.html',
    updatedAt:'2026-09-19T08:00:00.000Z'
  });
  writeJson(path.join(duplicateDir, 'donnees', 'progression.json'), { lastPage:'pageFinale.html', lastEvaluationPage:'pageFinale.html' });
  writeJson(path.join(duplicateDir, 'resultats', 'reponses.json'), { duplicate_only:'OK' });
  writeJson(path.join(duplicateDir, 'resultats', 'scores.json'), { duplicate_only:1 });
  writeJson(path.join(duplicateDir, 'replay', 'DUPLICATE_ONLY.json'), { candidate, source:'duplicate' });

  const consolidated = sync();
  assert(consolidated && consolidated.ok && consolidated.consolidatedDuplicates === 1, 'Le catalogue doit consolider automatiquement un doublon du même candidat.');
  assert.strictEqual(fs.existsSync(duplicateDir), false, 'Le doublon ne doit plus rester dans Candidats.');
  const duplicateArchiveRoot = path.join(sebRoot, 'Corbeille', 'Doublons');
  assert(fs.existsSync(duplicateArchiveRoot), 'Le doublon doit être archivé sans destruction.');
  assert(fs.readdirSync(duplicateArchiveRoot).some((name) => name.startsWith(codedFolderName('candidate-xx-duplicate') + '__DUP-')), 'Le dossier doublon complet doit être conservé dans Corbeille\\Doublons sous un nom codé.');
  const mergedDuplicateResponses = JSON.parse(fs.readFileSync(path.join(newDir, 'resultats', 'reponses.json'), 'utf8'));
  assert.strictEqual(mergedDuplicateResponses.duplicate_only, 'OK', 'Les réponses présentes uniquement dans le doublon doivent être récupérées.');
  const mergedState = JSON.parse(fs.readFileSync(path.join(newDir, 'donnees', 'evaluation-state.json'), 'utf8'));
  assert(mergedState.sessionStorage && mergedState.sessionStorage.admin_bilan_state, 'Les données de bilan présentes dans le doublon doivent être conservées.');
  assert(fs.existsSync(path.join(newDir, 'replay', 'DUPLICATE_ONLY.json')), 'Le replay du doublon doit être récupéré dans le dossier unique.');
  assert.strictEqual(list().length, 1, 'Après consolidation, un candidat ne doit apparaître qu’une seule fois.');

  writeJson(path.join(newDir, 'resultats', 'reponses.json'), { duplicate_only:'OK', page2_q1:'1020', page2_q2:'1250' });
  writeJson(path.join(newDir, 'resultats', 'scores.json'), { page2_q1:1, page2_q2:1 });
  const stateBeforeResults = fs.readFileSync(path.join(newDir, 'donnees', 'evaluation-state.json'), 'utf8');

  const preparedResults = beginResults(null, 'candidate-xx');
  assert(preparedResults && preparedResults.ok, 'Les résultats du candidat doivent pouvoir être ouverts indépendamment d’une session active.');
  const resultsEvent = { returnValue:null };
  loadResultsWorkspaceSync(resultsEvent);
  assert(resultsEvent.returnValue && resultsEvent.returnValue.ok && resultsEvent.returnValue.readOnly === true, 'Le workspace Résultats doit être disponible en lecture seule.');
  assert.strictEqual(resultsEvent.returnValue.candidateId, 'candidate-xx', 'Les résultats doivent appartenir au candidat sélectionné.');
  const resultsCandidate = JSON.parse(resultsEvent.returnValue.state.sessionStorage.candidat_data);
  const resultsResponses = JSON.parse(resultsEvent.returnValue.state.sessionStorage.reponses_data);
  const resultsScores = JSON.parse(resultsEvent.returnValue.state.sessionStorage.scores_data);
  assert.strictEqual(resultsCandidate.nom, 'XX');
  assert.strictEqual(resultsCandidate['prénom'], 'YY');
  assert.strictEqual(resultsResponses.page2_q1, '1020');
  assert.strictEqual(resultsScores.page2_q1, 1);
  assert.strictEqual(endResults(), true, 'La fermeture du workspace Résultats doit réussir.');
  const resultsAfterEnd = { returnValue:null };
  loadResultsWorkspaceSync(resultsAfterEnd);
  assert(resultsAfterEnd.returnValue && resultsAfterEnd.returnValue.ok === false, 'Le workspace Résultats fermé ne doit plus exposer de candidat.');
  assert.strictEqual(fs.readFileSync(path.join(newDir, 'donnees', 'evaluation-state.json'), 'utf8'), stateBeforeResults, 'Ouvrir les résultats ne doit jamais modifier l’état du candidat.');

  const d = detail(null, 'candidate-xx');
  assert(d && d.ok);
  assert.strictEqual(d.bilans.length, 1);
  assert.strictEqual(d.bilans[0].integrityOk, false, 'Un bilan corrompu doit être signalé.');

  const prepared = beginBilan(null, 'candidate-xx');
  assert(prepared && prepared.ok, 'Le candidat doit pouvoir ouvrir un espace de bilan même sans dépendre d’une session active.');

  const loadEvent = { returnValue:null };
  loadWorkspaceSync(loadEvent);
  assert(loadEvent.returnValue && loadEvent.returnValue.ok, 'Les données du candidat sélectionné doivent être chargées pour le bilan.');
  assert.strictEqual(loadEvent.returnValue.candidateId, 'candidate-xx');
  const loadedCandidate = JSON.parse(loadEvent.returnValue.state.sessionStorage.candidat_data);
  assert.strictEqual(loadedCandidate.nom, 'XX');
  assert.strictEqual(loadedCandidate.prenom || loadedCandidate['prénom'], 'YY');
  assert.strictEqual(loadEvent.returnValue.state.sessionStorage.seb_evalpro_admin_candidate_id, 'candidate-xx');

  const originalDocument = {
    title:'Bilan institutionnel',
    headers:['Modules','NE','I','II','III','Commentaires'],
    rows:[{ kind:'item', key:'test', moduleText:'Test', level:'I', preset:'', comment:'Original', detail:'', options:[] }]
  };
  const firstBilan = saveCurrentBilan(null, {
    candidateId:'candidate-xx',
    candidate:{ nom:'XX', prenom:'YY', date:'2026-09-18' },
    originalBuild:'79',
    sessionToken:'candidate-xx-smoke',
    document:originalDocument
  });
  assert(firstBilan && firstBilan.ok && firstBilan.revision === 0, 'Le bilan original doit être archivé directement dans le dossier candidat sélectionné.');
  const firstArchive = JSON.parse(fs.readFileSync(path.join(newDir, 'bilan', 'historique', firstBilan.filename), 'utf8'));
  assert.strictEqual(firstArchive.candidateId, 'candidate-xx', 'L’archive doit mémoriser le dossier candidat exact.');

  const revisionDocument = {
    ...originalDocument,
    rows:[{ ...originalDocument.rows[0], comment:'Révision 1' }]
  };
  const revision = saveBilanRevision(null, { sourceFilename:firstBilan.filename, document:revisionDocument });
  assert(revision && revision.ok && revision.revision === 1, 'La première révision doit être enregistrée dans le même dossier candidat.');
  assert(fs.existsSync(path.join(newDir, 'bilan', 'historique', revision.filename)), 'Le fichier de révision doit exister dans le dossier candidat.');

  const wordBase = 'Evaluation_XX_JEAN_2026-09-18.doc';
  fs.writeFileSync(path.join(newDir, 'bilan', 'exports', wordBase), 'word courant', 'utf8');
  fs.writeFileSync(path.join(newDir, 'bilan', 'exports', 'Evaluation_XX_JEAN_2026-09-18_2.doc'), 'doublon', 'utf8');
  fs.writeFileSync(path.join(newDir, 'bilan', 'exports', 'Evaluation_XX_JEAN_2026-09-18_R01.doc'), 'ancienne révision Word', 'utf8');
  const afterBilan = detail(null, 'candidate-xx');
  assert(afterBilan && afterBilan.ok);
  assert.strictEqual(afterBilan.bilans.filter((b) => b.integrityOk).length, 2, 'Le catalogue doit voir le bilan original et sa révision.');
  assert.strictEqual(afterBilan.candidate.revisionCount, 1, 'Le catalogue doit annoncer une révision.');
  assert.deepStrictEqual(
    afterBilan.exports.filter((name) => /^Evaluation_XX_JEAN_2026-09-18/i.test(name)).map((name) => name.toLowerCase()),
    [wordBase.toLowerCase()],
    'Un seul Word courant doit rester visible, sans dépendre de la casse du nom de fichier Windows.'
  );
  assert.strictEqual(fs.existsSync(path.join(newDir, 'bilan', 'exports', 'Evaluation_XX_JEAN_2026-09-18_2.doc')), false, 'Le doublon Word _2 doit être nettoyé.');
  assert.strictEqual(fs.existsSync(path.join(newDir, 'bilan', 'exports', 'Evaluation_XX_JEAN_2026-09-18_R01.doc')), false, 'L’ancien Word de révision doit être nettoyé.');

  const modifiedState = {
    ...loadEvent.returnValue.state,
    sessionStorage:{
      ...loadEvent.returnValue.state.sessionStorage,
      admin_bilan_state:JSON.stringify({ rows:{ test:{ level:'I' } } })
    }
  };
  const savedAsync = saveWorkspace(null, modifiedState);
  assert(savedAsync && savedAsync.ok, 'La sauvegarde du bilan sélectionné doit être acceptée.');
  const persisted = JSON.parse(fs.readFileSync(path.join(newDir, 'donnees', 'evaluation-state.json'), 'utf8'));
  assert.strictEqual(persisted.sessionStorage.admin_bilan_state, modifiedState.sessionStorage.admin_bilan_state, 'Le bilan doit être sauvegardé dans le dossier du candidat sélectionné.');

  const saveEvent = { returnValue:null };
  saveWorkspaceSync(saveEvent, modifiedState);
  assert(saveEvent.returnValue && saveEvent.returnValue.ok, 'La sauvegarde synchrone du bilan sélectionné doit être acceptée.');

  assert.strictEqual(endBilan(), true, 'La fermeture de l’espace bilan doit réussir.');
  const afterEnd = { returnValue:null };
  loadWorkspaceSync(afterEnd);
  assert(afterEnd.returnValue && afterEnd.returnValue.ok === false, 'L’espace bilan fermé ne doit plus exposer de candidat sélectionné.');

  const corrupt = loadBilan(null, 'candidate-xx', bilanName);
  assert(corrupt && corrupt.ok === false && corrupt.corruption === true, 'Un bilan corrompu doit être refusé avec avertissement.');
  assert(/ATTENTION/i.test(corrupt.error) && /corruption/i.test(corrupt.error));

  // Le dossier candidat est la source opérationnelle : aucune copie inverse
  // vers les anciens dossiers globaux ne doit être recréée.
  const localOnlyReplay = path.join(newDir, 'replay', 'LOCAL_ONLY');
  fs.mkdirSync(localOnlyReplay, { recursive:true });
  writeJson(path.join(localOnlyReplay, 'manifest.json'), { candidate });
  sync();
  assert.strictEqual(fs.existsSync(path.join(replayRoot, 'LOCAL_ONLY')), false, 'Le replay candidat ne doit pas être recopié vers le stockage global.');

  const again = list();
  assert.strictEqual(again.length, 1, 'La migration automatique ne doit jamais dupliquer le candidat.');
  assert(fs.existsSync(newDir), 'Le dossier candidat doit exister avant suppression administrateur.');

  fs.mkdirSync(userDataPath, { recursive:true });
  writeJson(path.join(userDataPath, 'evaluation-state.json'), {
    version:1,
    sessionStorage:{ candidat_data:JSON.stringify(candidate) },
    localStorage:{}
  });

  const deleted = deleteCandidate(null, 'candidate-xx');
  assert(deleted && deleted.ok, 'La suppression administrateur du candidat doit réussir.');
  assert.strictEqual(fs.existsSync(newDir), false, 'Le dossier candidat complet doit être supprimé.');
  assert.strictEqual(fs.existsSync(legacyDir), false, 'La copie historique Admin du même candidat doit être supprimée.');
  assert.strictEqual(fs.existsSync(path.join(replayRoot, replayName)), false, 'Le replay historique du candidat doit être supprimé.');
  assert.strictEqual(fs.existsSync(path.join(bilanRoot, bilanName)), false, 'Le bilan historique global du candidat doit être supprimé.');
  assert.strictEqual(fs.existsSync(path.join(sebRoot, 'Bilans', legacyWordName)), false, 'Le Word historique global du candidat doit être supprimé.');
  assert.strictEqual(fs.existsSync(path.join(userDataPath, 'evaluation-state.json')), false, 'L’état local du candidat supprimé ne doit pas permettre sa recréation.');
  assert.strictEqual(list().length, 0, 'Un candidat supprimé ne doit pas réapparaître après synchronisation.');

  console.log('Candidate Catalog Authoritative Folder + Erasure Test: OK');
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
