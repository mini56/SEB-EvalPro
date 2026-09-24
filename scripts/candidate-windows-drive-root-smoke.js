const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createCandidateStore } = require('../src/candidate-store-main');
const { createCandidateTransfer } = require('../src/candidate-transfer-main');
const { configureLocalKey } = require('../src/candidate-data-crypto');

const usbRoot = path.resolve(String(process.env.SEB_USB_ROOT || ''));
if (!usbRoot) throw new Error('SEB_USB_ROOT requis pour le test racine USB Windows.');
if (!fs.existsSync(usbRoot)) throw new Error('La racine USB Windows simulée est inaccessible : ' + usbRoot);
if (!fs.statSync(usbRoot).isDirectory()) throw new Error('SEB_USB_ROOT doit désigner une racine de lecteur.');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seb-evalpro-win-root-'));
const sourceDocuments = path.join(root, 'SOURCE', 'Documents');
const sourceUserData = path.join(root, 'SOURCE', 'AppData');
const targetDocuments = path.join(root, 'TARGET', 'Documents');
const targetUserData = path.join(root, 'TARGET', 'AppData');
const password = 'Windows-Root-2026!';
const now = () => new Date('2026-09-24T18:00:00.000Z');

function state() {
  const candidat = { nom:'XXROOT', 'prénom':'YYROOT', lieu:'Lorient', groupe:'R', date:'2026-09-24' };
  return {
    version:1,
    sessionStorage:{
      candidat_data:JSON.stringify(candidat),
      reponses_data:JSON.stringify({ q1:'1020' }),
      scores_data:JSON.stringify({ page2:5 })
    },
    localStorage:{},
    lastPage:'pageFinale.html',
    lastEvaluationPage:'pageFinale.html'
  };
}

try {
  const unrelated = path.join(usbRoot, 'FICHIER_DEJA_PRESENT.txt');
  fs.writeFileSync(unrelated, 'A CONSERVER', 'utf8');

  configureLocalKey(Buffer.alloc(32, 61));
  const sourceStore = createCandidateStore({ documentsPath:sourceDocuments, userDataPath:sourceUserData, now });
  const saved = sourceStore.saveSnapshot(state());
  assert(saved);
  const done = sourceStore.completeActiveCandidate(state(), 'candidate-final-page');
  assert(done && done.status === 'TERMINE');

  const sourceTransfer = createCandidateTransfer({ documentsPath:sourceDocuments, userDataPath:sourceUserData, now });
  const exported = sourceTransfer.exportAll(usbRoot, password);
  assert.strictEqual(exported.total, 1);
  assert.strictEqual(exported.added, 1);
  assert.strictEqual(exported.destinationRoot, usbRoot);
  assert.strictEqual(fs.readFileSync(unrelated, 'utf8'), 'A CONSERVER');
  const sebFiles = fs.readdirSync(usbRoot).filter((name) => name.toLowerCase().endsWith('.seb'));
  assert.strictEqual(sebFiles.length, 1, 'Un fichier .seb doit être écrit directement à la racine du lecteur.');

  configureLocalKey(Buffer.alloc(32, 62));
  const targetTransfer = createCandidateTransfer({ documentsPath:targetDocuments, userDataPath:targetUserData, now });
  const imported = targetTransfer.importAll(usbRoot, password);
  assert.strictEqual(imported.total, 1);
  assert.strictEqual(imported.added, 1);
  assert.strictEqual(imported.sourceRoot, usbRoot);
  assert.strictEqual(targetTransfer.listCandidateRecords(targetTransfer.paths.candidatesRoot, false).length, 1);

  console.log('WINDOWS_USB_ROOT=' + usbRoot);
  console.log('WINDOWS_USB_ROOT_EXPORT_DIRECT=OK');
  console.log('WINDOWS_USB_ROOT_IMPORT_DIRECT=OK');
  console.log('WINDOWS_USB_ROOT_EXISTING_FILE_PRESERVED=OK');
  console.log('Candidate Windows Drive Root Test: OK');
} finally {
  try {
    for (const entry of fs.readdirSync(usbRoot)) {
      if (entry.toLowerCase().endsWith('.seb') || entry === 'FICHIER_DEJA_PRESENT.txt') {
        fs.rmSync(path.join(usbRoot, entry), { recursive:true, force:true });
      }
    }
  } catch (_) {}
  fs.rmSync(root, { recursive:true, force:true });
}
