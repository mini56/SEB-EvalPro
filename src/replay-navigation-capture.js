const { ipcRenderer } = require('electron');
const path = require('path');
const crypto = require('crypto');

let installed = false;
let replayingNavigation = false;
const NAV_CAPTURE_TIMEOUT_MS = 2000;

function pageName() {
  try {
    return path.basename(decodeURIComponent(window.location.pathname)) || 'qcmv1.0.html';
  } catch (_) {
    return 'qcmv1.0.html';
  }
}

function replayToken() {
  const key = 'seb_evalpro_replay_token';
  let value = '';
  try { value = String(window.sessionStorage.getItem(key) || ''); } catch (_) {}
  if (/^[A-Za-z0-9-]{12,100}$/.test(value)) return value;
  try { value = crypto.randomUUID(); }
  catch (_) { value = `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`; }
  try { window.sessionStorage.setItem(key, value); } catch (_) {}
  return value;
}

function visibleQcmPage() {
  if (pageName().toLowerCase() !== 'qcmv1.0.html') return null;
  return Array.from(document.querySelectorAll('[id^="page"]'))
    .find((el) => el.classList && el.classList.contains('visible')) || null;
}

function pageDescriptor() {
  const file = pageName();
  if (file.toLowerCase() === 'qcmv1.0.html') {
    const page = visibleQcmPage();
    if (page && page.id) {
      const heading = page.querySelector('h1,h2,h3,.titre,.title');
      const title = heading ? String(heading.textContent || '').replace(/\s+/g, ' ').trim() : page.id;
      return { pageKey: `${file}#${page.id}`, title: title || page.id };
    }
  }
  return { pageKey: file, title: String(document.title || file).trim() || file };
}

function replayBlocked() {
  try {
    if (window.sessionStorage.getItem('seb_evalpro_replay_archive_file')) return true;
  } catch (_) {}
  if (document.getElementById('seb-replay-viewer') || document.getElementById('seb-replay-chooser')) return true;
  const privacy = document.getElementById('seb-evalpro-privacy-layer');
  if (privacy) {
    try {
      const style = getComputedStyle(privacy);
      if (style.display !== 'none' && style.visibility !== 'hidden') return true;
    } catch (_) {}
  }
  return false;
}

async function captureNow(reason) {
  if (!document.body || replayBlocked()) return false;
  const descriptor = pageDescriptor();
  try {
    const result = await ipcRenderer.invoke('replay:capture-page', {
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
    return !!(result && result.ok);
  } catch (_) {
    return false;
  }
}

async function captureBeforeNavigation() {
  let timer = null;
  try {
    return await Promise.race([
      captureNow('navigation-before-guaranteed'),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), NAV_CAPTURE_TIMEOUT_MS);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function labelOf(control) {
  return String(control && (control.textContent || control.value) || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isNavigationControl(control) {
  if (!control) return false;
  const tag = String(control.tagName || '').toLowerCase();
  const label = labelOf(control);
  const onclick = String(control.getAttribute && control.getAttribute('onclick') || '').toLowerCase();
  const href = String(control.getAttribute && control.getAttribute('href') || '').trim();

  if (/^(suivant|suivante|page suivante|étape suivante|etape suivante|passer|passez|continuer)\b/.test(label)) return true;
  if (/nextpage\s*\(|location\.href|window\.location/.test(onclick)) return true;
  if (tag === 'a' && href && !href.startsWith('#') && !href.toLowerCase().startsWith('javascript:')) return true;
  return false;
}

function continueNavigation(control) {
  if (!control || !document.contains(control)) return;
  const tag = String(control.tagName || '').toLowerCase();
  const href = String(control.getAttribute && control.getAttribute('href') || '').trim();

  replayingNavigation = true;
  try {
    // Les boutons QCM utilisent principalement onclick. Appeler directement ce
    // gestionnaire évite de relancer le capteur générique qui pouvait écraser
    // la bonne image de la page précédente après le changement de page.
    if (typeof control.onclick === 'function') {
      control.onclick.call(control, new MouseEvent('click', { bubbles: false, cancelable: true }));
      return;
    }
    if (tag === 'a' && href) {
      window.location.href = control.href || href;
      return;
    }
    control.click();
  } finally {
    setTimeout(() => { replayingNavigation = false; }, 0);
  }
}

function install() {
  if (installed) return;
  installed = true;

  // Les champs de la page 3 sont nombreux : une capture au changement de champ
  // garantit qu'un remplissage rapide n'attend pas le debounce générique.
  document.addEventListener('change', () => {
    setTimeout(() => { captureNow('change-immediate'); }, 70);
  }, true);
  document.addEventListener('focusout', () => {
    setTimeout(() => { captureNow('focusout'); }, 70);
  }, true);

  // Capture bloquante uniquement au moment d'une vraie navigation. La page
  // courante reste affichée jusqu'à la fin de capture, puis l'action d'origine
  // reprend. Cela supprime la course qui pouvait archiver page3 déjà vidée.
  document.addEventListener('click', async (event) => {
    if (replayingNavigation || replayBlocked()) return;
    const control = event.target && event.target.closest ? event.target.closest('button,a') : null;
    if (!isNavigationControl(control)) return;

    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();

    await captureBeforeNavigation();
    continueNavigation(control);
  }, true);
}

module.exports = { install, isNavigationControl };
