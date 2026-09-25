const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TECHNICAL_DIRS = new Set([
  'candidats',
  'system',
  'admin',
  'parcours',
  'corbeille',
  'bilans',
  'bilan',
  'replay',
  'resultats',
  'donnees'
]);

function ensureDir(target) {
  fs.mkdirSync(target, { recursive:true });
  return target;
}

function sha256(target) {
  return crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
}

function sameFile(a, b) {
  try {
    return fs.statSync(a).size === fs.statSync(b).size && sha256(a) === sha256(b);
  } catch (_) {
    return false;
  }
}

function uniqueFilePath(directory, filename) {
  const parsed = path.parse(filename);
  let target = path.join(directory, filename);
  let index = 2;
  while (fs.existsSync(target)) {
    target = path.join(directory, parsed.name + '_' + index + parsed.ext);
    index += 1;
  }
  return target;
}

function copyFilePreserving(source, target, conflictRoot, relativeName) {
  ensureDir(path.dirname(target));
  if (!fs.existsSync(target)) {
    fs.copyFileSync(source, target);
    if (!sameFile(source, target)) throw new Error('Vérification de migration échouée : ' + source);
    return { copied:1, conflict:0 };
  }
  if (sameFile(source, target)) return { copied:0, conflict:0 };

  const conflictBase = path.join(conflictRoot, relativeName);
  ensureDir(path.dirname(conflictBase));
  const conflictTarget = uniqueFilePath(path.dirname(conflictBase), path.basename(conflictBase));
  fs.copyFileSync(source, conflictTarget);
  if (!sameFile(source, conflictTarget)) throw new Error('Vérification de sauvegarde de conflit échouée : ' + source);
  return { copied:0, conflict:1 };
}

function mergeTree(sourceRoot, targetRoot, conflictRoot, relativeRoot = '') {
  let copied = 0;
  let conflicts = 0;
  if (!fs.existsSync(sourceRoot)) return { copied, conflicts };

  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes:true })) {
    const source = path.join(sourceRoot, entry.name);
    const relative = path.join(relativeRoot, entry.name);
    const target = path.join(targetRoot, entry.name);
    if (entry.isDirectory()) {
      ensureDir(target);
      const nested = mergeTree(source, target, conflictRoot, relative);
      copied += nested.copied;
      conflicts += nested.conflicts;
      continue;
    }
    if (!entry.isFile()) continue;
    const result = copyFilePreserving(source, target, conflictRoot, relative);
    copied += result.copied;
    conflicts += result.conflict;
  }
  return { copied, conflicts };
}

function collectWordExports(root) {
  const files = [];
  if (!root || !fs.existsSync(root)) return files;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && /\.docx?$/i.test(entry.name)) {
        files.push(full);
      }
    }
  };
  walk(root);
  return files;
}

function preserveWordAtRoot(source, documentsRoot) {
  if (path.dirname(source) === documentsRoot) return false;
  const filename = path.basename(source);
  let target = path.join(documentsRoot, filename);
  if (fs.existsSync(target)) {
    if (sameFile(source, target)) return false;
    target = uniqueFilePath(documentsRoot, filename);
  }
  fs.copyFileSync(source, target);
  if (!sameFile(source, target)) throw new Error('Vérification export Word échouée : ' + source);
  return true;
}

function internalStorageRoot(userDataPath) {
  return path.join(userDataPath, 'storage');
}

function documentsWordRoot(documentsPath) {
  return path.join(documentsPath, 'SEB EvalPro');
}

function migrateLegacyDocumentsStorage({ documentsPath, userDataPath }) {
  if (!documentsPath || !userDataPath) throw new Error('Chemins de migration SEB EvalPro incomplets.');

  const legacyRoot = documentsWordRoot(documentsPath);
  const internalRoot = internalStorageRoot(userDataPath);
  const conflictRoot = path.join(internalRoot, 'MigrationConflicts');
  const legacyMiscRoot = path.join(internalRoot, 'LegacyDocuments');
  const result = {
    copied:0,
    conflicts:0,
    wordExports:0,
    removedDirectories:0,
    removedFiles:0,
    remaining:[],
    errors:[]
  };

  ensureDir(internalRoot);
  ensureDir(legacyRoot);

  // Phase 1 : copier et vérifier TOUT avant de supprimer quoi que ce soit
  // dans Documents. Une erreur laisse l'ancien stockage entièrement présent.
  try {
    for (const word of collectWordExports(legacyRoot)) {
      if (preserveWordAtRoot(word, legacyRoot)) result.wordExports += 1;
    }

    const entries = fs.readdirSync(legacyRoot, { withFileTypes:true });
    for (const entry of entries) {
      const source = path.join(legacyRoot, entry.name);

      if (entry.isDirectory()) {
        const normalized = entry.name.toLocaleLowerCase('fr-FR');
        const target = TECHNICAL_DIRS.has(normalized)
          ? path.join(internalRoot, entry.name)
          : path.join(legacyMiscRoot, entry.name);
        ensureDir(target);
        const merged = mergeTree(source, target, conflictRoot, entry.name);
        result.copied += merged.copied;
        result.conflicts += merged.conflicts;
        continue;
      }

      if (!entry.isFile() || /\.docx?$/i.test(entry.name)) continue;
      const target = path.join(legacyMiscRoot, '_root', entry.name);
      const merged = copyFilePreserving(source, target, conflictRoot, path.join('_root', entry.name));
      result.copied += merged.copied;
      result.conflicts += merged.conflict;
    }
  } catch (error) {
    result.errors.push(error && error.message ? error.message : String(error));
    return { ...result, legacyRoot, internalRoot, completed:false };
  }

  // Phase 2 : seulement après vérification complète, retirer de Documents
  // tout ce qui n'est pas un export Word.
  for (const entry of fs.readdirSync(legacyRoot, { withFileTypes:true })) {
    const target = path.join(legacyRoot, entry.name);
    try {
      if (entry.isDirectory()) {
        fs.rmSync(target, { recursive:true, force:true });
        result.removedDirectories += 1;
      } else if (entry.isFile() && !/\.docx?$/i.test(entry.name)) {
        fs.rmSync(target, { force:true });
        result.removedFiles += 1;
      }
    } catch (error) {
      result.errors.push(error && error.message ? error.message : String(error));
      result.remaining.push(target);
    }
  }

  for (const entry of fs.readdirSync(legacyRoot, { withFileTypes:true })) {
    if (entry.isDirectory() || (entry.isFile() && !/\.docx?$/i.test(entry.name))) {
      result.remaining.push(path.join(legacyRoot, entry.name));
    }
  }

  return {
    ...result,
    legacyRoot,
    internalRoot,
    completed:result.remaining.length === 0 && result.errors.length === 0
  };
}

module.exports = {
  internalStorageRoot,
  documentsWordRoot,
  migrateLegacyDocumentsStorage
};
