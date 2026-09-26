const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { shell } = require('electron');
const { getEditionCapabilities } = require('./edition');
const { encodeJson } = require('./candidate-data-crypto');
const {
  readJson,
  ensureDir,
  normalize,
  standardFolderName,
  codedFolderName,
  uniqueFolderPath,
  listCandidateDirs,
  selectCandidate,
  selectCandidateFromFilename,
  copyFileIfMissing,
  copyDirectoryIfMissing,
  copyDirectoryAtomically
} = require('./candidate-folder-utils');

module.exports = function registerCandidateCatalog({ app, ipcMain, getAdminUnlocked, getActiveCandidate, dataRoot = null }) {
  const editionCapabilities = getEditionCapabilities();
  const documentsPath = app.getPath('documents');
  const root = dataRoot || path.join(documentsPath, 'SEB EvalPro');
  const candidatesRoot = path.join(root, 'Candidats');
  const legacyAdminRoot = path.join(root, 'Admin');
  const globalReplayRoot = path.join(root, 'parcours');
  const globalBilanRoot = path.join(root, 'Bilans', 'Historique');
  const globalExportsRoot = path.join(root, 'Bilans');
  const BILAN_TYPE = 'SEB_EVALPRO_BILAN_ARCHIVE';
  let adminBilanWorkspace = null;
  let adminResultsWorkspace = null;

  function writeJson(target, value) {
    ensureDir(path.dirname(target));
    const temp = target + '.tmp';
    fs.writeFileSync(temp, encodeJson(value), 'utf8');
    fs.renameSync(temp, target);
  }

  function ensureCandidateShape(dir) {
    for (const rel of ['donnees', 'resultats', 'replay', path.join('bilan','historique'), path.join('bilan','exports')]) {
      ensureDir(path.join(dir, rel));
    }
  }

  function candidateIdentityKey(candidate) {
    const c = candidate || {};
    const parts = [
      c.nom,
      c.prenom || c['prénom'],
      c.lieu || c.ville,
      c.groupe
    ].map(normalize);
    return parts.every(Boolean) ? parts.join('|') : '';
  }

  function fileSha256(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  }

  function copyTreePreserving(source, target, suffix) {
    if (!fs.existsSync(source)) return 0;
    let copied = 0;
    const stat = fs.statSync(source);
    if (stat.isDirectory()) {
      ensureDir(target);
      for (const entry of fs.readdirSync(source, { withFileTypes:true })) {
        copied += copyTreePreserving(path.join(source, entry.name), path.join(target, entry.name), suffix);
      }
      return copied;
    }
    ensureDir(path.dirname(target));
    if (!fs.existsSync(target)) {
      fs.copyFileSync(source, target);
      return 1;
    }
    try {
      if (fileSha256(source) === fileSha256(target)) return 0;
    } catch (_) {}
    const parsed = path.parse(target);
    let conflict = path.join(parsed.dir, parsed.name + '__' + suffix + parsed.ext);
    let index = 2;
    while (fs.existsSync(conflict)) {
      try { if (fileSha256(source) === fileSha256(conflict)) return 0; } catch (_) {}
      conflict = path.join(parsed.dir, parsed.name + '__' + suffix + '_' + index + parsed.ext);
      index += 1;
    }
    fs.copyFileSync(source, conflict);
    return 1;
  }

  function mergeJsonObjectFile(target, source) {
    if (!fs.existsSync(source)) return false;
    const sourceValue = readJson(source);
    if (!sourceValue || typeof sourceValue !== 'object' || Array.isArray(sourceValue)) return false;
    const targetValue = readJson(target);
    if (!targetValue || typeof targetValue !== 'object' || Array.isArray(targetValue)) {
      writeJson(target, sourceValue);
      return true;
    }
    let sourceNewer = false;
    try { sourceNewer = fs.statSync(source).mtimeMs >= fs.statSync(target).mtimeMs; } catch (_) {}
    const merged = sourceNewer ? { ...targetValue, ...sourceValue } : { ...sourceValue, ...targetValue };
    writeJson(target, merged);
    return true;
  }

  function mergeEvaluationStateFile(target, source) {
    if (!fs.existsSync(source)) return false;
    const sourceValue = readJson(source);
    if (!sourceValue || typeof sourceValue !== 'object' || Array.isArray(sourceValue)) return false;
    const targetValue = readJson(target);
    if (!targetValue || typeof targetValue !== 'object' || Array.isArray(targetValue)) {
      writeJson(target, sourceValue);
      return true;
    }
    let sourceNewer = false;
    try {
      const sourceTime = Date.parse(sourceValue.updatedAt || '') || fs.statSync(source).mtimeMs;
      const targetTime = Date.parse(targetValue.updatedAt || '') || fs.statSync(target).mtimeMs;
      sourceNewer = sourceTime >= targetTime;
    } catch (_) {}
    const older = sourceNewer ? targetValue : sourceValue;
    const newer = sourceNewer ? sourceValue : targetValue;
    const merged = {
      ...older,
      ...newer,
      sessionStorage:{
        ...((older.sessionStorage && typeof older.sessionStorage === 'object') ? older.sessionStorage : {}),
        ...((newer.sessionStorage && typeof newer.sessionStorage === 'object') ? newer.sessionStorage : {})
      },
      localStorage:{
        ...((older.localStorage && typeof older.localStorage === 'object') ? older.localStorage : {}),
        ...((newer.localStorage && typeof newer.localStorage === 'object') ? newer.localStorage : {})
      }
    };
    writeJson(target, merged);
    return true;
  }

  function choosePrimaryDuplicate(records) {
    let active = null;
    try { active = typeof getActiveCandidate === 'function' ? getActiveCandidate() : null; } catch (_) {}
    if (active && active.candidateId) {
      const current = records.find((record) => String(record.candidateId) === String(active.candidateId));
      if (current) return current;
    }
    const canonical = codedFolderName(records[0] && records[0].candidateId, records[0] && records[0].manifest && records[0].manifest.shortId);
    const exact = records.find((record) => record.folderName === canonical);
    if (exact) return exact;
    return records.slice().sort((a,b) =>
      String(a.manifest && a.manifest.createdAt || '').localeCompare(String(b.manifest && b.manifest.createdAt || ''))
    )[0];
  }

  function consolidateDuplicateCandidateFolders() {
    ensureDir(candidatesRoot);
    const records = listCandidateDirs(candidatesRoot, false);
    const groups = new Map();
    for (const record of records) {
      // Deux évaluations distinctes ne doivent jamais être fusionnées sur la seule
      // identité humaine. Seules deux copies techniques du MEME candidateId
      // peuvent être consolidées.
      const key = String(record.candidateId || '').trim();
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    }

    const duplicateArchiveRoot = path.join(root, 'Corbeille', 'Doublons');
    let consolidated = 0;
    let archived = 0;
    let mergedFiles = 0;

    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const primary = choosePrimaryDuplicate(group);
      ensureCandidateShape(primary.candidateDir);
      const consolidatedFrom = Array.isArray(primary.manifest && primary.manifest.consolidatedFrom)
        ? primary.manifest.consolidatedFrom.slice()
        : [];

      for (const duplicate of group) {
        if (duplicate.candidateDir === primary.candidateDir) continue;
        ensureCandidateShape(duplicate.candidateDir);
        const suffix = String(duplicate.candidateId || 'doublon').replace(/[^A-Za-z0-9_-]+/g, '').slice(0, 12) || 'doublon';

        mergeJsonObjectFile(
          path.join(primary.candidateDir, 'resultats', 'reponses.json'),
          path.join(duplicate.candidateDir, 'resultats', 'reponses.json')
        );
        mergeJsonObjectFile(
          path.join(primary.candidateDir, 'resultats', 'scores.json'),
          path.join(duplicate.candidateDir, 'resultats', 'scores.json')
        );
        mergeEvaluationStateFile(
          path.join(primary.candidateDir, 'donnees', 'evaluation-state.json'),
          path.join(duplicate.candidateDir, 'donnees', 'evaluation-state.json')
        );
        mergeJsonObjectFile(
          path.join(primary.candidateDir, 'donnees', 'progression.json'),
          path.join(duplicate.candidateDir, 'donnees', 'progression.json')
        );

        mergedFiles += copyTreePreserving(
          path.join(duplicate.candidateDir, 'replay'),
          path.join(primary.candidateDir, 'replay'),
          suffix
        );
        mergedFiles += copyTreePreserving(
          path.join(duplicate.candidateDir, 'bilan', 'historique'),
          path.join(primary.candidateDir, 'bilan', 'historique'),
          suffix
        );

        const duplicateExports = path.join(duplicate.candidateDir, 'bilan', 'exports');
        const primaryExports = path.join(primary.candidateDir, 'bilan', 'exports');
        if (fs.existsSync(duplicateExports)) {
          ensureDir(primaryExports);
          for (const entry of fs.readdirSync(duplicateExports, { withFileTypes:true })) {
            if (!entry.isFile() || !/\.(doc|docx)$/i.test(entry.name)) continue;
            const target = path.join(primaryExports, entry.name);
            if (!fs.existsSync(target)) {
              fs.copyFileSync(path.join(duplicateExports, entry.name), target);
              mergedFiles += 1;
            }
          }
        }

        ensureDir(duplicateArchiveRoot);
        const archiveBase = codedFolderName(duplicate.candidateId, duplicate.manifest && duplicate.manifest.shortId) + '__DUP-' + suffix;
        const archiveTarget = uniqueFolderPath(duplicateArchiveRoot, archiveBase);
        fs.renameSync(duplicate.candidateDir, archiveTarget);
        consolidatedFrom.push({
          candidateId:String(duplicate.candidateId || ''),
          folderName:String(duplicate.folderName || ''),
          archivedAt:new Date().toISOString(),
          archivedPath:archiveTarget
        });
        consolidated += 1;
        archived += 1;
      }

      const manifest = readJson(path.join(primary.candidateDir, 'manifest.json')) || {};
      writeJson(path.join(primary.candidateDir, 'manifest.json'), {
        ...manifest,
        folderName:path.basename(primary.candidateDir),
        consolidatedFrom
      });
    }

    return { consolidated, archived, mergedFiles };
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
      const base = codedFolderName(legacy.candidateId, legacy.manifest && legacy.manifest.shortId);
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
    const firstPass = consolidateDuplicateCandidateFolders();
    const migratedCandidates = migrateLegacyCandidateFolders();
    const secondPass = consolidateDuplicateCandidateFolders();
    const artifacts = syncLegacyArtifacts();
    return {
      migratedCandidates,
      consolidatedDuplicates:firstPass.consolidated + secondPass.consolidated,
      archivedDuplicates:firstPass.archived + secondPass.archived,
      mergedDuplicateFiles:firstPass.mergedFiles + secondPass.mergedFiles,
      ...artifacts
    };
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
      .filter((e) => e.isFile() && /^Evaluation_.+\.docx?$/i.test(e.name))
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
    const candidateForStorage = { ...candidateFile };
    if (!candidateForStorage.prenom && candidateForStorage['prénom']) candidateForStorage.prenom = candidateForStorage['prénom'];
    if (!candidateForStorage['prénom'] && candidateForStorage.prenom) candidateForStorage['prénom'] = candidateForStorage.prenom;
    if (!candidateForStorage.lieu && candidateForStorage.ville) candidateForStorage.lieu = candidateForStorage.ville;
    const saved = readJson(path.join(record.candidateDir, 'donnees', 'evaluation-state.json')) || {};
    const responses = readJson(path.join(record.candidateDir, 'resultats', 'reponses.json'));
    const scores = readJson(path.join(record.candidateDir, 'resultats', 'scores.json'));
    const sessionStorage = { ...(saved.sessionStorage && typeof saved.sessionStorage === 'object' ? saved.sessionStorage : {}) };
    const localStorage = { ...(saved.localStorage && typeof saved.localStorage === 'object' ? saved.localStorage : {}) };

    sessionStorage.candidat_data = JSON.stringify(candidateForStorage);
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
    if (!editionCapabilities.canBilan) return { ok:false, error:'Le bilan est disponible uniquement sur le PC Administrateur.' };
    if (!getAdminUnlocked()) return { ok:false, error:'Accès administrateur requis.' };
    synchronize();
    const record = findById(candidateId);
    if (!record) return { ok:false, error:'Candidat introuvable.' };
    adminResultsWorkspace = null;
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

  ipcMain.handle('candidate-catalog:begin-results', (_event, candidateId) => {
    if (!getAdminUnlocked()) return { ok:false, error:'Accès administrateur requis.' };
    synchronize();
    const record = findById(candidateId);
    if (!record) return { ok:false, error:'Candidat introuvable.' };
    adminBilanWorkspace = null;
    adminResultsWorkspace = {
      candidateId:record.candidateId,
      candidateDir:record.candidateDir,
      candidate:clone(record.candidate || {}),
      state:candidateWorkspaceState(record)
    };
    return { ok:true, candidate:serialize(record) };
  });

  ipcMain.on('candidate-catalog:results-workspace-load-sync', (event) => {
    if (!getAdminUnlocked() || !adminResultsWorkspace) {
      event.returnValue = { ok:false };
      return;
    }
    event.returnValue = {
      ok:true,
      readOnly:true,
      candidateId:adminResultsWorkspace.candidateId,
      candidate:clone(adminResultsWorkspace.candidate),
      state:clone(adminResultsWorkspace.state)
    };
  });

  ipcMain.handle('candidate-catalog:end-results', () => {
    adminResultsWorkspace = null;
    return true;
  });


  function sameCandidate(candidateA, candidateB) {
    const a = candidateIdentityKey(candidateA);
    const b = candidateIdentityKey(candidateB);
    return !!a && a === b;
  }

  function removeCandidateRuntimeState(candidate) {
    const userData = app.getPath('userData');
    const statePath = path.join(userData, 'evaluation-state.json');
    const state = readJson(statePath);
    try {
      const raw = state && state.sessionStorage && state.sessionStorage.candidat_data;
      const storedCandidate = raw ? JSON.parse(raw) : null;
      if (storedCandidate && sameCandidate(storedCandidate, candidate)) fs.rmSync(statePath, { force:true });
    } catch (_) {}

    const activePath = path.join(userData, 'active-candidate.json');
    const active = readJson(activePath);
    if (active && active.candidateDir) {
      try {
        const manifest = readJson(path.join(active.candidateDir, 'manifest.json'));
        if (manifest && sameCandidate(manifest.candidat || manifest.candidate, candidate)) fs.rmSync(activePath, { force:true });
      } catch (_) {}
    }
  }

  function removeLegacyCandidateCopies(candidate, authoritativeRecord, recordsBeforeDelete) {
    let removedLegacyFolders = 0;
    let removedReplay = 0;
    let removedBilans = 0;
    let removedWords = 0;
    let removedDuplicateArchives = 0;

    for (const legacy of listCandidateDirs(legacyAdminRoot, true)) {
      if (!sameCandidate(legacy.candidate, candidate)) continue;
      fs.rmSync(legacy.candidateDir, { recursive:true, force:true });
      removedLegacyFolders += 1;
    }

    const duplicateRoot = path.join(root, 'Corbeille', 'Doublons');
    for (const duplicate of listCandidateDirs(duplicateRoot, true)) {
      if (!sameCandidate(duplicate.candidate, candidate)) continue;
      fs.rmSync(duplicate.candidateDir, { recursive:true, force:true });
      removedDuplicateArchives += 1;
    }

    if (fs.existsSync(globalReplayRoot)) {
      for (const entry of fs.readdirSync(globalReplayRoot, { withFileTypes:true })) {
        const full = path.join(globalReplayRoot, entry.name);
        const replayCandidateValue = replayCandidate(full);
        if (!replayCandidateValue || !sameCandidate(replayCandidateValue, candidate)) continue;
        fs.rmSync(full, { recursive:true, force:true });
        removedReplay += 1;
      }
    }

    if (fs.existsSync(globalBilanRoot)) {
      for (const entry of fs.readdirSync(globalBilanRoot, { withFileTypes:true })) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) continue;
        const full = path.join(globalBilanRoot, entry.name);
        const archive = readJson(full);
        if (!archive || !sameCandidate(archive.candidate, candidate)) continue;
        fs.rmSync(full, { force:true });
        removedBilans += 1;
      }
    }

    if (fs.existsSync(globalExportsRoot)) {
      for (const entry of fs.readdirSync(globalExportsRoot, { withFileTypes:true })) {
        if (!entry.isFile() || !/\.(doc|docx)$/i.test(entry.name)) continue;
        const matched = selectCandidateFromFilename(recordsBeforeDelete, entry.name);
        if (!matched || String(matched.candidateId) !== String(authoritativeRecord.candidateId)) continue;
        fs.rmSync(path.join(globalExportsRoot, entry.name), { force:true });
        removedWords += 1;
      }
    }

    return { removedLegacyFolders, removedReplay, removedBilans, removedWords, removedDuplicateArchives };
  }

  ipcMain.handle('candidate-catalog:list', () => {
    if (!getAdminUnlocked()) return [];
    synchronize();
    return listCandidateDirs(candidatesRoot, false)
      .map(serialize)
      .sort((a,b) => [a.nom,a.prenom,a.date].join('|').localeCompare([b.nom,b.prenom,b.date].join('|'), 'fr', { sensitivity:'base' }));
  });

  ipcMain.handle('candidate-catalog:delete', () => {
    // Protection volontaire : SEB EvalPro ne supprime jamais un dossier candidat.
    // Les éventuels nettoyages historiques restent une action manuelle hors application.
    return {
      ok:false,
      error:'La suppression d’un dossier candidat est désactivée afin d’éviter toute perte de données.'
    };
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
    if (!/^Evaluation_.+\.docx?$/i.test(safe)) return { ok:false, error:'Type de fichier non autorisé.' };
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
