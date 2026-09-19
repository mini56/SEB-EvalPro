const fs = require('fs');
const path = require('path');
const {
  readJson,
  ensureDir,
  standardFolderName,
  uniqueFolderPath,
  listCandidateDirs,
  selectCandidate,
  copyFileIfMissing,
  copyDirectoryIfMissing,
  unmarkDeleted
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

  function writeJson(target, value) {
    ensureDir(path.dirname(target));
    const temp = target + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(temp, target);
  }

  function ensureCandidateShape(dir) {
    for (const rel of ['donnees','resultats','replay',path.join('bilan','historique'),path.join('bilan','exports')]) {
      ensureDir(path.join(dir, rel));
    }
  }

  function mergeDirectory(sourceDir, targetDir, relativeDir = '') {
    ensureDir(targetDir);
    for (const entry of fs.readdirSync(sourceDir, { withFileTypes:true })) {
      const source = path.join(sourceDir, entry.name);
      const target = path.join(targetDir, entry.name);
      const relative = path.join(relativeDir, entry.name).replace(/\\/g, '/').toLowerCase();
      if (entry.isDirectory()) {
        mergeDirectory(source, target, relative);
        continue;
      }
      if (!entry.isFile()) continue;
      if (relative === 'manifest.json') continue;
      if (!fs.existsSync(target)) {
        fs.copyFileSync(source, target);
        continue;
      }

      // Les données de parcours et résultats reflètent la version importée la plus
      // récente et peuvent donc être mises à jour. Les productions Admin et les
      // archives immuables sont fusionnées sans écrasement.
      const protectedArchive =
        relative.startsWith('replay/') ||
        relative.startsWith('bilan/historique/') ||
        relative.startsWith('bilan/exports/');
      if (!protectedArchive) fs.copyFileSync(source, target);
    }

    const sourceManifest = readJson(path.join(sourceDir, 'manifest.json'));
    const targetManifest = readJson(path.join(targetDir, 'manifest.json'));
    if (sourceManifest || targetManifest) {
      const srcTime = String(sourceManifest && sourceManifest.updatedAt || '');
      const dstTime = String(targetManifest && targetManifest.updatedAt || '');
      const newer = srcTime >= dstTime ? sourceManifest : targetManifest;
      writeJson(path.join(targetDir, 'manifest.json'), {
        ...(targetManifest || {}),
        ...(newer || sourceManifest || {}),
        candidateId: String((targetManifest && targetManifest.candidateId) || (sourceManifest && sourceManifest.candidateId) || ''),
        folderName: path.basename(targetDir)
      });
    }
  }

  function migrateLegacyAdmin() {
    ensureDir(candidatesRoot);
    const byId = new Map(listCandidateDirs(candidatesRoot, false).map((r) => [r.candidateId, r]));
    let added = 0;
    for (const legacy of listCandidateDirs(legacyAdminRoot, true)) {
      if (byId.has(legacy.candidateId)) continue;
      const base = standardFolderName(legacy.candidate);
      const target = fs.existsSync(path.join(candidatesRoot, base)) ? uniqueFolderPath(candidatesRoot, base) : path.join(candidatesRoot, base);
      fs.cpSync(legacy.candidateDir, target, { recursive:true, force:false, errorOnExist:true, preserveTimestamps:true });
      ensureCandidateShape(target);
      const manifest = readJson(path.join(target, 'manifest.json')) || {};
      writeJson(path.join(target, 'manifest.json'), { ...manifest, folderName:path.basename(target), migratedFrom:legacy.candidateDir });
      byId.set(legacy.candidateId, { ...legacy, candidateDir:target, folderName:path.basename(target) });
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

  function mirrorCandidateArtifactsToLegacy(record) {
    ensureDir(globalReplayRoot);
    ensureDir(globalBilanRoot);
    const replayDir = path.join(record.candidateDir, 'replay');
    if (fs.existsSync(replayDir)) {
      for (const entry of fs.readdirSync(replayDir, { withFileTypes:true })) {
        const source = path.join(replayDir, entry.name);
        const target = path.join(globalReplayRoot, entry.name);
        if (entry.isDirectory()) copyDirectoryIfMissing(source, target);
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) copyFileIfMissing(source, target);
      }
    }
    const historyDir = path.join(record.candidateDir, 'bilan', 'historique');
    if (fs.existsSync(historyDir)) {
      for (const entry of fs.readdirSync(historyDir, { withFileTypes:true })) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) continue;
        copyFileIfMissing(path.join(historyDir, entry.name), path.join(globalBilanRoot, entry.name));
      }
    }
  }

  function prepareCandidates() {
    const migrated = migrateLegacyAdmin();
    syncGlobalArtifactsIntoCandidates();
    return migrated;
  }

  function copyToRoot(sourceRecord, destinationRoot) {
    ensureDir(destinationRoot);
    const desiredName = standardFolderName(sourceRecord.candidate);
    let target = path.join(destinationRoot, desiredName);
    const existingRecords = listCandidateDirs(destinationRoot, false);
    const sameId = existingRecords.find((r) => r.candidateId === sourceRecord.candidateId);

    if (sameId) {
      target = sameId.candidateDir;
      mergeDirectory(sourceRecord.candidateDir, target);
      return { updated:true, target };
    }

    if (fs.existsSync(target)) target = uniqueFolderPath(destinationRoot, desiredName);
    fs.cpSync(sourceRecord.candidateDir, target, { recursive:true, force:false, errorOnExist:true, preserveTimestamps:true });
    ensureCandidateShape(target);
    const manifest = readJson(path.join(target, 'manifest.json')) || {};
    writeJson(path.join(target, 'manifest.json'), { ...manifest, folderName:path.basename(target) });
    return { updated:false, target };
  }

  function exportAll(selectedUsbPath) {
    const destinationRoot = path.resolve(String(selectedUsbPath || ''));
    if (!destinationRoot) throw new Error('Clé USB non sélectionnée.');
    prepareCandidates();
    if (path.resolve(candidatesRoot) === destinationRoot) throw new Error('La destination d’export ne peut pas être le dossier local des candidats.');

    const sourceRecords = listCandidateDirs(candidatesRoot, false);
    let added = 0;
    let updated = 0;
    const copied = [];
    for (const source of sourceRecords) {
      const result = copyToRoot(source, destinationRoot);
      if (result.updated) updated += 1; else added += 1;
      copied.push({ candidateId:source.candidateId, folderName:path.basename(result.target), candidateDir:result.target });
    }
    return { total:sourceRecords.length, added, updated, skipped:0, copied, destinationRoot, exportedAt:now().toISOString() };
  }

  function importAll(selectedUsbPath) {
    const sourceRoot = path.resolve(String(selectedUsbPath || ''));
    if (!sourceRoot || !fs.existsSync(sourceRoot)) throw new Error('Clé USB non sélectionnée ou inaccessible.');
    ensureDir(candidatesRoot);
    prepareCandidates();

    const sourceRecords = listCandidateDirs(sourceRoot, false);
    if (!sourceRecords.length) {
      return { total:0, added:0, updated:0, skipped:0, copied:[], sourceRoot, destinationRoot:candidatesRoot, importedAt:now().toISOString() };
    }

    let added = 0;
    let updated = 0;
    const copied = [];
    for (const source of sourceRecords) {
      const destinationRecords = listCandidateDirs(candidatesRoot, false);
      const existing = destinationRecords.find((r) => r.candidateId === source.candidateId);
      let target;
      if (existing) {
        target = existing.candidateDir;
        mergeDirectory(source.candidateDir, target);
        updated += 1;
      } else {
        const base = standardFolderName(source.candidate);
        target = fs.existsSync(path.join(candidatesRoot, base)) ? uniqueFolderPath(candidatesRoot, base) : path.join(candidatesRoot, base);
        fs.cpSync(source.candidateDir, target, { recursive:true, force:false, errorOnExist:true, preserveTimestamps:true });
        ensureCandidateShape(target);
        const manifest = readJson(path.join(target, 'manifest.json')) || {};
        writeJson(path.join(target, 'manifest.json'), { ...manifest, folderName:path.basename(target), importedAt:now().toISOString() });
        added += 1;
      }
      unmarkDeleted(documentsPath, source.candidateId);
      const imported = listCandidateDirs(candidatesRoot, false).find((r) => r.candidateId === source.candidateId);
      if (imported) mirrorCandidateArtifactsToLegacy(imported);
      copied.push({ candidateId:source.candidateId, folderName:path.basename(target), candidateDir:target });
    }

    return { total:sourceRecords.length, added, updated, skipped:0, copied, sourceRoot, destinationRoot:candidatesRoot, importedAt:now().toISOString() };
  }

  return {
    exportAll,
    importAll,
    listCandidateRecords: listCandidateDirs,
    prepareCandidates,
    paths: { sebRoot, candidatesRoot, legacyAdminRoot }
  };
}

module.exports = { createCandidateTransfer };
