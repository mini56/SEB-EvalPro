const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function registerBilanHistory({ app, ipcMain, getAdminUnlocked, buildNumber }) {
  const CURRENT_BUILD = String(buildNumber || 'DEV');
  const TYPE = 'SEB_EVALPRO_BILAN_ARCHIVE';

  function historyDir() {
    return path.join(app.getPath('documents'), 'SEB EvalPro', 'Bilans', 'Historique');
  }

  function ensureDir() {
    fs.mkdirSync(historyDir(), { recursive: true });
  }

  function safePart(value, fallback = 'INCONNU') {
    let text = String(value || '').trim();
    try { text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
    text = text.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase();
    return text || fallback;
  }

  function stableJson(value) {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
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

  function readArchive(filename) {
    const safe = path.basename(String(filename || ''));
    if (!safe.toLowerCase().endsWith('.json')) throw new Error('Archive de bilan invalide.');
    const full = path.join(historyDir(), safe);
    if (!fs.existsSync(full)) throw new Error('Archive de bilan introuvable.');
    const archive = JSON.parse(fs.readFileSync(full, 'utf8'));
    if (!verify(archive)) throw new Error('Archive de bilan modifiée ou corrompue.');
    return { archive, filename: safe, full };
  }

  function listArchivesRaw() {
    ensureDir();
    return fs.readdirSync(historyDir(), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
      .map((entry) => {
        try {
          const archive = JSON.parse(fs.readFileSync(path.join(historyDir(), entry.name), 'utf8'));
          return { filename: entry.name, archive, integrityOk: verify(archive) };
        } catch (_) {
          return { filename: entry.name, archive: null, integrityOk: false };
        }
      });
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

  function normalizeCandidate(candidate) {
    const c = candidate && typeof candidate === 'object' ? candidate : {};
    return {
      nom: String(c.nom || '').trim(),
      prenom: String(c.prenom || c['prénom'] || '').trim(),
      date: String(c.date || '').trim(),
      lieu: String(c.lieu || '').trim(),
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

  function writeArchive({ rootId, revision, parentFilename, originalBuild, candidate, document, source }) {
    ensureDir();
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
    const target = path.join(historyDir(), filename);
    const temp = `${target}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(body, null, 2), 'utf8');
    fs.renameSync(temp, target);
    return { filename, archive: body };
  }

  ipcMain.handle('bilan-history:save-current', (_event, payload) => {
    if (!getAdminUnlocked()) return { ok: false, error: 'Accès administrateur requis.' };
    try {
      const candidate = normalizeCandidate(payload && payload.candidate);
      if (!candidate.nom && !candidate.prenom) throw new Error('Candidat non identifié.');
      const document = normalizeDocument(payload && payload.document);
      const sessionToken = safePart(payload && payload.sessionToken, '');
      const rootId = sessionToken || sha({ candidate, originalBuild: String((payload && payload.originalBuild) || CURRENT_BUILD) }).slice(0, 24);
      const latest = latestForRoot(rootId);
      const documentSha256 = sha(document);
      if (latest && latest.archive.documentSha256 === documentSha256) {
        return { ok: true, unchanged: true, filename: latest.filename, revision: latest.archive.revision, rootId };
      }
      const revision = nextRevision(rootId);
      const result = writeArchive({
        rootId,
        revision,
        parentFilename: latest ? latest.filename : '',
        originalBuild: String((payload && payload.originalBuild) || CURRENT_BUILD),
        candidate,
        document,
        source: revision === 0 ? 'CURRENT_BILAN_ORIGINAL' : 'CURRENT_BILAN_SAVE'
      });
      return { ok: true, filename: result.filename, revision, rootId, originalBuild: result.archive.originalBuild };
    } catch (error) {
      return { ok: false, error: error && error.message ? error.message : String(error) };
    }
  });

  ipcMain.handle('bilan-history:list', () => {
    if (!getAdminUnlocked()) return [];
    return listArchivesRaw().map((item) => {
      const a = item.archive || {};
      return {
        filename: item.filename,
        integrityOk: item.integrityOk,
        candidate: a.candidate || {},
        originalBuild: String(a.originalBuild || '?'),
        editedWithBuild: String(a.editedWithBuild || '?'),
        revision: Number(a.revision || 0),
        rootId: String(a.rootId || ''),
        createdAt: String(a.createdAt || ''),
        autonomous: a.autonomous === true,
        editable: a.editable === true
      };
    }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  });

  ipcMain.handle('bilan-history:load', (_event, filename) => {
    if (!getAdminUnlocked()) return { ok: false, error: 'Accès administrateur requis.' };
    try {
      const loaded = readArchive(filename);
      return { ok: true, filename: loaded.filename, archive: loaded.archive };
    } catch (error) {
      return { ok: false, error: error && error.message ? error.message : String(error) };
    }
  });

  ipcMain.handle('bilan-history:save-revision', (_event, payload) => {
    if (!getAdminUnlocked()) return { ok: false, error: 'Accès administrateur requis.' };
    try {
      const loaded = readArchive(payload && payload.sourceFilename);
      const source = loaded.archive;
      const document = normalizeDocument(payload && payload.document);
      const documentSha256 = sha(document);
      const latest = latestForRoot(source.rootId);
      if (latest && latest.archive.documentSha256 === documentSha256) {
        return { ok: true, unchanged: true, filename: latest.filename, revision: latest.archive.revision, rootId: source.rootId };
      }
      const revision = nextRevision(source.rootId);
      const result = writeArchive({
        rootId: source.rootId,
        revision,
        parentFilename: loaded.filename,
        originalBuild: source.originalBuild,
        candidate: normalizeCandidate(source.candidate),
        document,
        source: 'HISTORICAL_REVISION'
      });
      return { ok: true, filename: result.filename, revision, rootId: source.rootId, originalBuild: source.originalBuild };
    } catch (error) {
      return { ok: false, error: error && error.message ? error.message : String(error) };
    }
  });
};
