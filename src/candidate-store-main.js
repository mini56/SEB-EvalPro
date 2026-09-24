const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { encodeJson, readJsonFile } = require('./candidate-data-crypto');
const { codedFolderName } = require('./candidate-folder-utils');

function createCandidateStore(options = {}) {
  const documentsPath = options.documentsPath;
  const userDataPath = options.userDataPath;
  const now = typeof options.now === 'function' ? options.now : () => new Date();

  if (!documentsPath) throw new Error('documentsPath requis');
  if (!userDataPath) throw new Error('userDataPath requis');

  const sebRoot = path.join(documentsPath, 'SEB EvalPro');
  const candidatesRoot = path.join(sebRoot, 'Candidats');
  const activePointerPath = path.join(userDataPath, 'active-candidate.json');
  let atomicWriteCounter = 0;

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
    atomicWriteCounter += 1;
    const temp = `${target}.${process.pid}.${atomicWriteCounter}.tmp`;
    fs.writeFileSync(temp, encodeJson(value), 'utf8');
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
    throw lastError || new Error('Écriture JSON candidat impossible.');
  }

  function readJson(target) {
    return readJsonFile(target);
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

  function normalizeIdentityPart(value) {
    let text = String(value == null ? '' : value).trim();
    try { text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
    return text.toLocaleLowerCase('fr-FR').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function candidateIdentityKey(candidate) {
    const c = candidate || {};
    const parts = [
      c.nom,
      c.prenom || c['prénom'],
      c.lieu || c.ville,
      c.groupe
    ].map(normalizeIdentityPart);
    return parts.every(Boolean) ? parts.join('|') : '';
  }

  function defaultCandidateState(candidate) {
    return {
      version: 1,
      sessionStorage: {
        candidat_data: JSON.stringify(candidate || {}),
        reponses_data: '{}',
        scores_data: '{}'
      },
      localStorage: {},
      lastPage: 'qcmv1.0.html',
      lastEvaluationPage: 'qcmv1.0.html',
      updatedAt: now().toISOString()
    };
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
    const identityKey = candidateIdentityKey({ nom, prenom, lieu, groupe });

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

  function buildFolderName(candidateId, shortId = '') {
    return codedFolderName(candidateId, shortId);
  }

  function migrateCandidateFolderNames() {
    ensureRoots();
    const pointer = readActivePointer();
    let renamed = 0;
    let entries = [];
    try { entries = fs.readdirSync(candidatesRoot, { withFileTypes:true }); } catch (_) { entries = []; }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const oldDir = path.join(candidatesRoot, entry.name);
      const manifest = readManifest(oldDir);
      if (!manifest || !manifest.candidateId) continue;
      const desiredBase = buildFolderName(manifest.candidateId, manifest.shortId);
      if (entry.name === desiredBase || entry.name.startsWith(desiredBase + '_')) continue;

      let target = path.join(candidatesRoot, desiredBase);
      let index = 2;
      while (fs.existsSync(target)) {
        const existing = readManifest(target);
        if (existing && String(existing.candidateId || '') === String(manifest.candidateId)) break;
        target = path.join(candidatesRoot, desiredBase + '_' + index);
        index += 1;
      }

      if (path.resolve(oldDir) !== path.resolve(target)) {
        fs.renameSync(oldDir, target);
        renamed += 1;
      }

      const folderName = path.basename(target);
      writeManifest(target, { ...manifest, folderName, privacyFolderMigratedAt:now().toISOString() });
      if (pointer && String(pointer.candidateId || '') === String(manifest.candidateId)) {
        atomicWriteJson(activePointerPath, { ...pointer, folderName, candidateDir:target });
      }
    }
    return { renamed };
  }

  function existingCandidateForIdentity(identity) {
    ensureRoots();
    const expectedKey = String(identity && identity.identityKey || '');
    if (!expectedKey) return null;
    const records = [];
    let entries = [];
    try { entries = fs.readdirSync(candidatesRoot, { withFileTypes:true }); } catch (_) { entries = []; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidateDir = path.join(candidatesRoot, entry.name);
      const manifest = readManifest(candidateDir);
      if (!manifest || !manifest.candidateId) continue;
      if (candidateIdentityKey(manifest.candidat || {}) !== expectedKey) continue;
      records.push({ candidateDir, folderName:entry.name, manifest });
    }
    if (!records.length) return null;
    records.sort((a,b) => {
      const ac = /^CAND-/i.test(a.folderName) ? 0 : 1;
      const bc = /^CAND-/i.test(b.folderName) ? 0 : 1;
      if (ac !== bc) return ac - bc;
      return String(a.manifest.createdAt || '').localeCompare(String(b.manifest.createdAt || ''));
    });
    return records[0];
  }

  function activateExistingCandidate(record, identity) {
    const manifest = record.manifest || {};
    const candidateId = String(manifest.candidateId || '');
    const shortId = String(manifest.shortId || candidateId.replace(/-/g, '').slice(0, 6).toUpperCase());
    const pointer = {
      schemaVersion:1,
      candidateId,
      shortId,
      folderName:record.folderName,
      candidateDir:record.candidateDir,
      identityKey:identity.identityKey,
      createdAt:String(manifest.createdAt || now().toISOString())
    };
    atomicWriteJson(activePointerPath, pointer);
    return pointer;
  }

  function allocateCandidate(identity) {
    ensureRoots();

    const candidateId = crypto.randomUUID();
    const shortId = candidateId.replace(/-/g, '').slice(0, 6).toUpperCase();
    const baseFolderName = buildFolderName(candidateId, shortId);
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

    // Les fichiers de base existent dès la création du dossier candidat.
    atomicWriteJson(path.join(candidateDir, 'donnees', 'candidat.json'), identity.original);
    atomicWriteJson(path.join(candidateDir, 'donnees', 'evaluation-state.json'), defaultCandidateState(identity.original));
    atomicWriteJson(path.join(candidateDir, 'donnees', 'progression.json'), {
      lastPage: null,
      lastEvaluationPage: null,
      updatedAt: createdAt
    });
    atomicWriteJson(path.join(candidateDir, 'resultats', 'reponses.json'), {});
    atomicWriteJson(path.join(candidateDir, 'resultats', 'scores.json'), {});

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
    migrateCandidateFolderNames();
    const identity = candidateIdentityFromState(state);
    if (!identity) return null;

    const active = readActivePointer();
    if (active && active.identityKey === identity.identityKey) {
      return active;
    }

    const existing = existingCandidateForIdentity(identity);
    if (existing) {
      return activateExistingCandidate(existing, identity);
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
    migrateCandidateFolderNames,
    paths: {
      sebRoot,
      candidatesRoot,
      activePointerPath
    }
  };
}

module.exports = { createCandidateStore };
