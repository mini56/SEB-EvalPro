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

function installDownloadRouting() {
  if (!mainWindow || mainWindow.isDestroyed() || downloadRoutingInstalled) return;
  downloadRoutingInstalled = true;
  mainWindow.webContents.session.on('will-download', (_event, item) => {
    const filename = path.basename(item.getFilename() || 'Evaluation.doc');
    if (!/\.docx?$/i.test(filename)) return;
    try {
      ensureSebDocumentsFolders();
      const candidateExportDir = getCandidateStore().getActiveExportDir();
      const targetDirectory = candidateExportDir || bilanDocumentsDir();
      item.setSavePath(uniqueOutputPath(targetDirectory, filename));
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
  } catch (error) {
    console.error('Sauvegarde du dossier candidat impossible:', error && error.message ? error.message : error);
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
      sandbox: true
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
    mainWindow.setKiosk(true);
    mainWindow.setFullScreen(true);
    applyAdaptiveZoom();
    mainWindow.focus();
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
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
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
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
    const current = readState();
    const page = safePageName(url);
    current.lastPage = page;
    if (!isAdminBilanPage(page)) {
      current.lastEvaluationPage = page;
    }
    writeState(current);
    applyAdaptiveZoom();
  });

  mainWindow.on('enter-full-screen', () => {
    setTimeout(applyAdaptiveZoom, 50);
  });

  mainWindow.on('resize', applyAdaptiveZoom);

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

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
    event.returnValue = { ok: true, state: writeState(payload || {}) };
  } catch (error) {
    event.returnValue = { ok: false, error: error.message };
  }
});

ipcMain.handle('state:save', (_event, payload) => {
  return writeState(payload || {});
});

ipcMain.handle('admin:verify', (_event, password) => {
  const ok = verifyAdminPassword(password);
  if (ok) adminSessionUnlocked = true;
  return ok;
});

ipcMain.handle('admin:verify-password', (_event, password) => {
  return verifyAdminPassword(password);
});

ipcMain.handle('admin:status', () => adminSessionUnlocked);

ipcMain.handle('admin:lock', () => {
  adminSessionUnlocked = false;
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

ipcMain.handle('admin:import-candidates', async (_event, groupName) => {
  if (!mainWindow || !adminSessionUnlocked) return { ok: false, error: 'Accès administrateur requis.' };
  try {
    const selection = await dialog.showOpenDialog(mainWindow, {
      title: 'Choisir la clé USB contenant SEB EvalPro\\Candidats',
      buttonLabel: 'Importer',
      properties: ['openDirectory']
    });
    if (selection.canceled || !selection.filePaths || !selection.filePaths[0]) {
      return { ok: false, cancelled: true };
    }
    const result = getCandidateTransfer().importAll(selection.filePaths[0], groupName);
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('admin:open-bilan', () => {
  if (!mainWindow || !adminSessionUnlocked) return false;
  const bilanPath = existingWebPage('admin-bilan.html');
  if (!fs.existsSync(bilanPath)) return false;
  mainWindow.loadFile(bilanPath);
  return true;
});

ipcMain.handle('admin:return-evaluation', () => {
  if (!mainWindow || !adminSessionUnlocked) return false;
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
  localAi.stop();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) startApplication();
});
