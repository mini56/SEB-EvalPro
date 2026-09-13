const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function registerCandidateReplay({ app, ipcMain, getAdminUnlocked, buildNumber }) {
  const BUILD = String(buildNumber || 'DEV');
  const ARCHIVE_MARKER_KEYS = new Set([
    'seb_evalpro_replay_archive',
    'seb_evalpro_replay_archive_file'
  ]);

  function parcoursDir() {
    return path.join(app.getPath('documents'), 'SEB EvalPro', 'parcours');
  }

  function ensureParcoursDir() {
    fs.mkdirSync(parcoursDir(), { recursive: true });
  }

  function safePart(value, fallback = 'INCONNU') {
    let text = String(value || '').trim();
    try { text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
    text = text.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase();
    return text || fallback;
  }

  function parseJson(value, fallback = null) {
    try { return JSON.parse(String(value || '')); } catch (_) { return fallback; }
  }

  function candidateFromStorage(storage) {
    const c = parseJson(storage && storage.candidat_data, {}) || {};
    return {
      nom: String(c.nom || '').trim(),
      prenom: String(c['prénom'] || c.prenom || '').trim(),
      lieu: String(c.lieu || '').trim(),
      groupe: String(c.groupe || '').trim(),
      date: String(c.date || c.dateTest || '').trim()
    };
  }

  function normalizedSnapshot(payload) {
    const sessionStorage = { ...((payload && payload.sessionStorage) || {}) };
    for (const key of ARCHIVE_MARKER_KEYS) delete sessionStorage[key];
    return {
      sessionStorage,
      localStorage: { ...((payload && payload.localStorage) || {}) },
      lastPage: String((payload && payload.lastPage) || 'qcmv1.0.html'),
      lastEvaluationPage: String((payload && payload.lastEvaluationPage) || 'qcmv1.0.html')
    };
  }

  function snapshotSha(snapshot) {
    return crypto.createHash('sha256').update(JSON.stringify(snapshot), 'utf8').digest('hex');
  }

  function verifyArchive(archive) {
    if (!archive || typeof archive !== 'object' || !archive.snapshot || !archive.integritySha256) return false;
    return snapshotSha(archive.snapshot) === String(archive.integritySha256);
  }

  function readArchive(fullPath) {
    const archive = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    return archive;
  }

  ipcMain.handle('replay:archive-final', (event, payload) => {
    try {
      if (!payload || payload.finalPageVisible !== true) {
        return { ok: false, error: 'Archivage refusé : la page Résultats n’est pas affichée.' };
      }
      let senderPage = '';
      try { senderPage = path.basename(new URL(event.sender.getURL()).pathname); } catch (_) {}
      if (String(senderPage).toLowerCase() !== 'qcmv1.0.html') {
        return { ok: false, error: 'Archivage refusé hors de la page finale du parcours.' };
      }

      const snapshot = normalizedSnapshot(payload);
      const candidate = candidateFromStorage(snapshot.sessionStorage);
      if (!candidate.nom && !candidate.prenom) {
        return { ok: false, error: 'Candidat non identifié : archive non créée.' };
      }

      ensureParcoursDir();
      const integritySha256 = snapshotSha(snapshot);
      const datePart = safePart(candidate.date || new Date().toISOString().slice(0, 10), 'DATE');
      const base = [safePart(candidate.nom, 'NOM'), safePart(candidate.prenom, 'PRENOM'), datePart, `BUILD-${safePart(BUILD, 'DEV')}`].join('_');
      const filename = `${base}_${integritySha256.slice(0, 12)}.json`;
      const target = path.join(parcoursDir(), filename);

      if (!fs.existsSync(target)) {
        const archive = {
          schemaVersion: 1,
          type: 'SEB_EVALPRO_PARCOURS_ARCHIVE',
          readOnly: true,
          build: BUILD,
          archivedAt: new Date().toISOString(),
          candidate,
          integritySha256,
          snapshot
        };
        const temp = `${target}.tmp`;
        fs.writeFileSync(temp, JSON.stringify(archive, null, 2), 'utf8');
        fs.renameSync(temp, target);
      }

      return { ok: true, filename, build: BUILD, integritySha256 };
    } catch (error) {
      return { ok: false, error: error && error.message ? error.message : String(error) };
    }
  });

  ipcMain.handle('admin:list-parcours', () => {
    if (!getAdminUnlocked()) return [];
    try {
      ensureParcoursDir();
      return fs.readdirSync(parcoursDir(), { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
        .map((entry) => {
          const fullPath = path.join(parcoursDir(), entry.name);
          const stat = fs.statSync(fullPath);
          try {
            const archive = readArchive(fullPath);
            return {
              filename: entry.name,
              candidate: archive.candidate || {},
              build: String(archive.build || '?'),
              archivedAt: String(archive.archivedAt || stat.mtime.toISOString()),
              integrityOk: verifyArchive(archive)
            };
          } catch (_) {
            return {
              filename: entry.name,
              candidate: {},
              build: '?',
              archivedAt: stat.mtime.toISOString(),
              integrityOk: false
            };
          }
        })
        .sort((a, b) => String(b.archivedAt).localeCompare(String(a.archivedAt)));
    } catch (_) {
      return [];
    }
  });

  ipcMain.handle('admin:load-parcours', (_event, requestedName) => {
    if (!getAdminUnlocked()) return { ok: false, error: 'Accès administrateur requis.' };
    const filename = path.basename(String(requestedName || ''));
    if (!filename.toLowerCase().endsWith('.json')) return { ok: false, error: 'Archive invalide.' };
    try {
      const fullPath = path.join(parcoursDir(), filename);
      if (!fs.existsSync(fullPath)) return { ok: false, error: 'Archive introuvable.' };
      const archive = readArchive(fullPath);
      if (archive.type !== 'SEB_EVALPRO_PARCOURS_ARCHIVE' || archive.readOnly !== true) {
        return { ok: false, error: 'Format d’archive non reconnu.' };
      }
      if (!verifyArchive(archive)) {
        return { ok: false, error: 'Archive modifiée ou corrompue : replay refusé.' };
      }
      return { ok: true, archive };
    } catch (error) {
      return { ok: false, error: error && error.message ? error.message : String(error) };
    }
  });
};
