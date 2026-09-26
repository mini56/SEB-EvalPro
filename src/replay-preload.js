const { ipcRenderer } = require('electron');
const path = require('path');
const crypto = require('crypto');

let installed = false;
let archiveInFlight = false;
let captureTimer = null;
let lastCaptureRequestAt = 0;

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

function candidateLabel(candidate) {
  const nom = String((candidate && candidate.nom) || '').trim();
  const prenom = String((candidate && (candidate.prenom || candidate['prénom'])) || '').trim();
  return [nom, prenom].filter(Boolean).join(' ') || 'Candidat non identifié';
}

function replayToken() {
  const key = 'seb_evalpro_replay_token';
  let value = '';
  try { value = String(window.sessionStorage.getItem(key) || ''); } catch (_) {}
  if (/^[A-Za-z0-9-]{12,100}$/.test(value)) return value;
  try { value = crypto.randomUUID(); } catch (_) { value = `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`; }
  try { window.sessionStorage.setItem(key, value); } catch (_) {}
  return value;
}

function visibleQcmPage() {
  if (pageName().toLowerCase() !== 'qcmv1.0.html') return null;
  const candidates = Array.from(document.querySelectorAll('[id^="page"]'));
  return candidates.find((el) => el.classList && el.classList.contains('visible')) || null;
}

function titleFromElement(root, fallback) {
  try {
    const heading = root && root.querySelector ? root.querySelector('h1,h2,h3,.titre,.title') : null;
    const text = heading ? String(heading.textContent || '').replace(/\s+/g, ' ').trim() : '';
    if (text) return text.slice(0, 180);
  } catch (_) {}
  const docTitle = String(document.title || '').replace(/\s+/g, ' ').trim();
  return (docTitle || fallback).slice(0, 180);
}

function currentPageDescriptor() {
  const file = pageName();
  if (file.toLowerCase() === 'qcmv1.0.html') {
    const visible = visibleQcmPage();
    if (visible && visible.id) {
      return {
        pageKey: `${file}#${visible.id}`,
        title: titleFromElement(visible, visible.id)
      };
    }
  }
  return { pageKey: file, title: titleFromElement(document.body, file) };
}

function privacyLayerVisible() {
  const layer = document.getElementById('seb-evalpro-privacy-layer');
  if (!layer) return false;
  try {
    const style = getComputedStyle(layer);
    return style.display !== 'none' && style.visibility !== 'hidden';
  } catch (_) {
    return false;
  }
}

function adminWorkBlocked() {
  const page = pageName().toLowerCase();
  if (page === 'admin-bilan.html' || page === 'bilan.html') return true;
  const adminButton = document.getElementById('seb-evalpro-admin');
  if (adminButton && /^verrouiller$/i.test(String(adminButton.textContent || '').trim())) return true;
  return !!(
    document.getElementById('seb-evalpro-admin-dialog') ||
    document.getElementById('seb-evalpro-session-close-dialog') ||
    document.getElementById('seb-bilan-history-chooser') ||
    document.getElementById('seb-bilan-history-editor') ||
    document.getElementById('seb-replay-chooser') ||
    document.getElementById('seb-replay-viewer')
  );
}

function adminInteractionTarget(target) {
  if (!target || !target.closest) return false;
  return !!target.closest('#seb-evalpro-topbar,#seb-evalpro-admin-dialog,#seb-evalpro-session-close-dialog,#seb-bilan-history-chooser,#seb-bilan-history-editor,#seb-replay-chooser,#seb-replay-viewer');
}

// SEB_RESULTS_CAPTURE_STOP
function replayCaptureStopped() {
  try { return window.sessionStorage.getItem('seb_evalpro_replay_capture_stopped') === '1'; }
  catch (_) { return false; }
}

function stopReplayCaptureAfterResults() {
  try { window.sessionStorage.setItem('seb_evalpro_replay_capture_stopped', '1'); } catch (_) {}
  if (captureTimer) { clearTimeout(captureTimer); captureTimer = null; }
}

async function captureCurrentPage(reason = 'state', force = false) {
  if (!document.body) return { ok: false };
  if (replayCaptureStopped() && reason !== 'final-results') return { ok: false, resultsComplete: true };
  if (adminWorkBlocked()) return { ok: false, adminWorkBlocked: true };
  if (window.sessionStorage.getItem('seb_evalpro_replay_archive_file')) return { ok: false, archived: true };
  if (privacyLayerVisible()) return { ok: false, privacy: true };
  if (document.getElementById('seb-replay-viewer') || document.getElementById('seb-replay-chooser')) return { ok: false, replayUi: true };

  const now = Date.now();
  if (!force && now - lastCaptureRequestAt < 180) return { ok: false, throttled: true };
  lastCaptureRequestAt = now;
  const descriptor = currentPageDescriptor();
  try {
    return await ipcRenderer.invoke('replay:capture-page', {
      token: replayToken(),
      pageKey: descriptor.pageKey,
      title: descriptor.title,
      reason,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        scrollWidth: document.documentElement ? document.documentElement.scrollWidth : 0,
        scrollHeight: document.documentElement ? document.documentElement.scrollHeight : 0
      }
    });
  } catch (_) {
    return { ok: false };
  }
}

function scheduleCapture(reason, delay = 350) {
  if (adminWorkBlocked() || replayCaptureStopped()) return;
  if (window.sessionStorage.getItem('seb_evalpro_replay_archive_file')) return;
  clearTimeout(captureTimer);
  captureTimer = setTimeout(() => captureCurrentPage(reason), delay);
}

function buildArchivePayload() {
  const final = document.getElementById('pageFinale');
  const finalPageVisible = !!(final && final.classList.contains('visible'));
  return {
    token: replayToken(),
    finalPageVisible,
    sessionStorage: storageToObject(window.sessionStorage),
    localStorage: storageToObject(window.localStorage),
    lastPage: pageName(),
    lastEvaluationPage: currentPageDescriptor().pageKey
  };
}

async function archiveIfFinalVisible(options = {}) {
  if (pageName().toLowerCase() !== 'qcmv1.0.html') return { ok: true, skipped: true };
  const final = document.getElementById('pageFinale');
  if (!final || !final.classList.contains('visible')) return { ok: true, skipped: true };
  try { window.sessionStorage.setItem('seb_evalpro_results_seen', '1'); } catch (_) {}
  stopReplayCaptureAfterResults();
  const existing = window.sessionStorage.getItem('seb_evalpro_replay_archive_file');
  if (existing) { stopReplayCaptureAfterResults(); return { ok: true, filename: existing, alreadyArchived: true }; }
  if (archiveInFlight) {
    for (let i = 0; i < 40 && archiveInFlight; i += 1) await new Promise((resolve) => setTimeout(resolve, 100));
    const afterWait = window.sessionStorage.getItem('seb_evalpro_replay_archive_file');
    if (afterWait) return { ok: true, filename: afterWait, alreadyArchived: true };
    if (archiveInFlight) return { ok: false, error: 'Archivage du parcours toujours en cours.' };
  }

  archiveInFlight = true;
  try {
    await new Promise((resolve) => setTimeout(resolve, 180));
    await captureCurrentPage('final-results', true);
    const result = await ipcRenderer.invoke('replay:archive-final', buildArchivePayload());
    if (!result || !result.ok || !result.filename) throw new Error(result?.error || 'Archivage du parcours refusé.');
    window.sessionStorage.setItem('seb_evalpro_replay_archive_file', result.filename);
    window.sessionStorage.setItem('seb_evalpro_replay_archive_build', String(result.build || ''));
    window.sessionStorage.setItem('seb_evalpro_replay_archive', JSON.stringify({
      filename: result.filename,
      build: result.build,
      slides: result.slides,
      integritySha256: result.integritySha256
    }));
    window.sessionStorage.removeItem('seb_evalpro_replay_archive_error');
    return result;
  } catch (error) {
    const message = error && error.message ? error.message : String(error || 'Archivage impossible.');
    try { window.sessionStorage.setItem('seb_evalpro_replay_archive_error', message); } catch (_) {}
    if (options.notify) window.alert('Archivage du parcours impossible : ' + message + '\nLa session ne sera pas fermée tant que le parcours n’est pas archivé.');
    return { ok: false, error: message };
  } finally {
    archiveInFlight = false;
  }
}

async function ensureFinalArchive() {
  const archived = window.sessionStorage.getItem('seb_evalpro_replay_archive_file');
  if (archived) return { ok: true, filename: archived, alreadyArchived: true };
  const resultsSeen = window.sessionStorage.getItem('seb_evalpro_results_seen') === '1';
  const final = pageName().toLowerCase() === 'qcmv1.0.html' ? document.getElementById('pageFinale') : null;
  const finalVisible = !!(final && final.classList.contains('visible'));
  if (!resultsSeen && !finalVisible) return { ok: true, skipped: true };
  if (!finalVisible) {
    const error = 'La page Résultats a été atteinte mais le parcours n’est pas archivé. Revenez à l’évaluation puis affichez Résultats avant de fermer la session.';
    window.alert(error);
    return { ok: false, error };
  }
  return archiveIfFinalVisible({ notify: true });
}

function installCaptureRecorder() {
  if (!document.body || adminWorkBlocked()) return;





  const observer = new MutationObserver((mutations) => {
    let pageChanged = false;
    for (const mutation of mutations) {
      if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') continue;
      const target = mutation.target;
      if (target && target.id && /^page/i.test(target.id)) {
        pageChanged = true;
        break;
      }
    }
    if (pageChanged) {
      setTimeout(archiveIfFinalVisible, 380);
    }
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
}

function installArchiveWatcher() {
  if (pageName().toLowerCase() !== 'qcmv1.0.html') return;
  const final = document.getElementById('pageFinale');
  if (!final) return;
  archiveIfFinalVisible();
  const observer = new MutationObserver(() => archiveIfFinalVisible());
  observer.observe(final, { attributes: true, attributeFilter: ['class'] });
}

function addReplayStyle() {
  if (document.getElementById('seb-replay-style')) return;
  const style = document.createElement('style');
  style.id = 'seb-replay-style';
  style.textContent = `
    #seb-evalpro-topbar .seb-admin-left-actions,#seb-evalpro-topbar .seb-admin-right-actions{display:flex;align-items:center;gap:8px}
    #seb-evalpro-topbar .seb-admin-left-actions{margin-left:8px;padding-left:10px;border-left:1px solid rgba(255,255,255,.5)}
    #seb-evalpro-topbar .seb-admin-right-actions{margin-left:8px;padding-left:12px;border-left:1px solid rgba(255,255,255,.5)}
    #seb-replay-chooser,#seb-replay-viewer{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.58);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
    .seb-replay-card{width:min(980px,95vw);max-height:88vh;background:#fff;border:1px solid #aaa;border-radius:10px;box-shadow:0 15px 48px rgba(0,0,0,.34);display:flex;flex-direction:column;overflow:hidden}
    .seb-replay-head{background:#0070c0;color:#fff;padding:14px 18px;display:flex;align-items:center;gap:12px}
    .seb-replay-head-title{font-size:20px;font-weight:700;flex:1}
    .seb-replay-build{font-size:13px;font-weight:700;background:#fff;color:#0070c0;border-radius:14px;padding:4px 9px}
    .seb-replay-readonly{font-size:12px;font-weight:700;background:#fff3cd;color:#7a5b00;border:1px solid #e7cb70;border-radius:14px;padding:4px 9px}
    .seb-replay-body{padding:16px;overflow:auto;background:#f5f7fb;min-height:260px}
    .seb-replay-path{font-size:12px;color:#666;margin-bottom:10px}
    .seb-replay-row{display:grid;grid-template-columns:1.5fr .65fr .55fr .8fr auto;gap:10px;align-items:center;padding:10px 12px;background:#fff;border:1px solid #d8dde8;border-radius:7px;margin-bottom:8px}
    .seb-replay-row strong{font-size:15px;color:#222}.seb-replay-row small{color:#666}.seb-replay-row .bad{color:#c00000;font-weight:700}.seb-replay-row .legacy{color:#9a6700;font-weight:700}
    .seb-replay-actions{display:flex;justify-content:flex-end;gap:10px;padding:12px 16px;border-top:1px solid #ddd;background:#fff}
    .seb-replay-actions button,.seb-replay-row button{font:700 14px Arial,sans-serif;padding:8px 14px;border:1px solid #999;border-radius:5px;background:#f2f2f2;cursor:pointer}
    .seb-replay-row button.primary,.seb-replay-actions button.primary{background:#0070c0;color:#fff;border-color:#0070c0}.seb-replay-row button:disabled{opacity:.45;cursor:default}
    .seb-visual-card{width:98vw;height:94vh;background:#111;border-radius:8px;box-shadow:0 16px 50px rgba(0,0,0,.42);display:flex;flex-direction:column;overflow:hidden}
    .seb-visual-head{background:#0070c0;color:#fff;padding:10px 16px;display:flex;align-items:center;gap:10px}
    .seb-visual-title{font-size:18px;font-weight:700;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .seb-visual-meta{font-size:12px;font-weight:700;background:#fff;color:#0070c0;padding:4px 8px;border-radius:12px;white-space:nowrap}
    .seb-visual-readonly{font-size:12px;font-weight:700;background:#fff3cd;color:#6e5200;padding:4px 8px;border-radius:12px;white-space:nowrap}
    .seb-visual-stage{flex:1;min-height:0;overflow:auto;background:#272727;display:flex;align-items:flex-start;justify-content:center;padding:12px;box-sizing:border-box}
    .seb-visual-stage img{display:block;max-width:100%;max-height:none;width:auto;height:auto;object-fit:initial;background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.35);user-select:none;-webkit-user-drag:none}
    .seb-visual-loading{color:#fff;font-size:16px;font-weight:700}.seb-visual-warning{color:#7a5b00;background:#fff3cd;border:1px solid #e7cb70;padding:18px 22px;border-radius:8px;max-width:760px;text-align:center;line-height:1.45}
    .seb-visual-foot{display:flex;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid #444;background:#fff}
    .seb-visual-counter{flex:1;text-align:center;font-weight:700;color:#555}.seb-visual-pagekey{font-size:12px;color:#777;max-width:34%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .seb-visual-foot button{font:700 14px Arial,sans-serif;padding:8px 15px;border:1px solid #999;border-radius:5px;background:#f2f2f2;cursor:pointer}.seb-visual-foot button.primary{background:#0070c0;color:#fff;border-color:#0070c0}.seb-visual-foot button:disabled{opacity:.45;cursor:default}
  `;
  document.head.appendChild(style);
}

function regroupAdminButtons() {
  const bar = document.getElementById('seb-evalpro-topbar');
  if (!bar || bar.querySelector('.seb-admin-left-actions')) return;
  addReplayStyle();

  const left = document.createElement('div');
  left.className = 'seb-admin-left-actions';
  const right = document.createElement('div');
  right.className = 'seb-admin-right-actions';

  const results = document.getElementById('seb-evalpro-results');
  const bilan = document.getElementById('seb-evalpro-bilan');
  const retour = document.getElementById('seb-evalpro-return');
  const close = document.getElementById('seb-evalpro-close-session');
  const admin = document.getElementById('seb-evalpro-admin');
  const spacer = bar.querySelector('.seb-evalpro-spacer');
  const build = document.getElementById('seb-evalpro-build');
  const name = bar.querySelector('.seb-evalpro-name');

  // Le replay n'est jamais un bouton global de la barre Admin.
  // Il reste accessible uniquement depuis la fiche du candidat concerné.
  [results, bilan, retour].forEach((el) => { if (el) left.appendChild(el); });
  [close, admin].forEach((el) => { if (el) right.appendChild(el); });

  const anchor = build || name;
  if (anchor) anchor.insertAdjacentElement('afterend', left);
  else bar.prepend(left);
  if (spacer) spacer.insertAdjacentElement('afterend', right);
  else {
    const newSpacer = document.createElement('div');
    newSpacer.className = 'seb-evalpro-spacer';
    left.insertAdjacentElement('afterend', newSpacer);
    newSpacer.insertAdjacentElement('afterend', right);
  }
}

function formatDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value || '') : parsed.toLocaleString('fr-FR');
}

function createReplayChooserDialog() {
  return new Promise(async (resolve) => {
    addReplayStyle();
    const old = document.getElementById('seb-replay-chooser');
    if (old) old.remove();
    const backdrop = document.createElement('div');
    backdrop.id = 'seb-replay-chooser';
    backdrop.innerHTML = `
      <div class="seb-replay-card" role="dialog" aria-modal="true" aria-label="Choisir le parcours à rejouer">
        <div class="seb-replay-head">
          <div class="seb-replay-head-title">Choisir le parcours à rejouer</div>
          <div class="seb-replay-readonly">LECTURE SEULE · AUCUN RECALCUL</div>
        </div>
        <div class="seb-replay-body">
          <div class="seb-replay-path">Documents\\SEB EvalPro\\parcours — les nouveaux parcours contiennent leurs propres diapositives figées et ne dépendent pas de la version actuelle.</div>
          <div id="seb-replay-list">Chargement…</div>
        </div>
        <div class="seb-replay-actions"><button type="button" id="seb-replay-close">Fermer</button></div>
      </div>`;
    document.body.appendChild(backdrop);
    const finish = () => { backdrop.remove(); resolve(); };
    backdrop.querySelector('#seb-replay-close').addEventListener('click', finish);

    const list = backdrop.querySelector('#seb-replay-list');
    let items = [];
    try { items = await ipcRenderer.invoke('admin:list-parcours'); } catch (_) {}
    list.innerHTML = '';
    if (!Array.isArray(items) || !items.length) {
      list.innerHTML = '<div style="padding:30px;text-align:center;color:#555">Aucun parcours archivé.</div>';
      return;
    }

    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'seb-replay-row';
      const who = document.createElement('strong');
      who.textContent = candidateLabel(item.candidate);
      const when = document.createElement('small');
      when.textContent = formatDate(item.archivedAt);
      const build = document.createElement('small');
      build.textContent = `Build #${item.build || '?'}`;
      const mode = document.createElement('small');
      if (item.legacy) {
        mode.className = 'legacy';
        mode.textContent = 'Ancien prototype';
      } else {
        mode.textContent = `${Number(item.slideCount || 0)} diapositive(s)`;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'primary';
      button.textContent = 'Rejouer';
      if (!item.integrityOk) {
        button.disabled = true;
        button.textContent = 'Archive invalide';
        mode.className = 'bad';
      } else if (item.legacy) {
        button.textContent = 'Voir info';
      }
      button.addEventListener('click', async () => {
        const loaded = await ipcRenderer.invoke('admin:load-parcours', item.filename);
        if (!loaded || !loaded.ok) {
          alert((loaded && loaded.error) || 'Impossible d’ouvrir ce parcours.');
          return;
        }
        finish();
        await createVisualReplayViewer(item.filename, loaded.archive, !!loaded.legacy, loaded.warning || '');
      });
      row.append(who, when, build, mode, button);
      list.appendChild(row);
    });
  });
}

function createVisualReplayViewer(filename, archive, legacy, warning, candidateId = '') {
  return new Promise((resolve) => {
    addReplayStyle();
    const old = document.getElementById('seb-replay-viewer');
    if (old) old.remove();
    const slides = Array.isArray(archive && archive.slides) ? archive.slides : [];
    let index = 0;
    let renderToken = 0;
    const backdrop = document.createElement('div');
    backdrop.id = 'seb-replay-viewer';
    backdrop.innerHTML = `
      <div class="seb-visual-card" role="dialog" aria-modal="true" aria-label="Replay visuel du parcours">
        <div class="seb-visual-head">
          <div id="seb-visual-title" class="seb-visual-title">${candidateLabel(archive && archive.candidate)}</div>
          <div class="seb-visual-meta">Build #${String((archive && archive.build) || '?')}</div>
          <div class="seb-visual-readonly">LECTURE SEULE · ARCHIVE VISUELLE FIGÉE · AUCUN RECALCUL</div>
        </div>
        <div id="seb-visual-stage" class="seb-visual-stage"></div>
        <div class="seb-visual-foot">
          <button type="button" id="seb-visual-prev">← Précédent</button>
          <div id="seb-visual-pagekey" class="seb-visual-pagekey"></div>
          <div id="seb-visual-counter" class="seb-visual-counter"></div>
          <button type="button" id="seb-visual-next" class="primary">Suivant →</button>
          <button type="button" id="seb-visual-close">Fermer le replay</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    const stage = backdrop.querySelector('#seb-visual-stage');
    const title = backdrop.querySelector('#seb-visual-title');
    const counter = backdrop.querySelector('#seb-visual-counter');
    const pageKey = backdrop.querySelector('#seb-visual-pagekey');
    const prev = backdrop.querySelector('#seb-visual-prev');
    const next = backdrop.querySelector('#seb-visual-next');
    const close = backdrop.querySelector('#seb-visual-close');

    const finish = () => { backdrop.remove(); resolve(); };
    close.addEventListener('click', finish);

    async function render() {
      const myToken = ++renderToken;
      if (legacy || !slides.length) {
        title.textContent = `${candidateLabel(archive && archive.candidate)} — Build #${String((archive && archive.build) || '?')}`;
        stage.innerHTML = `<div class="seb-visual-warning">${warning || 'Ce parcours provient de l’ancien prototype. Il ne contient pas de pages visuelles figées et ne peut donc pas être rejoué dans les conditions réelles.'}</div>`;
        counter.textContent = 'Aucune diapositive visuelle';
        pageKey.textContent = '';
        prev.disabled = true;
        next.disabled = true;
        return;
      }

      const slide = slides[index];
      title.textContent = `${candidateLabel(archive && archive.candidate)} — ${slide.title || 'Page'}`;
      counter.textContent = `${index + 1} / ${slides.length}`;
      pageKey.textContent = slide.pageKey || '';
      prev.disabled = index <= 0;
      next.disabled = index >= slides.length - 1;
      stage.innerHTML = '<div class="seb-visual-loading">Chargement de la page figée…</div>';
      let result = null;
      try {
        result = candidateId
          ? await ipcRenderer.invoke('admin:get-candidate-parcours-slide', candidateId, filename, slide.file)
          : await ipcRenderer.invoke('admin:get-parcours-slide', filename, slide.file);
      } catch (_) {}
      if (myToken !== renderToken) return;
      if (!result || !result.ok || !result.dataUrl) {
        stage.innerHTML = `<div class="seb-visual-warning">${(result && result.error) || 'Impossible de charger cette diapositive.'}</div>`;
        return;
      }
      const image = document.createElement('img');
      image.alt = slide.title || 'Page archivée du parcours';
      image.draggable = false;
      image.src = result.dataUrl;
      stage.innerHTML = '';
      stage.appendChild(image);
    }

    prev.addEventListener('click', () => { if (index > 0) { index -= 1; render(); } });
    next.addEventListener('click', () => { if (index < slides.length - 1) { index += 1; render(); } });
    backdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') finish();
      else if (event.key === 'ArrowLeft' && index > 0) { index -= 1; render(); }
      else if (event.key === 'ArrowRight' && index < slides.length - 1) { index += 1; render(); }
    });
    backdrop.tabIndex = -1;
    backdrop.focus();
    render();
  });
}

async function openCandidateReplay(candidateId, filename) {
  const loaded = await ipcRenderer.invoke('admin:load-candidate-parcours', candidateId, filename);
  if (!loaded || !loaded.ok) {
    alert((loaded && loaded.error) || 'Impossible d’ouvrir ce replay.');
    return false;
  }
  await createVisualReplayViewer(filename, loaded.archive, !!loaded.legacy, loaded.warning || '', String(candidateId || ''));
  return true;
}

function install() {
  if (installed) return;
  installed = true;
  addReplayStyle();
  regroupAdminButtons();
  installCaptureRecorder();
  installArchiveWatcher();
}

module.exports = { install, openCandidateReplay, ensureFinalArchive };
