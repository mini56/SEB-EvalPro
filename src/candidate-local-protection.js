const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOCAL_PREFIX = 'SEBLOCAL1:';

function createCandidateLocalProtection(options = {}) {
  const documentsPath = options.documentsPath;
  const userDataPath = options.userDataPath;
  const dataRoot = options.dataRoot || (documentsPath ? path.join(documentsPath, 'SEB EvalPro') : null);
  const safeStorage = options.safeStorage;
  const cryptoModule = options.cryptoModule || crypto;

  if (!dataRoot) throw new Error('dataRoot requis');
  if (!userDataPath) throw new Error('userDataPath requis');
  if (!safeStorage) throw new Error('safeStorage requis');

  const sebRoot = dataRoot;
  const candidatesRoot = path.join(sebRoot, 'Candidats');
  const systemRoot = path.join(sebRoot, 'System');
  const primaryKeyPath = path.join(userDataPath, 'candidate-local-key.sebkey');
  const backupKeyPath = path.join(systemRoot, 'candidate-local-key.sebkey');
  const primaryStatePath = path.join(userDataPath, 'evaluation-state.json');
  const backupStatePath = path.join(systemRoot, 'evaluation-state.json');

  function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive:true });
    return dir;
  }

  function atomicWrite(target, data, encoding = undefined) {
    ensureDir(path.dirname(target));
    const temp = target + '.seb-protect-' + process.pid + '-' + Date.now() + '.tmp';
    if (encoding) fs.writeFileSync(temp, data, encoding);
    else fs.writeFileSync(temp, data);
    fs.renameSync(temp, target);
  }

  function copyAtomic(source, target) {
    if (!source || !target || !fs.existsSync(source)) return false;
    const data = fs.readFileSync(source);
    atomicWrite(target, data);
    return true;
  }

  function protectedWrapperForKey(key) {
    const protectedBytes = safeStorage.encryptString(Buffer.from(key).toString('base64'));
    return {
      schemaVersion:1,
      protection:'Windows safeStorage/DPAPI',
      protectedKey:protectedBytes.toString('base64'),
      createdAt:new Date().toISOString()
    };
  }

  function writeProtectedKey(target, key) {
    atomicWrite(target, JSON.stringify(protectedWrapperForKey(key), null, 2), 'utf8');
  }

  function loadProtectedKey(target) {
    const wrapper = JSON.parse(fs.readFileSync(target, 'utf8'));
    const protectedBytes = Buffer.from(String(wrapper.protectedKey || ''), 'base64');
    const keyBase64 = safeStorage.decryptString(protectedBytes);
    const key = Buffer.from(keyBase64, 'base64');
    if (key.length !== 32) throw new Error('Clé locale SEB EvalPro invalide.');
    return key;
  }

  function fileStartsEncrypted(target) {
    try {
      const fd = fs.openSync(target, 'r');
      const probe = Buffer.alloc(LOCAL_PREFIX.length);
      const bytes = fs.readSync(fd, probe, 0, probe.length, 0);
      fs.closeSync(fd);
      return bytes === probe.length && probe.toString('utf8') === LOCAL_PREFIX;
    } catch (_) {
      return false;
    }
  }

  function encryptedCandidateDataExists() {
    if (fileStartsEncrypted(primaryStatePath) || fileStartsEncrypted(backupStatePath)) return true;
    if (!fs.existsSync(candidatesRoot)) return false;
    const stack = [candidatesRoot];
    while (stack.length) {
      const dir = stack.pop();
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes:true }); } catch (_) { continue; }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
          continue;
        }
        if (entry.isFile() && entry.name.toLowerCase().endsWith('.json') && fileStartsEncrypted(full)) return true;
      }
    }
    return false;
  }

  function initializeKey() {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('La protection Windows des données candidat n’est pas disponible sur ce poste.');
    }

    ensureDir(userDataPath);
    ensureDir(systemRoot);

    let key = null;
    let primaryError = null;

    if (fs.existsSync(primaryKeyPath)) {
      try {
        key = loadProtectedKey(primaryKeyPath);
      } catch (error) {
        primaryError = error;
      }
    }

    if (!key && fs.existsSync(backupKeyPath)) {
      try {
        key = loadProtectedKey(backupKeyPath);
        copyAtomic(backupKeyPath, primaryKeyPath);
      } catch (backupError) {
        if (primaryError) {
          throw new Error('Les deux copies de la clé locale candidat sont illisibles sur ce PC.');
        }
        throw new Error('La sauvegarde de la clé locale candidat est illisible sur ce PC.');
      }
    }

    if (!key) {
      if (fs.existsSync(primaryKeyPath) || encryptedCandidateDataExists()) {
        throw new Error(
          'Clé locale candidat absente ou illisible alors que des données chiffrées existent. ' +
          'SEB EvalPro n’a créé aucune nouvelle clé afin de ne pas rendre les dossiers candidats irrécupérables.'
        );
      }
      key = cryptoModule.randomBytes(32);
      writeProtectedKey(primaryKeyPath, key);
      copyAtomic(primaryKeyPath, backupKeyPath);
    } else {
      // La copie Documents est la sauvegarde de récupération durable du même poste Windows.
      copyAtomic(primaryKeyPath, backupKeyPath);
    }

    return Buffer.from(key);
  }

  function restoreStateFromBackupIfNeeded() {
    if (!fs.existsSync(primaryStatePath) && fs.existsSync(backupStatePath)) {
      return copyAtomic(backupStatePath, primaryStatePath);
    }
    return false;
  }

  function backupState() {
    if (!fs.existsSync(primaryStatePath)) return false;
    return copyAtomic(primaryStatePath, backupStatePath);
  }

  return {
    initializeKey,
    restoreStateFromBackupIfNeeded,
    backupState,
    encryptedCandidateDataExists,
    paths:{
      sebRoot,
      candidatesRoot,
      systemRoot,
      primaryKeyPath,
      backupKeyPath,
      primaryStatePath,
      backupStatePath
    }
  };
}

module.exports = { createCandidateLocalProtection };
