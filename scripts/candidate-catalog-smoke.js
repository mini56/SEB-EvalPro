const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const registerCandidateCatalog = require('../src/candidate-catalog-main');
const registerBilanHistory = require('../src/bilan-history-main');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seb-evalpro-candidate-catalog-'));
const documentsPath = path.join(root, 'Documents');
const sebRoot = path.join(documentsPath, 'SEB EvalPro');
const legacyDir = path.join(sebRoot, 'Admin', 'Ancien groupe', 'DUPONT_Jean_ancien');
const replayRoot = path.join(sebRoot, 'parcours');
const bilanRoot = path.join(sebRoot, 'Bilans', 'Historique');

const candidate = {
  nom:'DUPONT',
  prenom:'Jean',
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
    candidateId:'candidate-dupont',
    folderName:path.basename(legacyDir),
    status:'SESSION_FERMEE',
    updatedAt:'2026-09-18T18:00:00.000Z',
    candidat:{ ...candidate, 'prénom':candidate.prenom }
  });
  writeJson(path.join(legacyDir, 'donnees', 'evaluation-state.json'), { version:1 });

  const replayName = 'DUPONT_JEAN_2026-09-18_BUILD-24_TEST';
  const replayDir = path.join(replayRoot, replayName);
  writeJson(path.join(replayDir, 'manifest.json'), {
    schemaVersion:2,
    type:'SEB_EVALPRO_PARCOURS_ARCHIVE',
    candidate
  });
  fs.mkdirSync(path.join(replayDir, 'slides'), { recursive:true });
  fs.writeFileSync(path.join(replayDir, 'slides', '001.png'), 'fake', 'utf8');

  const legacyWordName = 'Evaluation_DUPONT_Jean_2026-09-18.doc';
  fs.mkdirSync(path.join(sebRoot, 'Bilans'), { recursive:true });
  fs.writeFileSync(path.join(sebRoot, 'Bilans', legacyWordName), '<html><table><tr><td>ancien Word</td></tr></table></html>', 'utf8');

  const bilanName = 'DUPONT_JEAN_2026-09-18_BUILD-24_BILAN_R00_TEST.json';
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
  const saveWorkspace = handlers.get('candidate-catalog:workspace-save');
  const endBilan = handlers.get('candidate-catalog:end-bilan');
  const loadWorkspaceSync = listeners.get('candidate-catalog:workspace-load-sync');
  const saveWorkspaceSync = listeners.get('candidate-catalog:workspace-save-sync');
  const sync = handlers.get('candidate-catalog:sync');
  const saveCurrentBilan = handlers.get('bilan-history:save-current');
  const saveBilanRevision = handlers.get('bilan-history:save-revision');
  assert(list && detail && loadBilan && beginBilan && saveWorkspace && endBilan && loadWorkspaceSync && saveWorkspaceSync && sync && saveCurrentBilan && saveBilanRevision, 'Handlers catalogue/bilan absents.');
  assert.strictEqual(handlers.has('candidate-catalog:delete'), false, 'Aucun handler ne doit permettre de supprimer un candidat.');

  const first = list();
  assert.strictEqual(first.length, 1, 'Le candidat historique doit être migré une seule fois.');
  assert.strictEqual(first[0].candidateId, 'candidate-dupont');
  assert.strictEqual(first[0].replayCount, 1, 'Le parcours historique doit être rattaché au dossier candidat.');
  assert.strictEqual(first[0].bilanCount, 1, 'Le bilan historique doit être rattaché au dossier candidat.');

  const newDir = path.join(sebRoot, 'Candidats', 'DUPONT_Jean_Lorient_7');
  assert(fs.existsSync(newDir), 'La copie autonome du candidat doit exister.');
  assert(fs.existsSync(legacyDir), 'Le dossier historique Admin doit rester intact.');
  assert(fs.existsSync(path.join(newDir, 'replay', replayName)), 'Le replay doit être migré dans le dossier candidat.');
  assert(fs.existsSync(path.join(newDir, 'bilan', 'historique', bilanName)), 'Le bilan doit être migré dans le dossier candidat.');
  assert(fs.existsSync(path.join(newDir, 'bilan', 'exports', legacyWordName)), 'Un ancien Word associable sans ambiguïté doit être copié dans le dossier candidat.');
  assert(fs.existsSync(path.join(sebRoot, 'Bilans', legacyWordName)), 'L’ancien Word global doit rester intact pendant la migration de sécurité.');

  const d = detail(null, 'candidate-dupont');
  assert(d && d.ok);
  assert.strictEqual(d.bilans.length, 1);
  assert.strictEqual(d.bilans[0].integrityOk, false, 'Un bilan corrompu doit être signalé.');

  const prepared = beginBilan(null, 'candidate-dupont');
  assert(prepared && prepared.ok, 'Le candidat doit pouvoir ouvrir un espace de bilan même sans dépendre d’une session active.');

  const loadEvent = { returnValue:null };
  loadWorkspaceSync(loadEvent);
  assert(loadEvent.returnValue && loadEvent.returnValue.ok, 'Les données du candidat sélectionné doivent être chargées pour le bilan.');
  assert.strictEqual(loadEvent.returnValue.candidateId, 'candidate-dupont');
  const loadedCandidate = JSON.parse(loadEvent.returnValue.state.sessionStorage.candidat_data);
  assert.strictEqual(loadedCandidate.nom, 'DUPONT');
  assert.strictEqual(loadedCandidate.prenom || loadedCandidate['prénom'], 'Jean');
  assert.strictEqual(loadEvent.returnValue.state.sessionStorage.seb_evalpro_admin_candidate_id, 'candidate-dupont');

  const originalDocument = {
    title:'Bilan institutionnel',
    headers:['Modules','NE','I','II','III','Commentaires'],
    rows:[{ kind:'item', key:'test', moduleText:'Test', level:'I', preset:'', comment:'Original', detail:'', options:[] }]
  };
  const firstBilan = saveCurrentBilan(null, {
    candidateId:'candidate-dupont',
    candidate:{ nom:'DUPONT', prenom:'Jean', date:'2026-09-18' },
    originalBuild:'79',
    sessionToken:'candidate-dupont-smoke',
    document:originalDocument
  });
  assert(firstBilan && firstBilan.ok && firstBilan.revision === 0, 'Le bilan original doit être archivé directement dans le dossier candidat sélectionné.');
  const firstArchive = JSON.parse(fs.readFileSync(path.join(newDir, 'bilan', 'historique', firstBilan.filename), 'utf8'));
  assert.strictEqual(firstArchive.candidateId, 'candidate-dupont', 'L’archive doit mémoriser le dossier candidat exact.');

  const revisionDocument = {
    ...originalDocument,
    rows:[{ ...originalDocument.rows[0], comment:'Révision 1' }]
  };
  const revision = saveBilanRevision(null, { sourceFilename:firstBilan.filename, document:revisionDocument });
  assert(revision && revision.ok && revision.revision === 1, 'La première révision doit être enregistrée dans le même dossier candidat.');
  assert(fs.existsSync(path.join(newDir, 'bilan', 'historique', revision.filename)), 'Le fichier de révision doit exister dans le dossier candidat.');

  const wordBase = 'Evaluation_DUPONT_JEAN_2026-09-18.doc';
  fs.writeFileSync(path.join(newDir, 'bilan', 'exports', wordBase), 'word courant', 'utf8');
  fs.writeFileSync(path.join(newDir, 'bilan', 'exports', 'Evaluation_DUPONT_JEAN_2026-09-18_2.doc'), 'doublon', 'utf8');
  fs.writeFileSync(path.join(newDir, 'bilan', 'exports', 'Evaluation_DUPONT_JEAN_2026-09-18_R01.doc'), 'ancienne révision Word', 'utf8');
  const afterBilan = detail(null, 'candidate-dupont');
  assert(afterBilan && afterBilan.ok);
  assert.strictEqual(afterBilan.bilans.filter((b) => b.integrityOk).length, 2, 'Le catalogue doit voir le bilan original et sa révision.');
  assert.strictEqual(afterBilan.candidate.revisionCount, 1, 'Le catalogue doit annoncer une révision.');
  assert.deepStrictEqual(afterBilan.exports.filter((name) => /^Evaluation_DUPONT_JEAN_2026-09-18/i.test(name)), [wordBase], 'Un seul Word courant doit rester visible.');
  assert.strictEqual(fs.existsSync(path.join(newDir, 'bilan', 'exports', 'Evaluation_DUPONT_JEAN_2026-09-18_2.doc')), false, 'Le doublon Word _2 doit être nettoyé.');
  assert.strictEqual(fs.existsSync(path.join(newDir, 'bilan', 'exports', 'Evaluation_DUPONT_JEAN_2026-09-18_R01.doc')), false, 'L’ancien Word de révision doit être nettoyé.');

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

  const corrupt = loadBilan(null, 'candidate-dupont', bilanName);
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
  assert(fs.existsSync(newDir), 'Un dossier candidat n’est jamais supprimé par le catalogue.');

  console.log('Candidate Catalog Authoritative Folder Test: OK');
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
