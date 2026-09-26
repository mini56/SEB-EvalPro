const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webDir = path.join(root, 'app', 'web');

function readPage(name) {
  const file = path.join(webDir, name);
  if (!fs.existsSync(file)) throw new Error(`SEB EvalPro: page générée introuvable : ${name}`);
  return { file, html: fs.readFileSync(file, 'utf8') };
}

function writePage(file, html) {
  fs.writeFileSync(file, html, 'utf8');
}

function injectBeforeBodyEnd(html, block) {
  const index = html.toLowerCase().lastIndexOf('</body>');
  if (index < 0) return `${html}\n${block}\n`;
  return `${html.slice(0, index)}${block}\n${html.slice(index)}`;
}

function patchTri() {
  const { file, html } = readPage('tri_de_cheville.html');
  let out = html;

  const prematureSaveBlock = /\n\s*for \(let i = 1; i <= 5; i \+= 1\) \{\s*\['m','s','e'\]\.forEach\(\(prefix\) => \{\s*const input = document\.getElementById\(prefix \+ i\);\s*if \(input\) input\.addEventListener\('change', computeAndPersist\);\s*\}\);\s*\}\s*/m;
  if (!prematureSaveBlock.test(out)) {
    throw new Error('SEB EvalPro: bloc de sauvegarde prématurée du tri introuvable.');
  }
  out = out.replace(prematureSaveBlock, '\n    // Temps et erreurs d’un tri ne sont persistés qu’au clic sur « Valider le tri ».\n');

  if (!out.includes('let currentTri = 1;')) {
    throw new Error('SEB EvalPro: état du tri introuvable.');
  }
  out = out.replace('let currentTri = 1;', 'let currentTri = 1;\n  let triStarted = false;');

  if (!out.includes("validate.textContent = 'Valider le tri';\n      validate.disabled = false;")) {
    throw new Error('SEB EvalPro: activation du bouton Valider le tri introuvable.');
  }
  out = out.replace(
    "validate.textContent = 'Valider le tri';\n      validate.disabled = false;",
    "validate.textContent = 'Valider le tri';\n      validate.disabled = !triStarted;"
  );

  if (!out.includes("function validateCurrentTri(){\n    if (currentTri > 5) return;")) {
    throw new Error('SEB EvalPro: validation du tri introuvable.');
  }
  out = out.replace(
    "function validateCurrentTri(){\n    if (currentTri > 5) return;",
    "function validateCurrentTri(){\n    if (currentTri > 5) return;\n    if (!triStarted) {\n      window.alert('Démarrez le chronomètre avant de valider ce tri.');\n      return;\n    }"
  );

  if (!out.includes('currentTri += 1;\n    computeAndPersist();')) {
    throw new Error('SEB EvalPro: passage au tri suivant introuvable.');
  }
  out = out.replace(
    'currentTri += 1;\n    computeAndPersist();',
    'currentTri += 1;\n    triStarted = false;\n    computeAndPersist();'
  );

  if (!out.includes("const validate = document.getElementById('resetBtn');\n    if (validate) validate.onclick = validateCurrentTri;")) {
    throw new Error('SEB EvalPro: branchement du bouton Valider le tri introuvable.');
  }
  out = out.replace(
    "const validate = document.getElementById('resetBtn');\n    if (validate) validate.onclick = validateCurrentTri;",
    "const validate = document.getElementById('resetBtn');\n    if (validate) validate.onclick = validateCurrentTri;\n    const startButton = document.getElementById('startBtn');\n    if (startButton) startButton.addEventListener('click', function(){\n      triStarted = true;\n      updateTriState();\n    });"
  );

  writePage(file, out);
}

function patchBrique() {
  const { file, html } = readPage('brique.html');
  if (html.includes('seb-evalpro-brique-checkpoint')) return;

  const patch = `
<script id="seb-evalpro-brique-checkpoint">
(function(){
  const KEY = 'seb_evalpro_brique_checkpoint';
  const PERIOD_SECONDS = 10 * 60;
  let lastSavedBucket = 0;

  function persistCheckpoint(){
    if (typeof chronoSeconds !== 'number' || chronoSeconds < PERIOD_SECONDS) return;
    const bucket = Math.floor(chronoSeconds / PERIOD_SECONDS);
    if (bucket <= lastSavedBucket) return;
    lastSavedBucket = bucket;
    sessionStorage.setItem(KEY, JSON.stringify({
      chronoSeconds: bucket * PERIOD_SECONDS,
      savedAt: Date.now()
    }));
    if (window.sebEvalPro?.save) window.sebEvalPro.save();
  }

  function restoreCheckpoint(){
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (_) {}
    const seconds = Number(saved && saved.chronoSeconds);
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    chronoSeconds = Math.floor(seconds);
    lastSavedBucket = Math.floor(chronoSeconds / PERIOD_SECONDS);
    if (typeof updateChrono === 'function') updateChrono();
  }

  function protectCheckpointOnReset(){
    const resetBtn = document.getElementById('resetBtn');
    if (!resetBtn || typeof resetBtn.onclick !== 'function') return;
    const protectedReset = resetBtn.onclick;
    resetBtn.onclick = async function(event){
      const before = typeof chronoSeconds === 'number' ? chronoSeconds : 0;
      const result = await protectedReset.call(this, event);
      if (before > 0 && chronoSeconds === 0) {
        sessionStorage.removeItem(KEY);
        lastSavedBucket = 0;
        if (window.sebEvalPro?.save) window.sebEvalPro.save();
      }
      return result;
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    restoreCheckpoint();
    protectCheckpointOnReset();
    setInterval(persistCheckpoint, 1000);
  });
})();
</script>`;

  writePage(file, injectBeforeBodyEnd(html, patch));
}

function patchQcmResume() {
  const { file, html } = readPage('qcmv1.0.html');
  if (html.includes('seb-evalpro-qcm-resume')) return;

  const patch = `
<script id="seb-evalpro-qcm-resume">
(function(){
  const VIEW_KEY = 'seb_evalpro_qcm_view';
  const DRAFT_KEY = 'seb_evalpro_qcm_drafts';
  const EXERCISE_KEYS_TO_CLEAR = [
    'eval_brique',
    'eval_brique_auto',
    'seb_evalpro_brique_checkpoint',
    'tri_cheville_data',
    'autoEvaltri_resultats'
  ];
  let saveTimer = null;
  let viewTimer = null;

  function visiblePage(){
    return document.querySelector('.page.visible');
  }

  function readDrafts(){
    try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }

  function clearPreviousBriqueAndTriForNewEvaluation(){
    EXERCISE_KEYS_TO_CLEAR.forEach((key) => sessionStorage.removeItem(key));
  }

  function installNewEvaluationReset(){
    const original = window.verifierNomLieu;
    if (typeof original !== 'function') return;
    window.verifierNomLieu = function(){
      const nom = document.getElementById('nom')?.value.trim() || '';
      const prenom = document.getElementById('prénom')?.value.trim() || '';
      const lieu = document.getElementById('lieu')?.value.trim() || '';
      const groupe = document.getElementById('groupe')?.value.trim() || '';
      if (nom && prenom && lieu && groupe) {
        clearPreviousBriqueAndTriForNewEvaluation();
      }
      return original.apply(this, arguments);
    };
  }

  function saveCurrentDraft(){
    const page = visiblePage();
    if (!page || !page.id || page.id === 'bilanPage') return;
    const controls = Array.from(page.querySelectorAll('input, textarea, select'));
    const values = controls.map((el, index) => ({
      index,
      id: el.id || '',
      name: el.name || '',
      type: (el.type || el.tagName || '').toLowerCase(),
      checked: !!el.checked,
      value: el.type === 'password' || el.type === 'file' ? '' : el.value
    }));
    const items = Array.from(page.querySelectorAll('.item')).map((el) => el.classList.contains('selected'));
    const drafts = readDrafts();
    drafts[page.id] = { values, items };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
    sessionStorage.setItem(VIEW_KEY, page.id);
    if (window.sebEvalPro?.save) window.sebEvalPro.save();
  }

  function restoreDraft(page){
    const draft = readDrafts()[page.id];
    if (!draft) return;
    const controls = Array.from(page.querySelectorAll('input, textarea, select'));
    (draft.values || []).forEach((saved) => {
      let el = saved.id ? document.getElementById(saved.id) : null;
      if (!el || !page.contains(el)) el = controls[saved.index];
      if (!el || el.type === 'password' || el.type === 'file') return;
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!saved.checked;
      else if (saved.value !== undefined) el.value = saved.value;
    });
    if (Array.isArray(draft.items)) {
      Array.from(page.querySelectorAll('.item')).forEach((el, index) => {
        el.classList.toggle('selected', !!draft.items[index]);
        el.setAttribute('aria-pressed', draft.items[index] ? 'true' : 'false');
      });
    }
  }

  function scheduleDraftSave(){
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCurrentDraft, 400);
  }

  function storeVisiblePage(){
    const page = visiblePage();
    if (!page || !page.id || page.id === 'bilanPage') return;
    sessionStorage.setItem(VIEW_KEY, page.id);
    if (window.sebEvalPro?.save) window.sebEvalPro.save();
  }

  function scheduleViewSave(){
    clearTimeout(viewTimer);
    viewTimer = setTimeout(storeVisiblePage, 50);
  }

  function restoreView(){
    const id = sessionStorage.getItem(VIEW_KEY);
    const target = id ? document.getElementById(id) : null;
    if (!target || !target.classList.contains('page') || id === 'bilanPage') return;
    document.querySelectorAll('.page').forEach((page) => page.classList.remove('visible'));
    target.classList.add('visible');
    if (id === 'pageFinale' && typeof afficherResultat === 'function') afficherResultat();
    restoreDraft(target);
    window.scrollTo(0, 0);
  }

  document.addEventListener('DOMContentLoaded', function(){
    installNewEvaluationReset();
    restoreView();
    document.addEventListener('input', scheduleDraftSave, true);
    document.addEventListener('change', scheduleDraftSave, true);
    document.addEventListener('click', scheduleDraftSave, true);

    const observer = new MutationObserver(function(mutations){
      if (mutations.some((m) => m.type === 'attributes' && m.attributeName === 'class')) scheduleViewSave();
    });
    document.querySelectorAll('.page').forEach((page) => observer.observe(page, { attributes: true, attributeFilter: ['class'] }));
    storeVisiblePage();
  });
})();
</script>`;

  writePage(file, injectBeforeBodyEnd(html, patch));
}

function injectBeforeHeadEnd(html, block) {
  const index = html.toLowerCase().lastIndexOf('</head>');
  if (index < 0) return block + '\n' + html;
  return html.slice(0, index) + block + '\n' + html.slice(index);
}

function patchInAppAlerts() {
  // Architecture commune : aucune logique inline. Les pages ne reçoivent
  // que des références vers les ressources partagées.
  const cssRef = '<link rel="stylesheet" href="css/seb-in-app-alert.css" id="seb-evalpro-in-app-alert-css">';
  const jsRef = '<script src="js/seb-in-app-alert.js" id="seb-evalpro-in-app-alert-script"></script>';

  let count = 0;
  for (const file of fs.readdirSync(webDir)) {
    if (!/\.html?$/i.test(file)) continue;
    const target = path.join(webDir, file);
    let html = fs.readFileSync(target, 'utf8');
    let changed = false;
    if (!html.includes('seb-evalpro-in-app-alert-css')) {
      html = injectBeforeHeadEnd(html, cssRef);
      changed = true;
    }
    if (!html.includes('seb-evalpro-in-app-alert-script')) {
      html = injectBeforeBodyEnd(html, jsRef);
      changed = true;
    }
    if (changed) {
      fs.writeFileSync(target, html, 'utf8');
      count += 1;
    }
  }
  return count;
}

patchTri();
patchBrique();
patchQcmResume();
const alertPages = patchInAppAlerts();
console.log(`SEB EvalPro: reprise renforcée + alertes intégrées au plein écran sur ${alertPages} page(s).`);
