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
  readDeletedIds,
  markDeleted,
  unmarkDeleted
} = require('./candidate-folder-utils');

module.exports = function registerCandidateCatalog({ app, ipcMain, getAdminUnlocked, getActiveCandidate }) {
  const documentsPath = app.getPath('documents');
  const root = path.join(documentsPath, 'SEB EvalPro');
  const candidatesRoot = path.join(root, 'Candidats');
  const legacyAdminRoot = path.join(root, 'Admin');
  const globalReplayRoot = path.join(root, 'parcours');
  const globalBilanRoot = path.join(root, 'Bilans', 'Historique');
  const trashRoot = path.join(root, 'Corbeille', 'Candidats');

  function writeJson(target, value) {
    ensureDir(path.dirname(target));
    const temp = target + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(temp, target);
  }

  function ensureCandidateShape(dir) {
    for (const rel of ['donnees', 'resultats', 'replay', path.join('bilan','historique'), path.join('bilan','exports')]) {
      ensureDir(path.join(dir, rel));
    }
  }

  function migrateLegacyCandidateFolders() {
    ensureDir(candidatesRoot);
    const deleted = readDeletedIds(documentsPath);
    const current = listCandidateDirs(candidatesRoot, false);
    const byId = new Map(current.map((r) => [r.candidateId, r]));
    let copied = 0;
    for (const legacy of listCandidateDirs(legacyAdminRoot, true)) {
      if (deleted.has(legacy.candidateId) || byId.has(legacy.candidateId)) continue;
      const base = standardFolderName(legacy.candidate);
      const target = fs.existsSync(path.join(candidatesRoot, base))
        ? uniqueFolderPath(candidatesRoot, base)
        : path.join(candidatesRoot, base);
      fs.cpSync(legacy.candidateDir, target, { recursive:true, force:false, errorOnExist:true, preserveTimestamps:true });
      ensureCandidateShape(target);
      const manifest = readJson(path.join(target, 'manifest.json')) || {};
      writeJson(path.join(target, 'manifest.json'), { ...manifest, folderName:path.basename(target), migratedFrom:legacy.candidateDir });
      const record = { ...legacy, candidateDir:target, folderName:path.basename(target), manifest:{...manifest,folderName:path.basename(target)} };
      byId.set(legacy.candidateId, record);
      copied += 1;
    }
    return copied;
  }

  function replayCandidate(entryPath) {
    try {
      const stat = fs.statSync(entryPath);
      if (stat.isDirectory()) {
        const manifest = readJson(path.join(entryPath, 'manifest.json'));
        return manifest && manifest.candidate ? manifest.candidate : null;
      }
      if (stat.isFile() && entryPath.toLowerCase().endsWith('.json')) {
        const archive = readJson(entryPath);
        return archive && archive.candidate ? archive.candidate : null;
      }
    } catch (_) {}
    return null;
  }

  function syncLegacyArtifacts() {
    ensureDir(candidatesRoot);
    ensureDir(globalReplayRoot);
    ensureDir(globalBilanRoot);
    const records = listCandidateDirs(candidatesRoot, false);
    records.forEach((record) => ensureCandidateShape(record.candidateDir));

    // Ancien stockage global -> dossier candidat autonome.
    let replayCopied = 0;
    let bilanCopied = 0;
    let ambiguous = 0;
    for (const entry of fs.readdirSync(globalReplayRoot, { withFileTypes:true })) {
      const source = path.join(globalReplayRoot, entry.name);
      const candidate = replayCandidate(source);
      if (!candidate) continue;
      const match = selectCandidate(records, candidate);
      if (!match) { ambiguous += 1; continue; }
      const target = path.join(match.candidateDir, 'replay', entry.name);
      if (entry.isDirectory()) {
        if (copyDirectoryIfMissing(source, target)) replayCopied += 1;
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
        if (copyFileIfMissing(source, target)) replayCopied += 1;
      }
    }

    for (const entry of fs.readdirSync(globalBilanRoot, { withFileTypes:true })) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) continue;
      const source = path.join(globalBilanRoot, entry.name);
      const archive = readJson(source);
      if (!archive || !archive.candidate) continue;
      const match = selectCandidate(records, archive.candidate);
      if (!match) { ambiguous += 1; continue; }
      const target = path.join(match.candidateDir, 'bilan', 'historique', entry.name);
      if (copyFileIfMissing(source, target)) bilanCopied += 1;
    }

    // Dossier candidat -> anciens emplacements globaux, uniquement comme miroir
    // de compatibilité pour les fenêtres Replay/Bilan déjà existantes.
    for (const record of records) {
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

    return { replayCopied, bilanCopied, ambiguous };
  }

  function synchronize() {
    const migratedCandidates = migrateLegacyCandidateFolders();
    const artifacts = syncLegacyArtifacts();
    return { migratedCandidates, ...artifacts };
  }

  function bilanEntries(candidateDir) {
    const dir = path.join(candidateDir, 'bilan', 'historique');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes:true })
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.json'))
      .map((entry) => {
        const archive = readJson(path.join(dir, entry.name));
        if (!archive) return null;
        return {
          filename: entry.name,
          revision: Number(archive.revision || 0),
          createdAt: String(archive.createdAt || ''),
          originalBuild: String(archive.originalBuild || '?'),
          integrityOk: !!archive.integritySha256,
          archive
        };
      })
      .filter(Boolean)
      .sort((a,b) => (a.revision - b.revision) || String(a.createdAt).localeCompare(String(b.createdAt)));
  }

  function replayEntries(candidateDir) {
    const dir = path.join(candidateDir, 'replay');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes:true })
      .filter((e) => e.isDirectory() || (e.isFile() && e.name.toLowerCase().endsWith('.json')))
      .map((e) => e.name);
  }

  function exportEntries(candidateDir) {
    const dir = path.join(candidateDir, 'bilan', 'exports');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes:true }).filter((e) => e.isFile()).map((e) => e.name);
  }

  function serialize(record) {
    const c = record.candidate || {};
    const bilans = bilanEntries(record.candidateDir);
    const replays = replayEntries(record.candidateDir);
    return {
      candidateId: record.candidateId,
      folderName: record.folderName,
      nom: c.nom || '',
      prenom: c.prenom || c['prénom'] || '',
      lieu: c.lieu || c.ville || '',
      groupe: c.groupe || '',
      date: c.date || '',
      status: String(record.manifest && record.manifest.status || ''),
      updatedAt: String(record.manifest && record.manifest.updatedAt || ''),
      bilanCount: bilans.length,
      revisionCount: bilans.filter((b) => b.revision > 0).length,
      hasOriginalBilan: bilans.some((b) => b.revision === 0),
      replayCount: replays.length,
      exportCount: exportEntries(record.candidateDir).length
    };
  }

  function findById(candidateId) {
    return listCandidateDirs(candidatesRoot, false).find((r) => r.candidateId === String(candidateId || '')) || null;
  }

  ipcMain.handle('candidate-catalog:list', () => {
    if (!getAdminUnlocked()) return [];
    synchronize();
    return listCandidateDirs(candidatesRoot, false)
      .map(serialize)
      .sort((a,b) => [a.nom,a.prenom,a.date].join('|').localeCompare([b.nom,b.prenom,b.date].join('|'), 'fr', { sensitivity:'base' }));
  });

  ipcMain.handle('candidate-catalog:detail', (_event, candidateId) => {
    if (!getAdminUnlocked()) return { ok:false, error:'Accès administrateur requis.' };
    synchronize();
    const record = findById(candidateId);
    if (!record) return { ok:false, error:'Candidat introuvable.' };
    const bilans = bilanEntries(record.candidateDir).map((b) => ({
      filename:b.filename, revision:b.revision, createdAt:b.createdAt, originalBuild:b.originalBuild, integrityOk:b.integrityOk
    }));
    return { ok:true, candidate:serialize(record), bilans, replays:replayEntries(record.candidateDir), exports:exportEntries(record.candidateDir) };
  });

  ipcMain.handle('candidate-catalog:load-bilan', (_event, candidateId, filename) => {
    if (!getAdminUnlocked()) return { ok:false, error:'Accès administrateur requis.' };
    synchronize();
    const record = findById(candidateId);
    if (!record) return { ok:false, error:'Candidat introuvable.' };
    const safe = path.basename(String(filename || ''));
    const full = path.join(record.candidateDir, 'bilan', 'historique', safe);
    if (!safe.toLowerCase().endsWith('.json') || !fs.existsSync(full)) return { ok:false, error:'Bilan introuvable.' };
    const archive = readJson(full);
    if (!archive) return { ok:false, error:'Bilan illisible.' };
    copyFileIfMissing(full, path.join(globalBilanRoot, safe));
    return { ok:true, filename:safe, archive };
  });

  ipcMain.handle('candidate-catalog:delete', (_event, candidateId) => {
    if (!getAdminUnlocked()) return { ok:false, error:'Accès administrateur requis.' };
    const record = findById(candidateId);
    if (!record) return { ok:false, error:'Candidat introuvable.' };
    const active = typeof getActiveCandidate === 'function' ? getActiveCandidate() : null;
    if (active && String(active.candidateId) === String(record.candidateId)) {
      return { ok:false, error:'Ce candidat est la session active. Fermez d’abord sa session avant de le supprimer de la liste.' };
    }
    ensureDir(trashRoot);
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14);
    const target = uniqueFolderPath(trashRoot, `${record.folderName}_${stamp}`);
    fs.renameSync(record.candidateDir, target);
    markDeleted(documentsPath, record.candidateId);
    return { ok:true, movedTo:target };
  });

  ipcMain.handle('candidate-catalog:sync', () => {
    if (!getAdminUnlocked()) return { ok:false, error:'Accès administrateur requis.' };
    return { ok:true, ...synchronize() };
  });

  return { synchronize };
};
