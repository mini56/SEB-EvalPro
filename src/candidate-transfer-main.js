const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  readJson,
  ensureDir,
  normalize,
  standardFolderName,
  uniqueFolderPath,
  listCandidateDirs,
  selectCandidate,
  copyFileIfMissing,
  copyDirectoryIfMissing
} = require('./candidate-folder-utils');

function createCandidateTransfer(options = {}) {
  const documentsPath = options.documentsPath;
  const now = typeof options.now === 'function' ? options.now : () => new Date();
  if (!documentsPath) throw new Error('documentsPath requis');

  const sebRoot = path.join(documentsPath, 'SEB EvalPro');
  const candidatesRoot = path.join(sebRoot, 'Candidats');
  const legacyAdminRoot = path.join(sebRoot, 'Admin');
  const globalReplayRoot = path.join(sebRoot, 'parcours');
  const globalBilanRoot = path.join(sebRoot, 'Bilans', 'Historique');
  const requiredDirs = ['donnees', 'resultats', 'replay', path.join('bilan','historique'), path.join('bilan','exports')];
  const requiredFiles = [
    'manifest.json',
    path.join('donnees', 'candidat.json'),
    path.join('donnees', 'evaluation-state.json'),
    path.join('donnees', 'progression.json'),
    path.join('resultats', 'reponses.json'),
    path.join('resultats', 'scores.json')
  ];

  function writeJson(target, value) {
    ensureDir(path.dirname(target));
    const temp = target + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(temp, target);
  }

  function ensureCandidateShape(dir) {
    for (const rel of requiredDirs) ensureDir(path.join(dir, rel));
  }

  function identityKey(candidate) {
    const c = candidate || {};
    return [c.nom, c.prenom || c['prénom'], c.lieu || c.ville, c.groupe].map(normalize).join('|');
  }

  function sameCandidate(a, b) {
    if (!a || !b) return false;
    if (a.candidateId && b.candidateId && String(a.candidateId) === String(b.candidateId)) return true;
    const ka = identityKey(a.candidate);
    const kb = identityKey(b.candidate);
    return !!ka && ka === kb && ka.split('|').every(Boolean);
  }

  function candidateShapeValid(record) {
    if (!record || !record.candidateDir || !record.candidateId) return false;
    const c = record.candidate || {};
    if (![c.nom, c.prenom || c['prénom'], c.lieu || c.ville, c.groupe].every((v) => normalize(v))) return false;
    const manifest = readJson(path.join(record.candidateDir, 'manifest.json'));
    if (!manifest || String(manifest.candidateId || '') !== String(record.candidateId)) return false;
    const dirsOk = requiredDirs.every((rel) => {
      try { return fs.statSync(path.join(record.candidateDir, rel)).isDirectory(); }
      catch (_) { return false; }
    });
    if (!dirsOk) return false;
    return requiredFiles.every((rel) => {
      try { return fs.statSync(path.join(record.candidateDir, rel)).isFile(); }
      catch (_) { return false; }
    });
  }

  function hashFile(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  }

  function inventory(root) {
    const out = [];
    function walk(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes:true }).sort((a,b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(root, full).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          out.push({ type:'dir', rel });
          walk(full);
        } else if (entry.isFile()) {
          const stat = fs.statSync(full);
          out.push({ type:'file', rel, size:stat.size, sha256:hashFile(full) });
        }
      }
    }
    walk(root);
    return out;
  }

  function verifyExactCopy(sourceDir, copiedDir) {
    const source = inventory(sourceDir);
    const copy = inventory(copiedDir);
    if (source.length !== copy.length) throw new Error('Vérification USB échouée : nombre de fichiers ou dossiers différent.');
    for (let i = 0; i < source.length; i += 1) {
      const a = source[i], b = copy[i];
      if (a.type !== b.type || a.rel !== b.rel) throw new Error('Vérification USB échouée : contenu différent (' + a.rel + ').');
      if (a.type === 'file' && (a.size !== b.size || a.sha256 !== b.sha256)) {
        throw new Error('Vérification USB échouée : fichier altéré ou incomplet (' + a.rel + ').');
      }
    }
    return { entries:source.length, files:source.filter((e) => e.type === 'file').length };
  }

  function copyVerifiedAtomic(sourceDir, targetDir) {
    ensureDir(path.dirname(targetDir));
    if (fs.existsSync(targetDir)) throw new Error('Le dossier destination existe déjà : aucune donnée ne sera écrasée.');
    const token = String(process.pid) + '-' + Date.now() + '-' + Math.random().toString(16).slice(2,8);
    const temp = path.join(path.dirname(targetDir), '.' + path.basename(targetDir) + '.seb-copy-' + token);
    try {
      fs.cpSync(sourceDir, temp, { recursive:true, force:false, errorOnExist:true, preserveTimestamps:true });
      const verified = verifyExactCopy(sourceDir, temp);
      fs.renameSync(temp, targetDir);
      verifyExactCopy(sourceDir, targetDir);
      return verified;
    } catch (error) {
      try { if (fs.existsSync(temp)) fs.rmSync(temp, { recursive:true, force:true }); } catch (_) {}
      throw error;
    }
  }

  function migrateLegacyAdmin() {
    ensureDir(candidatesRoot);
    const current = listCandidateDirs(candidatesRoot, false);
    let added = 0;
    for (const legacy of listCandidateDirs(legacyAdminRoot, true)) {
      if (!candidateShapeValid(legacy)) continue;
      if (current.some((r) => sameCandidate(r, legacy))) continue;
      const base = standardFolderName(legacy.candidate);
      const target = fs.existsSync(path.join(candidatesRoot, base)) ? uniqueFolderPath(candidatesRoot, base) : path.join(candidatesRoot, base);
      copyVerifiedAtomic(legacy.candidateDir, target);
      ensureCandidateShape(target);
      const manifest = readJson(path.join(target, 'manifest.json')) || {};
      writeJson(path.join(target, 'manifest.json'), { ...manifest, folderName:path.basename(target), migratedFrom:legacy.candidateDir });
      const migrated = listCandidateDirs(candidatesRoot, false).find((r) => String(r.candidateId) === String(legacy.candidateId));
      if (migrated) current.push(migrated);
      added += 1;
    }
    return added;
  }

  function replayCandidate(source) {
    try {
      const stat = fs.statSync(source);
      if (stat.isDirectory()) {
        const m = readJson(path.join(source, 'manifest.json'));
        return m && m.candidate ? m.candidate : null;
      }
      if (stat.isFile() && source.toLowerCase().endsWith('.json')) {
        const a = readJson(source);
        return a && a.candidate ? a.candidate : null;
      }
    } catch (_) {}
    return null;
  }

  function syncGlobalArtifactsIntoCandidates() {
    ensureDir(globalReplayRoot);
    ensureDir(globalBilanRoot);
    const records = listCandidateDirs(candidatesRoot, false);
    records.forEach((r) => ensureCandidateShape(r.candidateDir));

    for (const entry of fs.readdirSync(globalReplayRoot, { withFileTypes:true })) {
      const source = path.join(globalReplayRoot, entry.name);
      const candidate = replayCandidate(source);
      if (!candidate) continue;
      const match = selectCandidate(records, candidate);
      if (!match) continue;
      const target = path.join(match.candidateDir, 'replay', entry.name);
      if (entry.isDirectory()) copyDirectoryIfMissing(source, target);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) copyFileIfMissing(source, target);
    }

    for (const entry of fs.readdirSync(globalBilanRoot, { withFileTypes:true })) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) continue;
      const source = path.join(globalBilanRoot, entry.name);
      const archive = readJson(source);
      if (!archive || !archive.candidate) continue;
      const match = selectCandidate(records, archive.candidate);
      if (!match) continue;
      copyFileIfMissing(source, path.join(match.candidateDir, 'bilan', 'historique', entry.name));
    }
  }

  function prepareCandidates() {
    const migrated = migrateLegacyAdmin();
    syncGlobalArtifactsIntoCandidates();
    return migrated;
  }

  function chooseTargetName(record, destinationRoot) {
    const base = standardFolderName(record.candidate);
    return fs.existsSync(path.join(destinationRoot, base)) ? uniqueFolderPath(destinationRoot, base) : path.join(destinationRoot, base);
  }

  function exportAll(selectedUsbPath) {
    const destinationRoot = path.resolve(String(selectedUsbPath || ''));
    if (!destinationRoot) throw new Error('Clé USB non sélectionnée.');
    prepareCandidates();
    ensureDir(destinationRoot);
    if (path.resolve(candidatesRoot) === destinationRoot) throw new Error('La destination d’export ne peut pas être le dossier local des candidats.');

    const sourceRecords = listCandidateDirs(candidatesRoot, false).filter(candidateShapeValid);
    const existing = listCandidateDirs(destinationRoot, false);
    let added = 0, skipped = 0, verifiedFiles = 0;
    const copied = [];
    for (const source of sourceRecords) {
      if (existing.some((r) => sameCandidate(r, source))) {
        skipped += 1;
        continue;
      }
      const target = chooseTargetName(source, destinationRoot);
      const checked = copyVerifiedAtomic(source.candidateDir, target);
      verifiedFiles += checked.files;
      const imported = listCandidateDirs(destinationRoot, false).find((r) => sameCandidate(r, source));
      if (imported) existing.push(imported);
      added += 1;
      copied.push({ candidateId:source.candidateId, folderName:path.basename(target), candidateDir:target });
    }
    return { total:sourceRecords.length, added, updated:0, skipped, verifiedFiles, copied, destinationRoot, exportedAt:now().toISOString(), verified:true };
  }

  function importAll(selectedUsbPath) {
    const sourceRoot = path.resolve(String(selectedUsbPath || ''));
    if (!sourceRoot || !fs.existsSync(sourceRoot)) throw new Error('Clé USB non sélectionnée ou inaccessible.');
    ensureDir(candidatesRoot);
    prepareCandidates();

    const sourceRecords = listCandidateDirs(sourceRoot, false).filter(candidateShapeValid);
    const destinationRecords = listCandidateDirs(candidatesRoot, false);
    let added = 0, skipped = 0, verifiedFiles = 0;
    const copied = [];

    for (const source of sourceRecords) {
      if (destinationRecords.some((r) => sameCandidate(r, source))) {
        skipped += 1;
        continue;
      }
      const target = chooseTargetName(source, candidatesRoot);
      const checked = copyVerifiedAtomic(source.candidateDir, target);
      verifiedFiles += checked.files;
      const manifest = readJson(path.join(target, 'manifest.json')) || {};
      writeJson(path.join(target, 'manifest.json'), { ...manifest, folderName:path.basename(target), importedAt:now().toISOString() });
      const imported = listCandidateDirs(candidatesRoot, false).find((r) => sameCandidate(r, source));
      if (imported) destinationRecords.push(imported);
      added += 1;
      copied.push({ candidateId:source.candidateId, folderName:path.basename(target), candidateDir:target });
    }

    return { total:sourceRecords.length, added, updated:0, skipped, verifiedFiles, copied, sourceRoot, destinationRoot:candidatesRoot, importedAt:now().toISOString(), verified:true };
  }

  return {
    exportAll,
    importAll,
    listCandidateRecords: listCandidateDirs,
    prepareCandidates,
    verifyExactCopy,
    paths: { sebRoot, candidatesRoot, legacyAdminRoot }
  };
}

module.exports = { createCandidateTransfer };
