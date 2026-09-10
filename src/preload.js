const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

const BAR_HEIGHT = 44;
const HOTZONE_HEIGHT = 5;
const BAR_HIDE_DELAY = 450;
let restoredState = {};
let adminUnlocked = false;
let saveTimer = null;
let barHideTimer = null;

function objectToStorage(storage, values) {
  if (!storage || !values || typeof values !== 'object') return;
  for (const [key, value] of Object.entries(values)) {
    try {
      storage.setItem(key, String(value));
    } catch (_) {}
  }
}

function storageToObject(storage) {
  const out = {};
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      out[key] = storage.getItem(key);
    }
  } catch (_) {}
  return out;
}

function pageName() {
  try {
    return path.basename(decodeURIComponent(window.location.pathname)) || 'qcmv1.0.html';
  } catch (_) {
    return 'qcmv1.0.html';
  }
}

function isAdminBilanPage(page = pageName()) {
  return ['admin-bilan.html', 'bilan.html'].includes(String(page || '').toLowerCase());
}

function buildSnapshot() {
  const page = pageName();
  return {
    ...restoredState,
    sessionStorage: storageToObject(window.sessionStorage),
    localStorage: storageToObject(window.localStorage),
    lastPage: page,
    lastEvaluationPage: isAdminBilanPage(page)
      ? (restoredState.lastEvaluationPage || 'qcmv1.0.html')
      : page
  };
}

function saveNow(sync = false) {
  const snapshot = buildSnapshot();
  restoredState = snapshot;
  if (sync) {
    ipcRenderer.sendSync('state:save-sync', snapshot);
  } else {
    ipcRenderer.invoke('state:save', snapshot).catch(() => {});
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveNow(false), 250);
}

function createPasswordDialog() {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.id = 'seb-evalpro-admin-dialog';
    backdrop.innerHTML = `
      <div class="seb-admin-card" role="dialog" aria-modal="true" aria-label="Accès administrateur">
        <div class="seb-admin-title">Accès administrateur</div>
        <label class="seb-admin-label" for="seb-admin-password">Mot de passe</label>
        <input id="seb-admin-password" class="seb-admin-input" type="password" autocomplete="off" />
        <div id="seb-admin-error" class="seb-admin-error" aria-live="polite"></div>
        <div class="seb-admin-actions">
          <button type="button" id="seb-admin-cancel">Annuler</button>
          <button type="button" id="seb-admin-ok" class="primary">Valider</button>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #seb-evalpro-admin-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.38);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
      #seb-evalpro-admin-dialog .seb-admin-card{width:360px;background:#fff;border:1px solid #bbb;border-radius:8px;padding:20px;box-shadow:0 10px 35px rgba(0,0,0,.28);box-sizing:border-box}
      #seb-evalpro-admin-dialog .seb-admin-title{font-size:20px;font-weight:700;color:#0070c0;margin-bottom:16px}
      #seb-evalpro-admin-dialog .seb-admin-label{display:block;font-size:14px;margin-bottom:6px;color:#222}
      #seb-evalpro-admin-dialog .seb-admin-input{width:100%;font-size:18px;padding:8px 10px;border:1px solid #999;border-radius:4px;box-sizing:border-box}
      #seb-evalpro-admin-dialog .seb-admin-error{min-height:20px;color:#c00000;font-size:13px;margin-top:6px}
      #seb-evalpro-admin-dialog .seb-admin-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
      #seb-evalpro-admin-dialog button{font-family:Arial,sans-serif;font-size:14px;padding:8px 14px;border:1px solid #999;border-radius:4px;background:#f2f2f2;cursor:pointer}
      #seb-evalpro-admin-dialog button.primary{background:#0070c0;color:#fff;border-color:#0070c0}
    `;
    backdrop.appendChild(style);
    document.body.appendChild(backdrop);

    const input = backdrop.querySelector('#seb-admin-password');
    const error = backdrop.querySelector('#seb-admin-error');
    const finish = (value) => {
      backdrop.remove();
      resolve(value);
    };

    backdrop.querySelector('#seb-admin-cancel').addEventListener('click', () => finish(false));
    backdrop.querySelector('#seb-admin-ok').addEventListener('click', async () => {
      const ok = await ipcRenderer.invoke('admin:verify', input.value);
      input.value = '';
      if (ok) finish(true);
      else {
        error.textContent = 'Mot de passe incorrect.';
        input.focus();
      }
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') backdrop.querySelector('#seb-admin-ok').click();
      if (event.key === 'Escape') finish(false);
    });
    input.focus();
  });
}

function injectAdminBar() {
  if (!document.body || document.getElementById('seb-evalpro-topbar')) return;

  const bar = document.createElement('div');
  bar.id = 'seb-evalpro-topbar';
  bar.innerHTML = `
    <div class="seb-evalpro-name">SEB EvalPro</div>
    <div class="seb-evalpro-spacer"></div>
    <button id="seb-evalpro-return" type="button" hidden>Retour à l'évaluation</button>
    <button id="seb-evalpro-bilan" type="button" hidden>Bilan</button>
    <button id="seb-evalpro-admin" type="button">Administrateur</button>`;

  const hotzone = document.createElement('div');
  hotzone.id = 'seb-evalpro-top-hotzone';
  hotzone.setAttribute('aria-hidden', 'true');

  const style = document.createElement('style');
  style.id = 'seb-evalpro-shell-style';
  style.textContent = `
    html{box-sizing:border-box}
    body{padding-top:0 !important;box-sizing:border-box}
    #seb-evalpro-top-hotzone{position:fixed;top:0;left:0;right:0;height:${HOTZONE_HEIGHT}px;z-index:2147483645;background:transparent}
    #seb-evalpro-topbar{position:fixed;top:0;left:0;right:0;height:${BAR_HEIGHT}px;z-index:2147483646;display:flex;align-items:center;gap:8px;padding:0 12px;box-sizing:border-box;background:#0070c0;color:#fff;font-family:Arial,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.25);transform:translateY(-100%);transition:transform .16s ease;will-change:transform}
    #seb-evalpro-topbar.seb-evalpro-visible{transform:translateY(0)}
    #seb-evalpro-topbar .seb-evalpro-name{font-size:18px;font-weight:700;white-space:nowrap}
    #seb-evalpro-topbar .seb-evalpro-spacer{flex:1}
    #seb-evalpro-topbar button{font-family:Arial,sans-serif;font-size:14px;padding:6px 12px;border:1px solid rgba(255,255,255,.75);border-radius:4px;background:#fff;color:#0070c0;cursor:pointer}
    #seb-evalpro-topbar button:hover{background:#f2f2f2}
  `;
  document.head.appendChild(style);
  document.body.prepend(bar);
  document.body.prepend(hotzone);

  const adminButton = bar.querySelector('#seb-evalpro-admin');
  const bilanButton = bar.querySelector('#seb-evalpro-bilan');
  const returnButton = bar.querySelector('#seb-evalpro-return');

  const showBar = () => {
    clearTimeout(barHideTimer);
    bar.classList.add('seb-evalpro-visible');
  };

  const hideBar = () => {
    if (document.getElementById('seb-evalpro-admin-dialog')) return;
    bar.classList.remove('seb-evalpro-visible');
  };

  const scheduleHideBar = () => {
    clearTimeout(barHideTimer);
    barHideTimer = setTimeout(() => {
      if (!bar.matches(':hover') && !hotzone.matches(':hover')) hideBar();
    }, BAR_HIDE_DELAY);
  };

  hotzone.addEventListener('mouseenter', showBar);
  hotzone.addEventListener('mouseleave', scheduleHideBar);
  bar.addEventListener('mouseenter', showBar);
  bar.addEventListener('mouseleave', scheduleHideBar);
  document.addEventListener('mousemove', (event) => {
    if (event.clientY <= 2) showBar();
  }, true);

  const updateAdminButtons = () => {
    const onBilan = isAdminBilanPage();
    bilanButton.hidden = !adminUnlocked || onBilan;
    returnButton.hidden = !adminUnlocked || !onBilan;
    adminButton.textContent = adminUnlocked ? 'Verrouiller' : 'Administrateur';
  };

  adminButton.addEventListener('click', async () => {
    showBar();

    if (adminUnlocked) {
      await ipcRenderer.invoke('admin:lock');
      adminUnlocked = false;
      updateAdminButtons();
      scheduleHideBar();
      return;
    }

    const ok = await createPasswordDialog();
    if (ok) {
      adminUnlocked = true;
      updateAdminButtons();
    }
    scheduleHideBar();
  });

  bilanButton.addEventListener('click', async () => {
    saveNow(true);
    await ipcRenderer.invoke('admin:open-bilan');
  });

  returnButton.addEventListener('click', async () => {
    saveNow(true);
    await ipcRenderer.invoke('admin:return-evaluation');
  });

  updateAdminButtons();
  hideBar();
}

try {
  restoredState = ipcRenderer.sendSync('state:load-sync') || {};
  objectToStorage(window.sessionStorage, restoredState.sessionStorage);
  objectToStorage(window.localStorage, restoredState.localStorage);
} catch (_) {}

window.addEventListener('DOMContentLoaded', async () => {
  adminUnlocked = await ipcRenderer.invoke('admin:status');
  injectAdminBar();
  document.addEventListener('input', scheduleSave, true);
  document.addEventListener('change', scheduleSave, true);
  document.addEventListener('click', scheduleSave, true);
  setInterval(() => saveNow(false), 1000);
});

window.addEventListener('beforeunload', () => {
  saveNow(true);
});

contextBridge.exposeInMainWorld('sebEvalPro', {
  save: () => saveNow(false),
  verifyAdminPassword: (password) => ipcRenderer.invoke('admin:verify-password', password)
});
