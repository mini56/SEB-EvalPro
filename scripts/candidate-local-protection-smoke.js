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

try {
  const first = createCandidateLocalProtection({
    documentsPath,
    userDataPath,
    safeStorage:fakeSafeStorage()
  });

  const key1 = first.initializeKey();
  assert(Buffer.isBuffer(key1) && key1.length === 32);
  assert(fs.existsSync(first.paths.primaryKeyPath), 'La clé AppData doit être créée.');
  assert(fs.existsSync(first.paths.backupKeyPath), 'La copie durable de la clé doit être créée dans Documents.');

  fs.mkdirSync(userDataPath, { recursive:true });
  fs.writeFileSync(first.paths.primaryStatePath, 'SEBLOCAL1:ETAT-CHIFFRE-TEST', 'utf8');
  assert.strictEqual(first.backupState(), true);
  assert(fs.existsSync(first.paths.backupStatePath), 'L’état de reprise doit être sauvegardé dans Documents.');

  const originalKey = Buffer.from(key1);
  key1.fill(0);

  // Simulation de l'ancien désinstalleur 0.3.5 : AppData disparaît.
  fs.rmSync(first.paths.primaryKeyPath, { force:true });
  fs.rmSync(first.paths.primaryStatePath, { force:true });

  const second = createCandidateLocalProtection({
    documentsPath,
    userDataPath,
    safeStorage:fakeSafeStorage()
  });
  const key2 = second.initializeKey();
  assert.deepStrictEqual(key2, originalKey, 'La même clé doit être restaurée depuis Documents.');
  assert(fs.existsSync(second.paths.primaryKeyPath), 'La clé AppData doit être restaurée.');
  assert.strictEqual(second.restoreStateFromBackupIfNeeded(), true, 'L’état de reprise doit être restauré.');
  assert.strictEqual(fs.readFileSync(second.paths.primaryStatePath, 'utf8'), 'SEBLOCAL1:ETAT-CHIFFRE-TEST');
  key2.fill(0);

  // Aucune nouvelle clé ne doit être créée si des données chiffrées existent
  // mais que toutes les copies de la clé ont disparu.
  fs.rmSync(second.paths.primaryKeyPath, { force:true });
  fs.rmSync(second.paths.backupKeyPath, { force:true });
  fs.rmSync(second.paths.primaryStatePath, { force:true });
  fs.rmSync(second.paths.backupStatePath, { force:true });

  const candidateDir = path.join(documentsPath, 'SEB EvalPro', 'Candidats', 'CAND-TEST');
  fs.mkdirSync(candidateDir, { recursive:true });
  fs.writeFileSync(path.join(candidateDir, 'manifest.json'), 'SEBLOCAL1:DONNEE-CHIFFREE-SANS-CLE', 'utf8');

  const third = createCandidateLocalProtection({
    documentsPath,
    userDataPath,
    safeStorage:fakeSafeStorage()
  });
  assert.throws(
    () => third.initializeKey(),
    /aucune nouvelle clé|données chiffrées existent/i,
    'Une clé perdue ne doit jamais être remplacée silencieusement.'
  );
  assert.strictEqual(fs.existsSync(third.paths.primaryKeyPath), false, 'Aucune nouvelle clé ne doit être générée en présence de données chiffrées orphelines.');

  console.log('CANDIDATE_KEY_BACKUP_RESTORE=OK');
  console.log('CANDIDATE_STATE_BACKUP_RESTORE=OK');
  console.log('CANDIDATE_MISSING_KEY_FAIL_CLOSED=OK');
  console.log('Candidate Local Protection Test: OK');
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
