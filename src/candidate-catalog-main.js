const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { shell } = require('electron');
const {
  readJson,
  ensureDir,
  standardFolderName,
  uniqueFolderPath,
  listCandidateDirs,
  selectCandidate,
  selectCandidateFromFilename,
  copyFileIfMissing,
  copyDirectoryIfMissing,
  copyDirectoryAtomically
} = require('./candidate-folder-utils');

module.exports = function registerCandidateCatalog({ app, ipcMain, getAdminUnlocked }) {
  const documentsPath = app.getPath('documents');
  const root = path.join(documentsPath, 'SEB EvalPro');
  const candidatesRoot = path.join(root, 'Candidats');
  const legacyAdminRoot = path.join(root, 'Admin');
  const globalReplayRoot = path.join(root, 'parcours');
  const globalBilanRoot = path.join(root, 'Bilans', 'Historique');
  const globalExportsRoot = path.join(root, 'Bilans');
  const BILAN_TYPE = 'SEB_EVALPRO_BILAN_ARCHIVE';
  let adminBilanWorkspace = null;

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

  function completeLegacySkeleton(dir, record) {
    ensureCandidateShape(dir);
    const c = (record && record.candidate) || {};
    const defaults = [
      [path.join(dir, 'donnees', 'candidat.json'), c],
      [path.join(dir, 'donnees', 'evaluation-state.json'), {
        version:1,
        sessionStorage:{
          candidat_data:JSON.stringify(c),
          reponses_data:'{}',
          scores_data:'{}'
        },
        localStorage:{},
        lastPage:'qcmv1.0.html',
        lastEvaluationPage:'qcmv1.0.html',
        migratedPlaceholder:true
      }],
      [path.join(dir, 'donnees', 'progression.json'), { lastPage:null, lastEvaluationPage:null, migratedPlaceholder:true }],
      [path.join(dir, 'resultats', 'reponses.json'), {}],
      [path.join(dir, 'resultats', 'scores.json'), {}]
    ];
    for (const [file, value] of defaults) {
      if (!fs.existsSync(file)) writeJson(file, value);
    }
  }

  function migrateLegacyCandidateFolders() {
    ensureDir(candidatesRoot);
    const current = listCandidateDirs(candidatesRoot, false);
    let copied = 0;
    for (const legacy of listCandidateDirs(legacyAdminRoot, true)) {
      if (current.some((r) => String(r.candidateId) === String(legacy.candidateId))) continue;
      if (selectCandidate(current, legacy.candidate)) continue;
      const base = standardFolderName(legacy.candidate);
      const target = fs.existsSync(path.join(candidatesRoot, base))
        ? uniqueFolderPath(candidatesRoot, base)
        : path.join(candidatesRoot, base);
      copyDirectoryAtomically(legacy.candidateDir, target);
      completeLegacySkeleton(target, legacy);
      const manifest = readJson(path.join(target, 'manifest.json')) || {};
      writeJson(path.join(target, 'manifest.json'), { ...manifest, folderName:path.basename(target), migratedFrom:legacy.candidateDir });
      const migrated = listCandidateDirs(candidatesRoot, false).find((r) => String(r.candidateId) === String(legacy.candidateId));
      if (migrated) current.push(migrated);
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

    // Sécurité de migration uniquement : ancien stockage global -> dossier candidat.
    // Le sens inverse est volontairement interdit : le dossier candidat est la référence.
    let replayCopied = 0;
    let bilanCopied = 0;
    let exportCopied = 0;
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

    ensureDir(globalExportsRoot);
    for (const entry of fs.readdirSync(globalExportsRoot, { withFileTypes:true })) {
      if (!entry.isFile() || !/\.(doc|docx)$/i.test(entry.name)) continue;
      const match = selectCandidateFromFilename(records, entry.name);
      if (!match) { ambiguous += 1; continue; }
      if (copyFileIfMissing(
        path.join(globalExportsRoot, entry.name),
        path.join(match.candidateDir, 'bilan', 'exports', entry.name)
      )) exportCopied += 1;
    }

    return { replayCopied, bilanCopied, exportCopied, ambiguous };
  }

  function synchronize() {
    const migratedCandidates = migrateLegacyCandidateFolders();
    const artifacts = syncLegacyArtifacts();
    return { migratedCandidates, ...artifacts };
  }

  function stableJson(value) {
    if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
    }
    return JSON.stringify(value);
  }

  function sha(value) {
    return crypto.createHash('sha256').update(stableJson(value), 'utf8').digest('hex');
  }

  function verifyBilan(archive) {
    if (!archive || archive.type !== BILAN_TYPE || !archive.integritySha256) return false;
    const clone = { ...archive };
    delete clone.integritySha256;
    return sha(clone) === String(archive.integritySha256);
  }

  function bilanEntries(candidateDir) {
    const dir = path.join(candidateDir, 'bilan', 'historique');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes:true })
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.json'))
      .map((entry) => {
        const archive = readJson(path.join(dir, entry.name));
        if (!archive) return {
          filename:entry.name, revision:0, createdAt:'', originalBuild:'?', integrityOk:false
        };
        return {
          filename: entry.name,
          revision: Number(archive.revision || 0),
          createdAt: String(archive.createdAt || ''),
          originalBuild: String(archive.originalBuild || '?'),
          integrityOk: verifyBilan(archive)
        };
      })
      .sort((a,b) => (a.revision - b.revision) || String(a.createdAt).localeCompare(String(b.createdAt)));
  }

  function replayEntries(candidateDir) {
    const dir = path.join(candidateDir, 'replay');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes:true })
      .filter((e) => e.isDirectory() || (e.isFile() && e.name.toLowerCase().endsWith('.json')))
      .map((e) => e.name);
  }

  function cleanupDuplicateWordExports(candidateDir) {
    const dir = path.join(candidateDir, 'bilan', 'exports');
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes:true }).filter((e) => e.isFile() && /^Evaluation_.+\.docx?$/i.test(e.name));
    const names = new Set(entries.map((e) => e.name.toLowerCase()));
    for (const entry of entries) {
      const match = entry.name.match(/^(Evaluation_.+?)(?:_R\d+|_\d+)(\.docx?)$/i);
      if (!match) continue;
      const canonical = (match[1] + match[2]).toLowerCase();
      if (!names.has(canonical)) continue;
      try { fs.rmSync(path.join(dir, entry.name), { force:true }); } catch (_) {}
    }
  }

  function exportEntries(candidateDir) {
    const dir = path.join(candidateDir, 'bilan', 'exports');
    if (!fs.existsSync(dir)) return [];
    cleanupDuplicateWordExports(candidateDir);
    return fs.readdirSync(dir, { withFileTypes:true })
      .filter((e) => e.isFile() && /\.(doc|docx)$/i.test(e.name))
      .map((e) => e.name)
      .sort((a,b) => a.localeCompare(b, 'fr', { sensitivity:'base' }));
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

  function clone(value) {
    return JSON.parse(JSON.stringify(value == null ? {} : value));
  }

  function candidateWorkspaceState(record) {
    const candidateFile = readJson(path.join(record.candidateDir, 'donnees', 'candidat.json')) || record.candidate || {};
    const saved = readJson(path.join(record.candidateDir, 'donnees', 'evaluation-state.json')) || {};
    const responses = readJson(path.join(record.candidateDir, 'resultats', 'reponses.json'));
    const scores = readJson(path.join(record.candidateDir, 'resultats', 'scores.json'));
    const sessionStorage = { ...(saved.sessionStorage && typeof saved.sessionStorage === 'object' ? saved.sessionStorage : {}) };
    const localStorage = { ...(saved.localStorage && typeof saved.localStorage === 'object' ? saved.localStorage : {}) };

    sessionStorage.candidat_data = JSON.stringify(candidateFile);
    sessionStorage.seb_evalpro_admin_candidate_id = String(record.candidateId || '');
    if (responses && typeof responses === 'object') sessionStorage.reponses_data = JSON.stringify(responses);
    if (scores && typeof scores === 'object') sessionStorage.scores_data = JSON.stringify(scores);

    return {
      ...saved,
      version: 1,
      sessionStorage,
      localStorage,
      lastPage: String(saved.lastPage || 'qcmv1.0.html'),
      lastEvaluationPage: String(saved.lastEvaluationPage || saved.lastPage || 'qcmv1.0.html')
    };
  }

  function saveCandidateWorkspaceState(workspace, state) {
    if (!workspace || !workspace.candidateDir) throw new Error('Aucun candidat sélectionné pour le bilan.');
    const candidateFile = readJson(path.join(workspace.candidateDir, 'donnees', 'candidat.json')) || workspace.candidate || {};
    const safe = clone(state);
    safe.version = 1;
    safe.sessionStorage = safe.sessionStorage && typeof safe.sessionStorage === 'object' ? safe.sessionStorage : {};
    safe.localStorage = safe.localStorage && typeof safe.localStorage === 'object' ? safe.localStorage : {};
    safe.sessionStorage.candidat_data = JSON.stringify(candidateFile);
    safe.updatedAt = new Date().toISOString();
    writeJson(path.join(workspace.candidateDir, 'donnees', 'evaluation-state.json'), safe);
    workspace.state = safe;
    return safe;
  }

  ipcMain.handle('candidate-catalog:begin-bilan', (_event, candidateId) => {
    if (!getAdminUnlocked()) return { ok:false, error:'Accès administrateur requis.' };
    synchronize();
    const record = findById(candidateId);
    if (!record) return { ok:false, error:'Candidat introuvable.' };
    const state = candidateWorkspaceState(record);
    adminBilanWorkspace = {
      candidateId: record.candidateId,
      candidateDir: record.candidateDir,
      candidate: clone(record.candidate || {}),
      state
    };
    return { ok:true, candidate:serialize(record) };
  });

  ipcMain.on('candidate-catalog:workspace-load-sync', (event) => {
    if (!getAdminUnlocked() || !adminBilanWorkspace) {
      event.returnValue = { ok:false };
      return;
    }
    event.returnValue = {
      ok:true,
      candidateId:adminBilanWorkspace.candidateId,
      candidate:clone(adminBilanWorkspace.candidate),
      state:clone(adminBilanWorkspace.state)
    };
  });

  ipcMain.on('candidate-catalog:workspace-save-sync', (event, state) => {
    if (!getAdminUnlocked() || !adminBilanWorkspace) {
      event.returnValue = { ok:false, error:'Aucun candidat sélectionné pour le bilan.' };
      return;
    }
    try {
      const saved = saveCandidateWorkspaceState(adminBilanWorkspace, state || {});
      event.returnValue = { ok:true, state:clone(saved) };
    } catch (error) {
      event.returnValue = { ok:false, error:error && error.message ? error.message : String(error) };
    }
  });

  ipcMain.handle('candidate-catalog:workspace-save', (_event, state) => {
    if (!getAdminUnlocked() || !adminBilanWorkspace) return { ok:false, error:'Aucun candidat sélectionné pour le bilan.' };
    try {
      const saved = saveCandidateWorkspaceState(adminBilanWorkspace, state || {});
      return { ok:true, state:clone(saved) };
    } catch (error) {
      return { ok:false, error:error && error.message ? error.message : String(error) };
    }
  });

  ipcMain.handle('candidate-catalog:end-bilan', () => {
    adminBilanWorkspace = null;
    return true;
  });

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
    return {
      ok:true,
      candidate:serialize(record),
      bilans:bilanEntries(record.candidateDir),
      replays:replayEntries(record.candidateDir),
      exports:exportEntries(record.candidateDir)
    };
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
    if (!archive) return { ok:false, corruption:true, error:'ATTENTION : ce bilan est illisible. Il peut y avoir une corruption de données. Le fichier n’a pas été ouvert.' };
    if (!verifyBilan(archive)) return { ok:false, corruption:true, error:'ATTENTION : le contrôle d’intégrité a échoué. Il peut y avoir une corruption de données. Le bilan n’a pas été ouvert.' };
    return { ok:true, filename:safe, archive };
  });

  ipcMain.handle('candidate-catalog:open-export', async (_event, candidateId, filename) => {
    if (!getAdminUnlocked()) return { ok:false, error:'Accès administrateur requis.' };
    const record = findById(candidateId);
    if (!record) return { ok:false, error:'Candidat introuvable.' };
    const safe = path.basename(String(filename || ''));
    if (!/\.(doc|docx)$/i.test(safe)) return { ok:false, error:'Type de fichier non autorisé.' };
    const full = path.join(record.candidateDir, 'bilan', 'exports', safe);
    if (!fs.existsSync(full)) return { ok:false, error:'Fichier résultat introuvable.' };
    const error = await shell.openPath(full);
    return error ? { ok:false, error } : { ok:true };
  });

  ipcMain.handle('candidate-catalog:sync', () => {
    if (!getAdminUnlocked()) return { ok:false, error:'Accès administrateur requis.' };
    return { ok:true, ...synchronize() };
  });

  return { synchronize };
};
