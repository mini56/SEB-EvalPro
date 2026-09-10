const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webDir = path.join(root, 'app', 'web');

function read(name) {
  const file = path.join(webDir, name);
  if (!fs.existsSync(file)) throw new Error(`SEB EvalPro audit: page générée introuvable : ${name}`);
  return { file, html: fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') };
}

function write(file, html) {
  fs.writeFileSync(file, html, 'utf8');
}

function mustReplace(html, search, replacement, label) {
  const found = typeof search === 'string' ? html.includes(search) : search.test(html);
  if (!found) throw new Error(`SEB EvalPro audit: cible introuvable pour ${label}`);
  if (search instanceof RegExp) search.lastIndex = 0;
  return html.replace(search, replacement);
}

function injectBeforeBodyEnd(html, block) {
  const index = html.toLowerCase().lastIndexOf('</body>');
  if (index < 0) return `${html}\n${block}\n`;
  return `${html.slice(0, index)}${block}\n${html.slice(index)}`;
}

function patchQcm() {
  const { file, html } = read('qcmv1.0.html');
  let out = html;

  out = mustReplace(
    out,
    "(bonnes[i] && val.replace(',', '.') === bonnes[i].toString())",
    "(bonnes[i] && val.replace(',', '.') === bonnes[i].toString().replace(',', '.'))",
    'conversion page 6 avec virgule ou point'
  );

  out = mustReplace(
    out,
    /\s*total \+= scoreTexte;\s*totalQuestions \+= 8;/,
    "\n      // Le traitement de texte est évalué séparément dans le bilan : il n'entre pas dans le score général.",
    'exclusion ancien texte libre du score général'
  );

  out = mustReplace(
    out,
    /\s*total \+= score7;\s*totalQuestions \+= scoreMax;/,
    "\n    // Le traitement de texte est évalué séparément dans le bilan : il n'entre pas dans le score général.",
    'exclusion traitement de texte du score général'
  );

  out = mustReplace(
    out,
    'const scoreMax = 7;',
    'const scoreMax = 8;',
    'score maximum traitement de texte affiché'
  );

  out = mustReplace(
    out,
    "html += `<span class=\"${analyse.score.texte_taille ? 'correct' : 'incorrect'}\">${analyse.score.texte_taille ? '✓' : '✗'} Taille 12px (détecté: ${analyse.texte.taille || 'inconnue'})</span>`;",
    "html += `<span class=\"${analyse.score.texte_taille ? 'correct' : 'incorrect'}\">${analyse.score.texte_taille ? '✓' : '✗'} Taille 12px (détecté: ${analyse.texte.taille || 'inconnue'})</span>`;\n    html += `<span class=\"${analyse.score.enregistrement ? 'correct' : 'incorrect'}\">${analyse.score.enregistrement ? '✓' : '✗'} Enregistrement via le menu Fichier</span>`;",
    'affichage critère enregistrement traitement de texte'
  );

  write(file, out);
}

function patchAdminBilan() {
  const { file, html } = read('admin-bilan.html');
  let out = html;

  out = mustReplace(out, 'Math.round(pr/27*100)', 'Math.round(pr/28*100)', 'dénominateur mathématiques bilan');
  out = mustReplace(out, "'- '+pr+' / 27 réponses correctes ('+p+' %)'", "'- '+pr+' / 28 réponses correctes ('+p+' %)'", 'affichage dénominateur mathématiques bilan');
  out = mustReplace(out, "'- '+v+' / 7 point(s)'", "'- '+v+' / 8 point(s)'", 'affichage score traitement de texte bilan');

  write(file, out);
}

function patchMailResume() {
  const { file, html } = read('nvmail.html');
  const destructive = /document\.addEventListener\('DOMContentLoaded', function\(\) \{\s*\/\/ NETTOYAGE des données page 8[\s\S]*?document\.getElementById\('fichierSelectionne'\)\.textContent = 'Aucun fichier sélectionné';\s*\}\);/;
  const out = mustReplace(
    html,
    destructive,
    "// Les champs et page8_data sont conservés pour permettre une reprise exacte après fermeture de l'application.",
    'suppression nettoyage destructif messagerie'
  );
  write(file, out);
}

function patchGenreNombreResume() {
  const { file, html } = read('genrenombres.html');
  const out = mustReplace(
    html,
    "  // clear previous data for this page\n  try { sessionStorage.removeItem('erreurs_exercice'); } catch(e){}\n",
    "  // Les données précédentes sont conservées pendant l'évaluation pour permettre la reprise.\n",
    'suppression nettoyage destructif genre/nombre'
  );
  write(file, out);
}

function patchStockScoring() {
  const { file, html } = read('stock.html');
  let out = html;
  out = mustReplace(
    out,
    "        if (!parent.classList.contains('case')) return;",
    "        if (!parent.classList.contains('case')) {\n            pot.classList.add('incorrect');\n            errorCount++;\n            return;\n        }",
    'comptage des flacons non rangés'
  );
  out = mustReplace(
    out,
    "        if (!niveau) return;",
    "        if (!niveau) {\n            pot.classList.add('incorrect');\n            errorCount++;\n            return;\n        }",
    'comptage des flacons sans niveau valide'
  );
  write(file, out);
}

function patchAutoEval1() {
  const { file, html } = read('autoeval1.html');
  let out = html;
  out = mustReplace(
    out,
    'onclick="saveAutoEval1(); passerEtapeSuivante()"',
    'onclick="saveAutoEval1()"',
    'double action bouton autoévaluation 1'
  );
  out = mustReplace(
    out,
    /function passerEtapeSuivante\(\) \{\s*if \(confirm\("Souhaitez-vous passer à l'étape suivante \?"\)\) \{\s*\/\/ Même comportement que le bouton principal : enregistre avant de passer\s*saveAutoEval1\(\);\s*\}\s*\}/,
    "function passerEtapeSuivante() {\n  saveAutoEval1();\n}",
    'simplification étape suivante autoévaluation 1'
  );
  write(file, out);
}

function patchBriqueZeroErrorsAndCheckpoint() {
  const { file, html } = read('brique.html');
  let out = html;
  out = mustReplace(out, 'type="number" min="1" max="10"', 'type="number" min="0" max="10"', 'zéro erreur briques');
  out = mustReplace(out, 'const PERIOD_SECONDS = 10 * 60;', 'const PERIOD_SECONDS = 1;', 'checkpoint briques chaque seconde');
  write(file, out);
}

function patchWordScoring() {
  const { file, html } = read('nwtexte.html');
  let out = html;

  out = mustReplace(
    out,
    "        texte_taille: 0,\n        total: 0",
    "        texte_taille: 0,\n        enregistrement: 0,\n        total: 0",
    'critère enregistrement traitement de texte'
  );

  out = mustReplace(
    out,
    "      analyse.titre.texte = titreTexte;\n      analyse.titre.present = titreTexte.length > 0;\n      \n      if (analyse.titre.present) {\n        analyse.score.titre_present = 1;",
    `      analyse.titre.texte = titreTexte;\n      analyse.titre.present = titreTexte.length > 0;\n      const normaliserTitre = (value) => String(value || '')\n        .toLowerCase()\n        .replace(/[’']/g, "'")\n        .replace(/\\s+/g, ' ')\n        .replace(/\\s*\\?\\s*$/, '')\n        .trim();\n      const titresValides = [\n        'Quel est mon activité préférée et pourquoi?',\n        'Quel est mon expérience professionnel préférée et pourquoi?',\n        'Quel est mon métier préféré et pourquoi?'\n      ].map(normaliserTitre);\n      analyse.titre.valide = titresValides.includes(normaliserTitre(titreTexte));\n      \n      if (analyse.titre.valide) {\n        analyse.score.titre_present = 1;`,
    'titre limité aux trois propositions'
  );

  out = mustReplace(
    out,
    "    analyse.score.total = analyse.score.titre_present +\n                         analyse.score.titre_gras +\n                         analyse.score.titre_police +\n                         analyse.score.titre_taille +\n                         analyse.score.texte_lignes +\n                         analyse.score.texte_police +\n                         analyse.score.texte_taille;",
    "    analyse.score.enregistrement = (localStorage.getItem('seb_evalpro_texte_enregistre') === 'true' || localStorage.getItem('dernierEnregistrementSous') === 'true') ? 1 : 0;\n    analyse.score.total = analyse.score.titre_present +\n                         analyse.score.titre_gras +\n                         analyse.score.titre_police +\n                         analyse.score.titre_taille +\n                         analyse.score.texte_lignes +\n                         analyse.score.texte_police +\n                         analyse.score.texte_taille +\n                         analyse.score.enregistrement;",
    'total traitement de texte avec enregistrement'
  );

  out = mustReplace(
    out,
    "      a.download = 'document.html'; \n      a.click();",
    "      a.download = 'document.html'; \n      a.click();\n      localStorage.setItem('seb_evalpro_texte_enregistre', 'true');",
    'enregistrement simple comptabilisé'
  );

  out = mustReplace(
    out,
    "      a.download = nomComplet; \n      a.click();",
    "      a.download = nomComplet; \n      a.click();\n      localStorage.setItem('seb_evalpro_texte_enregistre', 'true');",
    'enregistrement sous comptabilisé'
  );

  write(file, out);
}

function patchTriLiveChrono() {
  const { file, html } = read('tri_de_cheville.html');
  let out = html;
  out = mustReplace(
    out,
    'let triStarted = false;',
    "let triStarted = Number(sessionStorage.getItem('seb_evalpro_tri_live_chrono') || '0') > 0;",
    'reprise état tri en cours'
  );
  out = mustReplace(
    out,
    "chronoSeconds = 0;\n    if (typeof updateChronoDisplay === 'function') updateChronoDisplay();",
    "chronoSeconds = 0;\n    sessionStorage.setItem('seb_evalpro_tri_live_chrono', '0');\n    if (typeof updateChronoDisplay === 'function') updateChronoDisplay();",
    'remise à zéro checkpoint tri après validation'
  );
  const patch = `
<script id="seb-evalpro-tri-live-resume">
(function(){
  const KEY = 'seb_evalpro_tri_live_chrono';
  function persist(){
    try {
      if (typeof chronoSeconds !== 'number') return;
      sessionStorage.setItem(KEY, String(Math.max(0, Math.floor(chronoSeconds))));
    } catch (_) {}
  }
  function restore(){
    try {
      const saved = Number(sessionStorage.getItem(KEY));
      if (!Number.isFinite(saved) || saved <= 0 || typeof chronoSeconds !== 'number') return;
      chronoSeconds = Math.floor(saved);
      if (typeof updateChronoDisplay === 'function') updateChronoDisplay();
    } catch (_) {}
  }
  document.addEventListener('DOMContentLoaded', function(){
    restore();
    setInterval(function(){ persist(); }, 1000);
  });
})();
</script>`;
  write(file, injectBeforeBodyEnd(out, patch));
}

function installGenericResume() {
  const pages = [
    'autoeval1.html', 'autoeval2.html', 'brique.html', 'carre.html', 'genrenombres.html',
    'nvmail.html', 'nwtexte.html', 'paronymes.html', 'planning.html', 'stock.html', 'tri_de_cheville.html'
  ];

  const runtime = `
<script id="seb-evalpro-page-draft-resume">
(function(){
  const page = decodeURIComponent((location.pathname.split('/').pop() || '').toLowerCase());
  const KEY = 'seb_evalpro_page_draft_' + page;
  let restoring = false;
  let timer = null;

  function controls(){ return Array.from(document.querySelectorAll('input,textarea,select')); }
  function editables(){ return Array.from(document.querySelectorAll('[contenteditable="true"]')); }

  function stockPositions(){
    if (page !== 'stock.html') return null;
    return Array.from(document.querySelectorAll('.pot')).map((pot) => {
      const id = pot.dataset.potId || '';
      const parent = pot.parentElement;
      if (!parent) return { id, type: 'source' };
      if (parent.classList.contains('case')) {
        const level = parent.closest('[data-etagere][data-niveau]');
        return {
          id,
          type: 'case',
          etagere: level?.dataset.etagere || '',
          niveau: level?.dataset.niveau || '',
          caseNum: parent.dataset.case || ''
        };
      }
      if (parent.id === 'zone-tri') return { id, type: 'tri' };
      return { id, type: 'source' };
    });
  }

  function saveDraft(){
    if (restoring) return;
    try {
      const state = {
        controls: controls().map((el, index) => ({
          index,
          id: el.id || '',
          type: (el.type || el.tagName || '').toLowerCase(),
          value: (el.type === 'password' || el.type === 'file') ? '' : el.value,
          checked: !!el.checked,
          disabled: !!el.disabled
        })),
        editables: editables().map((el, index) => ({ index, id: el.id || '', html: el.innerHTML })),
        selectedCells: Array.from(document.querySelectorAll('td')).map((td, index) => td.classList.contains('selected') ? index : -1).filter((x) => x >= 0),
        ui: {},
        stock: stockPositions(),
        stockValidated: page === 'stock.html' && sessionStorage.getItem('stockCorrect') !== null
      };
      ['consigne','autoEvalPart','btnValider','btnSuivant','validBtn','autoEvalBtn','startBtn','stopBtn','resetBtn','resMS','resErr','indicator','fichierSelectionne','resultatScore','autoEvalResult'].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        state.ui[id] = {
          text: (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) ? null : el.textContent,
          className: el.className || '',
          style: el.getAttribute('style') || '',
          disabled: 'disabled' in el ? !!el.disabled : null
        };
      });
      sessionStorage.setItem(KEY, JSON.stringify(state));
      if (window.sebEvalPro?.save) window.sebEvalPro.save();
    } catch (_) {}
  }

  function restoreStock(items){
    if (page !== 'stock.html' || !Array.isArray(items)) return;
    setTimeout(() => {
      document.querySelectorAll('.case').forEach((c) => c.classList.remove('occupied'));
      items.forEach((saved) => {
        const pot = document.querySelector('.pot[data-pot-id="' + saved.id + '"]');
        if (!pot) return;
        let target = null;
        if (saved.type === 'case') {
          target = document.querySelector('[data-etagere="' + saved.etagere + '"][data-niveau="' + saved.niveau + '"] .case[data-case="' + saved.caseNum + '"]');
        } else if (saved.type === 'tri') {
          target = document.getElementById('zone-tri');
        } else {
          target = document.getElementById('pots-source');
        }
        if (target) {
          target.appendChild(pot);
          if (target.classList?.contains('case')) target.classList.add('occupied');
        }
      });
    }, 180);
  }

  function restoreDraft(){
    let state = null;
    try { state = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (_) {}
    if (!state) return;
    restoring = true;
    try {
      const list = controls();
      (state.controls || []).forEach((saved) => {
        let el = saved.id ? document.getElementById(saved.id) : null;
        if (!el) el = list[saved.index];
        if (!el || el.type === 'password' || el.type === 'file') return;
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!saved.checked;
        else if (saved.value !== undefined) el.value = saved.value;
        if (saved.disabled !== undefined) el.disabled = !!saved.disabled;
      });
      const eds = editables();
      (state.editables || []).forEach((saved) => {
        let el = saved.id ? document.getElementById(saved.id) : null;
        if (!el) el = eds[saved.index];
        if (el && typeof saved.html === 'string') el.innerHTML = saved.html;
      });
      const tds = Array.from(document.querySelectorAll('td'));
      (state.selectedCells || []).forEach((index) => { if (tds[index]) tds[index].classList.add('selected'); });
      Object.entries(state.ui || {}).forEach(([id, saved]) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (typeof saved.className === 'string') el.className = saved.className;
        if (typeof saved.style === 'string') {
          if (saved.style) el.setAttribute('style', saved.style); else el.removeAttribute('style');
        }
        if (saved.text !== null && saved.text !== undefined && !(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement) && !(el instanceof HTMLSelectElement)) el.textContent = saved.text;
        if (saved.disabled !== null && saved.disabled !== undefined && 'disabled' in el) el.disabled = !!saved.disabled;
      });
      restoreStock(state.stock);
      if (page === 'stock.html' && state.stockValidated) {
        const btn = document.querySelector('.verify-btn');
        if (btn) {
          btn.innerHTML = '➡️ Suivant';
          btn.onclick = () => { window.location.href = 'planning.html'; };
        }
      }
    } finally {
      restoring = false;
    }
  }

  function schedule(){
    clearTimeout(timer);
    timer = setTimeout(saveDraft, 80);
  }

  document.addEventListener('DOMContentLoaded', function(){
    restoreDraft();
    document.addEventListener('input', schedule, true);
    document.addEventListener('change', schedule, true);
    document.addEventListener('click', schedule, true);
    document.addEventListener('drop', () => setTimeout(schedule, 30), true);
    document.addEventListener('dragend', () => setTimeout(schedule, 30), true);
    setInterval(saveDraft, 1000);
  });
})();
</script>`;

  pages.forEach((name) => {
    const { file, html } = read(name);
    if (html.includes('seb-evalpro-page-draft-resume')) return;
    write(file, injectBeforeBodyEnd(html, runtime));
  });
}

patchQcm();
patchAdminBilan();
patchMailResume();
patchGenreNombreResume();
patchStockScoring();
patchAutoEval1();
patchBriqueZeroErrorsAndCheckpoint();
patchWordScoring();
patchTriLiveChrono();
installGenericResume();

console.log('SEB EvalPro audit: corrections validées appliquées (barèmes, reprise, stock, autoévaluations, briques, traitement de texte).');
