const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
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
  copyDirectoryIfMissing
} = require('./candidate-folder-utils');

function createCandidateTransfer(options = {}) {
  const documentsPath = options.documentsPath;
  const now = typeof options.now === 'function' ? options.now : () => new Date();
  if (!documentsPath) throw new Error('documentsPath requis');

  const sebRoot = path.join(documentsPath, 'SEB EvalPro');
  const candidatesRoot = path.join(sebRoot, 'Candidats');
  const legacyAdminRoot = path.join(sebRoot, 'Admin');
  const globalReplayRoot = path.join(sebRoot, 'parcours');
  const globalBilanRoot = path.join(sebRoot, 'Bilans', 'Historique');
  const globalExportsRoot = path.join(sebRoot, 'Bilans');
  const requiredDirs = ['donnees', 'resultats', 'replay', path.join('bilan','historique'), path.join('bilan','exports')];
  const requiredFiles = [
    'manifest.json',
    path.join('donnees', 'candidat.json'),
    path.join('donnees', 'evaluation-state.json'),
    path.join('donnees', 'progression.json'),
    path.join('resultats', 'reponses.json'),
    path.join('resultats', 'scores.json')
  ];

  function writeJson(target, value) {
    ensureDir(path.dirname(target));
    const temp = target + '.tmp';
    fs.writeFileSync(temp, encodeJson(value), 'utf8');
    fs.renameSync(temp, target);
  }

  function ensureCandidateShape(dir) {
    for (const rel of requiredDirs) ensureDir(path.join(dir, rel));
  }

  function basicRecordValid(record) {
    if (!record || !record.candidateDir || !record.candidateId) return false;
    const c = record.candidate || {};
    if (![c.nom, c.prenom || c['prénom'], c.lieu || c.ville, c.groupe].every((v) => normalize(v))) return false;
    const manifest = readJson(path.join(record.candidateDir, 'manifest.json'));
    return !!manifest && String(manifest.candidateId || '') === String(record.candidateId);
  }

  function completeLegacySkeleton(dir, record) {
    ensureCandidateShape(dir);
    const c = (record && record.candidate) || {};
    const candidateFile = path.join(dir, 'donnees', 'candidat.json');
    const stateFile = path.join(dir, 'donnees', 'evaluation-state.json');
    const progressionFile = path.join(dir, 'donnees', 'progression.json');
    const responsesFile = path.join(dir, 'resultats', 'reponses.json');
    const scoresFile = path.join(dir, 'resultats', 'scores.json');
    if (!fs.existsSync(candidateFile)) writeJson(candidateFile, c);
    if (!fs.existsSync(stateFile)) writeJson(stateFile, {
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
    });
    if (!fs.existsSync(progressionFile)) writeJson(progressionFile, { lastPage:null, lastEvaluationPage:null, migratedPlaceholder:true });
    if (!fs.existsSync(responsesFile)) writeJson(responsesFile, {});
    if (!fs.existsSync(scoresFile)) writeJson(scoresFile, {});
  }

  function identityKey(candidate) {
    const c = candidate || {};
    return [c.nom, c.prenom || c['prénom'], c.lieu || c.ville, c.groupe].map(normalize).join('|');
  }

  function sameCandidate(a, b) {
    if (!a || !b) return false;
    if (a.candidateId && b.candidateId && String(a.candidateId) === String(b.candidateId)) return true;
    const ka = identityKey(a.candidate);
    const kb = identityKey(b.candidate);
    return !!ka && ka === kb && ka.split('|').every(Boolean);
  }

  function candidateShapeValid(record) {
    if (!basicRecordValid(record)) return false;
    const dirsOk = requiredDirs.every((rel) => {
      try { return fs.statSync(path.join(record.candidateDir, rel)).isDirectory(); }
      catch (_) { return false; }
    });
    if (!dirsOk) return false;
    return requiredFiles.every((rel) => {
      try { return fs.statSync(path.join(record.candidateDir, rel)).isFile(); }
      catch (_) { return false; }
    });
  }

  function hashFile(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  }

  function inventory(root) {
    const out = [];
    function walk(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes:true }).sort((a,b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(root, full).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          out.push({ type:'dir', rel });
          walk(full);
        } else if (entry.isFile()) {
          const stat = fs.statSync(full);
          out.push({ type:'file', rel, size:stat.size, sha256:hashFile(full) });
        }
      }
    }
    walk(root);
    return out;
  }

  function verifyExactCopy(sourceDir, copiedDir) {
    const source = inventory(sourceDir);
    const copy = inventory(copiedDir);
    if (source.length !== copy.length) throw new Error('Vérification USB échouée : nombre de fichiers ou dossiers différent.');
    for (let i = 0; i < source.length; i += 1) {
      const a = source[i], b = copy[i];
      if (a.type !== b.type || a.rel !== b.rel) throw new Error('Vérification USB échouée : contenu différent (' + a.rel + ').');
      if (a.type === 'file' && (a.size !== b.size || a.sha256 !== b.sha256)) {
        throw new Error('Vérification USB échouée : fichier altéré ou incomplet (' + a.rel + ').');
      }
    }
    return { entries:source.length, files:source.filter((e) => e.type === 'file').length };
  }

  function copyVerifiedAtomic(sourceDir, targetDir) {
    ensureDir(path.dirname(targetDir));
    if (fs.existsSync(targetDir)) throw new Error('Le dossier destination existe déjà : aucune donnée ne sera écrasée.');
    const token = String(process.pid) + '-' + Date.now() + '-' + Math.random().toString(16).slice(2,8);
    const temp = path.join(path.dirname(targetDir), '.' + path.basename(targetDir) + '.seb-copy-' + token);
    try {
      fs.cpSync(sourceDir, temp, { recursive:true, force:false, errorOnExist:true, preserveTimestamps:true });
      const verified = verifyExactCopy(sourceDir, temp);
      fs.renameSync(temp, targetDir);
      verifyExactCopy(sourceDir, targetDir);
      return verified;
    } catch (error) {
      try { if (fs.existsSync(temp)) fs.rmSync(temp, { recursive:true, force:true }); } catch (_) {}
      throw error;
    }
  }

  function migrateLegacyAdmin() {
    ensureDir(candidatesRoot);
    const current = listCandidateDirs(candidatesRoot, false);
    let added = 0;
    for (const legacy of listCandidateDirs(legacyAdminRoot, true)) {
      if (!basicRecordValid(legacy)) continue;
      if (current.some((r) => sameCandidate(r, legacy))) continue;
      const base = codedFolderName(legacy.candidateId, legacy.manifest && legacy.manifest.shortId);
      const target = fs.existsSync(path.join(candidatesRoot, base)) ? uniqueFolderPath(candidatesRoot, base) : path.join(candidatesRoot, base);
      copyVerifiedAtomic(legacy.candidateDir, target);
      completeLegacySkeleton(target, legacy);
      const manifest = readJson(path.join(target, 'manifest.json')) || {};
      writeJson(path.join(target, 'manifest.json'), { ...manifest, folderName:path.basename(target), migratedFrom:legacy.candidateDir });
      const migrated = listCandidateDirs(candidatesRoot, false).find((r) => String(r.candidateId) === String(legacy.candidateId));
      if (migrated) current.push(migrated);
      added += 1;
    }
    return added;
  }

  function replayCandidate(source) {
    try {
      const stat = fs.statSync(source);
      if (stat.isDirectory()) {
        const m = readJson(path.join(source, 'manifest.json'));
        return m && m.candidate ? m.candidate : null;
      }
      if (stat.isFile() && source.toLowerCase().endsWith('.json')) {
        const a = readJson(source);
        return a && a.candidate ? a.candidate : null;
      }
    } catch (_) {}
    return null;
  }

  function syncGlobalArtifactsIntoCandidates() {
    ensureDir(globalReplayRoot);
    ensureDir(globalBilanRoot);
    const records = listCandidateDirs(candidatesRoot, false);
    records.forEach((r) => ensureCandidateShape(r.candidateDir));

    for (const entry of fs.readdirSync(globalReplayRoot, { withFileTypes:true })) {
      const source = path.join(globalReplayRoot, entry.name);
      const candidate = replayCandidate(source);
      if (!candidate) continue;
      const match = selectCandidate(records, candidate);
      if (!match) continue;
      const target = path.join(match.candidateDir, 'replay', entry.name);
      if (entry.isDirectory()) copyDirectoryIfMissing(source, target);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) copyFileIfMissing(source, target);
    }

    for (const entry of fs.readdirSync(globalBilanRoot, { withFileTypes:true })) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) continue;
      const source = path.join(globalBilanRoot, entry.name);
      const archive = readJson(source);
      if (!archive || !archive.candidate) continue;
      const match = selectCandidate(records, archive.candidate);
      if (!match) continue;
      copyFileIfMissing(source, path.join(match.candidateDir, 'bilan', 'historique', entry.name));
    }

    // Ancien Word/PDF global -> dossier candidat uniquement si l'association
    // Nom + Prénom (et date si nécessaire) est unique. Sinon on ne devine pas.
    ensureDir(globalExportsRoot);
    for (const entry of fs.readdirSync(globalExportsRoot, { withFileTypes:true })) {
      if (!entry.isFile() || !/\.(doc|docx|pdf)$/i.test(entry.name)) continue;
      const match = selectCandidateFromFilename(records, entry.name);
      if (!match) continue;
      copyFileIfMissing(
        path.join(globalExportsRoot, entry.name),
        path.join(match.candidateDir, 'bilan', 'exports', entry.name)
      );
    }
  }

  function prepareCandidates() {
    const migrated = migrateLegacyAdmin();
    syncGlobalArtifactsIntoCandidates();
    return migrated;
  }

  function chooseTargetName(record, destinationRoot) {
    const base = codedFolderName(record && record.candidateId, record && record.manifest && record.manifest.shortId);
    return fs.existsSync(path.join(destinationRoot, base)) ? uniqueFolderPath(destinationRoot, base) : path.join(destinationRoot, base);
  }

  function transferPassword(password) {
    const value = String(password || '');
    if (value.length < 8) throw new Error('Le mot de passe de transfert doit contenir au moins 8 caractères.');
    return value;
  }

  function transferKey(password, salt) {
    return crypto.scryptSync(transferPassword(password), salt, 32, { N:32768, r:8, p:1, maxmem:64 * 1024 * 1024 });
  }

  function encryptTransferPayload(payload, password) {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = transferKey(password, salt);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from('SEB-EvalPro/usb-transfer/v1', 'utf8'));
    const zipped = zlib.gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'), { level:9 });
    const encrypted = Buffer.concat([cipher.update(zipped), cipher.final()]);
    const tag = cipher.getAuthTag();
    key.fill(0);
    return JSON.stringify({
      format:'SEB-EVALPRO-USB-1',
      kdf:'scrypt-N32768-r8-p1',
      cipher:'aes-256-gcm',
      salt:salt.toString('base64'),
      iv:iv.toString('base64'),
      tag:tag.toString('base64'),
      data:encrypted.toString('base64')
    });
  }

  function decryptTransferPayload(text, password) {
    let envelope;
    try { envelope = JSON.parse(String(text || '')); }
    catch (_) { throw new Error('Fichier de transfert SEB EvalPro invalide.'); }
    if (!envelope || envelope.format !== 'SEB-EVALPRO-USB-1') throw new Error('Format de transfert SEB EvalPro non reconnu.');
    try {
      const salt = Buffer.from(String(envelope.salt || ''), 'base64');
      const iv = Buffer.from(String(envelope.iv || ''), 'base64');
      const tag = Buffer.from(String(envelope.tag || ''), 'base64');
      const encrypted = Buffer.from(String(envelope.data || ''), 'base64');
      const key = transferKey(password, salt);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAAD(Buffer.from('SEB-EvalPro/usb-transfer/v1', 'utf8'));
      decipher.setAuthTag(tag);
      const zipped = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      key.fill(0);
      const payload = JSON.parse(zlib.gunzipSync(zipped).toString('utf8'));
      if (!payload || payload.type !== 'SEB_EVALPRO_CANDIDATE_TRANSFER' || payload.schemaVersion !== 1 || !payload.candidateId) {
        throw new Error('Contenu de transfert invalide.');
      }
      return payload;
    } catch (error) {
      if (String(error && error.message || '').includes('Contenu de transfert invalide')) throw error;
      throw new Error('Mot de passe incorrect ou fichier de transfert endommagé. Aucun fichier n’a été importé.');
    }
  }

  function safeTransferRelative(rel) {
    const value = String(rel || '').replace(/\\/g, '/');
    if (!value || value.startsWith('/') || /^[A-Za-z]:/.test(value)) throw new Error('Chemin de transfert invalide.');
    const normalized = path.posix.normalize(value);
    if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) throw new Error('Chemin de transfert invalide.');
    return normalized;
  }

  function packCandidate(record) {
    const entries = [];
    const walk = (dir) => {
      const list = fs.readdirSync(dir, { withFileTypes:true }).sort((a,b) => a.name.localeCompare(b.name));
      for (const entry of list) {
        const full = path.join(dir, entry.name);
        const rel = safeTransferRelative(path.relative(record.candidateDir, full));
        if (entry.isDirectory()) {
          entries.push({ type:'dir', rel });
          walk(full);
          continue;
        }
        if (!entry.isFile()) continue;
        if (entry.name.endsWith('.tmp') || entry.name.includes('.seb-copy-')) continue;
        if (entry.name.toLowerCase().endsWith('.json')) {
          const value = readJson(full);
          if (value == null) throw new Error('Fichier candidat JSON illisible : ' + rel);
          entries.push({ type:'json', rel, data:Buffer.from(JSON.stringify(value), 'utf8').toString('base64') });
        } else {
          entries.push({ type:'file', rel, data:fs.readFileSync(full).toString('base64') });
        }
      }
    };
    walk(record.candidateDir);
    return {
      schemaVersion:1,
      type:'SEB_EVALPRO_CANDIDATE_TRANSFER',
      candidateId:String(record.candidateId || ''),
      shortId:String(record.manifest && record.manifest.shortId || ''),
      status:String(record.manifest && record.manifest.status || ''),
      exportedAt:now().toISOString(),
      entries
    };
  }

  function portableFileName(record) {
    const token = String(record && record.candidateId || '').replace(/[^A-Za-z0-9]+/g, '').toUpperCase().slice(0, 12) || crypto.randomBytes(6).toString('hex').toUpperCase();
    return 'CAND-' + token + '.seb';
  }

  function writePortableAtomic(target, text) {
    const temp = target + '.seb-copy-' + process.pid + '-' + Date.now() + '.tmp';
    fs.writeFileSync(temp, text, 'utf8');
    fs.renameSync(temp, target);
  }

  function exportAll(selectedUsbPath, password) {
    const destinationRoot = path.resolve(String(selectedUsbPath || ''));
    if (!destinationRoot) throw new Error('Clé USB non sélectionnée.');
    transferPassword(password);
    prepareCandidates();
    ensureDir(destinationRoot);
    if (path.resolve(candidatesRoot) === destinationRoot) throw new Error('La destination d’export ne peut pas être le dossier local des candidats.');

    const sourceRecords = listCandidateDirs(candidatesRoot, false)
      .filter(candidateShapeValid)
      .filter((record) => String(record.manifest && record.manifest.status || '') === 'SESSION_FERMEE');
    let added = 0, skipped = 0, verifiedFiles = 0;
    const copied = [];

    for (const source of sourceRecords) {
      const filename = portableFileName(source);
      const target = path.join(destinationRoot, filename);
      if (fs.existsSync(target)) {
        skipped += 1;
        continue;
      }
      const payload = packCandidate(source);
      const encrypted = encryptTransferPayload(payload, password);
      writePortableAtomic(target, encrypted);
      const verified = decryptTransferPayload(fs.readFileSync(target, 'utf8'), password);
      if (String(verified.candidateId) !== String(source.candidateId)) {
        try { fs.rmSync(target, { force:true }); } catch (_) {}
        throw new Error('Vérification de l’export chiffré échouée.');
      }
      added += 1;
      verifiedFiles += payload.entries.filter((entry) => entry.type !== 'dir').length;
      copied.push({ candidateId:source.candidateId, filename, transferFile:target });
    }

    return {
      total:sourceRecords.length,
      added,
      updated:0,
      skipped,
      verifiedFiles,
      copied,
      destinationRoot,
      exportedAt:now().toISOString(),
      verified:true,
      passwordProtected:true,
      format:'SEB-EVALPRO-USB-1'
    };
  }

  function unpackCandidatePayload(payload, targetDir) {
    const temp = targetDir + '.seb-import-' + process.pid + '-' + Date.now();
    if (fs.existsSync(temp)) fs.rmSync(temp, { recursive:true, force:true });
    ensureDir(temp);
    try {
      for (const item of payload.entries || []) {
        const rel = safeTransferRelative(item && item.rel);
        const target = path.join(temp, ...rel.split('/'));
        if (item.type === 'dir') {
          ensureDir(target);
          continue;
        }
        ensureDir(path.dirname(target));
        const data = Buffer.from(String(item && item.data || ''), 'base64');
        if (item.type === 'json') {
          let value;
          try { value = JSON.parse(data.toString('utf8')); }
          catch (_) { throw new Error('JSON de transfert invalide : ' + rel); }
          writeJson(target, value);
        } else if (item.type === 'file') {
          fs.writeFileSync(target, data);
        } else {
          throw new Error('Type de fichier de transfert invalide.');
        }
      }
      ensureCandidateShape(temp);
      const manifest = readJson(path.join(temp, 'manifest.json'));
      if (!manifest || String(manifest.candidateId || '') !== String(payload.candidateId || '')) {
        throw new Error('Identité technique du candidat incohérente dans le transfert.');
      }
      writeJson(path.join(temp, 'manifest.json'), {
        ...manifest,
        folderName:path.basename(targetDir),
        importedAt:now().toISOString(),
        importedFromEncryptedTransfer:true
      });
      fs.renameSync(temp, targetDir);
    } catch (error) {
      try { if (fs.existsSync(temp)) fs.rmSync(temp, { recursive:true, force:true }); } catch (_) {}
      throw error;
    }
  }

  function importAll(selectedUsbPath, password) {
    const sourceRoot = path.resolve(String(selectedUsbPath || ''));
    if (!sourceRoot || !fs.existsSync(sourceRoot)) throw new Error('Clé USB non sélectionnée ou inaccessible.');
    transferPassword(password);

    const transferFiles = fs.readdirSync(sourceRoot, { withFileTypes:true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.seb'))
      .map((entry) => path.join(sourceRoot, entry.name))
      .sort((a,b) => path.basename(a).localeCompare(path.basename(b)));

    if (!transferFiles.length) {
      return { total:0, added:0, updated:0, skipped:0, verifiedFiles:0, copied:[], sourceRoot, destinationRoot:candidatesRoot, verified:true, passwordProtected:true };
    }

    // Phase 1 : tout déchiffrer et tout valider avant la moindre écriture locale.
    const packages = transferFiles.map((file) => ({
      file,
      payload:decryptTransferPayload(fs.readFileSync(file, 'utf8'), password)
    }));

    ensureDir(candidatesRoot);
    prepareCandidates();
    const destinationRecords = listCandidateDirs(candidatesRoot, false);
    let added = 0, skipped = 0, verifiedFiles = 0;
    const copied = [];

    for (const pack of packages) {
      const payload = pack.payload;
      if (destinationRecords.some((record) => String(record.candidateId) === String(payload.candidateId))) {
        skipped += 1;
        continue;
      }
      const base = codedFolderName(payload.candidateId, payload.shortId);
      const target = fs.existsSync(path.join(candidatesRoot, base))
        ? uniqueFolderPath(candidatesRoot, base)
        : path.join(candidatesRoot, base);
      unpackCandidatePayload(payload, target);
      const imported = listCandidateDirs(candidatesRoot, false).find((record) => String(record.candidateId) === String(payload.candidateId));
      if (!imported || !candidateShapeValid(imported)) {
        try { fs.rmSync(target, { recursive:true, force:true }); } catch (_) {}
        throw new Error('Vérification locale après import échouée.');
      }
      destinationRecords.push(imported);
      added += 1;
      verifiedFiles += (payload.entries || []).filter((entry) => entry.type !== 'dir').length;
      copied.push({ candidateId:payload.candidateId, folderName:path.basename(target), candidateDir:target });
    }

    return {
      total:packages.length,
      added,
      updated:0,
      skipped,
      verifiedFiles,
      copied,
      sourceRoot,
      destinationRoot:candidatesRoot,
      importedAt:now().toISOString(),
      verified:true,
      passwordProtected:true,
      format:'SEB-EVALPRO-USB-1'
    };
  }

  return {
    exportAll,
    importAll,
    listCandidateRecords: listCandidateDirs,
    prepareCandidates,
    verifyExactCopy,
    paths: { sebRoot, candidatesRoot, legacyAdminRoot }
  };
}

module.exports = { createCandidateTransfer };
