const fs = require('fs');
const path = require('path');

function readJson(target) {
  try { return JSON.parse(fs.readFileSync(target, 'utf8')); }
  catch (_) { return null; }
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
  return target;
}

function normalize(value) {
  let text = String(value == null ? '' : value).trim();
  try { text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
  return text.toLocaleLowerCase('fr-FR').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function sanitize(value, fallback = 'INCONNU') {
  let text = String(value == null ? '' : value).trim();
  try { text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
  text = text.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  return text || fallback;
}

function candidateObject(source) {
  const c = source && typeof source === 'object' ? source : {};
  return {
    nom: String(c.nom || '').trim(),
    prenom: String(c.prenom || c['prénom'] || '').trim(),
    lieu: String(c.lieu || c.ville || '').trim(),
    groupe: String(c.groupe || '').trim(),
    date: String(c.date || c.dateTest || '').trim()
  };
}

function candidateFromManifest(manifest) {
  return candidateObject(manifest && manifest.candidat);
}

function standardFolderName(candidate) {
  const c = candidateObject(candidate);
  return [
    sanitize(c.nom, 'NOM').toUpperCase(),
    sanitize(c.prenom, 'PRENOM'),
    sanitize(c.lieu, 'VILLE'),
    sanitize(c.groupe, 'GROUPE')
  ].join('_');
}

function uniqueFolderPath(parent, baseName) {
  let target = path.join(parent, baseName);
  let index = 2;
  while (fs.existsSync(target)) {
    target = path.join(parent, `${baseName}_${index}`);
    index += 1;
  }
  return target;
}

function listCandidateDirs(root, recursive = false) {
  const results = [];
  if (!root || !fs.existsSync(root)) return results;
  const walk = (dir, depth) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      const manifest = readJson(path.join(full, 'manifest.json'));
      if (manifest && String(manifest.candidateId || '').trim()) {
        results.push({
          candidateId: String(manifest.candidateId).trim(),
          candidateDir: full,
          folderName: entry.name,
          manifest,
          candidate: candidateFromManifest(manifest)
        });
        continue;
      }
      if (recursive && depth < 5) walk(full, depth + 1);
    }
  };
  walk(root, 0);
  return results;
}

function scoreCandidateMatch(record, candidate) {
  const a = candidateObject(record && (record.candidate || (record.manifest && record.manifest.candidat)));
  const b = candidateObject(candidate);
  if (!normalize(a.nom) || !normalize(a.prenom)) return -1;
  if (normalize(a.nom) !== normalize(b.nom) || normalize(a.prenom) !== normalize(b.prenom)) return -1;
  let score = 10;
  for (const key of ['date', 'lieu', 'groupe']) {
    const av = normalize(a[key]);
    const bv = normalize(b[key]);
    if (av && bv) score += av === bv ? 3 : -2;
  }
  return score;
}

function selectCandidate(records, candidate) {
  const scored = (records || [])
    .map((record) => ({ record, score: scoreCandidateMatch(record, candidate) }))
    .filter((item) => item.score >= 10)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  if (scored.length === 1) return scored[0].record;
  if (scored[0].score > scored[1].score) return scored[0].record;
  return null;
}

function findCandidateDir(documentsPath, candidate) {
  const root = path.join(documentsPath, 'SEB EvalPro');
  const current = listCandidateDirs(path.join(root, 'Candidats'), false);
  const selectedCurrent = selectCandidate(current, candidate);
  if (selectedCurrent) return selectedCurrent.candidateDir;
  const legacy = listCandidateDirs(path.join(root, 'Admin'), true);
  const selectedLegacy = selectCandidate(legacy, candidate);
  return selectedLegacy ? selectedLegacy.candidateDir : null;
}

function copyDirectoryAtomically(sourceDir, targetDir) {
  ensureDir(path.dirname(targetDir));
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const temp = path.join(path.dirname(targetDir), `.${path.basename(targetDir)}.seb-copy-${token}`);
  const backup = path.join(path.dirname(targetDir), `.${path.basename(targetDir)}.seb-backup-${token}`);
  fs.cpSync(sourceDir, temp, { recursive: true, force: true, errorOnExist: false, preserveTimestamps: true });
  let hadTarget = false;
  try {
    if (fs.existsSync(targetDir)) {
      fs.renameSync(targetDir, backup);
      hadTarget = true;
    }
    fs.renameSync(temp, targetDir);
    if (hadTarget) fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    try { if (fs.existsSync(temp)) fs.rmSync(temp, { recursive: true, force: true }); } catch (_) {}
    try { if (hadTarget && !fs.existsSync(targetDir) && fs.existsSync(backup)) fs.renameSync(backup, targetDir); } catch (_) {}
    throw error;
  }
}

function copyFileIfMissing(source, target) {
  if (!fs.existsSync(source) || fs.existsSync(target)) return false;
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
  return true;
}

function copyDirectoryIfMissing(source, target) {
  if (!fs.existsSync(source) || fs.existsSync(target)) return false;
  ensureDir(path.dirname(target));
  fs.cpSync(source, target, { recursive: true, force: false, errorOnExist: true, preserveTimestamps: true });
  return true;
}

function deletionIndexPath(documentsPath) {
  return path.join(documentsPath, 'SEB EvalPro', 'Corbeille', 'deleted-candidate-ids.json');
}

function readDeletedIds(documentsPath) {
  const value = readJson(deletionIndexPath(documentsPath));
  return new Set(Array.isArray(value) ? value.map((v) => String(v)) : []);
}

function writeDeletedIds(documentsPath, ids) {
  const target = deletionIndexPath(documentsPath);
  ensureDir(path.dirname(target));
  const temp = target + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(Array.from(ids).sort(), null, 2), 'utf8');
  fs.renameSync(temp, target);
}

function markDeleted(documentsPath, candidateId) {
  const ids = readDeletedIds(documentsPath);
  ids.add(String(candidateId || ''));
  writeDeletedIds(documentsPath, ids);
}

function unmarkDeleted(documentsPath, candidateId) {
  const ids = readDeletedIds(documentsPath);
  ids.delete(String(candidateId || ''));
  writeDeletedIds(documentsPath, ids);
}

module.exports = {
  readJson,
  ensureDir,
  normalize,
  sanitize,
  candidateObject,
  candidateFromManifest,
  standardFolderName,
  uniqueFolderPath,
  listCandidateDirs,
  selectCandidate,
  findCandidateDir,
  copyDirectoryAtomically,
  copyFileIfMissing,
  copyDirectoryIfMissing,
  readDeletedIds,
  markDeleted,
  unmarkDeleted
};
