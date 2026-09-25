const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { listCandidateDirs, selectCandidate } = require('./candidate-folder-utils');
const { readJsonFile, encodeJson } = require('./candidate-data-crypto');

module.exports = function registerCandidateReplay({ app, ipcMain, getAdminUnlocked, buildNumber, dataRoot = null }) {
  const BUILD = String(buildNumber || 'DEV');
  const TYPE = 'SEB_EVALPRO_PARCOURS_ARCHIVE';
  const SCHEMA_VERSION = 2;
  const captureQueues = new Map();
  let replayAtomicCounter = 0;
  const storageRoot = dataRoot || path.join(app.getPath('userData'), 'storage');
  const candidatesRoot = path.join(storageRoot, 'Candidats');
  const legacyAdminRoot = path.join(storageRoot, 'Admin');

  function findCandidateDirInternal(candidate) {
    const current = selectCandidate(listCandidateDirs(candidatesRoot, false), candidate);
    if (current) return current.candidateDir;
    const legacy = selectCandidate(listCandidateDirs(legacyAdminRoot, true), candidate);
    return legacy ? legacy.candidateDir : null;
  }
  const ARCHIVE_MARKER_KEYS = new Set([
    'seb_evalpro_replay_archive',
    'seb_evalpro_replay_archive_file',
    'seb_evalpro_replay_archive_build'
  ]);

  function parcoursDir() {
    return path.join(storageRoot, 'parcours');
  }

  function pendingRoot() {
    return path.join(app.getPath('userData'), 'replay-pending');
  }

  function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
  }

  function ensureParcoursDir() {
    ensureDir(parcoursDir());
  }

  function ensurePendingRoot() {
    ensureDir(pendingRoot());
  }

  function atomicWriteReplayFile(target, data, encoding) {
    replayAtomicCounter += 1;
    const temp = `${target}.${process.pid}.${replayAtomicCounter}.tmp`;
    ensureDir(path.dirname(target));
    if (encoding) fs.writeFileSync(temp, data, encoding);
    else fs.writeFileSync(temp, data);
    let lastError = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        fs.renameSync(temp, target);
        return;
      } catch (error) {
        lastError = error;
        const code = String(error && error.code || '');
        if (!['EPERM','EACCES','EBUSY','EEXIST','ENOTEMPTY'].includes(code)) break;
        try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25 + attempt * 35); } catch (_) {}
      }
    }
    try { fs.rmSync(temp, { force:true }); } catch (_) {}
    throw lastError || new Error('Écriture Replay impossible.');
  }

  function enqueueCapture(token, work) {
    const previous = captureQueues.get(token) || Promise.resolve();
    const current = previous.catch(() => {}).then(work);
    captureQueues.set(token, current);
    const cleanup = () => {
      if (captureQueues.get(token) === current) captureQueues.delete(token);
    };
    current.then(cleanup, cleanup);
    return current;
  }

  function safeToken(value) {
    const text = String(value || '').trim();
    return /^[A-Za-z0-9-]{12,100}$/.test(text) ? text : '';
  }

  function safePart(value, fallback = 'INCONNU') {
    let text = String(value || '').trim();
    try { text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
    text = text.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase();
    return text || fallback;
  }

  function safePageKey(value) {
    const text = String(value || '').trim().slice(0, 220);
    return text || 'page-inconnue';
  }

  function parseJson(value, fallback = null) {
    try { return JSON.parse(String(value || '')); } catch (_) { return fallback; }
  }

  function sha256Buffer(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  function sha256Json(value) {
    return crypto.createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
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

  function pendingDir(token) {
    return path.join(pendingRoot(), token);
  }

  function pendingIndexPath(token) {
    return path.join(pendingDir(token), 'index.json');
  }

  function readPendingIndex(token) {
    const file = pendingIndexPath(token);
    if (!fs.existsSync(file)) return { schemaVersion: 1, token, pages: {} };
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || !parsed.pages || typeof parsed.pages !== 'object') {
        return { schemaVersion: 1, token, pages: {} };
      }
      return parsed;
    } catch (_) {
      return { schemaVersion: 1, token, pages: {} };
    }
  }

  function writePendingIndex(token, index) {
    const dir = pendingDir(token);
    ensureDir(dir);
    const target = pendingIndexPath(token);
    atomicWriteReplayFile(target, JSON.stringify(index, null, 2), 'utf8');
  }

  function cleanupOldPending() {
    try {
      ensurePendingRoot();
      const now = Date.now();
      for (const entry of fs.readdirSync(pendingRoot(), { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const full = path.join(pendingRoot(), entry.name);
        try {
          const age = now - fs.statSync(full).mtimeMs;
          if (age > 7 * 24 * 60 * 60 * 1000) fs.rmSync(full, { recursive: true, force: true });
        } catch (_) {}
      }
    } catch (_) {}
  }

  function archiveIntegrityPayload(manifest) {
    return {
      schemaVersion: manifest.schemaVersion,
      type: manifest.type,
      readOnly: manifest.readOnly,
      archiveMode: manifest.archiveMode,
      futureVersionIndependent: manifest.futureVersionIndependent,
      build: manifest.build,
      archivedAt: manifest.archivedAt,
      candidate: manifest.candidate,
      snapshot: manifest.snapshot,
      slides: (manifest.slides || []).map((slide) => ({
        order: slide.order,
        pageKey: slide.pageKey,
        title: slide.title,
        file: slide.file,
        capturedAt: slide.capturedAt,
        width: slide.width,
        height: slide.height,
        sha256: slide.sha256
      }))
    };
  }

  function computeArchiveIntegrity(manifest) {
    return sha256Json(archiveIntegrityPayload(manifest));
  }

  function readManifest(folderPath) {
    return readJsonFile(path.join(folderPath, 'manifest.json'));
  }

  function verifyArchiveDirectory(folderPath, manifest) {
    try {
      if (!manifest || manifest.type !== TYPE || manifest.readOnly !== true || manifest.schemaVersion !== SCHEMA_VERSION) return false;
      if (computeArchiveIntegrity(manifest) !== String(manifest.integritySha256 || '')) return false;
      for (const slide of manifest.slides || []) {
        const name = path.basename(String(slide.file || ''));
        if (!name || name !== slide.file || !name.toLowerCase().endsWith('.png')) return false;
        const full = path.join(folderPath, 'slides', name);
        if (!fs.existsSync(full)) return false;
        const actual = sha256Buffer(fs.readFileSync(full));
        if (actual !== String(slide.sha256 || '')) return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function legacySnapshotSha(snapshot) {
    return sha256Json(snapshot);
  }

  function verifyLegacyArchive(archive) {
    if (!archive || typeof archive !== 'object' || !archive.snapshot || !archive.integritySha256) return false;
    return legacySnapshotSha(archive.snapshot) === String(archive.integritySha256);
  }

  async function capturePage(event, payload) {
    const token = safeToken(payload && payload.token);
    if (!token) return { ok: false, error: 'Jeton de parcours invalide.' };
    return enqueueCapture(token, async () => {
    try {
      const pageKey = safePageKey(payload && payload.pageKey);
      const title = String((payload && payload.title) || pageKey).trim().slice(0, 180) || pageKey;
      cleanupOldPending();
      ensurePendingRoot();

      const image = await event.sender.capturePage();
      if (!image || image.isEmpty()) return { ok: false, error: 'Capture visuelle vide.' };
      const png = image.toPNG();
      if (!png || !png.length) return { ok: false, error: 'Capture PNG vide.' };
      const size = image.getSize();

      const index = readPendingIndex(token);
      const existing = index.pages[pageKey];
      const order = existing && Number.isFinite(Number(existing.order))
        ? Number(existing.order)
        : Object.keys(index.pages).length + 1;
      const file = existing && existing.file
        ? path.basename(existing.file)
        : `${String(order).padStart(3, '0')}_${safePart(pageKey, 'PAGE').slice(0, 70)}.png`;
      const targetDir = pendingDir(token);
      ensureDir(targetDir);
      const target = path.join(targetDir, file);
      atomicWriteReplayFile(target, png);

      index.pages[pageKey] = {
        order,
        pageKey,
        title,
        file,
        capturedAt: new Date().toISOString(),
        width: Number(size.width || 0),
        height: Number(size.height || 0),
        sha256: sha256Buffer(png)
      };
      index.updatedAt = new Date().toISOString();
      writePendingIndex(token, index);
      return { ok: true, pageKey, order, file };
    } catch (error) {
      return { ok: false, error: error && error.message ? error.message : String(error) };
    }
    });
  }

  ipcMain.handle('replay:capture-page', capturePage);

  ipcMain.handle('replay:archive-final', async (event, payload) => {
    try {
      if (!payload || payload.finalPageVisible !== true) {
        return { ok: false, error: 'Archivage refusé : la page Résultats n’est pas affichée.' };
      }
      let senderPage = '';
      try { senderPage = path.basename(new URL(event.sender.getURL()).pathname); } catch (_) {}
      if (String(senderPage).toLowerCase() !== 'qcmv1.0.html') {
        return { ok: false, error: 'Archivage refusé hors de la page finale du parcours.' };
      }

      const token = safeToken(payload.token);
      if (!token) return { ok: false, error: 'Jeton du parcours absent.' };
      const snapshot = normalizedSnapshot(payload);
      const candidate = candidateFromStorage(snapshot.sessionStorage);
      if (!candidate.nom && !candidate.prenom) {
        return { ok: false, error: 'Candidat non identifié : archive non créée.' };
      }

      const candidateDir = findCandidateDirInternal(candidate);
      if (!candidateDir) {
        return { ok: false, error: 'Dossier candidat introuvable : replay non créé.' };
      }
      const candidateReplayRoot = path.join(candidateDir, 'replay');
      ensureDir(candidateReplayRoot);
      const pending = readPendingIndex(token);
      const pendingSlides = Object.values(pending.pages || {}).sort((a, b) => Number(a.order) - Number(b.order));
      if (!pendingSlides.length) {
        return { ok: false, error: 'Aucune page visuelle capturée : archive non créée.' };
      }

      const snapshotSha256 = sha256Json(snapshot);
      const datePart = safePart(candidate.date || new Date().toISOString().slice(0, 10), 'DATE');
      const base = ['REPLAY', safePart(path.basename(candidateDir), 'CAND'), datePart, `BUILD-${safePart(BUILD, 'DEV')}`, snapshotSha256.slice(0, 12)].join('_');
      const folderName = base;
      const targetFolder = path.join(candidateReplayRoot, folderName);
      const manifestPath = path.join(targetFolder, 'manifest.json');

      if (fs.existsSync(manifestPath)) {
        const manifest = readManifest(targetFolder);
        if (verifyArchiveDirectory(targetFolder, manifest)) {
          return { ok: true, filename: folderName, build: BUILD, integritySha256: manifest.integritySha256, slides: manifest.slides.length };
        }
        return { ok: false, error: 'Une archive existante portant ce nom est invalide.' };
      }

      const tempFolder = `${targetFolder}.tmp-${process.pid}-${Date.now()}`;
      const slidesDir = path.join(tempFolder, 'slides');
      ensureDir(slidesDir);
      const slides = [];
      for (const source of pendingSlides) {
        const srcName = path.basename(String(source.file || ''));
        const src = path.join(pendingDir(token), srcName);
        if (!srcName || !fs.existsSync(src)) continue;
        const buffer = fs.readFileSync(src);
        const outName = `${String(slides.length + 1).padStart(3, '0')}_${safePart(source.pageKey, 'PAGE').slice(0, 70)}.png`;
        fs.writeFileSync(path.join(slidesDir, outName), buffer);
        slides.push({
          order: slides.length + 1,
          pageKey: String(source.pageKey || ''),
          title: String(source.title || source.pageKey || 'Page'),
          file: outName,
          capturedAt: String(source.capturedAt || new Date().toISOString()),
          width: Number(source.width || 0),
          height: Number(source.height || 0),
          sha256: sha256Buffer(buffer)
        });
      }
      if (!slides.length) {
        fs.rmSync(tempFolder, { recursive: true, force: true });
        return { ok: false, error: 'Les captures visuelles temporaires sont introuvables.' };
      }

      const manifest = {
        schemaVersion: SCHEMA_VERSION,
        type: TYPE,
        readOnly: true,
        archiveMode: 'VISUAL_FROZEN_SLIDES',
        futureVersionIndependent: true,
        build: BUILD,
        archivedAt: new Date().toISOString(),
        candidate,
        snapshotSha256,
        snapshot,
        slides
      };
      manifest.integritySha256 = computeArchiveIntegrity(manifest);
      fs.writeFileSync(path.join(tempFolder, 'manifest.json'), encodeJson(manifest), 'utf8');
      fs.renameSync(tempFolder, targetFolder);
      // SEB_CANDIDATE_AUTONOMOUS_REPLAY: le dossier candidat est la source unique du replay.

      try { fs.rmSync(pendingDir(token), { recursive: true, force: true }); } catch (_) {}
      return { ok: true, filename: folderName, build: BUILD, integritySha256: manifest.integritySha256, slides: slides.length };
    } catch (error) {
      return { ok: false, error: error && error.message ? error.message : String(error) };
    }
  });

  function candidateRecordById(candidateId) {
    return listCandidateDirs(candidatesRoot, false).find((record) => String(record.candidateId) === String(candidateId || '')) || null;
  }

  function loadCandidateArchive(candidateId, requestedName) {
    const record = candidateRecordById(candidateId);
    if (!record) return { ok:false, error:'Candidat introuvable.' };
    const name = path.basename(String(requestedName || ''));
    if (!name) return { ok:false, error:'Archive invalide.' };
    const fullPath = path.join(record.candidateDir, 'replay', name);
    if (!fs.existsSync(fullPath)) return { ok:false, error:'Replay introuvable dans le dossier de ce candidat.' };
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isFile() && name.toLowerCase().endsWith('.json')) {
        const archive = readJsonFile(fullPath);
        if (!verifyLegacyArchive(archive)) {
          return { ok:false, corruption:true, error:'ATTENTION : le replay est modifié ou corrompu. Il n’a pas été ouvert.' };
        }
        if (!selectCandidate([record], archive.candidate || {})) {
          return { ok:false, corruption:true, error:'ATTENTION : ce replay ne correspond pas à ce candidat. Ouverture refusée.' };
        }
        return {
          ok:true,
          legacy:true,
          archive:{
            build:String(archive.build || '?'),
            archivedAt:String(archive.archivedAt || ''),
            candidate:archive.candidate || {},
            slides:[]
          },
          warning:'Ancien prototype : aucune capture visuelle autonome n’était enregistrée.'
        };
      }
      if (!stat.isDirectory()) return { ok:false, error:'Format de replay non reconnu.' };
      const manifest = readManifest(fullPath);
      if (!verifyArchiveDirectory(fullPath, manifest)) {
        return { ok:false, corruption:true, error:'ATTENTION : le replay est modifié ou corrompu. Il n’a pas été ouvert.' };
      }
      if (!selectCandidate([record], manifest.candidate || {})) {
        return { ok:false, corruption:true, error:'ATTENTION : ce replay ne correspond pas à ce candidat. Ouverture refusée.' };
      }
      return {
        ok:true,
        legacy:false,
        archive:{
          schemaVersion:manifest.schemaVersion,
          type:manifest.type,
          readOnly:true,
          archiveMode:manifest.archiveMode,
          futureVersionIndependent:manifest.futureVersionIndependent,
          build:manifest.build,
          archivedAt:manifest.archivedAt,
          candidate:manifest.candidate,
          integritySha256:manifest.integritySha256,
          slides:manifest.slides
        }
      };
    } catch (error) {
      return { ok:false, error:error && error.message ? error.message : String(error) };
    }
  }

  ipcMain.handle('admin:load-candidate-parcours', (_event, candidateId, requestedName) => {
    if (!getAdminUnlocked()) return { ok:false, error:'Accès administrateur requis.' };
    return loadCandidateArchive(candidateId, requestedName);
  });

  ipcMain.handle('admin:get-candidate-parcours-slide', (_event, candidateId, requestedName, requestedFile) => {
    if (!getAdminUnlocked()) return { ok:false, error:'Accès administrateur requis.' };
    const loaded = loadCandidateArchive(candidateId, requestedName);
    if (!loaded || !loaded.ok || loaded.legacy) return loaded && !loaded.ok ? loaded : { ok:false, error:'Replay visuel indisponible.' };
    const record = candidateRecordById(candidateId);
    const name = path.basename(String(requestedName || ''));
    const file = path.basename(String(requestedFile || ''));
    if (!record || !name || !file || !file.toLowerCase().endsWith('.png')) return { ok:false, error:'Diapositive invalide.' };
    try {
      const folder = path.join(record.candidateDir, 'replay', name);
      const manifest = readManifest(folder);
      if (!verifyArchiveDirectory(folder, manifest)) return { ok:false, corruption:true, error:'ATTENTION : replay corrompu.' };
      if (!selectCandidate([record], manifest.candidate || {})) return { ok:false, corruption:true, error:'ATTENTION : replay d’un autre candidat refusé.' };
      const slide = (manifest.slides || []).find((item) => String(item.file) === file);
      if (!slide) return { ok:false, error:'Diapositive absente du manifeste.' };
      const buffer = fs.readFileSync(path.join(folder, 'slides', file));
      if (sha256Buffer(buffer) !== String(slide.sha256 || '')) return { ok:false, corruption:true, error:'ATTENTION : diapositive corrompue.' };
      return { ok:true, dataUrl:`data:image/png;base64,${buffer.toString('base64')}`, slide };
    } catch (error) {
      return { ok:false, error:error && error.message ? error.message : String(error) };
    }
  });

  ipcMain.handle('admin:list-parcours', () => {
    if (!getAdminUnlocked()) return [];
    try {
      ensureParcoursDir();
      const results = [];
      for (const entry of fs.readdirSync(parcoursDir(), { withFileTypes: true })) {
        const fullPath = path.join(parcoursDir(), entry.name);
        if (entry.isDirectory()) {
          const manifestPath = path.join(fullPath, 'manifest.json');
          if (!fs.existsSync(manifestPath)) continue;
          const stat = fs.statSync(fullPath);
          try {
            const manifest = readManifest(fullPath);
            results.push({
              filename: entry.name,
              candidate: manifest.candidate || {},
              build: String(manifest.build || '?'),
              archivedAt: String(manifest.archivedAt || stat.mtime.toISOString()),
              integrityOk: verifyArchiveDirectory(fullPath, manifest),
              slideCount: Array.isArray(manifest.slides) ? manifest.slides.length : 0,
              archiveMode: String(manifest.archiveMode || ''),
              legacy: false
            });
          } catch (_) {
            results.push({ filename: entry.name, candidate: {}, build: '?', archivedAt: stat.mtime.toISOString(), integrityOk: false, slideCount: 0, archiveMode: '', legacy: false });
          }
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
          const stat = fs.statSync(fullPath);
          try {
            const archive = readJsonFile(fullPath);
            results.push({
              filename: entry.name,
              candidate: archive.candidate || {},
              build: String(archive.build || '?'),
              archivedAt: String(archive.archivedAt || stat.mtime.toISOString()),
              integrityOk: verifyLegacyArchive(archive),
              slideCount: 0,
              archiveMode: 'LEGACY_DATA_ONLY',
              legacy: true
            });
          } catch (_) {
            results.push({ filename: entry.name, candidate: {}, build: '?', archivedAt: stat.mtime.toISOString(), integrityOk: false, slideCount: 0, archiveMode: 'LEGACY_DATA_ONLY', legacy: true });
          }
        }
      }
      return results.sort((a, b) => String(b.archivedAt).localeCompare(String(a.archivedAt)));
    } catch (_) {
      return [];
    }
  });

  ipcMain.handle('admin:load-parcours', (_event, requestedName) => {
    if (!getAdminUnlocked()) return { ok: false, error: 'Accès administrateur requis.' };
    const name = path.basename(String(requestedName || ''));
    if (!name) return { ok: false, error: 'Archive invalide.' };
    try {
      const fullPath = path.join(parcoursDir(), name);
      if (!fs.existsSync(fullPath)) return { ok: false, error: 'Archive introuvable.' };
      const stat = fs.statSync(fullPath);
      if (stat.isFile() && name.toLowerCase().endsWith('.json')) {
        const archive = readJsonFile(fullPath);
        if (!verifyLegacyArchive(archive)) return { ok: false, error: 'Archive historique modifiée ou corrompue.' };
        return {
          ok: true,
          legacy: true,
          archive: {
            build: String(archive.build || '?'),
            archivedAt: String(archive.archivedAt || ''),
            candidate: archive.candidate || {},
            slides: []
          },
          warning: 'Ancien prototype : aucune capture visuelle autonome n’était enregistrée.'
        };
      }
      if (!stat.isDirectory()) return { ok: false, error: 'Format d’archive non reconnu.' };
      const manifest = readManifest(fullPath);
      if (!verifyArchiveDirectory(fullPath, manifest)) {
        return { ok: false, error: 'Archive modifiée ou corrompue : replay refusé.' };
      }
      return {
        ok: true,
        legacy: false,
        archive: {
          schemaVersion: manifest.schemaVersion,
          type: manifest.type,
          readOnly: true,
          archiveMode: manifest.archiveMode,
          futureVersionIndependent: manifest.futureVersionIndependent,
          build: manifest.build,
          archivedAt: manifest.archivedAt,
          candidate: manifest.candidate,
          integritySha256: manifest.integritySha256,
          slides: manifest.slides
        }
      };
    } catch (error) {
      return { ok: false, error: error && error.message ? error.message : String(error) };
    }
  });

  ipcMain.handle('admin:get-parcours-slide', (_event, requestedName, requestedFile) => {
    if (!getAdminUnlocked()) return { ok: false, error: 'Accès administrateur requis.' };
    const name = path.basename(String(requestedName || ''));
    const file = path.basename(String(requestedFile || ''));
    if (!name || !file || !file.toLowerCase().endsWith('.png')) return { ok: false, error: 'Diapositive invalide.' };
    try {
      const folder = path.join(parcoursDir(), name);
      const manifest = readManifest(folder);
      if (!verifyArchiveDirectory(folder, manifest)) return { ok: false, error: 'Archive modifiée ou corrompue : replay refusé.' };
      const slide = (manifest.slides || []).find((item) => String(item.file) === file);
      if (!slide) return { ok: false, error: 'Diapositive absente du manifeste.' };
      const buffer = fs.readFileSync(path.join(folder, 'slides', file));
      if (sha256Buffer(buffer) !== String(slide.sha256 || '')) return { ok: false, error: 'Diapositive corrompue.' };
      return {
        ok: true,
        dataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
        slide
      };
    } catch (error) {
      return { ok: false, error: error && error.message ? error.message : String(error) };
    }
  });

  cleanupOldPending();
};
