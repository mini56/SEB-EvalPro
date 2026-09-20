const { ipcRenderer } = require('electron');
const bilanHistory = require('./bilan-history-preload');
const replayPreload = require('./replay-preload');

let installed = false;
let beforeAdminNavigate = null;

function isCandidateAdminHost() {
  try { return /\/admin-candidats\.html$/i.test(decodeURIComponent(window.location.pathname)); }
  catch (_) { return false; }
}

function requestedCandidateId() {
  try { return String(new URL(window.location.href).searchParams.get('candidateId') || '').trim(); }
  catch (_) { return ''; }
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function norm(value) {
  let text = String(value == null ? '' : value);
  try { text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
  return text.toLocaleLowerCase('fr-FR').replace(/\s+/g,' ').trim();
}

function addStyle() {
  if (document.getElementById('seb-candidate-catalog-style')) return;
  const style = document.createElement('style');
  style.id = 'seb-candidate-catalog-style';
  style.textContent = `
    #seb-evalpro-open-candidate{background:#fff!important;color:#0070c0!important;border:2px solid #0070c0!important;font-weight:700}
    #seb-candidate-catalog,#seb-candidate-detail{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.58);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
    .seb-cc-card{width:min(1180px,96vw);max-height:90vh;background:#fff;border-radius:10px;box-shadow:0 16px 50px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden}
    .seb-cc-head{background:#0070c0;color:#fff;padding:14px 18px;display:flex;align-items:center;gap:12px}
    .seb-cc-title{font-size:20px;font-weight:700;flex:1}.seb-cc-badge{font-size:12px;font-weight:700;background:#fff;color:#0070c0;border-radius:14px;padding:4px 9px}
    .seb-cc-search-wrap{padding:12px 16px;border-bottom:1px solid #ddd;background:#f7f9fc}
    .seb-cc-search,.seb-list-search{width:100%;box-sizing:border-box;font:16px Arial,sans-serif;padding:10px 12px;border:1px solid #9aa7b8;border-radius:6px;background:#fff}
    .seb-cc-body{padding:12px 16px;overflow-y:auto;min-height:260px;max-height:68vh;background:#f5f7fb}
    .seb-cc-row{display:grid;grid-template-columns:1.35fr 1.2fr .95fr auto;gap:10px;align-items:center;padding:11px 12px;background:#fff;border:1px solid #d8dde8;border-radius:7px;margin-bottom:8px}
    .seb-cc-row strong{font-size:15px;color:#222}.seb-cc-row small{display:block;color:#666;margin-top:3px}
    .seb-cc-bilan{font-size:13px;line-height:1.35}.seb-cc-actions{display:flex;gap:7px;justify-content:flex-end}
    .seb-cc-actions button,.seb-cc-foot button,.seb-cc-bilan-row button,.seb-cc-detail-actions button{font:700 14px Arial,sans-serif;padding:8px 12px;border:2px solid #0070c0!important;border-radius:6px;background:#fff!important;color:#0070c0!important;cursor:pointer}
    .seb-cc-actions .primary,.seb-cc-bilan-row .primary,.seb-cc-detail-actions .primary{background:#fff!important;color:#0070c0!important;border-color:#0070c0!important}
    .seb-cc-actions button:hover,.seb-cc-foot button:hover,.seb-cc-bilan-row button:hover,.seb-cc-detail-actions button:hover{background:#f5f9fd!important}
    .seb-cc-actions .danger{background:#fff;color:#c00000;border-color:#c00000}.seb-cc-actions .confirm{background:#c00000;color:#fff}
    .seb-cc-foot{display:flex;justify-content:flex-end;gap:10px;padding:12px 16px;border-top:1px solid #ddd;background:#fff}
    .seb-cc-empty{padding:35px;text-align:center;color:#555}
    .seb-cc-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 18px;padding:14px 16px;background:#f7f9fc;border-bottom:1px solid #ddd;font-size:14px}
    .seb-cc-section{padding:14px 16px}.seb-cc-section h3{margin:0 0 10px;color:#005b9f}
    .seb-cc-bilan-row{display:grid;grid-template-columns:1fr .65fr .9fr auto;gap:10px;align-items:center;padding:9px 10px;border:1px solid #ddd;border-radius:6px;margin-bottom:7px}
    .seb-cc-detail-actions{display:flex;gap:10px;flex-wrap:wrap;padding:14px 16px;border-top:1px solid #ddd;background:#f7f9fc}
    .seb-list-search-wrap{margin:0 0 12px}
  `;
  document.head.appendChild(style);
}

function hideLegacyAdminEntryPoints() {
  // Les anciens accès Admin restent visibles : ils servent à retrouver les bilans
  // historiques qui ne sont pas encore rattachés à un dossier candidat autonome.
}

function enhanceChooser(dialogId, listId, rowSelector) {
  const dialog = document.getElementById(dialogId);
  if (!dialog || dialog.dataset.sebSearchEnhanced === '1') return;
  const list = dialog.querySelector('#' + listId);
  if (!list || !list.parentElement) return;
  dialog.dataset.sebSearchEnhanced = '1';
  const wrap = document.createElement('div');
  wrap.className = 'seb-list-search-wrap';
  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'seb-list-search';
  input.placeholder = 'Rechercher un nom, prénom, ville, groupe, date…';
  input.autocomplete = 'off';
  wrap.appendChild(input);
  list.parentElement.insertBefore(wrap, list);
  const filter = () => {
    const q = norm(input.value);
    dialog.querySelectorAll(rowSelector).forEach((row) => {
      row.style.display = !q || norm(row.textContent).includes(q) ? '' : 'none';
    });
  };
  input.addEventListener('input', filter);
  new MutationObserver(filter).observe(list, { childList:true, subtree:true });
}

function installGenericSearchObserver() {
  const apply = () => {
    hideLegacyAdminEntryPoints();
    enhanceChooser('seb-replay-chooser', 'seb-replay-list', '.seb-replay-row');
    enhanceChooser('seb-bilan-history-chooser', 'seb-bh-list', '.seb-bh-row');
  };
  apply();
  new MutationObserver(apply).observe(document.documentElement, { childList:true, subtree:true });
}

function bilanLabel(item) {
  if (!item.bilanCount) return 'Bilan : non enregistré';
  if (item.revisionCount) return `Bilan disponible<br><b>${item.revisionCount} révision(s)</b>`;
  return 'Bilan disponible<br><b>Original</b>';
}

async function openCandidateDetail(candidateId, onChanged) {
  const old = document.getElementById('seb-candidate-detail');
  if (old) old.remove();
  const result = await ipcRenderer.invoke('candidate-catalog:detail', candidateId);
  if (!result || !result.ok) {
    alert((result && result.error) || 'Impossible d’ouvrir ce candidat.');
    return;
  }

  const item = result.candidate;
  const overlay = document.createElement('div');
  overlay.id = 'seb-candidate-detail';
  overlay.innerHTML = `
    <div class="seb-cc-card">
      <div class="seb-cc-head"><div class="seb-cc-title">${escapeHtml(item.nom)} ${escapeHtml(item.prenom)}</div><div class="seb-cc-badge">DOSSIER CANDIDAT</div></div>
      <div class="seb-cc-meta">
        <div><b>Ville :</b> ${escapeHtml(item.lieu)}</div><div><b>Groupe :</b> ${escapeHtml(item.groupe)}</div><div><b>Date :</b> ${escapeHtml(item.date)}</div>
        <div><b>Bilans :</b> ${item.bilanCount}</div><div><b>Révisions :</b> ${item.revisionCount}</div><div><b>Parcours :</b> ${item.replayCount}</div>
      </div>
      <div class="seb-cc-body">
        <div class="seb-cc-section"><h3>Bilan et révisions</h3><div id="seb-cc-detail-bilans"></div></div>
        <div class="seb-cc-section"><h3>Replay du parcours</h3><div id="seb-cc-detail-replays"></div></div>
        <div class="seb-cc-section"><h3>Résultats du candidat</h3><div id="seb-cc-detail-results"></div></div>
        <div class="seb-cc-section"><h3>Document Word du bilan</h3><div id="seb-cc-detail-exports"></div></div>
      </div>
      <div class="seb-cc-detail-actions">
        <button type="button" id="seb-cc-detail-bilan" class="primary">Faire le bilan</button>
        <button type="button" id="seb-cc-detail-close">Fermer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const bilans = overlay.querySelector('#seb-cc-detail-bilans');
  if (!result.bilans || !result.bilans.length) {
    bilans.innerHTML = '<div class="seb-cc-empty">Aucun bilan enregistré pour ce candidat.</div>';
  } else {
    result.bilans.forEach((b) => {
      const row = document.createElement('div');
      row.className = 'seb-cc-bilan-row';
      const when = b.createdAt ? new Date(b.createdAt).toLocaleString('fr-FR') : '';
      const integrity = b.integrityOk ? '' : '<small style="color:#c00000;font-weight:700">⚠ intégrité à vérifier</small>';
      row.innerHTML = `<div><strong>${b.revision === 0 ? 'Bilan original' : 'Révision ' + b.revision}</strong>${integrity}</div><div>Build #${escapeHtml(b.originalBuild)}</div><div><small>${escapeHtml(when)}</small></div><div></div>`;
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'primary';
      open.textContent = 'Ouvrir';
      open.addEventListener('click', async () => {
        const loaded = await ipcRenderer.invoke('candidate-catalog:load-bilan', candidateId, b.filename);
        if (!loaded || !loaded.ok) {
          alert((loaded && loaded.error) || 'Ouverture impossible.');
          return;
        }
        await ipcRenderer.invoke('candidate:set-admin-export-context', candidateId).catch(() => false);
        if (typeof bilanHistory.openEditor === 'function') bilanHistory.openEditor(loaded.filename, loaded.archive);
        else alert('Éditeur de bilan indisponible.');
      });
      row.lastElementChild.appendChild(open);
      bilans.appendChild(row);
    });
  }

  const replays = overlay.querySelector('#seb-cc-detail-replays');
  if (!Array.isArray(result.replays) || !result.replays.length) {
    replays.innerHTML = '<div class="seb-cc-empty">Aucun replay enregistré pour ce candidat.</div>';
  } else {
    result.replays.forEach((filename, index) => {
      const row = document.createElement('div');
      row.className = 'seb-cc-bilan-row';
      row.innerHTML = `<div><strong>Parcours ${index + 1}</strong><small>${escapeHtml(filename)}</small></div><div></div><div></div><div></div>`;
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'primary';
      open.textContent = 'Rejouer';
      open.addEventListener('click', async () => {
        if (typeof replayPreload.openCandidateReplay !== 'function') {
          alert('Lecteur de replay indisponible.');
          return;
        }
        await replayPreload.openCandidateReplay(candidateId, filename);
      });
      row.lastElementChild.appendChild(open);
      replays.appendChild(row);
    });
  }

  const results = overlay.querySelector('#seb-cc-detail-results');
  if (results) {
    const row = document.createElement('div');
    row.className = 'seb-cc-bilan-row';
    row.innerHTML = '<div><strong>Page Résultats</strong><small>Lecture seule des réponses et scores enregistrés pour ce candidat.</small></div><div></div><div></div><div></div>';
    const openResults = document.createElement('button');
    openResults.type = 'button';
    openResults.className = 'primary';
    openResults.textContent = 'Ouvrir les résultats';
    openResults.addEventListener('click', async () => {
      await beginCandidateResults(candidateId, overlay);
    });
    row.lastElementChild.appendChild(openResults);
    results.appendChild(row);
  }

  const exports = overlay.querySelector('#seb-cc-detail-exports');
  if (!Array.isArray(result.exports) || !result.exports.length) {
    exports.innerHTML = '<div class="seb-cc-empty">Aucun document Word enregistré pour ce candidat.</div>';
  } else {
    result.exports.forEach((filename) => {
      const row = document.createElement('div');
      row.className = 'seb-cc-bilan-row';
      row.innerHTML = `<div><strong>${escapeHtml(filename)}</strong><small>Ouverture côté Administrateur : lecture et impression possibles avec le logiciel Windows associé.</small></div><div></div><div></div><div></div>`;
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'primary';
      open.textContent = 'Ouvrir';
      open.addEventListener('click', async () => {
        const opened = await ipcRenderer.invoke('candidate-catalog:open-export', candidateId, filename);
        if (!opened || !opened.ok) alert((opened && opened.error) || 'Ouverture du fichier impossible.');
      });
      row.lastElementChild.appendChild(open);
      exports.appendChild(row);
    });
  }

  overlay.querySelector('#seb-cc-detail-bilan').addEventListener('click', async () => {
    await beginCandidateBilan(candidateId, overlay);
  });
  overlay.querySelector('#seb-cc-detail-close').addEventListener('click', () => overlay.remove());
}

async function beginCandidateResults(candidateId, detailOverlay = null) {
  const prepared = await ipcRenderer.invoke('candidate-catalog:begin-results', candidateId);
  if (!prepared || !prepared.ok) {
    alert((prepared && prepared.error) || 'Impossible de préparer les résultats de ce candidat.');
    return false;
  }
  if (detailOverlay) detailOverlay.remove();
  const catalog = document.getElementById('seb-candidate-catalog');
  if (catalog) catalog.remove();
  const opened = await ipcRenderer.invoke('admin:open-candidate-results');
  if (!opened) {
    await ipcRenderer.invoke('candidate-catalog:end-results').catch(() => false);
    alert('Impossible d’ouvrir la page Résultats.');
    return false;
  }
  return true;
}

async function beginCandidateBilan(candidateId, detailOverlay = null) {
  const prepared = await ipcRenderer.invoke('candidate-catalog:begin-bilan', candidateId);
  if (!prepared || !prepared.ok) {
    alert((prepared && prepared.error) || 'Impossible de préparer le bilan de ce candidat.');
    return false;
  }
  const routed = await ipcRenderer.invoke('candidate:set-admin-export-context', candidateId).catch(() => false);
  if (!routed) {
    alert('Impossible de préparer le dossier Word de ce candidat.');
    return false;
  }
  if (detailOverlay) detailOverlay.remove();
  const catalog = document.getElementById('seb-candidate-catalog');
  if (catalog) catalog.remove();
  const opened = await ipcRenderer.invoke('admin:open-bilan');
  if (!opened) {
    alert('Impossible d’ouvrir le bilan administrateur.');
    return false;
  }
  return true;
}

function openCatalog(initialCandidateId = '') {
  return new Promise(async (resolve) => {
    addStyle();
    const old = document.getElementById('seb-candidate-catalog');
    if (old) old.remove();
    const overlay = document.createElement('div');
    overlay.id = 'seb-candidate-catalog';
    overlay.innerHTML = `
      <div class="seb-cc-card" role="dialog" aria-modal="true" aria-label="Ouvrir un candidat">
        <div class="seb-cc-head"><div class="seb-cc-title">Ouvrir un candidat</div><div class="seb-cc-badge">DOSSIERS CANDIDATS</div></div>
        <div class="seb-cc-search-wrap"><input id="seb-cc-search" class="seb-cc-search" type="search" autocomplete="off" placeholder="Rechercher un nom, prénom, ville, groupe ou date…"></div>
        <div class="seb-cc-body"><div id="seb-cc-list">Chargement…</div></div>
        <div class="seb-cc-foot"><button type="button" id="seb-cc-close">Fermer</button></div>
      </div>`;
    document.body.appendChild(overlay);
    const list = overlay.querySelector('#seb-cc-list');
    const search = overlay.querySelector('#seb-cc-search');
    let items = [];

    const render = () => {
      const q = norm(search.value);
      const shown = items.filter((item) => !q || norm([item.nom,item.prenom,item.lieu,item.groupe,item.date].join(' ')).includes(q));
      list.innerHTML = '';
      if (!shown.length) {
        list.innerHTML = '<div class="seb-cc-empty">Aucun candidat correspondant.</div>';
        return;
      }
      shown.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'seb-cc-row';
        row.innerHTML = `
          <div><strong>${escapeHtml(item.nom)} ${escapeHtml(item.prenom)}</strong><small>${escapeHtml(item.date)}</small></div>
          <div><b>${escapeHtml(item.lieu)}</b><small>Groupe : ${escapeHtml(item.groupe)}</small></div>
          <div class="seb-cc-bilan">${bilanLabel(item)}</div>
          <div class="seb-cc-actions"></div>`;
        const actions = row.querySelector('.seb-cc-actions');
        const open = document.createElement('button');
        open.type='button'; open.className='primary'; open.textContent='Ouvrir';
        open.addEventListener('click', () => openCandidateDetail(item.candidateId, render));
        actions.append(open);
        list.appendChild(row);
      });
    };

    try { items = await ipcRenderer.invoke('candidate-catalog:list'); } catch (_) { items = []; }
    render();
    search.addEventListener('input', render);
    const closeButton = overlay.querySelector('#seb-cc-close');
    const close = () => { overlay.remove(); resolve(); };
    closeButton.hidden = false;
    closeButton.addEventListener('click', close);
    overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
    const selectedId = String(initialCandidateId || '').trim();
    if (selectedId && items.some((item) => String(item.candidateId) === selectedId)) {
      await openCandidateDetail(selectedId, render);
    } else {
      search.focus();
    }
  });
}

function ensureButton() {
  const bar = document.getElementById('seb-evalpro-topbar');
  if (!bar) return false;
  let button = document.getElementById('seb-evalpro-open-candidate');
  if (!button) {
    button = document.createElement('button');
    button.id = 'seb-evalpro-open-candidate';
    button.type = 'button';
    button.textContent = 'Ouvrir un candidat';
    button.hidden = true;
    button.addEventListener('click', async () => {
      if (isCandidateAdminHost()) {
        await openCatalog();
        return;
      }
      if (typeof beforeAdminNavigate === 'function') {
        const saved = beforeAdminNavigate();
        if (saved && saved.ok === false) {
          alert(saved.error || 'La sauvegarde du parcours n’a pas pu être confirmée.');
          return;
        }
      }
      await ipcRenderer.invoke('admin:open-candidate-browser').catch(() => false);
    });
  }
  const left = bar.querySelector('.seb-admin-left-actions');
  const replay = document.getElementById('seb-evalpro-replay');
  const bilan = document.getElementById('seb-evalpro-bilan');
  if (left && button.parentElement !== left) {
    if (replay && replay.parentElement === left) replay.insertAdjacentElement('afterend', button);
    else if (bilan && bilan.parentElement === left) left.insertBefore(button, bilan);
    else left.appendChild(button);
  } else if (!left && !button.isConnected) {
    const admin = document.getElementById('seb-evalpro-admin');
    if (admin) bar.insertBefore(button, admin);
  }
  return true;
}

async function refreshButton() {
  const button = document.getElementById('seb-evalpro-open-candidate');
  if (!button) return;
  try {
    const unlocked = await ipcRenderer.invoke('admin:status');
    const onBilan = /\/(?:admin-bilan|bilan)\.html$/i.test(decodeURIComponent(window.location.pathname));
    const results = ipcRenderer.sendSync('candidate-catalog:results-workspace-load-sync');
    button.hidden = !unlocked || onBilan || !!(results && results.ok);
  } catch (_) { button.hidden = true; }
}

function install(options = {}) {
  if (installed) return;
  installed = true;
  beforeAdminNavigate = typeof options.beforeNavigate === 'function' ? options.beforeNavigate : null;
  addStyle();
  installGenericSearchObserver();
  if (!ensureButton()) setTimeout(ensureButton, 150);
  const observer = new MutationObserver(() => { ensureButton(); refreshButton(); hideLegacyAdminEntryPoints(); });
  observer.observe(document.documentElement, { childList:true, subtree:true });
  document.addEventListener('click', (event) => {
    const admin = event.target && event.target.closest ? event.target.closest('#seb-evalpro-admin') : null;
    if (admin) setTimeout(refreshButton, 60);
  }, true);
  refreshButton();
  if (isCandidateAdminHost()) {
    setTimeout(() => {
      if (!document.getElementById('seb-candidate-catalog')) openCatalog(requestedCandidateId());
    }, 0);
  }
}

module.exports = { install, openCatalog, openCandidateDetail };
