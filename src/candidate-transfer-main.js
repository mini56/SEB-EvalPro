const fs = require('fs');
const path = require('path');

function createCandidateTransfer(options = {}) {
  const documentsPath = options.documentsPath;
  const now = typeof options.now === 'function' ? options.now : () => new Date();

  if (!documentsPath) throw new Error('documentsPath requis');

  const sebRoot = path.join(documentsPath, 'SEB EvalPro');
  const localCandidatesRoot = path.join(sebRoot, 'Candidats');
  const adminRoot = path.join(sebRoot, 'Admin');

  function ensureDirectory(directory) {
    fs.mkdirSync(directory, { recursive: true });
    return directory;
  }

  function readJson(target) {
    try {
      return JSON.parse(fs.readFileSync(target, 'utf8'));
    } catch (_) {
      return null;
    }
  }

  function sanitizeGroupName(value) {
    const cleaned = String(value || '')
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
      .replace(/[. ]+$/g, '')
      .replace(/\s+/g, ' ');
    if (!cleaned || cleaned === '.' || cleaned === '..') {
      throw new Error('Nom de regroupement invalide.');
    }
    return cleaned;
  }

  function portableCandidatesRoot(selectedPath) {
    const selected = path.resolve(String(selectedPath || ''));
    const base = path.basename(selected).toLocaleLowerCase('fr-FR');
    if (base === 'candidats') return selected;
    if (base === 'seb evalpro') return path.join(selected, 'Candidats');
    return path.join(selected, 'SEB EvalPro', 'Candidats');
  }

  function listCandidateRecords(root) {
    if (!root || !fs.existsSync(root)) return [];
    const entries = fs.readdirSync(root, { withFileTypes: true });
    const records = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidateDir = path.join(root, entry.name);
      const manifest = readJson(path.join(candidateDir, 'manifest.json'));
      const candidateId = String(manifest && manifest.candidateId || '').trim();
      if (!candidateId) continue;
      records.push({
        candidateId,
        folderName: entry.name,
        candidateDir,
        manifest
      });
    }
    return records;
  }

  function uniqueFolderPath(parent, folderName) {
    let target = path.join(parent, folderName);
    let index = 2;
    while (fs.existsSync(target)) {
      target = path.join(parent, `${folderName}_${index}`);
      index += 1;
    }
    return target;
  }

  function replaceDirectorySafely(sourceDir, targetDir) {
    ensureDirectory(path.dirname(targetDir));
    const token = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const tempDir = path.join(path.dirname(targetDir), `.${path.basename(targetDir)}.seb-copy-${token}`);
    const backupDir = path.join(path.dirname(targetDir), `.${path.basename(targetDir)}.seb-backup-${token}`);

    fs.cpSync(sourceDir, tempDir, {
      recursive: true,
      force: true,
      errorOnExist: false,
      preserveTimestamps: true
    });

    let hadTarget = false;
    try {
      if (fs.existsSync(targetDir)) {
        fs.renameSync(targetDir, backupDir);
        hadTarget = true;
      }
      fs.renameSync(tempDir, targetDir);
      if (hadTarget) fs.rmSync(backupDir, { recursive: true, force: true });
    } catch (error) {
      try {
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_) {}
      try {
        if (hadTarget && !fs.existsSync(targetDir) && fs.existsSync(backupDir)) {
          fs.renameSync(backupDir, targetDir);
        }
      } catch (_) {}
      throw error;
    }
  }

  function copyCandidates(sourceRoot, destinationRoot) {
    ensureDirectory(destinationRoot);
    const sourceRecords = listCandidateRecords(sourceRoot);
    const destinationRecords = listCandidateRecords(destinationRoot);
    const byId = new Map(destinationRecords.map((record) => [record.candidateId, record]));

    let added = 0;
    let updated = 0;
    const copied = [];

    for (const source of sourceRecords) {
      const existing = byId.get(source.candidateId);
      const targetDir = existing
        ? existing.candidateDir
        : (fs.existsSync(path.join(destinationRoot, source.folderName))
          ? uniqueFolderPath(destinationRoot, source.folderName)
          : path.join(destinationRoot, source.folderName));

      replaceDirectorySafely(source.candidateDir, targetDir);

      if (existing) updated += 1;
      else added += 1;

      const record = {
        candidateId: source.candidateId,
        folderName: path.basename(targetDir),
        candidateDir: targetDir
      };
      byId.set(source.candidateId, record);
      copied.push(record);
    }

    return {
      total: sourceRecords.length,
      added,
      updated,
      copied
    };
  }

  function exportAll(selectedUsbPath) {
    ensureDirectory(localCandidatesRoot);
    const destinationRoot = portableCandidatesRoot(selectedUsbPath);
    const result = copyCandidates(localCandidatesRoot, destinationRoot);
    return {
      ...result,
      destinationRoot,
      exportedAt: now().toISOString()
    };
  }

  function importAll(selectedUsbPath, groupName) {
    const label = sanitizeGroupName(groupName);
    const sourceRoot = portableCandidatesRoot(selectedUsbPath);
    if (!fs.existsSync(sourceRoot)) {
      throw new Error('Aucun dossier SEB EvalPro\\Candidats trouvé sur la clé sélectionnée.');
    }

    const destinationRoot = ensureDirectory(path.join(adminRoot, label));
    const result = copyCandidates(sourceRoot, destinationRoot);
    return {
      ...result,
      sourceRoot,
      destinationRoot,
      groupName: label,
      importedAt: now().toISOString()
    };
  }

  return {
    exportAll,
    importAll,
    listCandidateRecords,
    sanitizeGroupName,
    portableCandidatesRoot,
    paths: {
      sebRoot,
      localCandidatesRoot,
      adminRoot
    }
  };
}

module.exports = { createCandidateTransfer };
