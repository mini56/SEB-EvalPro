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
  nom: 'DUPONT',
  prenom: 'Jean',
  lieu: 'Lorient',
  groupe: '7',
  date: '2026-09-18'
};

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

try {
  fs.mkdirSync(path.join(legacyDir, 'donnees'), { recursive: true });
  fs.mkdirSync(path.join(legacyDir, 'resultats'), { recursive: true });
  fs.mkdirSync(path.join(legacyDir, 'replay'), { recursive: true });
  fs.mkdirSync(path.join(legacyDir, 'bilan', 'historique'), { recursive: true });
  fs.mkdirSync(path.join(legacyDir, 'bilan', 'exports'), { recursive: true });

  writeJson(path.join(legacyDir, 'manifest.json'), {
    schemaVersion: 1,
    candidateId: 'candidate-dupont',
    folderName: path.basename(legacyDir),
    status: 'SESSION_FERMEE',
    updatedAt: '2026-09-18T18:00:00.000Z',
    candidat: { ...candidate, 'prénom': candidate.prenom }
  });
  writeJson(path.join(legacyDir, 'donnees', 'evaluation-state.json'), { version:1 });

  const replayName = 'DUPONT_JEAN_2026-09-18_BUILD-24_TEST';
  const replayDir = path.join(replayRoot, replayName);
  writeJson(path.join(replayDir, 'manifest.json'), {
    schemaVersion: 2,
    type: 'SEB_EVALPRO_PARCOURS_ARCHIVE',
    candidate
  });
  fs.mkdirSync(path.join(replayDir, 'slides'), { recursive: true });
  fs.writeFileSync(path.join(replayDir, 'slides', '001.png'), 'fake', 'utf8');

  const bilanName = 'DUPONT_JEAN_2026-09-18_BUILD-24_BILAN_R00_TEST.json';
  writeJson(path.join(bilanRoot, bilanName), {
    schemaVersion: 1,
    type: 'SEB_EVALPRO_BILAN_ARCHIVE',
    candidate,
    revision: 0,
    originalBuild: '24',
    createdAt: '2026-09-18T18:30:00.000Z',
    integritySha256: 'test',
    document: { rows:[{ kind:'item', key:'x' }] }
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
    getAdminUnlocked: () => true,
    getActiveCandidate: () => null
  });

  const list = handlers.get('candidate-catalog:list');
  const remove = handlers.get('candidate-catalog:delete');
  assert(list && remove, 'Handlers catalogue absents.');

  const first = list();
  assert.strictEqual(first.length, 1, 'Le candidat historique doit être repris une seule fois.');
  assert.strictEqual(first[0].candidateId, 'candidate-dupont');
  assert.strictEqual(first[0].replayCount, 1, 'Le parcours global doit être rattaché au candidat.');
  assert.strictEqual(first[0].bilanCount, 1, 'Le bilan global doit être rattaché au candidat.');
  assert.strictEqual(first[0].hasOriginalBilan, true);

  const newDir = path.join(sebRoot, 'Candidats', 'DUPONT_Jean_Lorient_7');
  assert(fs.existsSync(newDir), 'La copie autonome du candidat doit exister.');
  assert(fs.existsSync(legacyDir), 'Le dossier historique Admin ne doit jamais être déplacé ni supprimé.');
  assert(fs.existsSync(path.join(newDir, 'replay', replayName)), 'Le replay doit être dans le dossier candidat.');
  assert(fs.existsSync(path.join(newDir, 'bilan', 'historique', bilanName)), 'Le bilan doit être dans le dossier candidat.');

  const deleted = remove(null, 'candidate-dupont');
  assert(deleted && deleted.ok, 'La suppression logique doit réussir.');
  assert(!fs.existsSync(newDir), 'Le dossier actif doit quitter Candidats.');
  assert(fs.existsSync(legacyDir), 'La sauvegarde historique Admin doit rester intacte.');
  assert(fs.existsSync(deleted.movedTo), 'Le dossier supprimé doit être conservé dans Corbeille.');

  const afterDelete = list();
  assert.strictEqual(afterDelete.length, 0, 'Un dossier supprimé ne doit pas être recréé automatiquement depuis l’ancien Admin.');

  console.log('Candidate Catalog Migration Test #1: OK');
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
