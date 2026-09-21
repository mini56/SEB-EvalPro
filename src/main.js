const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createLocalAiService } = require('./local-ai');
const { createCandidateStore } = require('./candidate-store-main');
const { createCandidateTransfer } = require('./candidate-transfer-main');

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
const localAi = createLocalAiService({ app });
let candidateStore = null;
let candidateTransfer = null;
let adminExportCandidateDir = null;
let adminCandidateResultsMode = false;
let lastCandidateSaveError = '';
let allowApplicationExit = false;

function stateFilePath() {
  return path.join(app.getPath('userData'), 'evaluation-state.json');
}

function sebDocumentsRoot() {
  return path.join(app.getPath('documents'), 'SEB EvalPro');
}

function getCandidateStore() {
  if (!candidateStore) {
    candidateStore = createCandidateStore({
      documentsPath: app.getPath('documents'),
      userDataPath: app.getPath('userData')
    });
  }
  return candidateStore;
}

function getCandidateTransfer() {
  if (!candidateTransfer) {
    candidateTransfer = createCandidateTransfer({
      documentsPath: app.getPath('documents')
    });
  }
  return candidateTransfer;
}

function bilanDocumentsDir() {
  return path.join(sebDocumentsRoot(), 'Bilans');
}

function ensureSebDocumentsFolders() {
  fs.mkdirSync(bilanDocumentsDir(), { recursive: true });
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
      const candidateExportDir = getCandidateStore().getActiveExportDir();
      const targetDirectory = adminExportCandidateDir || candidateExportDir || bilanDocumentsDir();
      const isCurrentCandidateWord = !!adminExportCandidateDir && /^Evaluation_.+\.docx?$/i.test(filename);
      if (isCurrentCandidateWord) {
        const target = path.join(targetDirectory, filename);
        item.setSavePath(target);
        item.once('done', (_downloadEvent, state) => {
          if (state === 'completed') cleanupNumberedCandidateWordCopies(targetDirectory, filename);
        });
      } else {
        item.setSavePath(uniqueOutputPath(targetDirectory, filename));
      }
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
    const raw = fs.readFileSync(stateFilePath(), 'utf8');
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch (_) {
    return defaultState();
  }
}

function writeState(nextState) {
  const target = stateFilePath();
  const temp = `${target}.tmp`;
  const safeState = {
    ...defaultState(),
    ...nextState,
    version: STATE_VERSION,
    updatedAt: new Date().toISOString()
  };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(temp, JSON.stringify(safeState, null, 2), 'utf8');
  fs.renameSync(temp, target);

  try {
    getCandidateStore().saveSnapshot(safeState);
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
    if (!adminSessionUnlocked) setTimeout(() => enforceCandidateWindowLock(true), 80);
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

    const windowsOrLauncherKey =
      meta ||
      key === 'meta' ||
      key === 'super' ||
      key === 'os' ||
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

function startApplication() {
  ensureSebDocumentsFolders();
  createSplashWindow();
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
  const root = path.join(sebDocumentsRoot(), 'Candidats');
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

ipcMain.handle('admin:export-candidates', async () => {
  if (!mainWindow || !adminSessionUnlocked) return { ok: false, error: 'Accès administrateur requis.' };
  try {
    const selection = await dialog.showOpenDialog(mainWindow, {
      title: 'Choisir la clé USB ou son dossier racine',
      buttonLabel: 'Exporter ici',
      properties: ['openDirectory', 'createDirectory']
    });
    if (selection.canceled || !selection.filePaths || !selection.filePaths[0]) {
      return { ok: false, cancelled: true };
    }
    const result = getCandidateTransfer().exportAll(selection.filePaths[0]);
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('admin:import-candidates', async () => {
  if (!mainWindow || !adminSessionUnlocked) return { ok: false, error: 'Accès administrateur requis.' };
  try {
    const selection = await dialog.showOpenDialog(mainWindow, {
      title: 'Choisir la racine de la clé USB contenant les dossiers candidats',
      buttonLabel: 'Importer',
      properties: ['openDirectory']
    });
    if (selection.canceled || !selection.filePaths || !selection.filePaths[0]) {
      return { ok: false, cancelled: true };
    }
    const result = getCandidateTransfer().importAll(selection.filePaths[0]);
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
  if (!adminSessionUnlocked) return { available: false, offline: true, error: 'Accès administrateur requis.' };
  return localAi.status();
});

ipcMain.handle('ai:rewrite-synthesis', async (_event, text) => {
  if (!adminSessionUnlocked) return { ok: false, error: 'Accès administrateur requis.' };
  return localAi.rewrite(String(text || ''));
});

require('./session-close')({
  app,
  ipcMain,
  getMainWindow: () => mainWindow,
  getAdminUnlocked: () => adminSessionUnlocked,
  setAdminUnlocked: (value) => { adminSessionUnlocked = !!value; },
  readState,
  writeState,
  defaultState,
  finalizeCandidateSession: (state) => getCandidateStore().closeActiveCandidate(state)
});

app.whenReady().then(startApplication);

app.on('before-quit', () => {
  allowApplicationExit = true;
  localAi.stop();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) startApplication();
});
