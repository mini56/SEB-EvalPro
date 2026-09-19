const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function createCandidateStore(options = {}) {
  const documentsPath = options.documentsPath;
  const userDataPath = options.userDataPath;
  const now = typeof options.now === 'function' ? options.now : () => new Date();

  if (!documentsPath) throw new Error('documentsPath requis');
  if (!userDataPath) throw new Error('userDataPath requis');

  const sebRoot = path.join(documentsPath, 'SEB EvalPro');
  const candidatesRoot = path.join(sebRoot, 'Candidats');
  const activePointerPath = path.join(userDataPath, 'active-candidate.json');

  function ensureDirectory(directory) {
    fs.mkdirSync(directory, { recursive: true });
    return directory;
  }

  function ensureRoots() {
    ensureDirectory(candidatesRoot);
    ensureDirectory(userDataPath);
    return { sebRoot, candidatesRoot };
  }

  function atomicWriteJson(target, value) {
    ensureDirectory(path.dirname(target));
    const temp = `${target}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(temp, target);
  }

  function readJson(target) {
    try {
      return JSON.parse(fs.readFileSync(target, 'utf8'));
    } catch (_) {
      return null;
    }
  }

  function removeFile(target) {
    try {
      fs.unlinkSync(target);
    } catch (_) {}
  }

  function sanitizeSegment(value, fallback = 'INCONNU') {
    const cleaned = String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
    return cleaned || fallback;
  }

  function normalizeDate(value) {
    const raw = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return now().toISOString().slice(0, 10);
  }

  function parseStorageJson(state, key) {
    const raw = state && state.sessionStorage ? state.sessionStorage[key] : null;
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(String(raw));
    } catch (_) {
      return null;
    }
  }

  function candidateIdentityFromState(state) {
    const data = parseStorageJson(state, 'candidat_data');
    if (!data || typeof data !== 'object') return null;

    const nom = String(data.nom || '').trim();
    const prenom = String(data.prenom || data['prénom'] || '').trim();
    const lieu = String(data.lieu || data.ville || '').trim();
    const groupe = String(data.groupe || '').trim();
    const date = String(data.date || '').trim();

    if (!nom || !prenom || !lieu || !groupe) return null;

    const folderDate = normalizeDate(date);
    const identityKey = [nom, prenom, lieu, groupe, date]
      .map((value) => String(value || '').trim().toLocaleLowerCase('fr-FR'))
      .join('|');

    return {
      nom,
      prenom,
      lieu,
      groupe,
      date,
      folderDate,
      identityKey,
      original: {
        ...data,
        nom,
        'prénom': prenom,
        lieu,
        groupe,
        date
      }
    };
  }

  function readActivePointer() {
    const pointer = readJson(activePointerPath);
    if (!pointer || !pointer.candidateDir || !pointer.candidateId) return null;
    if (!fs.existsSync(pointer.candidateDir)) return null;
    return pointer;
  }

  function manifestPath(candidateDir) {
    return path.join(candidateDir, 'manifest.json');
  }

  function readManifest(candidateDir) {
    return readJson(manifestPath(candidateDir));
  }

  function writeManifest(candidateDir, manifest) {
    atomicWriteJson(manifestPath(candidateDir), manifest);
  }

  function buildFolderName(identity) {
    return [
      sanitizeSegment(identity.nom).toUpperCase(),
      sanitizeSegment(identity.prenom),
      sanitizeSegment(identity.lieu),
      sanitizeSegment(identity.groupe)
    ].join('_');
  }

  function allocateCandidate(identity) {
    ensureRoots();

    const candidateId = crypto.randomUUID();
    const shortId = candidateId.replace(/-/g, '').slice(0, 6).toUpperCase();
    const baseFolderName = buildFolderName(identity);
    let folderName = baseFolderName;
    let candidateDir = path.join(candidatesRoot, folderName);
    let index = 2;
    while (fs.existsSync(candidateDir)) {
      folderName = `${baseFolderName}_${index}`;
      candidateDir = path.join(candidatesRoot, folderName);
      index += 1;
    }

    for (const relative of [
      'donnees',
      'resultats',
      'replay',
      path.join('bilan', 'historique'),
      path.join('bilan', 'exports')
    ]) {
      ensureDirectory(path.join(candidateDir, relative));
    }

    const createdAt = now().toISOString();
    const manifest = {
      schemaVersion: 1,
      candidateId,
      shortId,
      folderName,
      status: 'EN_COURS',
      createdAt,
      updatedAt: createdAt,
      closedAt: null,
      candidat: identity.original
    };

    writeManifest(candidateDir, manifest);

    const pointer = {
      schemaVersion: 1,
      candidateId,
      shortId,
      folderName,
      candidateDir,
      identityKey: identity.identityKey,
      createdAt
    };
    atomicWriteJson(activePointerPath, pointer);
    return pointer;
  }

  function ensureActiveCandidate(state) {
    const identity = candidateIdentityFromState(state);
    if (!identity) return null;

    const active = readActivePointer();
    if (active && active.identityKey === identity.identityKey) {
      return active;
    }

    return allocateCandidate(identity);
  }

  function writeOptionalStorageJson(state, key, target) {
    const parsed = parseStorageJson(state, key);
    if (parsed === null) return;
    atomicWriteJson(target, parsed);
  }

  function saveSnapshot(state) {
    const active = ensureActiveCandidate(state);
    if (!active) return null;

    const identity = candidateIdentityFromState(state);
    const candidateDir = active.candidateDir;
    ensureDirectory(path.join(candidateDir, 'donnees'));
    ensureDirectory(path.join(candidateDir, 'resultats'));

    atomicWriteJson(path.join(candidateDir, 'donnees', 'evaluation-state.json'), state || {});
    if (identity) {
      atomicWriteJson(path.join(candidateDir, 'donnees', 'candidat.json'), identity.original);
    }

    writeOptionalStorageJson(state, 'reponses_data', path.join(candidateDir, 'resultats', 'reponses.json'));
    writeOptionalStorageJson(state, 'scores_data', path.join(candidateDir, 'resultats', 'scores.json'));

    atomicWriteJson(path.join(candidateDir, 'donnees', 'progression.json'), {
      lastPage: state && state.lastPage ? state.lastPage : null,
      lastEvaluationPage: state && state.lastEvaluationPage ? state.lastEvaluationPage : null,
      updatedAt: now().toISOString()
    });

    const manifest = readManifest(candidateDir) || {};
    writeManifest(candidateDir, {
      ...manifest,
      schemaVersion: 1,
      candidateId: active.candidateId,
      shortId: active.shortId,
      folderName: active.folderName,
      status: manifest.status === 'SESSION_FERMEE' ? 'SESSION_FERMEE' : 'EN_COURS',
      updatedAt: now().toISOString(),
      candidat: identity ? identity.original : manifest.candidat
    });

    return {
      candidateId: active.candidateId,
      shortId: active.shortId,
      folderName: active.folderName,
      candidateDir,
      displayName: identity ? `${identity.prenom} ${identity.nom}` : active.folderName
    };
  }

  function getActiveCandidate() {
    const active = readActivePointer();
    if (!active) return null;
    const manifest = readManifest(active.candidateDir) || {};
    const candidat = manifest.candidat || {};
    const prenom = String(candidat.prenom || candidat['prénom'] || '').trim();
    const nom = String(candidat.nom || '').trim();
    return {
      candidateId: active.candidateId,
      shortId: active.shortId,
      folderName: active.folderName,
      candidateDir: active.candidateDir,
      displayName: [prenom, nom].filter(Boolean).join(' ') || active.folderName,
      status: manifest.status || 'EN_COURS'
    };
  }

  function getActiveExportDir() {
    const active = readActivePointer();
    if (!active) return null;
    return ensureDirectory(path.join(active.candidateDir, 'bilan', 'exports'));
  }

  function closeActiveCandidate(state) {
    const active = readActivePointer();
    if (!active) return null;

    if (candidateIdentityFromState(state)) {
      saveSnapshot(state);
    }

    const manifest = readManifest(active.candidateDir) || {};
    const closedAt = now().toISOString();
    writeManifest(active.candidateDir, {
      ...manifest,
      schemaVersion: 1,
      candidateId: active.candidateId,
      shortId: active.shortId,
      folderName: active.folderName,
      status: 'SESSION_FERMEE',
      updatedAt: closedAt,
      closedAt
    });

    removeFile(activePointerPath);

    return {
      candidateId: active.candidateId,
      folderName: active.folderName,
      candidateDir: active.candidateDir,
      status: 'SESSION_FERMEE'
    };
  }

  return {
    ensureRoots,
    ensureActiveCandidate,
    saveSnapshot,
    getActiveCandidate,
    getActiveExportDir,
    closeActiveCandidate,
    candidateIdentityFromState,
    paths: {
      sebRoot,
      candidatesRoot,
      activePointerPath
    }
  };
}

module.exports = { createCandidateStore };
