const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const registerCandidateReplay = require('../src/replay-main');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seb-evalpro-replay-direct-'));
const userData = path.join(root, 'userData');
const storageRoot = path.join(userData, 'storage');
const candidateDir = path.join(storageRoot, 'Candidats', 'CAND-TESTREPLAY18');
fs.mkdirSync(path.join(candidateDir, 'donnees'), { recursive:true });
fs.mkdirSync(path.join(candidateDir, 'replay'), { recursive:true });

const candidate = {
  nom:'XX',
  'prénom':'YY',
  lieu:'Lorient',
  groupe:'7',
  date:'2026-09-27'
};
fs.writeFileSync(path.join(candidateDir, 'manifest.json'), JSON.stringify({
  schemaVersion:1,
  candidateId:'candidate-replay-build18',
  shortId:'REPLAY18',
  folderName:path.basename(candidateDir),
  status:'EN_COURS',
  candidat:candidate
}, null, 2));
fs.writeFileSync(path.join(candidateDir, 'donnees', 'evaluation-state.json'), JSON.stringify({
  version:1,
  sessionStorage:{ candidat_data:JSON.stringify(candidate) },
  localStorage:{},
  lastPage:'nwtexte.html',
  lastEvaluationPage:'nwtexte.html'
}, null, 2));

const handlers = new Map();
const ipcMain = {
  handle(name, fn) { handlers.set(name, fn); }
};
const app = {
  getPath(name) {
    if (name === 'userData') return userData;
    throw new Error('Unexpected app path: ' + name);
  }
};

registerCandidateReplay({
  app,
  ipcMain,
  getAdminUnlocked:() => false,
  getActiveCandidate:() => ({
    candidateId:'candidate-replay-build18',
    candidateDir,
    status:'EN_COURS'
  }),
  buildNumber:18,
  dataRoot:storageRoot
});

const captureHandler = handlers.get('replay:capture-page');
const finalHandler = handlers.get('replay:archive-final');
assert(captureHandler, 'Handler replay:capture-page absent.');
assert(finalHandler, 'Handler replay:archive-final absent.');

const png = Buffer.from('89504e470d0a1a0a0011223344556677', 'hex');
const sender = {
  getURL:() => 'file:///C:/SEB/app/web/nwtexte.html',
  debugger:{
    isAttached:() => false,
    attach:() => {},
    detach:() => {},
    sendCommand:async (name) => {
      if (name === 'Page.enable') return {};
      if (name === 'Page.getLayoutMetrics') return { cssContentSize:{ width:1200, height:800 } };
      if (name === 'Page.captureScreenshot') return { data:png.toString('base64') };
      throw new Error('Unexpected debugger command: ' + name);
    }
  },
  capturePage:async () => ({
    isEmpty:() => false,
    toPNG:() => png,
    getSize:() => ({ width:1200, height:800 })
  })
};

const token = '12345678-1234-1234-1234-123456789018';

(async () => {
  try {
    const first = await captureHandler({ sender }, {
      token,
      pageKey:'nwtexte.html',
      title:'Traitement de texte',
      reason:'navigation-before-guaranteed',
      viewport:{ width:1200, height:800 }
    });
    assert(first && first.ok, 'Première capture Replay refusée.');
    assert.strictEqual(first.storedInCandidate, true, 'La capture doit indiquer un stockage candidat direct.');

    const replayDirs = fs.readdirSync(path.join(candidateDir, 'replay'), { withFileTypes:true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    assert.strictEqual(replayDirs.length, 1, 'Un dossier Replay doit exister immédiatement dans le dossier candidat.');

    const replayDir = path.join(candidateDir, 'replay', replayDirs[0]);
    const manifestPath = path.join(replayDir, 'manifest.json');
    const slidesDir = path.join(replayDir, 'slides');
    assert(fs.existsSync(manifestPath), 'manifest.json Replay absent après la capture.');
    assert(fs.existsSync(slidesDir), 'Dossier slides absent après la capture.');

    let manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(manifest.replayStatus, 'EN_COURS', 'Le Replay doit être marqué EN_COURS pendant le parcours.');
    assert.strictEqual(manifest.slides.length, 1, 'Une diapositive doit être enregistrée.');
    assert(fs.existsSync(path.join(slidesDir, manifest.slides[0].file)), 'PNG Replay absent du dossier candidat.');

    const second = await captureHandler({ sender }, {
      token,
      pageKey:'dictee.html',
      title:'Dictée',
      reason:'navigation-before-guaranteed',
      viewport:{ width:1200, height:800 }
    });
    assert(second && second.ok, 'Deuxième capture Replay refusée.');
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(manifest.slides.length, 2, 'Le Replay doit s’enrichir au fur et à mesure.');

    const pendingRoot = path.join(userData, 'replay-pending');
    assert.strictEqual(fs.existsSync(pendingRoot), false, 'Build #18 ne doit pas créer replay-pending pour les nouvelles captures.');

    const finalResult = await finalHandler({ sender:{...sender, getURL:() => 'file:///C:/SEB/app/web/qcmv1.0.html'} }, {
      token,
      finalPageVisible:true,
      sessionStorage:{ candidat_data:JSON.stringify(candidate) },
      localStorage:{},
      lastPage:'qcmv1.0.html',
      lastEvaluationPage:'qcmv1.0.html#pageFinale'
    });
    assert(finalResult && finalResult.ok, 'La mise à jour finale du Replay doit réussir sans déplacer les images.');
    assert.strictEqual(finalResult.filename, replayDirs[0], 'La fin du parcours doit conserver le même dossier Replay.');

    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(manifest.replayStatus, 'TERMINE', 'Le manifeste peut être marqué TERMINE à la fin.');
    assert.strictEqual(manifest.slides.length, 2, 'Aucune image Replay ne doit être perdue à la fin.');

    const preload = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload.js'), 'utf8');
    const closeStart = preload.indexOf("closeSessionButton.addEventListener('click'");
    const finalStart = preload.indexOf('async function completeCandidateFromFinalPage()');
    assert(closeStart >= 0 && finalStart >= 0, 'Flux de fermeture/fin introuvable.');
    const closeBlock = preload.slice(closeStart, finalStart);
    assert(!closeBlock.includes('ensureFinalArchive'), 'Fermer la session active ne doit pas dépendre d’une finalisation Replay.');
    const finalBlock = preload.slice(finalStart);
    assert(!finalBlock.includes('ensureFinalArchive'), 'La fin normale ne doit pas être bloquée par une finalisation Replay.');

    console.log('REPLAY_DIRECT_CANDIDATE_STORAGE: OK');
    console.log('REPLAY_NO_PENDING_FOR_NEW_CAPTURES: OK');
    console.log('REPLAY_GROWS_AS_PAGES_ARE_CAPTURED: OK');
    console.log('REPLAY_NEVER_BLOCKS_PARCOURS_CLOSE: OK');
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
