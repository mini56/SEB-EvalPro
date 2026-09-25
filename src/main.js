const { app, BrowserWindow, ipcMain, screen, dialog, Menu, safeStorage } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getEditionCapabilities } = require('./edition');
const { createCandidateStore } = require('./candidate-store-main');
const { createCandidateTransfer } = require('./candidate-transfer-main');
const { configureLocalKey, readJsonFile, encodeJson, migrateJsonFile, migrateJsonTree } = require('./candidate-data-crypto');
const { createCandidateLocalProtection } = require('./candidate-local-protection');
const { internalStorageRoot, documentsWordRoot, migrateLegacyDocumentsStorage } = require('./storage-layout');

const ADMIN_PASSWORD_SHA256 = 'c800892ba3f11b33d36eedf7d3c4297f2b6c02e2c347dda8954b4c577f6666b5';
const STATE_VERSION = 1;
const MIN_SPLASH_MS = 1400;
const DESIGN_WIDTH = 1600;
const DESIGN_HEIGHT = 900;
const MIN_ZOOM_FACTOR = 0.60;
let mainWindow = null;
let splashWindow = null;
let splashStartedAt = 0;
let adminSessionUnlocked = false;
let downloadRoutingInstalled = false;
const editionCapabilities = getEditionCapabilities();
let candidateStore = null;
let candidateTransfer = null;
let candidateProtection = null;
let adminExportCandidateDir = null;
let adminCandidateResultsMode = false;
let lastCandidateSaveError = '';
let allowApplicationExit = false;
let candidateKeyGuardProcess = null;
// SEB_TEMP_WINDOWS_RECOVERY : temporaire pendant la phase de stabilisation.
const TEMP_ALLOW_WINDOWS_RECOVERY = true;
let stateWriteCounter = 0;

function candidateKeyGuardExecutable() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'candidate-keyguard.exe')
    : path.join(__dirname, '..', 'build', 'candidate-keyguard.exe');
}

function stopCandidateKeyGuard() {
  const proc = candidateKeyGuardProcess;
  candidateKeyGuardProcess = null;
  if (!proc) return;
  try { proc.kill(); } catch (_) {}
}

function startCandidateKeyGuard() {
  if (process.platform !== 'win32' || adminSessionUnlocked || allowApplicationExit) return;
  if (candidateKeyGuardProcess && candidateKeyGuardProcess.exitCode == null && !candidateKeyGuardProcess.killed) return;
  const executable = candidateKeyGuardExecutable();
  if (!fs.existsSync(executable)) return;
  try {
    const proc = spawn(executable, [], { windowsHide:true, stdio:'ignore' });
    candidateKeyGuardProcess = proc;
    proc.once('exit', () => {
      if (candidateKeyGuardProcess === proc) candidateKeyGuardProcess = null;
      if (!adminSessionUnlocked && !allowApplicationExit) setTimeout(() => startCandidateKeyGuard(), 250);
    });
  } catch (_) {
    candidateKeyGuardProcess = null;
  }
}

function stateFilePath() {
  return path.join(app.getPath('userData'), 'evaluation-state.json');
}

function sebInternalRoot() {
  return internalStorageRoot(app.getPath('userData'));
}

function sebDocumentsRoot() {
  return documentsWordRoot(app.getPath('documents'));
}

function getCandidateProtection() {
  if (!candidateProtection) {
    candidateProtection = createCandidateLocalProtection({
      documentsPath: app.getPath('documents'),
      userDataPath: app.getPath('userData'),
      dataRoot: sebInternalRoot(),
      safeStorage
    });
  }
  return candidateProtection;
}

function initializeCandidateSecurity() {
  const protection = getCandidateProtection();
  const localKey = protection.initializeKey();
  if (!Buffer.isBuffer(localKey) || localKey.length !== 32) {
    throw new Error('Clé locale des données candidat invalide.');
  }

  configureLocalKey(localKey);
  localKey.fill(0);
  protection.restoreStateFromBackupIfNeeded();

  // Un dossier candidat individuel illisible ne doit jamais bloquer tout SEB EvalPro.
  // Les migrations parcourent les fichiers un par un et ignorent ceux qui ne peuvent
  // pas être décodés. Ils resteront intacts pour diagnostic/récupération ultérieure.
  const store = getCandidateStore();
  const folders = store.migrateCandidateFolderNames();
  const migrated = migrateJsonTree(store.paths.candidatesRoot);
  migrateJsonFile(stateFilePath());
  protection.backupState();
  console.log('SEB EvalPro confidentialité candidat: clé locale Windows protégée et sauvegardée, dossiers codés=' + folders.renamed + ', JSON chiffrés=' + migrated.files + '.');
}

function getCandidateStore() {
  if (!candidateStore) {
    candidateStore = createCandidateStore({
      documentsPath: app.getPath('documents'),
      userDataPath: app.getPath('userData'),
      dataRoot: sebInternalRoot()
    });
  }
  return candidateStore;
}

function getCandidateTransfer() {
  if (!candidateTransfer) {
    candidateTransfer = createCandidateTransfer({
      documentsPath: app.getPath('documents'),
      userDataPath: app.getPath('userData'),
      dataRoot: sebInternalRoot()
    });
  }
  return candidateTransfer;
}

function bilanDocumentsDir() {
  return sebDocumentsRoot();
}

function ensureSebDocumentsFolders() {
  fs.mkdirSync(sebDocumentsRoot(), { recursive: true });
  getCandidateStore().ensureRoots();
}

function uniqueOutputPath(directory, filename) {
  const parsed = path.parse(filename);
  let target = path.join(directory, filename);
  let index = 2;
  while (fs.existsSync(target)) {
    target = path.join(directory, `${parsed.name}_${index}${parsed.ext}`);
    index += 1;
  }
  return target;
}

function cleanupNumberedCandidateWordCopies(directory, filename) {
  if (!directory || !/^Evaluation_.+\.docx?$/i.test(filename)) return;
  const parsed = path.parse(filename);
  if (!fs.existsSync(directory)) return;
  const escaped = parsed.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const duplicate = new RegExp('^' + escaped + '_(?:R\\d+|\\d+)' + parsed.ext.replace('.', '\\.') + '$', 'i');
  for (const entry of fs.readdirSync(directory, { withFileTypes:true })) {
    if (!entry.isFile() || !duplicate.test(entry.name)) continue;
    try { fs.rmSync(path.join(directory, entry.name), { force:true }); } catch (_) {}
  }
}

function installDownloadRouting() {
  if (!mainWindow || mainWindow.isDestroyed() || downloadRoutingInstalled) return;
  downloadRoutingInstalled = true;
  mainWindow.webContents.session.on('will-download', (_event, item) => {
    const filename = path.basename(item.getFilename() || 'Evaluation.doc');
    if (!/\.docx?$/i.test(filename)) return;
    try {
      ensureSebDocumentsFolders();
      const candidateExportDir = adminExportCandidateDir || getCandidateStore().getActiveExportDir();
      const visibleDirectory = bilanDocumentsDir();
      const visibleTarget = /^Evaluation_.+\.docx?$/i.test(filename)
        ? path.join(visibleDirectory, filename)
        : uniqueOutputPath(visibleDirectory, filename);
      item.setSavePath(visibleTarget);
      item.once('done', (_downloadEvent, state) => {
        if (state !== 'completed') return;
        cleanupNumberedCandidateWordCopies(visibleDirectory, filename);
        if (!candidateExportDir) return;
        try {
          fs.mkdirSync(candidateExportDir, { recursive:true });
          const archiveTarget = path.join(candidateExportDir, path.basename(visibleTarget));
          fs.copyFileSync(visibleTarget, archiveTarget);
          cleanupNumberedCandidateWordCopies(candidateExportDir, path.basename(archiveTarget));
        } catch (error) {
          console.error('Archivage interne du Word impossible:', error && error.message ? error.message : String(error));
        }
      });
    } catch (_) {}
  });
}

function defaultState() {
  return {
    version: STATE_VERSION,
    sessionStorage: {},
    localStorage: {},
    lastPage: 'qcmv1.0.html',
    lastEvaluationPage: 'qcmv1.0.html',
    updatedAt: null
  };
}

function readState() {
  try {
    const protection = getCandidateProtection();
    protection.restoreStateFromBackupIfNeeded();
    let parsed = readJsonFile(stateFilePath());
    if ((!parsed || typeof parsed !== 'object') && fs.existsSync(protection.paths.backupStatePath)) {
      parsed = readJsonFile(protection.paths.backupStatePath);
    }
    return parsed && typeof parsed === 'object' ? { ...defaultState(), ...parsed } : defaultState();
  } catch (_) {
    return defaultState();
  }
}

function waitForFileRetry(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (_) {}
}

function atomicReplaceState(target, content) {
  stateWriteCounter += 1;
  const temp = `${target}.${process.pid}.${stateWriteCounter}.tmp`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(temp, content, 'utf8');
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.renameSync(temp, target);
      return;
    } catch (error) {
      lastError = error;
      const code = String(error && error.code || '');
      if (!['EPERM','EACCES','EBUSY','EEXIST','ENOTEMPTY'].includes(code)) break;
      waitForFileRetry(25 + attempt * 35);
    }
  }
  try { fs.rmSync(temp, { force:true }); } catch (_) {}
  throw lastError || new Error('Remplacement atomique de la sauvegarde impossible.');
}

function writeState(nextState) {
  const target = stateFilePath();
  const safeState = {
    ...defaultState(),
    ...nextState,
    version: STATE_VERSION,
    updatedAt: new Date().toISOString()
  };
  atomicReplaceState(target, encodeJson(safeState));

  try {
    getCandidateStore().saveSnapshot(safeState);
    getCandidateProtection().backupState();
    lastCandidateSaveError = '';
  } catch (error) {
    lastCandidateSaveError = error && error.message ? error.message : String(error);
    console.error('Sauvegarde du dossier candidat impossible:', lastCandidateSaveError);
  }

  return safeState;
}

function safePageName(urlOrName) {
  try {
    if (urlOrName.startsWith('file:')) {
      return path.basename(new URL(urlOrName).pathname);
    }
  } catch (_) {}
  return path.basename(String(urlOrName || 'qcmv1.0.html'));
}

function isAdminBilanPage(pageName) {
  return ['admin-bilan.html', 'bilan.html'].includes(String(pageName || '').toLowerCase());
}

function isAdminCandidatePage(pageName) {
  return String(pageName || '').toLowerCase() === 'admin-candidats.html';
}

function isAdminNavigationPage(pageName) {
  return isAdminBilanPage(pageName) || isAdminCandidatePage(pageName);
}

function existingWebPage(pageName) {
  const webRoot = path.join(__dirname, '..', 'app', 'web');
  const candidate = path.join(webRoot, safePageName(pageName));
  if (fs.existsSync(candidate)) return candidate;
  return path.join(webRoot, 'qcmv1.0.html');
}

function verifyAdminPassword(password) {
  const received = crypto.createHash('sha256').update(String(password || '').trim().toUpperCase(), 'utf8').digest('hex');
  const expected = Buffer.from(ADMIN_PASSWORD_SHA256, 'utf8');
  const actual = Buffer.from(received, 'utf8');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function calculateAdaptiveZoom() {
  if (!mainWindow || mainWindow.isDestroyed()) return 1;
  const bounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const size = display && display.size ? display.size : { width: bounds.width, height: bounds.height };
  const widthFactor = Number(size.width || bounds.width || DESIGN_WIDTH) / DESIGN_WIDTH;
  const heightFactor = Number(size.height || bounds.height || DESIGN_HEIGHT) / DESIGN_HEIGHT;
  const factor = Math.min(1, widthFactor, heightFactor);
  return Math.max(MIN_ZOOM_FACTOR, Math.round(factor * 100) / 100);
}

function applyAdaptiveZoom() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.setZoomFactor(calculateAdaptiveZoom());
}

// SEB_CANDIDATE_KIOSK_GUARD
function enforceCandidateWindowLock(focusWindow = false) {
  if (adminSessionUnlocked || !mainWindow || mainWindow.isDestroyed()) return;
  startCandidateKeyGuard();
  try {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isKiosk()) mainWindow.setKiosk(true);
    if (!mainWindow.isFullScreen()) mainWindow.setFullScreen(true);
    if (!mainWindow.isAlwaysOnTop()) mainWindow.setAlwaysOnTop(true);
    mainWindow.setSkipTaskbar(true);
    mainWindow.setMenuBarVisibility(false);
    if (focusWindow) mainWindow.focus();
  } catch (_) {}
}

function reinforceCandidateWindowLock() {
  for (const delay of [0, 120, 350, 800]) {
    setTimeout(() => enforceCandidateWindowLock(delay === 0 || delay === 350), delay);
  }
}

function setSplashProgress(percent, message) {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  const js = `window.setStartupProgress && window.setStartupProgress(${value}, ${JSON.stringify(String(message || ''))});`;
  splashWindow.webContents.executeJavaScript(js).catch(() => {});
}

function createSplashWindow() {
  splashStartedAt = Date.now();
  splashWindow = new BrowserWindow({
    width: 640,
    height: 390,
    show: false,
    frame: false,
    resizable: false,
    movable: true,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'), {
    query: { version: app.getVersion() }
  });

  splashWindow.once('ready-to-show', () => {
    if (!splashWindow || splashWindow.isDestroyed()) return;
    splashWindow.show();
    setSplashProgress(12, 'Initialisation de SEB EvalPro…');
  });

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function finishStartup() {
  const elapsed = Date.now() - splashStartedAt;
  const delay = Math.max(0, MIN_SPLASH_MS - elapsed);
  setSplashProgress(100, 'Prêt');

  setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
    enforceCandidateWindowLock(true);
    applyAdaptiveZoom();
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    // La fermeture du splash peut brièvement rendre la barre des tâches Windows
    // au premier plan : réaffirmer le verrou candidat après cette transition.
    reinforceCandidateWindowLock();
  }, delay + 180);
}

function createWindow() {
  Menu.setApplicationMenu(null);
  setSplashProgress(28, 'Lecture de la sauvegarde…');
  const state = readState();
  adminSessionUnlocked = false;

  mainWindow = new BrowserWindow({
    title: 'SEB EvalPro',
    show: false,
    fullscreen: true,
    kiosk: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: false,
      navigateOnDragDrop: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  installDownloadRouting();
  setSplashProgress(48, 'Chargement du parcours…');
  mainWindow.loadFile(existingWebPage(state.lastEvaluationPage || state.lastPage));

  mainWindow.webContents.on('did-finish-load', () => {
    applyAdaptiveZoom();
  });

  mainWindow.webContents.once('did-finish-load', () => {
    setSplashProgress(86, 'Restauration de la session…');
  });

  mainWindow.once('ready-to-show', finishStartup);

  mainWindow.webContents.on('did-navigate', (_event, url) => {
    const page = safePageName(url);
    if (adminCandidateResultsMode || isAdminNavigationPage(page)) {
      applyAdaptiveZoom();
      return;
    }
    const current = readState();
    current.lastPage = page;
    current.lastEvaluationPage = page;
    writeState(current);
    applyAdaptiveZoom();
  });

  mainWindow.on('enter-full-screen', () => {
    setTimeout(applyAdaptiveZoom, 50);
  });

  mainWindow.on('leave-full-screen', () => {
    if (!adminSessionUnlocked) setTimeout(() => enforceCandidateWindowLock(true), 30);
  });

  mainWindow.on('blur', () => {
    // Temporaire : pendant les tests de stabilité, la touche Windows doit pouvoir
    // afficher la barre Windows en cas de blocage.
    if (!adminSessionUnlocked && !TEMP_ALLOW_WINDOWS_RECOVERY) {
      setTimeout(() => enforceCandidateWindowLock(true), 80);
    }
  });

  mainWindow.on('minimize', () => {
    if (!adminSessionUnlocked) setTimeout(() => enforceCandidateWindowLock(true), 30);
  });

  mainWindow.on('show', () => {
    if (!adminSessionUnlocked) reinforceCandidateWindowLock();
  });

  mainWindow.on('resize', applyAdaptiveZoom);

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // SEB_CANDIDATE_OS_SHORTCUT_GUARD :
  // pendant le parcours, empêcher les raccourcis qui permettent de sortir vers
  // Windows ou de lancer une application externe (dont la calculatrice système).
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (adminSessionUnlocked) return;
    const key = String(input && input.key || '').toLowerCase();
    const alt = !!(input && input.alt);
    const control = !!(input && input.control);
    const meta = !!(input && input.meta);
    const shift = !!(input && input.shift);

    const isWindowsKey = key === 'meta' || key === 'super' || key === 'os';
    const windowsCombo = meta && !isWindowsKey;
    const windowsOrLauncherKey =
      windowsCombo ||
      key === 'alt' ||
      key === 'calculator' ||
      key === 'launchapp1' ||
      key === 'launchapp2' ||
      key === 'launchapplication1' ||
      key === 'launchapplication2' ||
      key.includes('calculator');

    const escapeToWindows =
      (alt && ['tab', 'escape', 'esc', ' ', 'space', 'f4'].includes(key)) ||
      (control && ['escape', 'esc'].includes(key)) ||
      (control && shift && ['escape', 'esc'].includes(key)) ||
      key === 'f11' ||
      key === 'f12';

    if (windowsOrLauncherKey || escapeToWindows) {
      event.preventDefault();
      setTimeout(() => enforceCandidateWindowLock(true), 0);
    }
  });

  // SEB_RUNTIME_OFFLINE : le plateau candidat ne doit jamais dépendre d'Internet.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      if (new URL(url).protocol !== 'file:') event.preventDefault();
    } catch (_) {
      event.preventDefault();
    }
  });
  mainWindow.webContents.session.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    (_details, callback) => callback({ cancel: true })
  );

  // SEB_CANDIDATE_CLOSE_GUARD : Alt+F4 / fermeture fenêtre refusés.
  // Une fermeture réelle ne devient possible que par le flux Admin qui appelle app.quit().
  mainWindow.on('close', (event) => {
    if (allowApplicationExit) return;
    event.preventDefault();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    enforceCandidateWindowLock(true);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    adminSessionUnlocked = false;
  });
}

function showStartupSecurityError(error) {
  const message = String(error && error.message ? error.message : error || 'Erreur de sécurité inconnue.');
  console.error('SEB EvalPro démarrage sécurisé impossible:', message);

  if (splashWindow && !splashWindow.isDestroyed()) {
    try { splashWindow.close(); } catch (_) {}
  }

  mainWindow = new BrowserWindow({
    width: 860,
    height: 520,
    show: true,
    center: true,
    resizable: true,
    backgroundColor: '#ffffff',
    title: 'SEB EvalPro - Démarrage impossible',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false
    }
  });
  mainWindow.setMenuBarVisibility(false);

  const safeMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>SEB EvalPro</title>
  <style>
    body{font-family:Arial,sans-serif;margin:0;background:#f5f7fa;color:#222}
    .card{max-width:760px;margin:60px auto;background:#fff;border:1px solid #ccd6e0;border-radius:10px;padding:28px 32px;box-shadow:0 8px 28px rgba(0,0,0,.12)}
    h1{margin:0 0 18px;color:#c00000;font-size:25px}
    p{line-height:1.55}
    .msg{margin:18px 0;padding:14px;background:#fff5f5;border-left:4px solid #c00000;white-space:pre-wrap}
    .note{color:#555;font-size:14px}
  </style></head><body><div class="card">
    <h1>SEB EvalPro ne peut pas accéder aux données sécurisées</h1>
    <p>Le programme a bien démarré, mais la protection générale des données candidat n'a pas pu être initialisée.</p>
    <div class="msg">${safeMessage}</div>
    <p><strong>Aucun dossier candidat n'a été supprimé ni remplacé.</strong></p>
    <p class="note">Fermez cette fenêtre puis faites vérifier la clé locale ou sa copie de récupération. Un dossier candidat individuel endommagé ne doit pas provoquer cet écran : seuls les problèmes concernant la clé générale du poste peuvent bloquer l'accès sécurisé aux données.</p>
  </div></body></html>`;

  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startApplication() {
  // Toujours créer une interface visible avant les contrôles de sécurité.
  // Une erreur de clé ne doit jamais laisser un simple processus invisible.
  createSplashWindow();
  setSplashProgress(10, 'Migration du stockage local…');

  try {
    const migration = migrateLegacyDocumentsStorage({
      documentsPath: app.getPath('documents'),
      userDataPath: app.getPath('userData')
    });
    if (!migration.completed) {
      console.warn('SEB EvalPro 0.3.8 : migration Documents incomplète, anciennes données conservées.', migration);
    } else {
      console.log(
        'SEB EvalPro 0.3.8 : stockage interne migré ; dossiers Documents retirés=' +
        migration.removedDirectories + ', fichiers Word visibles conservés=' + migration.wordExports + '.'
      );
    }

    setSplashProgress(16, 'Vérification de la protection des données…');
    initializeCandidateSecurity();
    ensureSebDocumentsFolders();
  } catch (error) {
    showStartupSecurityError(error);
    return;
  }

  setTimeout(() => {
    setSplashProgress(20, 'Préparation du programme…');
    createWindow();
  }, 120);
}

ipcMain.on('state:load-sync', (event) => {
  event.returnValue = readState();
});

ipcMain.on('state:save-sync', (event, payload) => {
  try {
    const state = writeState(payload || {});
    event.returnValue = lastCandidateSaveError
      ? { ok: false, state, error: 'Sauvegarde du dossier candidat impossible : ' + lastCandidateSaveError }
      : { ok: true, state };
  } catch (error) {
    event.returnValue = { ok: false, error: error.message };
  }
});

ipcMain.handle('state:save', (_event, payload) => {
  try {
    const state = writeState(payload || {});
    return lastCandidateSaveError
      ? { ok: false, state, error: 'Sauvegarde du dossier candidat impossible : ' + lastCandidateSaveError }
      : { ok: true, state };
  } catch (error) {
    return { ok: false, error: error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('admin:verify', (_event, password) => {
  const ok = verifyAdminPassword(password);
  if (ok) {
    adminSessionUnlocked = true;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setSkipTaskbar(false);
      mainWindow.setKiosk(false);
      mainWindow.setFullScreen(false);
      mainWindow.focus();
    }
  }
  return ok;
});

ipcMain.handle('admin:verify-password', (_event, password) => {
  return verifyAdminPassword(password);
});

ipcMain.handle('admin:status', () => adminSessionUnlocked);
ipcMain.on('app:edition-sync', (event) => { event.returnValue = { ...editionCapabilities }; });
ipcMain.handle('app:edition', () => ({ ...editionCapabilities }));

ipcMain.handle('admin:lock', () => {
  adminSessionUnlocked = false;
  adminExportCandidateDir = null;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setSkipTaskbar(true);
    mainWindow.setKiosk(true);
    mainWindow.setFullScreen(true);
    mainWindow.setAlwaysOnTop(true);
    reinforceCandidateWindowLock();
  }
  return true;
});

ipcMain.handle('candidate:set-admin-export-context', (_event, candidateId) => {
  if (!adminSessionUnlocked) return false;
  const root = path.join(sebInternalRoot(), 'Candidats');
  const record = getCandidateTransfer().listCandidateRecords(root, false)
    .find((item) => String(item.candidateId) === String(candidateId || ''));
  if (!record) {
    adminExportCandidateDir = null;
    return false;
  }
  adminExportCandidateDir = path.join(record.candidateDir, 'bilan', 'exports');
  fs.mkdirSync(adminExportCandidateDir, { recursive:true });
  return true;
});

ipcMain.handle('candidate:active', () => {
  if (!adminSessionUnlocked) return null;
  return getCandidateStore().getActiveCandidate();
});

ipcMain.handle('candidate:complete-active', (_event, mode) => {
  const completionMode = String(mode || '');
  if (!['admin-manual', 'candidate-final-page'].includes(completionMode)) {
    return { ok:false, error:'Mode de fin de parcours invalide.' };
  }
  if (completionMode === 'admin-manual' && !adminSessionUnlocked) {
    return { ok:false, error:'Accès administrateur requis.' };
  }
  try {
    const currentState = readState();
    const completed = getCandidateStore().completeActiveCandidate(currentState, completionMode);
    if (!completed) return { ok:false, error:'Aucun parcours candidat actif sur ce PC.' };
    writeState(defaultState());
    return { ok:true, ...completed };
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('admin:export-candidates', async (_event, password, destinationOptions = {}) => {
  if (!mainWindow || !adminSessionUnlocked) return { ok: false, error: 'Accès administrateur requis.' };
  try {
    const mode = String(destinationOptions && destinationOptions.mode || 'existing');

    if (mode === 'create') {
      const rawFolderName = String(destinationOptions && destinationOptions.folderName || '').trim();
      const folderName = rawFolderName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/[. ]+$/g, '').trim();
      if (!folderName || folderName === '.' || folderName === '..') {
        return { ok:false, error:'Le nom du dossier d’export est invalide.' };
      }

      const selection = await dialog.showOpenDialog(mainWindow, {
        title: 'Choisir la clé USB où créer le nouveau dossier',
        buttonLabel: 'Créer le dossier ici',
        properties: ['openDirectory']
      });
      if (selection.canceled || !selection.filePaths || !selection.filePaths[0]) {
        return { ok:false, cancelled:true };
      }

      const parent = selection.filePaths[0];
      const destination = path.join(parent, folderName);
      if (fs.existsSync(destination)) {
        return {
          ok:false,
          error:'Ce dossier existe déjà sur la clé. Choisissez « Choisir un dossier existant » pour y ajouter les nouveaux candidats.'
        };
      }
      fs.mkdirSync(destination, { recursive:false });
      const result = getCandidateTransfer().exportAll(destination, password);
      return { ok:true, ...result, createdExportFolder:true };
    }

    if (mode !== 'existing') {
      return { ok:false, error:'Choix de destination d’export invalide.' };
    }

    const selection = await dialog.showOpenDialog(mainWindow, {
      title: 'Choisir un dossier existant sur la clé USB',
      buttonLabel: 'Exporter dans ce dossier',
      properties: ['openDirectory']
    });
    if (selection.canceled || !selection.filePaths || !selection.filePaths[0]) {
      return { ok:false, cancelled:true };
    }

    const result = getCandidateTransfer().exportAll(selection.filePaths[0], password);
    return { ok:true, ...result, createdExportFolder:false };
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('admin:import-candidates', async (_event, password) => {
  if (!editionCapabilities.canImport) return { ok:false, error:'Import réservé à la version Administrateur.' };
  if (!mainWindow || !adminSessionUnlocked) return { ok: false, error: 'Accès administrateur requis.' };
  try {
    const selection = await dialog.showOpenDialog(mainWindow, {
      title: 'Choisir la clé USB contenant les fichiers candidats .seb',
      buttonLabel: 'Importer depuis cette clé',
      properties: ['openDirectory']
    });
    if (selection.canceled || !selection.filePaths || !selection.filePaths[0]) {
      return { ok: false, cancelled: true };
    }
    const result = getCandidateTransfer().importAll(selection.filePaths[0], password);
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: error && error.message ? error.message : String(error) };
  }
});

function loadAdminCandidateBrowser(candidateId = '') {
  if (!mainWindow || !adminSessionUnlocked) return false;
  adminCandidateResultsMode = false;
  const target = path.join(__dirname, '..', 'app', 'web', 'admin-candidats.html');
  if (!fs.existsSync(target)) return false;
  const selected = String(candidateId || '').trim();
  mainWindow.loadFile(target, selected ? { query:{ candidateId:selected } } : undefined);
  return true;
}

ipcMain.handle('admin:open-candidate-browser', (_event, candidateId) => {
  return loadAdminCandidateBrowser(candidateId);
});

ipcMain.handle('admin:return-candidate-browser', (_event, candidateId) => {
  return loadAdminCandidateBrowser(candidateId);
});

ipcMain.handle('admin:open-bilan', () => {
  if (!editionCapabilities.canBilan) return false;
  if (!mainWindow || !adminSessionUnlocked) return false;
  adminCandidateResultsMode = false;
  const bilanPath = existingWebPage('admin-bilan.html');
  if (!fs.existsSync(bilanPath)) return false;
  mainWindow.loadFile(bilanPath);
  return true;
});

ipcMain.handle('admin:open-candidate-results', () => {
  if (!mainWindow || !adminSessionUnlocked) return false;
  adminCandidateResultsMode = true;
  mainWindow.loadFile(existingWebPage('qcmv1.0.html'));
  return true;
});

ipcMain.handle('admin:return-evaluation', () => {
  if (!mainWindow || !adminSessionUnlocked) return false;
  adminCandidateResultsMode = false;
  const state = readState();
  mainWindow.loadFile(existingWebPage(state.lastEvaluationPage || 'qcmv1.0.html'));
  return true;
});

ipcMain.handle('ai:status', () => {
  if (!editionCapabilities.canAi) {
    return { available:false, offline:true, integrated:false, edition:editionCapabilities.edition, error:'SEB-IA est réservée à la version Administrateur.' };
  }
  if (!adminSessionUnlocked) return { available:false, offline:true, integrated:true, error:'Accès administrateur requis.' };
  return { available:true, offline:true, integrated:true, model:'SEB-IA V1', runtime:'moteur rédactionnel intégré' };
});

ipcMain.handle('ai:rewrite-synthesis', async () => {
  if (!editionCapabilities.canAi) return { ok:false, error:'SEB-IA est réservée à la version Administrateur.' };
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  return { ok:false, integrated:true, error:'SEB-IA génère directement la synthèse à partir du tableau ; aucune reformulation externe n’est nécessaire.' };
});

ipcMain.handle('ai:cancel-current', () => ({ ok:true, cancelled:false, offline:true, integrated:true }));

require('./session-close')({
  app,
  ipcMain,
  getMainWindow: () => mainWindow,
  getAdminUnlocked: () => adminSessionUnlocked,
  setAdminUnlocked: (value) => { adminSessionUnlocked = !!value; }
});

app.whenReady().then(startApplication);

app.on('before-quit', () => {
  allowApplicationExit = true;
  stopCandidateKeyGuard();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) startApplication();
});
