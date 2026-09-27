const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOCAL_PREFIX = 'SEBLOCAL1:';
const LOCAL_AAD = Buffer.from('SEB-EvalPro/local-json/v1', 'utf8');
let localKey = null;

function configureLocalKey(key) {
  const buffer = Buffer.isBuffer(key) ? Buffer.from(key) : Buffer.from(String(key || ''), 'base64');
  if (buffer.length !== 32) throw new Error('Clé locale SEB EvalPro invalide.');
  localKey = buffer;
  return true;
}

function clearLocalKey() {
  if (localKey) localKey.fill(0);
  localKey = null;
}

function hasLocalKey() {
  return Buffer.isBuffer(localKey) && localKey.length === 32;
}

function requireLocalKey() {
  if (!hasLocalKey()) throw new Error('Protection locale des données candidat non initialisée.');
  return localKey;
}

function encryptLocalBuffer(plain) {
  const key = requireLocalKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(LOCAL_AAD);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(plain)), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

function decryptLocalBuffer(payload) {
  const key = requireLocalKey();
  const buffer = Buffer.from(payload);
  if (buffer.length < 29) throw new Error('Donnée candidat chiffrée invalide.');
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(LOCAL_AAD);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function encodeJson(value) {
  const plain = Buffer.from(JSON.stringify(value, null, 2), 'utf8');
  if (!hasLocalKey()) return plain.toString('utf8');
  return LOCAL_PREFIX + encryptLocalBuffer(plain).toString('base64');
}

function decodeJsonText(text) {
  const raw = String(text == null ? '' : text);
  if (!raw.startsWith(LOCAL_PREFIX)) return JSON.parse(raw);
  const payload = Buffer.from(raw.slice(LOCAL_PREFIX.length), 'base64');
  const plain = decryptLocalBuffer(payload).toString('utf8');
  return JSON.parse(plain);
}

function readJsonFile(target) {
  try {
    return decodeJsonText(fs.readFileSync(target, 'utf8'));
  } catch (_) {
    return null;
  }
}

function atomicWriteText(target, text) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = target + '.seb-secure-' + process.pid + '-' + Date.now() + '.tmp';
  fs.writeFileSync(temp, text, 'utf8');
  fs.renameSync(temp, target);
}

function writeJsonFile(target, value) {
  atomicWriteText(target, encodeJson(value));
  return target;
}

function isEncryptedJsonFile(target) {
  try {
    const raw = fs.readFileSync(target, 'utf8');
    return raw.startsWith(LOCAL_PREFIX);
  } catch (_) {
    return false;
  }
}

function migrateJsonFile(target) {
  if (!hasLocalKey() || !fs.existsSync(target) || isEncryptedJsonFile(target)) return false;
  const value = readJsonFile(target);
  if (value == null) return false;
  writeJsonFile(target, value);
  return true;
}

function migrateJsonTree(root) {
  if (!hasLocalKey() || !root || !fs.existsSync(root)) return { files: 0 };
  let files = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) continue;
      if (migrateJsonFile(full)) files += 1;
    }
  };
  walk(root);
  return { files };
}

module.exports = {
  LOCAL_PREFIX,
  configureLocalKey,
  clearLocalKey,
  hasLocalKey,
  encodeJson,
  decodeJsonText,
  readJsonFile,
  writeJsonFile,
  isEncryptedJsonFile,
  migrateJsonFile,
  migrateJsonTree
};
