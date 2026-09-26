const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCandidateLocalProtection } = require('../src/candidate-local-protection');

function fakeSafeStorage() {
  return {
    isEncryptionAvailable:() => true,
    encryptString:(value) => Buffer.from('FAKE-DPAPI:' + String(value), 'utf8'),
    decryptString:(buffer) => {
      const raw = Buffer.from(buffer).toString('utf8');
      if (!raw.startsWith('FAKE-DPAPI:')) throw new Error('DPAPI invalide');
      return raw.slice('FAKE-DPAPI:'.length);
    }
  };
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seb-evalpro-local-protection-'));
const documentsPath = path.join(root, 'Documents');
const userDataPath = path.join(root, 'AppData');
const dataRoot = path.join(userDataPath, 'storage');

try {
  const first = createCandidateLocalProtection({
    documentsPath,
    userDataPath,
    dataRoot,
    safeStorage:fakeSafeStorage()
  });

  const key1 = first.initializeKey();
  assert(Buffer.isBuffer(key1) && key1.length === 32);
  assert(fs.existsSync(first.paths.primaryKeyPath), 'La clé AppData doit être créée.');
  assert(fs.existsSync(first.paths.backupKeyPath), 'La copie de récupération doit être interne, hors Documents.');
  assert(!first.paths.backupKeyPath.startsWith(path.join(documentsPath, 'SEB EvalPro')), 'La clé ne doit plus être sauvegardée dans Documents.');

  fs.mkdirSync(userDataPath, { recursive:true });
  fs.writeFileSync(first.paths.primaryStatePath, 'SEBLOCAL1:ETAT-CHIFFRE-TEST', 'utf8');
  assert.strictEqual(first.backupState(), true);
  assert(fs.existsSync(first.paths.backupStatePath), 'L’état de reprise doit être sauvegardé dans le stockage interne.');

  const originalKey = Buffer.from(key1);
  key1.fill(0);

  fs.rmSync(first.paths.primaryKeyPath, { force:true });
  fs.rmSync(first.paths.primaryStatePath, { force:true });

  const second = createCandidateLocalProtection({
    documentsPath,
    userDataPath,
    dataRoot,
    safeStorage:fakeSafeStorage()
  });
  const key2 = second.initializeKey();
  assert.deepStrictEqual(key2, originalKey, 'La même clé doit être restaurée depuis la copie interne.');
  assert(fs.existsSync(second.paths.primaryKeyPath), 'La clé principale doit être restaurée.');
  assert.strictEqual(second.restoreStateFromBackupIfNeeded(), true, 'L’état de reprise doit être restauré.');
  key2.fill(0);

  // Reproduit le cas réel 0.3.7 : sauvegarde de clé présente mais illisible.
  fs.rmSync(second.paths.primaryKeyPath, { force:true });
  fs.rmSync(second.paths.primaryStatePath, { force:true });
  fs.rmSync(second.paths.backupStatePath, { force:true });

  const candidateDir = path.join(dataRoot, 'Candidats', 'CAND-TEST');
  fs.mkdirSync(candidateDir, { recursive:true });
  const orphanEncrypted = 'SEBLOCAL1:DONNEE-CHIFFREE-SANS-CLE';
  fs.writeFileSync(path.join(candidateDir, 'manifest.json'), orphanEncrypted, 'utf8');
  fs.writeFileSync(second.paths.backupKeyPath, 'SAUVEGARDE-CLE-ILLISIBLE', 'utf8');

  const third = createCandidateLocalProtection({
    documentsPath,
    userDataPath,
    dataRoot,
    safeStorage:fakeSafeStorage()
  });
  const key3 = third.initializeKey();
  assert(Buffer.isBuffer(key3) && key3.length === 32, 'Une nouvelle clé doit permettre au programme de continuer.');
  assert(fs.existsSync(third.paths.primaryKeyPath), 'La nouvelle clé principale doit être créée.');
  assert(fs.existsSync(third.paths.backupKeyPath), 'La nouvelle copie interne doit être créée.');
  assert.strictEqual(
    fs.readFileSync(path.join(candidateDir, 'manifest.json'), 'utf8'),
    orphanEncrypted,
    'La donnée chiffrée ancienne doit rester strictement intacte.'
  );
  const recoveryDir = path.join(dataRoot, 'System', 'Recovery');
  assert(fs.existsSync(recoveryDir), 'La clé illisible doit être conservée en récupération.');
  assert(
    fs.readdirSync(recoveryDir).some((name) => name.startsWith('backup-key-unreadable-')),
    'La sauvegarde de clé illisible doit être archivée et non supprimée.'
  );
  key3.fill(0);

  console.log('CANDIDATE_KEY_INTERNAL_BACKUP_RESTORE=OK');
  console.log('CANDIDATE_STATE_INTERNAL_BACKUP_RESTORE=OK');
  console.log('UNREADABLE_BACKUP_KEY_DOES_NOT_BLOCK_APP=OK');
  console.log('ORPHAN_ENCRYPTED_CANDIDATE_PRESERVED=OK');
  console.log('Candidate Local Protection Test: OK');
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
