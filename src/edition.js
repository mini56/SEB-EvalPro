const fs = require('fs');
const path = require('path');

function normalizeEdition(value) {
  return String(value || '').trim().toLowerCase() === 'candidate' ? 'candidate' : 'admin';
}

function installDir() {
  return path.dirname(process.execPath);
}

function readInstalledEdition() {
  const forced = String(process.env.SEB_EVALPRO_EDITION || '').trim();
  if (forced) return normalizeEdition(forced);

  if (process.defaultApp) return 'admin';

  const dir = installDir();
  try {
    if (fs.existsSync(path.join(dir, 'edition-candidate.flag'))) return 'candidate';
    if (fs.existsSync(path.join(dir, 'edition-admin.flag'))) return 'admin';
    const jsonFile = path.join(dir, 'edition.json');
    if (fs.existsSync(jsonFile)) {
      const parsed = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      if (parsed && parsed.edition) return normalizeEdition(parsed.edition);
    }
  } catch (_) {}

  // Compatibilité : toute installation antérieure à la séparation reste Admin complète.
  return 'admin';
}

function getEditionCapabilities() {
  const edition = readInstalledEdition();
  const admin = edition === 'admin';
  return {
    edition,
    label: admin ? 'Administrateur' : 'Candidat',
    canBilan: admin,
    canAi: admin,
    canImport: admin,
    canExport: true,
    canCatalog: true,
    canReplay: true,
    canResults: true
  };
}

module.exports = { readInstalledEdition, getEditionCapabilities };
