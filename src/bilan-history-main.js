const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { listCandidateDirs, selectCandidate, copyFileIfMissing, ensureDir } = require('./candidate-folder-utils');
const { readJsonFile, encodeJson } = require('./candidate-data-crypto');

module.exports = function registerBilanHistory({ app, ipcMain, getAdminUnlocked, buildNumber, dataRoot = null }) {
  const CURRENT_BUILD = String(buildNumber || 'DEV');
  const TYPE = 'SEB_EVALPRO_BILAN_ARCHIVE';
  const documentsPath = app.getPath('documents');
  const root = dataRoot || path.join(app.getPath('userData'), 'storage');
  const candidatesRoot = path.join(root, 'Candidats');
  const legacyAdminRoot = path.join(root, 'Admin');
  const legacyHistoryDir = path.join(root, 'Bilans', 'Historique');

  function findCandidateDirInternal(candidate) {
    const current = selectCandidate(listCandidateDirs(candidatesRoot, false), candidate);
    if (current) return current.candidateDir;
    const legacy = selectCandidate(listCandidateDirs(legacyAdminRoot, true), candidate);
    return legacy ? legacy.candidateDir : null;
  }

  function safePart(value, fallback = 'INCONNU') {
    let text = String(value || '').trim();
    try { text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
    text = text.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase();
    return text || fallback;
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

  function archivePayloadForHash(archive) {
    const clone = { ...archive };
    delete clone.integritySha256;
    return clone;
  }

  function verify(archive) {
    if (!archive || archive.type !== TYPE || !archive.integritySha256) return false;
    return sha(archivePayloadForHash(archive)) === String(archive.integritySha256);
  }

  function normalizeCandidate(candidate) {
    const c = candidate && typeof candidate === 'object' ? candidate : {};
    return {
      nom: String(c.nom || '').trim(),
      prenom: String(c.prenom || c['prénom'] || '').trim(),
      date: String(c.date || '').trim(),
      lieu: String(c.lieu || c.ville || '').trim(),
      groupe: String(c.groupe || '').trim()
    };
  }

  function normalizeDocument(document) {
    if (!document || typeof document !== 'object') throw new Error('Bilan structuré absent.');
    const rows = Array.isArray(document.rows) ? document.rows : [];
    if (!rows.length) throw new Error('Aucune ligne de bilan à enregistrer.');
    return {
      title: String(document.title || 'Bilan institutionnel'),
      note: String(document.note || ''),
      headers: Array.isArray(document.headers) ? document.headers.map((v) => String(v || '')) : ['Modules', 'NE', 'I', 'II', 'III', 'Commentaires'],
      rows: rows.map((row, index) => ({
        kind: row && row.kind === 'section' ? 'section' : 'item',
        key: String((row && row.key) || `row-${index + 1}`),
        className: String((row && row.className) || ''),
        moduleText: String((row && row.moduleText) || ''),
        sectionText: String((row && row.sectionText) || ''),
        level: ['NE', 'I', 'II', 'III'].includes(String(row && row.level)) ? String(row.level) : '',
        preset: String((row && row.preset) || ''),
        comment: String((row && row.comment) || ''),
        detail: String((row && row.detail) || ''),
        options: Array.isArray(row && row.options) ? row.options.map((opt) => ({
          value: String((opt && opt.value) || ''),
          text: String((opt && opt.text) || ''),
          level: String((opt && opt.level) || '')
        })) : []
      }))
    };
  }

  function candidateHistoryDir(candidate, candidateId = '') {
    const id = String(candidateId || '').trim();
    const selected = id ? listCandidateDirs(candidatesRoot, false).find((record) => String(record.candidateId || '') === id) : null;
    const candidateDir = selected ? selected.candidateDir : findCandidateDirInternal(candidate);
    if (!candidateDir) throw new Error('Dossier candidat introuvable : bilan non enregistré.');
    const dir = path.join(candidateDir, 'bilan', 'historique');
    ensureDir(dir);
    return dir;
  }

  function candidateLocations(filename = '') {
    const safe = filename ? path.basename(String(filename)) : '';
    const out = [];
    for (const record of listCandidateDirs(candidatesRoot, false)) {
      const dir = path.join(record.candidateDir, 'bilan', 'historique');
      if (!fs.existsSync(dir)) continue;
      if (safe) {
        const full = path.join(dir, safe);
        if (fs.existsSync(full)) out.push({ full, filename:safe, record });
      } else {
        for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
          if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) continue;
          out.push({ full:path.join(dir, entry.name), filename:entry.name, record });
        }
      }
    }
    return out;
  }

  function migrateLegacyArchive(filename) {
    const safe = path.basename(String(filename || ''));
    const legacy = path.join(legacyHistoryDir, safe);
    if (!safe.toLowerCase().endsWith('.json') || !fs.existsSync(legacy)) return null;
    let archive = null;
    try { archive = readJsonFile(legacy); } catch (_) { return null; }
    if (!verify(archive)) return { full:legacy, filename:safe, archive, legacy:true, integrityOk:false };
    const candidateDir = findCandidateDirInternal(normalizeCandidate(archive.candidate));
    if (!candidateDir) return { full:legacy, filename:safe, archive, legacy:true, integrityOk:true };
    const target = path.join(candidateDir, 'bilan', 'historique', safe);
    ensureDir(path.dirname(target));
    copyFileIfMissing(legacy, target);
    fs.writeFileSync(target, encodeJson(archive), 'utf8');
    return { full:target, filename:safe, archive, legacy:false, integrityOk:true };
  }

  function readArchive(filename) {
    const safe = path.basename(String(filename || ''));
    if (!safe.toLowerCase().endsWith('.json')) throw new Error('Archive de bilan invalide.');
    const locations = candidateLocations(safe);
    if (locations.length > 1) throw new Error('Plusieurs archives portent le même nom : ouverture refusée par sécurité.');
    let full = locations.length === 1 ? locations[0].full : '';
    if (!full) {
      const migrated = migrateLegacyArchive(safe);
      full = migrated && migrated.full ? migrated.full : '';
    }
    if (!full || !fs.existsSync(full)) throw new Error('Archive de bilan introuvable.');
    const archive = readJsonFile(full);
    if (!verify(archive)) throw new Error('ATTENTION : archive de bilan modifiée ou corrompue. Ouverture refusée.');
    return { archive, filename:safe, full };
  }

  function listArchivesRaw() {
    ensureDir(candidatesRoot);
    const seen = new Set();
    const items = [];

    for (const location of candidateLocations()) {
      try {
        const archive = readJsonFile(location.full);
        items.push({ filename:location.filename, archive, integrityOk:verify(archive), full:location.full });
      } catch (_) {
        items.push({ filename:location.filename, archive:null, integrityOk:false, full:location.full });
      }
      seen.add(location.filename);
    }

    ensureDir(legacyHistoryDir);
    for (const entry of fs.readdirSync(legacyHistoryDir, { withFileTypes:true })) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json') || seen.has(entry.name)) continue;
      const migrated = migrateLegacyArchive(entry.name);
      if (!migrated) continue;
      try {
        const archive = migrated.archive || readJsonFile(migrated.full);
        items.push({ filename:entry.name, archive, integrityOk:verify(archive), full:migrated.full });
      } catch (_) {
        items.push({ filename:entry.name, archive:null, integrityOk:false, full:migrated.full });
      }
      seen.add(entry.name);
    }
    return items;
  }

  function nextRevision(rootId) {
    let max = -1;
    for (const item of listArchivesRaw()) {
      if (!item.integrityOk || !item.archive || item.archive.rootId !== rootId) continue;
      const rev = Number(item.archive.revision);
      if (Number.isFinite(rev)) max = Math.max(max, rev);
    }
    return max + 1;
  }

  function latestForRoot(rootId) {
    return listArchivesRaw()
      .filter((item) => item.integrityOk && item.archive && item.archive.rootId === rootId)
      .sort((a, b) => Number(b.archive.revision || 0) - Number(a.archive.revision || 0))[0] || null;
  }

  function writeArchive({ rootId, revision, parentFilename, originalBuild, candidateId, candidate, document, source }) {
    const targetHistory = candidateHistoryDir(candidate, candidateId);
    const createdAt = new Date().toISOString();
    const body = {
      schemaVersion: 1,
      type: TYPE,
      autonomous: true,
      editable: true,
      immutableRevision: true,
      rootId,
      revision,
      parentFilename: parentFilename || '',
      originalBuild: String(originalBuild || CURRENT_BUILD),
      editedWithBuild: CURRENT_BUILD,
      createdAt,
      candidateId: String(candidateId || ''),
      candidate,
      source: String(source || (revision === 0 ? 'CURRENT_BILAN' : 'HISTORICAL_REVISION')),
      document
    };
    body.documentSha256 = sha(document);
    body.integritySha256 = sha(body);

    const datePart = safePart(candidate.date || createdAt.slice(0, 10), 'DATE');
    const base = [safePart(candidate.nom, 'NOM'), safePart(candidate.prenom, 'PRENOM'), datePart, `BUILD-${safePart(body.originalBuild, 'DEV')}`].join('_');
    const stamp = createdAt.replace(/[-:.TZ]/g, '').slice(0, 14);
    const filename = `${base}_BILAN_R${String(revision).padStart(2, '0')}_${stamp}_${body.documentSha256.slice(0, 10)}.json`;
    const target = path.join(targetHistory, filename);
    const temp = target + '.tmp';
    fs.writeFileSync(temp, encodeJson(body), 'utf8');
    fs.renameSync(temp, target);
    // SEB_CANDIDATE_AUTONOMOUS_BILAN : aucune écriture opérationnelle dans l'ancien historique global.
    return { filename, archive:body };
  }

  ipcMain.handle('bilan-history:save-current', (_event, payload) => {
    if (!getAdminUnlocked()) return { ok:false, error:'Accès administrateur requis.' };
    try {
      const candidateId = String(payload && payload.candidateId || '').trim();
      const candidate = normalizeCandidate(payload && payload.candidate);
      if (!candidateId && !candidate.nom && !candidate.prenom) throw new Error('Candidat non identifié.');
      const document = normalizeDocument(payload && payload.document);
      const sessionToken = safePart(payload && payload.sessionToken, '');
      const rootId = sessionToken || sha({ candidate, originalBuild:String((payload && payload.originalBuild) || CURRENT_BUILD) }).slice(0,24);
      const latest = latestForRoot(rootId);
      const documentSha256 = sha(document);
      if (latest && latest.archive.documentSha256 === documentSha256) {
        return { ok:true, unchanged:true, filename:latest.filename, revision:latest.archive.revision, rootId };
      }
      const revision = nextRevision(rootId);
      const result = writeArchive({
        rootId,
        revision,
        parentFilename: latest ? latest.filename : '',
        originalBuild:String((payload && payload.originalBuild) || CURRENT_BUILD),
        candidateId,
        candidate,
        document,
        source: revision === 0 ? 'CURRENT_BILAN_ORIGINAL' : 'CURRENT_BILAN_SAVE'
      });
      return { ok:true, filename:result.filename, revision, rootId, originalBuild:result.archive.originalBuild };
    } catch (error) {
      return { ok:false, error:error && error.message ? error.message : String(error) };
    }
  });

  ipcMain.handle('bilan-history:list', () => {
    if (!getAdminUnlocked()) return [];
    return listArchivesRaw().map((item) => {
      const a = item.archive || {};
      return {
        filename:item.filename,
        integrityOk:item.integrityOk,
        candidate:a.candidate || {},
        originalBuild:String(a.originalBuild || '?'),
        editedWithBuild:String(a.editedWithBuild || '?'),
        revision:Number(a.revision || 0),
        rootId:String(a.rootId || ''),
        createdAt:String(a.createdAt || ''),
        autonomous:a.autonomous === true,
        editable:a.editable === true
      };
    }).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  });

  ipcMain.handle('bilan-history:load', (_event, filename) => {
    if (!getAdminUnlocked()) return { ok:false, error:'Accès administrateur requis.' };
    try {
      const loaded = readArchive(filename);
      return { ok:true, filename:loaded.filename, archive:loaded.archive };
    } catch (error) {
      return { ok:false, error:error && error.message ? error.message : String(error) };
    }
  });

  ipcMain.handle('bilan-history:delete-revision', (_event, filename) => {
    if (!getAdminUnlocked()) return { ok:false, error:'Accès administrateur requis.' };
    try {
      const loaded = readArchive(filename);
      const revision = Number(loaded.archive && loaded.archive.revision);
      if (!Number.isFinite(revision) || revision <= 0) throw new Error('Le bilan Original est protégé et ne peut pas être supprimé.');
      fs.unlinkSync(loaded.full);
      return { ok:true, filename:loaded.filename, revision, rootId:String(loaded.archive.rootId || '') };
    } catch (error) {
      return { ok:false, error:error && error.message ? error.message : String(error) };
    }
  });

  ipcMain.handle('bilan-history:save-revision', (_event, payload) => {
    if (!getAdminUnlocked()) return { ok:false, error:'Accès administrateur requis.' };
    try {
      const loaded = readArchive(payload && payload.sourceFilename);
      const source = loaded.archive;
      const document = normalizeDocument(payload && payload.document);
      const documentSha256 = sha(document);
      const latest = latestForRoot(source.rootId);
      if (latest && latest.archive.documentSha256 === documentSha256) {
        return { ok:true, unchanged:true, filename:latest.filename, revision:latest.archive.revision, rootId:source.rootId };
      }
      const revision = nextRevision(source.rootId);
      const result = writeArchive({
        rootId:source.rootId,
        revision,
        parentFilename:loaded.filename,
        originalBuild:source.originalBuild,
        candidateId:String(source.candidateId || ''),
        candidate:normalizeCandidate(source.candidate),
        document,
        source:'HISTORICAL_REVISION'
      });
      return { ok:true, filename:result.filename, revision, rootId:source.rootId, originalBuild:source.originalBuild };
    } catch (error) {
      return { ok:false, error:error && error.message ? error.message : String(error) };
    }
  });
  function historicalWordDir() {
    return path.join(app.getPath('documents'), 'SEB EvalPro');
  }

  function historicalWordArchiveDir(candidate) {
    const normalized = normalizeCandidate(candidate);
    const record = selectCandidate(listCandidateDirs(candidatesRoot, false), normalized);
    if (!record) return null;
    const directory = path.join(record.candidateDir, 'bilan', 'exports');
    ensureDir(directory);
    return directory;
  }

  function historicalWordPath(filename) {
    const directory = historicalWordDir();
    fs.mkdirSync(directory, { recursive: true });
    return path.join(directory, filename);
  }

  function cleanupLegacyHistoricalWords(filename) {
    const directory = historicalWordDir();
    fs.mkdirSync(directory, { recursive: true });
    const parsed = path.parse(filename);
    const escapedBase = String(parsed.name).replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
    const oldRevision = new RegExp('^' + escapedBase + '_R\\d+(?:_\\d+)?\\.doc$', 'i');
    const oldDuplicate = new RegExp('^' + escapedBase + '_\\d+\\.doc$', 'i');
    for (const entry of fs.readdirSync(directory)) {
      if (entry.toLowerCase() === filename.toLowerCase()) continue;
      if (!oldRevision.test(entry) && !oldDuplicate.test(entry)) continue;
      try { fs.rmSync(path.join(directory, entry), { force: true }); } catch (_) {}
    }
  }

  ipcMain.on('bilan-history:write-word-sync', (event, payload) => {
    if (!getAdminUnlocked()) {
      event.returnValue = { ok: false, error: 'Accès administrateur requis.' };
      return;
    }
    try {
      const filename = path.basename(String((payload && payload.filename) || ''));
      if (!filename || !filename.toLowerCase().endsWith('.doc')) throw new Error('Nom du document Word invalide.');
      const html = String((payload && payload.html) || '');
      if (html.length < 100 || !html.includes('<table')) throw new Error('Contenu Word vide ou invalide.');
      const candidate = normalizeCandidate(payload && payload.candidate);
      cleanupLegacyHistoricalWords(filename);
      const target = historicalWordPath(filename);
      const temp = `${target}.tmp`;
      fs.writeFileSync(temp, '\uFEFF' + html, 'utf8');
      if (fs.existsSync(target)) fs.rmSync(target, { force: true });
      fs.renameSync(temp, target);
      if (!fs.existsSync(target)) throw new Error('Le document Word n’a pas été créé sur le disque.');
      const size = fs.statSync(target).size;
      if (size < 100) throw new Error('Le document Word créé est vide.');

      const archiveDir = historicalWordArchiveDir(candidate);
      if (archiveDir) {
        fs.copyFileSync(target, path.join(archiveDir, path.basename(target)));
      }

      event.returnValue = { ok: true, filename: path.basename(target), path: target, size };
    } catch (error) {
      event.returnValue = { ok: false, error: error && error.message ? error.message : String(error) };
    }
  });

  ipcMain.on('bilan-history:get-word-template-sync', (event) => {
    if (!getAdminUnlocked()) {
      event.returnValue = { ok: false, error: 'Accès administrateur requis.' };
      return;
    }
    try {
      const templatePath = path.join(__dirname, '..', 'app', 'web', 'admin-bilan.html');
      if (!fs.existsSync(templatePath)) throw new Error('Modèle institutionnel du bilan introuvable.');
      const html = fs.readFileSync(templatePath, 'utf8');
      if (!html.includes('id="bilan"') || !html.includes('data-r="fabrication-plan"')) {
        throw new Error('Modèle institutionnel du bilan invalide.');
      }
      event.returnValue = { ok: true, html };
    } catch (error) {
      event.returnValue = { ok: false, error: error && error.message ? error.message : String(error) };
    }
  });

};
