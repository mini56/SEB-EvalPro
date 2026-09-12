const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error(`SEB EvalPro privacy: ${message}`);
  process.exit(code);
}

// -----------------------------------------------------------------------------
// 1. Reconstituer l'image d'accueil/confidentialité validée par l'utilisateur.
// -----------------------------------------------------------------------------
const privacyDir = path.join(root, 'source', 'branding', 'privacy-screen');
if (!fs.existsSync(privacyDir)) fail('dossier image confidentialité introuvable');

const parts = [
  'fix00a.txt',
  'fix00b.txt',
  'part01.txt',
  'part02.txt',
  'part03.txt',
  'fix04a.txt',
  'fix04b.txt'
];

for (const name of parts) {
  if (!fs.existsSync(path.join(privacyDir, name))) fail(`fragment image manquant: ${name}`, 3);
}

const base64 = parts
  .map((name) => fs.readFileSync(path.join(privacyDir, name), 'utf8').replace(/\s+/g, ''))
  .join('');

const image = Buffer.from(base64, 'base64');
const expectedSha = 'd27fc728e04b94b3678948b2ce81a1429628e6b9fcbd3c6eef49133752d1d802';
const actualSha = crypto.createHash('sha256').update(image).digest('hex');
if (actualSha !== expectedSha) {
  fail(`image confidentialité corrompue: SHA ${actualSha} au lieu de ${expectedSha}`, 4);
}

const imageTarget = path.join(root, 'app', 'web', 'imageqcm', 'seb-evalpro-privacy-screen.jpg');
fs.mkdirSync(path.dirname(imageTarget), { recursive: true });
fs.writeFileSync(imageTarget, image);

// -----------------------------------------------------------------------------
// 2. Ajouter le voile de confidentialité au shell Electron.
//    - mode temporaire: le candidat peut masquer l'écran d'accueil;
//    - mode final: seuls les droits Administrateur permettent de revoir les
//      résultats; le mode final reste actif après reverrouillage/redémarrage.
// -----------------------------------------------------------------------------
const preloadFile = path.join(root, 'src', 'preload.js');
if (!fs.existsSync(preloadFile)) fail('src/preload.js introuvable', 5);

let preload = fs.readFileSync(preloadFile, 'utf8').replace(/\r\n/g, '\n');

if (!preload.includes('SEB_PRIVACY_SCREEN_103')) {
  preload += `

// SEB_PRIVACY_SCREEN_103
(function(){
  'use strict';

  const PRIVACY_KEY = 'seb_evalpro_privacy_screen';
  const MODE_TEMP = 'temporary';
  const MODE_FINAL = 'final';
  let privacyMode = '';

  function readPrivacyMode(){
    try {
      const value = String(window.localStorage.getItem(PRIVACY_KEY) || '');
      return value === MODE_TEMP || value === MODE_FINAL ? value : '';
    } catch (_) {
      return '';
    }
  }

  privacyMode = readPrivacyMode();

  // En cas de redémarrage pendant que l'écran de confidentialité était actif,
  // empêcher un flash des données avant création du voile.
  if (privacyMode) {
    try { document.documentElement.style.setProperty('visibility', 'hidden', 'important'); } catch (_) {}
  }

  function savePrivacyMode(mode){
    privacyMode = mode === MODE_TEMP || mode === MODE_FINAL ? mode : '';
    try {
      if (privacyMode) window.localStorage.setItem(PRIVACY_KEY, privacyMode);
      else window.localStorage.removeItem(PRIVACY_KEY);
    } catch (_) {}
    try { saveNow(true); } catch (_) {}
    refreshPrivacy();
  }

  function onFinalResults(){
    if (String(pageName() || '').toLowerCase() !== 'qcmv1.0.html') return false;
    const page = document.getElementById('pageFinale');
    return !!(page && page.classList.contains('visible'));
  }

  function ensurePrivacyStyle(){
    if (document.getElementById('seb-evalpro-privacy-style')) return;
    const style = document.createElement('style');
    style.id = 'seb-evalpro-privacy-style';
    style.textContent =
      '#seb-evalpro-privacy-toggle{position:fixed!important;right:18px!important;bottom:18px!important;z-index:2147483643!important;margin:0!important;padding:10px 15px!important;border:0!important;border-radius:8px!important;background:#0070c0!important;color:#fff!important;font:700 14px Arial,sans-serif!important;box-shadow:0 3px 12px rgba(0,0,0,.24)!important;cursor:pointer!important}' +
      '#seb-evalpro-privacy-toggle:hover{background:#005c9e!important}' +
      '#seb-evalpro-privacy-layer{position:fixed;inset:0;background:#fff;display:none;align-items:center;justify-content:center;overflow:hidden;font-family:Arial,sans-serif}' +
      '#seb-evalpro-privacy-layer img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;user-select:none;-webkit-user-drag:none}' +
      '#seb-evalpro-privacy-hide{position:absolute!important;left:50%!important;bottom:24px!important;transform:translateX(-50%)!important;margin:0!important;padding:11px 20px!important;border:0!important;border-radius:8px!important;background:#0070c0!important;color:#fff!important;font:700 15px Arial,sans-serif!important;box-shadow:0 3px 12px rgba(0,0,0,.25)!important;cursor:pointer!important}' +
      '#seb-evalpro-final-privacy-wrap{display:flex!important;justify-content:center!important;margin:22px 0 12px!important}' +
      '#seb-evalpro-final-privacy{margin:0!important;padding:11px 20px!important;border:0!important;border-radius:8px!important;background:#0070c0!important;color:#fff!important;font:700 15px Arial,sans-serif!important;cursor:pointer!important}';
    (document.head || document.documentElement).appendChild(style);
  }

  function ensurePrivacyToggle(){
    let button = document.getElementById('seb-evalpro-privacy-toggle');
    if (button) return button;
    button = document.createElement('button');
    button.id = 'seb-evalpro-privacy-toggle';
    button.type = 'button';
    button.textContent = 'Afficher l’écran d’accueil';
    button.addEventListener('click', function(){
      savePrivacyMode(MODE_TEMP);
    });
    document.body.appendChild(button);
    return button;
  }

  function ensurePrivacyLayer(){
    let layer = document.getElementById('seb-evalpro-privacy-layer');
    if (layer) return layer;

    layer = document.createElement('div');
    layer.id = 'seb-evalpro-privacy-layer';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');

    const image = document.createElement('img');
    image.src = 'imageqcm/seb-evalpro-privacy-screen.jpg';
    image.alt = 'SEB-éval-PRO';
    image.draggable = false;

    const hide = document.createElement('button');
    hide.id = 'seb-evalpro-privacy-hide';
    hide.type = 'button';
    hide.textContent = 'Masquer l’écran d’accueil';
    hide.addEventListener('click', function(){
      if (privacyMode === MODE_TEMP) savePrivacyMode('');
    });

    layer.appendChild(image);
    layer.appendChild(hide);
    document.body.appendChild(layer);
    return layer;
  }

  function ensureFinalPrivacyButton(){
    if (String(pageName() || '').toLowerCase() !== 'qcmv1.0.html') return null;
    const page = document.getElementById('pageFinale');
    if (!page) return null;

    let wrap = document.getElementById('seb-evalpro-final-privacy-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'seb-evalpro-final-privacy-wrap';

      const button = document.createElement('button');
      button.id = 'seb-evalpro-final-privacy';
      button.type = 'button';
      button.textContent = 'Revenir à l’écran SEB-éval-PRO';
      button.addEventListener('click', function(){
        savePrivacyMode(MODE_FINAL);
      });

      wrap.appendChild(button);
      page.appendChild(wrap);
    }
    return wrap;
  }

  function refreshPrivacy(){
    if (!document.body) return;

    const adminPage = isAdminBilanPage();
    const toggle = ensurePrivacyToggle();
    const layer = ensurePrivacyLayer();
    const hide = layer.querySelector('#seb-evalpro-privacy-hide');
    const finalWrap = ensureFinalPrivacyButton();
    const finalResults = onFinalResults();

    if (adminPage) {
      toggle.style.setProperty('display', 'none', 'important');
      layer.style.setProperty('display', 'none', 'important');
      if (finalWrap) finalWrap.style.setProperty('display', 'none', 'important');
      document.documentElement.style.removeProperty('visibility');
      return;
    }

    if (finalWrap) {
      finalWrap.style.setProperty('display', finalResults && privacyMode !== MODE_FINAL ? 'flex' : 'none', 'important');
    }

    if (privacyMode === MODE_TEMP) {
      toggle.style.setProperty('display', 'none', 'important');
      layer.style.zIndex = '2147483647';
      layer.style.setProperty('display', 'flex', 'important');
      hide.style.setProperty('display', 'block', 'important');
      hide.setAttribute('aria-hidden', 'false');
    } else if (privacyMode === MODE_FINAL && !adminUnlocked) {
      toggle.style.setProperty('display', 'none', 'important');
      layer.style.zIndex = '2147483644';
      layer.style.setProperty('display', 'flex', 'important');
      hide.style.setProperty('display', 'none', 'important');
      hide.setAttribute('aria-hidden', 'true');
    } else {
      layer.style.setProperty('display', 'none', 'important');
      hide.style.setProperty('display', 'none', 'important');
      toggle.style.setProperty('display', finalResults ? 'none' : 'block', 'important');
    }

    document.documentElement.style.removeProperty('visibility');
  }

  function startPrivacy(){
    if (!document.body) return;
    ensurePrivacyStyle();
    refreshPrivacy();

    const observer = new MutationObserver(function(){
      setTimeout(refreshPrivacy, 0);
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden']
    });

    document.addEventListener('click', function(event){
      const admin = event.target && event.target.closest ? event.target.closest('#seb-evalpro-admin') : null;
      if (!admin) return;
      setTimeout(refreshPrivacy, 0);
      setTimeout(refreshPrivacy, 250);
    }, true);
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', function(){
      // injectAdminBar() est asynchrone au démarrage; un court délai permet de
      // récupérer aussi le statut Administrateur avant le premier rafraîchissement.
      setTimeout(startPrivacy, 0);
    }, { once: true });
  } else {
    setTimeout(startPrivacy, 0);
  }
})();
`;
}

for (const required of [
  'SEB_PRIVACY_SCREEN_103',
  'Afficher l’écran d’accueil',
  'Masquer l’écran d’accueil',
  'Revenir à l’écran SEB-éval-PRO',
  "const MODE_FINAL = 'final'",
  "saveNow(true)",
  'seb-evalpro-privacy-screen.jpg'
]) {
  if (!preload.includes(required)) fail(`contrôle confidentialité absent: ${required}`, 6);
}

fs.writeFileSync(preloadFile, preload, 'utf8');
console.log(`SEB EvalPro privacy: image validée ${actualSha}; écran temporaire persistant + protection des résultats finaux installés.`);
