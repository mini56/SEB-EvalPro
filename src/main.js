const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ADMIN_PASSWORD_SHA256 = 'c800892ba3f11b33d36eedf7d3c4297f2b6c02e2c347dda8954b4c577f6666b5';
const STATE_VERSION = 1;
let mainWindow = null;
let adminSessionUnlocked = false;

function stateFilePath() {
  return path.join(app.getPath('userData'), 'evaluation-state.json');
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

function existingWebPage(pageName) {
  const webRoot = path.join(__dirname, '..', 'app', 'web');
  const candidate = path.join(webRoot, safePageName(pageName));
  if (fs.existsSync(candidate)) return candidate;
  return path.join(webRoot, 'qcmv1.0.html');
}

function createWindow() {
  const state = readState();
  adminSessionUnlocked = false;

  mainWindow = new BrowserWindow({
    title: 'SEB EvalPro',
    show: false,
    fullscreen: true,
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
  mainWindow.loadFile(existingWebPage(state.lastEvaluationPage || state.lastPage));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.setFullScreen(true);
  });

  mainWindow.webContents.on('did-navigate', (_event, url) => {
    const current = readState();
    const page = safePageName(url);
    current.lastPage = page;
    if (page.toLowerCase() !== 'bilan.html') {
      current.lastEvaluationPage = page;
    }
    writeState(current);
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.on('closed', () => {
    mainWindow = null;
    adminSessionUnlocked = false;
  });
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
  const received = crypto.createHash('sha256').update(String(password || ''), 'utf8').digest('hex');
  const expected = Buffer.from(ADMIN_PASSWORD_SHA256, 'utf8');
  const actual = Buffer.from(received, 'utf8');
  const ok = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  if (ok) adminSessionUnlocked = true;
  return ok;
});

ipcMain.handle('admin:status', () => adminSessionUnlocked);

ipcMain.handle('admin:lock', () => {
  adminSessionUnlocked = false;
  return true;
});

ipcMain.handle('admin:open-bilan', () => {
  if (!mainWindow || !adminSessionUnlocked) return false;
  const bilanPath = existingWebPage('bilan.html');
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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
