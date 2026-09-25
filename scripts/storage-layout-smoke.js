const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { migrateLegacyDocumentsStorage, internalStorageRoot, documentsWordRoot } = require('../src/storage-layout');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seb-evalpro-storage-layout-'));
const documentsPath = path.join(root, 'Documents');
const userDataPath = path.join(root, 'UserData');
const docsRoot = documentsWordRoot(documentsPath);
const internalRoot = internalStorageRoot(userDataPath);

try {
  const files = {
    [path.join(docsRoot, 'System', 'candidate-local-key.sebkey')]:'old-key',
    [path.join(docsRoot, 'Candidats', 'CAND-TEST', 'manifest.json')]:'old-candidate',
    [path.join(docsRoot, 'parcours', 'old.json')]:'old-replay',
    [path.join(docsRoot, 'Corbeille', 'old.json')]:'old-trash',
    [path.join(docsRoot, 'Admin', 'old.json')]:'old-admin',
    [path.join(docsRoot, 'Bilans', 'Historique', 'old.json')]:'old-bilan',
    [path.join(docsRoot, 'Bilans', 'Evaluation_TEST.docx')]:'word-one',
    [path.join(docsRoot, 'Candidats', 'CAND-TEST', 'bilan', 'exports', 'Evaluation_TEST_2.docx')]:'word-two',
    [path.join(docsRoot, 'ancienne-note.txt')]:'legacy-note',
    [path.join(docsRoot, 'AutreDossier', 'trace.dat')]:'unknown-legacy'
  };

  for (const [file, value] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(file), { recursive:true });
    fs.writeFileSync(file, value, 'utf8');
  }

  const result = migrateLegacyDocumentsStorage({ documentsPath, userDataPath });
  assert.strictEqual(result.completed, true, 'La migration 0.3.8 doit se terminer sans reste technique dans Documents.');

  const visible = fs.readdirSync(docsRoot, { withFileTypes:true });
  assert(visible.length >= 2, 'Les exports Word doivent rester visibles.');
  assert(visible.every((entry) => entry.isFile() && /\.docx?$/i.test(entry.name)), 'Documents\\SEB EvalPro doit contenir uniquement des Word.');

  for (const dir of ['System','Candidats','parcours','Corbeille','Admin','Bilans']) {
    assert(fs.existsSync(path.join(internalRoot, dir)), dir + ' doit être migré dans le stockage interne.');
    assert.strictEqual(fs.existsSync(path.join(docsRoot, dir)), false, dir + ' ne doit plus exister dans Documents.');
  }

  assert(fs.existsSync(path.join(internalRoot, 'LegacyDocuments', '_root', 'ancienne-note.txt')), 'Les fichiers racine non Word doivent être conservés en interne.');
  assert(fs.existsSync(path.join(internalRoot, 'LegacyDocuments', 'AutreDossier', 'trace.dat')), 'Les dossiers inconnus doivent être conservés en interne avant suppression de Documents.');

  const second = migrateLegacyDocumentsStorage({ documentsPath, userDataPath });
  assert.strictEqual(second.completed, true, 'La migration doit être idempotente.');
  assert(fs.readdirSync(docsRoot, { withFileTypes:true }).every((entry) => entry.isFile() && /\.docx?$/i.test(entry.name)));

  console.log('DOCUMENTS_WORD_ONLY_AFTER_MIGRATION=OK');
  console.log('TECHNICAL_FOLDERS_MOVED_INTERNAL=OK');
  console.log('UNKNOWN_LEGACY_CONTENT_PRESERVED_INTERNAL=OK');
  console.log('Storage Layout 0.3.8 Test: OK');
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
