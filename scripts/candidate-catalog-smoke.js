const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const registerCandidateCatalog = require('../src/candidate-catalog-main');

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
  const ipcMain = { handle(name, fn) { handlers.set(name, fn); } };
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

  const list = handlers.get('candidate-catalog:list');
  const detail = handlers.get('candidate-catalog:detail');
  const loadBilan = handlers.get('candidate-catalog:load-bilan');
  const sync = handlers.get('candidate-catalog:sync');
  assert(list && detail && loadBilan && sync, 'Handlers catalogue absents.');
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

  const d = detail(null, 'candidate-dupont');
  assert(d && d.ok);
  assert.strictEqual(d.bilans.length, 1);
  assert.strictEqual(d.bilans[0].integrityOk, false, 'Un bilan corrompu doit être signalé.');

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
