const { ipcRenderer } = require('electron');
const path = require('path');

let installed = false;
let archiveInFlight = false;

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

function parseJson(value, fallback = null) {
  try { return JSON.parse(String(value || '')); } catch (_) { return fallback; }
}

function candidateLabel(candidate) {
  const nom = String((candidate && candidate.nom) || '').trim();
  const prenom = String((candidate && (candidate.prenom || candidate['prénom'])) || '').trim();
  return [nom, prenom].filter(Boolean).join(' ') || 'Candidat non identifié';
}

function buildArchivePayload() {
  const final = document.getElementById('pageFinale');
  const finalPageVisible = !!(final && final.classList.contains('visible'));
  return {
    finalPageVisible,
    sessionStorage: storageToObject(window.sessionStorage),
    localStorage: storageToObject(window.localStorage),
    lastPage: pageName(),
    lastEvaluationPage: pageName()
  };
}

async function archiveIfFinalVisible() {
  if (pageName().toLowerCase() !== 'qcmv1.0.html') return;
  const final = document.getElementById('pageFinale');
  if (!final || !final.classList.contains('visible') || archiveInFlight) return;
  if (window.sessionStorage.getItem('seb_evalpro_replay_archive_file')) return;

  archiveInFlight = true;
  try {
    const result = await ipcRenderer.invoke('replay:archive-final', buildArchivePayload());
    if (result && result.ok && result.filename) {
      window.sessionStorage.setItem('seb_evalpro_replay_archive_file', result.filename);
      window.sessionStorage.setItem('seb_evalpro_replay_archive_build', String(result.build || ''));
    }
  } catch (_) {
  } finally {
    archiveInFlight = false;
  }
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
    #seb-evalpro-topbar .seb-admin-left-actions,
    #seb-evalpro-topbar .seb-admin-right-actions{display:flex;align-items:center;gap:8px}
    #seb-evalpro-topbar .seb-admin-left-actions{margin-left:8px;padding-left:10px;border-left:1px solid rgba(255,255,255,.5)}
    #seb-evalpro-topbar .seb-admin-right-actions{margin-left:8px;padding-left:12px;border-left:1px solid rgba(255,255,255,.5)}
    #seb-evalpro-replay{background:#e8f3ff!important;color:#005b9f!important;border-color:#fff!important;font-weight:700}
    #seb-replay-chooser,#seb-replay-viewer{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.52);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
    .seb-replay-card{width:min(920px,94vw);max-height:86vh;background:#fff;border:1px solid #aaa;border-radius:10px;box-shadow:0 15px 48px rgba(0,0,0,.34);display:flex;flex-direction:column;overflow:hidden}
    .seb-replay-head{background:#0070c0;color:#fff;padding:14px 18px;display:flex;align-items:center;gap:12px}
    .seb-replay-head-title{font-size:20px;font-weight:700;flex:1}
    .seb-replay-build{font-size:13px;font-weight:700;background:#fff;color:#0070c0;border-radius:14px;padding:4px 9px}
    .seb-replay-readonly{font-size:12px;font-weight:700;background:#fff3cd;color:#7a5b00;border:1px solid #e7cb70;border-radius:14px;padding:4px 9px}
    .seb-replay-body{padding:16px;overflow:auto;background:#f5f7fb;min-height:260px}
    .seb-replay-path{font-size:12px;color:#666;margin-bottom:10px}
    .seb-replay-row{display:grid;grid-template-columns:1.6fr .8fr .7fr auto;gap:10px;align-items:center;padding:10px 12px;background:#fff;border:1px solid #d8dde8;border-radius:7px;margin-bottom:8px}
    .seb-replay-row strong{font-size:15px;color:#222}
    .seb-replay-row small{color:#666}
    .seb-replay-row .bad{color:#c00000;font-weight:700}
    .seb-replay-actions{display:flex;justify-content:flex-end;gap:10px;padding:12px 16px;border-top:1px solid #ddd;background:#fff}
    .seb-replay-actions button,.seb-replay-row button{font:700 14px Arial,sans-serif;padding:8px 14px;border:1px solid #999;border-radius:5px;background:#f2f2f2;cursor:pointer}
    .seb-replay-row button.primary,.seb-replay-actions button.primary{background:#0070c0;color:#fff;border-color:#0070c0}
    .seb-slide-card{width:min(1120px,95vw);height:min(780px,90vh);background:#fff;border-radius:12px;box-shadow:0 16px 50px rgba(0,0,0,.38);display:flex;flex-direction:column;overflow:hidden}
    .seb-slide-head{background:#0070c0;color:#fff;padding:12px 18px;display:flex;align-items:center;gap:10px}
    .seb-slide-title{font-size:20px;font-weight:700;flex:1}
    .seb-slide-meta{font-size:12px;font-weight:700;background:#fff;color:#0070c0;padding:4px 8px;border-radius:12px}
    .seb-slide-readonly{font-size:12px;font-weight:700;background:#fff3cd;color:#6e5200;padding:4px 8px;border-radius:12px}
    .seb-slide-content{flex:1;overflow:auto;padding:24px 28px;background:linear-gradient(#fff,#f5f7fb)}
    .seb-slide-page-title{font-size:26px;font-weight:700;color:#0070c0;margin:0 0 18px}
    .seb-slide-grid{display:grid;grid-template-columns:minmax(180px,34%) 1fr;gap:8px 16px;align-items:start}
    .seb-slide-label{font-weight:700;color:#333;background:#edf3fa;padding:8px;border-radius:5px}
    .seb-slide-value{white-space:pre-wrap;word-break:break-word;background:#fff;border:1px solid #dde4ee;padding:8px;border-radius:5px;min-height:20px}
    .seb-slide-empty{padding:30px;text-align:center;color:#666;font-style:italic}
    .seb-slide-foot{display:flex;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid #ddd;background:#fff}
    .seb-slide-counter{flex:1;text-align:center;font-weight:700;color:#555}
    .seb-slide-foot button{font:700 14px Arial,sans-serif;padding:8px 15px;border:1px solid #999;border-radius:5px;background:#f2f2f2;cursor:pointer}
    .seb-slide-foot button.primary{background:#0070c0;color:#fff;border-color:#0070c0}
    .seb-slide-foot button:disabled{opacity:.45;cursor:default}
  `;
  document.head.appendChild(style);
}

function regroupAdminButtons() {
  const bar = document.getElementById('seb-evalpro-topbar');
  if (!bar || document.getElementById('seb-evalpro-replay')) return;
  addReplayStyle();

  const replay = document.createElement('button');
  replay.id = 'seb-evalpro-replay';
  replay.type = 'button';
  replay.textContent = 'Rejouer un parcours';
  replay.hidden = true;

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

  [results, replay, bilan, retour].forEach((el) => { if (el) left.appendChild(el); });
  [close, admin].forEach((el) => { if (el) right.appendChild(el); });

  const anchor = build || name;
  if (anchor) anchor.insertAdjacentElement('afterend', left);
  else bar.prepend(left);
  if (spacer) {
    spacer.insertAdjacentElement('afterend', right);
  } else {
    const newSpacer = document.createElement('div');
    newSpacer.className = 'seb-evalpro-spacer';
    left.insertAdjacentElement('afterend', newSpacer);
    newSpacer.insertAdjacentElement('afterend', right);
  }

  async function refreshReplayVisibility() {
    try { replay.hidden = !(await ipcRenderer.invoke('admin:status')); }
    catch (_) { replay.hidden = true; }
  }

  replay.addEventListener('click', () => createReplayChooserDialog());
  if (admin) {
    admin.addEventListener('click', () => setTimeout(refreshReplayVisibility, 30));
    const observer = new MutationObserver(() => refreshReplayVisibility());
    observer.observe(admin, { childList: true, characterData: true, subtree: true });
  }
  bar.addEventListener('mouseenter', refreshReplayVisibility);
  refreshReplayVisibility();
}

function flatten(value, prefix = '', out = [], depth = 0) {
  if (out.length >= 80) return out;
  if (depth > 4) {
    out.push({ label: prefix || 'Valeur', value: String(value) });
    return out;
  }
  if (value === null || value === undefined) {
    out.push({ label: prefix || 'Valeur', value: '' });
    return out;
  }
  if (typeof value !== 'object') {
    out.push({ label: prefix || 'Valeur', value: String(value) });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, prefix ? `${prefix} [${index + 1}]` : `Élément ${index + 1}`, out, depth + 1));
    return out;
  }
  Object.entries(value).forEach(([key, item]) => flatten(item, prefix ? `${prefix} > ${key}` : key, out, depth + 1));
  return out;
}

function buildReplaySlides(archive) {
  const slides = [];
  const snapshot = (archive && archive.snapshot) || {};
  const s = snapshot.sessionStorage || {};
  const candidate = archive.candidate || parseJson(s.candidat_data, {}) || {};

  slides.push({
    title: 'Identification du parcours',
    entries: [
      { label: 'Candidat', value: candidateLabel(candidate) },
      { label: 'Date', value: candidate.date || '' },
      { label: 'Lieu', value: candidate.lieu || '' },
      { label: 'Groupe', value: candidate.groupe || '' },
      { label: 'Build utilisé', value: `Build #${archive.build || '?'}` },
      { label: 'Archive créée', value: archive.archivedAt ? new Date(archive.archivedAt).toLocaleString('fr-FR') : '' }
    ]
  });

  const pageNames = {
    page0: 'Identification', page2: 'Calculs contextualisés Q1-Q5', page2_1: 'Calculs contextualisés Q6-Q10',
    page3: 'Durées / horaires', page4: 'Fractions', page5: 'Ordonnancement', page5_1: 'Postures',
    page6: 'Conversions', pageTexteTrous: 'Texte à trous', page8: 'Messagerie', pageFinale: 'Résultats'
  };
  const drafts = parseJson(s.seb_evalpro_qcm_drafts, {}) || {};
  Object.entries(drafts).forEach(([pageId, draft]) => {
    const entries = [];
    const values = Array.isArray(draft && draft.values) ? draft.values : [];
    values.forEach((item, index) => {
      if (!item) return;
      const type = String(item.type || '').toLowerCase();
      if ((type === 'checkbox' || type === 'radio') && !item.checked) return;
      const value = (type === 'checkbox' || type === 'radio') ? 'Sélectionné' : String(item.value ?? '');
      if (!value.trim()) return;
      entries.push({ label: item.id || item.name || `Champ ${index + 1}`, value });
    });
    if (Array.isArray(draft && draft.items)) {
      const selected = draft.items.map((v, i) => v ? i + 1 : null).filter(Boolean);
      if (selected.length) entries.push({ label: 'Éléments sélectionnés', value: selected.join(', ') });
    }
    if (entries.length) slides.push({ title: pageNames[pageId] || `Page ${pageId}`, entries });
  });

  const reponses = parseJson(s.reponses_data, {}) || {};
  if (reponses.page7_contenu_texte) {
    slides.push({ title: 'Traitement de texte', entries: [{ label: 'Texte réellement enregistré', value: String(reponses.page7_contenu_texte) }] });
  }

  const moduleDefs = [
    ['Dictée', ['dictee_data']],
    ['Genre / Nombre', ['user_genrenombres', 'erreurs_exercice']],
    ['Paronymes', ['paronymes_reponses', 'paronymes_score', 'paronymes_total']],
    ['Messagerie', ['page8_data']],
    ['Planning', ['planningCorrection', 'planningScore']],
    ['Rangement de stock', ['stockCorrect', 'stockErrors', 'stockTotal']],
    ['Construction à base de briques', ['eval_brique', 'eval_brique_auto']],
    ['Tri de chevilles', ['tri_cheville_data', 'autoEvaltri_resultats']],
    ['Puzzle Gratte-ciel', ['carre_magique_score', 'carre_magique_erreurs']],
    ['Autoévaluation 1', ['autoEval1_resultats']],
    ['Autoévaluation 2', ['autoEval2_resultats']]
  ];

  moduleDefs.forEach(([title, keys]) => {
    const entries = [];
    keys.forEach((key) => {
      if (!(key in s)) return;
      const parsed = parseJson(s[key], undefined);
      if (parsed !== undefined && parsed !== null && typeof parsed === 'object') flatten(parsed, key, entries);
      else entries.push({ label: key, value: String(s[key] ?? '') });
    });
    if (entries.length) slides.push({ title, entries });
  });

  const scores = parseJson(s.scores_data, {}) || {};
  const scoreEntries = flatten(scores).filter((e) => !String(e.label).includes('page7_analyse'));
  if (scoreEntries.length) {
    slides.push({
      title: 'Scores archivés',
      entries: [{ label: 'Règle', value: 'Valeurs enregistrées au moment de la page Résultats — aucun recalcul pendant le replay.' }, ...scoreEntries]
    });
  }

  if (slides.length === 1) {
    slides.push({ title: 'Données enregistrées', entries: [{ label: 'Information', value: 'Aucune donnée détaillée supplémentaire n’a été trouvée dans cette archive.' }] });
  }
  return slides;
}

function openReplayViewer(archive) {
  document.getElementById('seb-replay-chooser')?.remove();
  document.getElementById('seb-replay-viewer')?.remove();
  const slides = buildReplaySlides(archive);
  let index = 0;

  const layer = document.createElement('div');
  layer.id = 'seb-replay-viewer';
  const card = document.createElement('div');
  card.className = 'seb-slide-card';
  const head = document.createElement('div');
  head.className = 'seb-slide-head';
  const title = document.createElement('div');
  title.className = 'seb-slide-title';
  title.textContent = candidateLabel(archive.candidate || {});
  const build = document.createElement('div');
  build.className = 'seb-slide-meta';
  build.textContent = `Évaluation : Build #${archive.build || '?'}`;
  const readonly = document.createElement('div');
  readonly.className = 'seb-slide-readonly';
  readonly.textContent = 'LECTURE SEULE · AUCUN RECALCUL';
  head.append(title, build, readonly);

  const content = document.createElement('div');
  content.className = 'seb-slide-content';
  const foot = document.createElement('div');
  foot.className = 'seb-slide-foot';
  const prev = document.createElement('button');
  prev.textContent = '← Précédent';
  const counter = document.createElement('div');
  counter.className = 'seb-slide-counter';
  const next = document.createElement('button');
  next.className = 'primary';
  next.textContent = 'Suivant →';
  const close = document.createElement('button');
  close.textContent = 'Fermer le replay';
  foot.append(prev, counter, next, close);
  card.append(head, content, foot);
  layer.appendChild(card);
  document.body.appendChild(layer);

  function render() {
    const slide = slides[index];
    content.innerHTML = '';
    const h = document.createElement('div');
    h.className = 'seb-slide-page-title';
    h.textContent = slide.title;
    content.appendChild(h);
    if (!slide.entries || !slide.entries.length) {
      const empty = document.createElement('div');
      empty.className = 'seb-slide-empty';
      empty.textContent = 'Aucune donnée enregistrée pour cette page.';
      content.appendChild(empty);
    } else {
      const grid = document.createElement('div');
      grid.className = 'seb-slide-grid';
      slide.entries.forEach((entry) => {
        const l = document.createElement('div');
        l.className = 'seb-slide-label';
        l.textContent = String(entry.label || 'Valeur');
        const v = document.createElement('div');
        v.className = 'seb-slide-value';
        v.textContent = String(entry.value ?? '');
        grid.append(l, v);
      });
      content.appendChild(grid);
    }
    counter.textContent = `Diapo ${index + 1} / ${slides.length}`;
    prev.disabled = index === 0;
    next.disabled = index >= slides.length - 1;
    content.scrollTop = 0;
  }

  prev.addEventListener('click', () => { if (index > 0) { index -= 1; render(); } });
  next.addEventListener('click', () => { if (index < slides.length - 1) { index += 1; render(); } });
  close.addEventListener('click', () => layer.remove());
  layer.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') layer.remove();
    if (event.key === 'ArrowLeft' && index > 0) { index -= 1; render(); }
    if (event.key === 'ArrowRight' && index < slides.length - 1) { index += 1; render(); }
  });
  layer.tabIndex = -1;
  layer.focus();
  render();
}

async function createReplayChooserDialog() {
  document.getElementById('seb-replay-chooser')?.remove();
  const layer = document.createElement('div');
  layer.id = 'seb-replay-chooser';
  const card = document.createElement('div');
  card.className = 'seb-replay-card';
  const head = document.createElement('div');
  head.className = 'seb-replay-head';
  const title = document.createElement('div');
  title.className = 'seb-replay-head-title';
  title.textContent = 'Choisir le parcours à rejouer';
  const badge = document.createElement('div');
  badge.className = 'seb-replay-readonly';
  badge.textContent = 'LECTURE SEULE';
  head.append(title, badge);
  const body = document.createElement('div');
  body.className = 'seb-replay-body';
  const pathInfo = document.createElement('div');
  pathInfo.className = 'seb-replay-path';
  pathInfo.textContent = 'Archives : Documents\\SEB EvalPro\\parcours';
  body.appendChild(pathInfo);
  const actions = document.createElement('div');
  actions.className = 'seb-replay-actions';
  const close = document.createElement('button');
  close.textContent = 'Fermer';
  actions.appendChild(close);
  card.append(head, body, actions);
  layer.appendChild(card);
  document.body.appendChild(layer);
  close.addEventListener('click', () => layer.remove());

  let files = [];
  try { files = await ipcRenderer.invoke('admin:list-parcours'); } catch (_) {}
  if (!Array.isArray(files) || !files.length) {
    const empty = document.createElement('div');
    empty.className = 'seb-slide-empty';
    empty.textContent = 'Aucun parcours archivé pour le moment.';
    body.appendChild(empty);
    return;
  }

  files.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'seb-replay-row';
    const who = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = candidateLabel(item.candidate || {});
    const small = document.createElement('small');
    small.textContent = item.candidate && item.candidate.date ? ` · ${item.candidate.date}` : '';
    who.append(strong, small);
    const when = document.createElement('div');
    when.textContent = item.archivedAt ? new Date(item.archivedAt).toLocaleString('fr-FR') : '';
    const build = document.createElement('div');
    build.textContent = `Build #${item.build || '?'}`;
    const button = document.createElement('button');
    button.className = 'primary';
    button.textContent = item.integrityOk ? 'Rejouer' : 'Archive invalide';
    button.disabled = !item.integrityOk;
    if (!item.integrityOk) build.classList.add('bad');
    button.addEventListener('click', async () => {
      const result = await ipcRenderer.invoke('admin:load-parcours', item.filename);
      if (!result || !result.ok) {
        window.alert((result && result.error) || 'Impossible de charger cette archive.');
        return;
      }
      openReplayViewer(result.archive);
    });
    row.append(who, when, build, button);
    body.appendChild(row);
  });
}

function install() {
  if (installed) return;
  installed = true;
  addReplayStyle();
  regroupAdminButtons();
  installArchiveWatcher();
}

module.exports = { install };
