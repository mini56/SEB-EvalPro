const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error(`SEB EvalPro navigation #98: ${message}`);
  process.exit(code);
}

function read(relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) fail(`fichier introuvable: ${relativePath}`);
  return { file, text: fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') };
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

function appendBeforeBody(text, addition, label) {
  const index = text.toLowerCase().lastIndexOf('</body>');
  if (index < 0) fail(`balise </body> introuvable: ${label}`, 3);
  return text.slice(0, index) + addition + text.slice(index);
}

// -----------------------------------------------------------------------------
// 1. Tri de chevilles : aucun bouton Suivant avant les 5 tris + erreurs +
//    autoévaluation réellement validée. La validation de l'autoévaluation ne
//    quitte plus immédiatement la page : elle déverrouille le bouton Suivant.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('app/web/tri_de_cheville.html');
  let out = text;

  if (!out.includes('id="seb-tri-next"')) {
    const nextRegex = /<button\s+type="button"\s+onclick="[^"]*passerEtapeSuivante\(\)[^"]*">\s*Étape suivante\s*(?:➜|→|-&gt;|->)?\s*<\/button>/i;
    if (!nextRegex.test(out)) fail('bouton Étape suivante du tri introuvable', 4);
    out = out.replace(nextRegex,
      '<button type="button" id="seb-tri-next" class="seb-exercise-nav-locked" onclick="passerEtapeSuivante()">Étape suivante ➜</button>'
    );
  }

  const oldAuto = '<button type="button" onclick="saveAutoEval(); saveTriResultsToQCM(); passerEtapeSuivante()">Valider mon autoévaluation</button>';
  const newAuto = '<button type="button" id="seb-tri-auto-validate" onclick="sebEvalProValidateTriAutoEvaluation(event)">Valider mon autoévaluation</button>';
  if (!out.includes(newAuto)) {
    if (!out.includes(oldAuto)) fail('bouton de validation autoévaluation du tri introuvable', 5);
    out = out.replace(oldAuto, newAuto);
  }

  if (!out.includes('id="seb-tri-navigation-guard98"')) {
    const guard = `
<script id="seb-tri-navigation-guard98">
(function(){
  'use strict';
  const READY_KEY = 'seb_tri_navigation_ready';

  function explicitError(index){
    const input = document.getElementById('e' + index);
    if (!input) return false;
    const raw = String(input.value == null ? '' : input.value).trim();
    if (raw === '') return false;
    const value = Number(raw);
    return Number.isInteger(value) && value >= 0;
  }

  function fiveTrisDone(){
    const validate = document.getElementById('resetBtn');
    if (validate && /5\\s+tris\\s+validés/i.test(validate.textContent || '')) {
      for (let i = 1; i <= 5; i += 1) if (!explicitError(i)) return false;
      return true;
    }
    for (let i = 1; i <= 5; i += 1) {
      const m = document.getElementById('m' + i);
      const s = document.getElementById('s' + i);
      if (!m || !s) return false;
      const hasTime = String(m.value == null ? '' : m.value).trim() !== '' || String(s.value == null ? '' : s.value).trim() !== '';
      if (!hasTime || !explicitError(i)) return false;
    }
    return true;
  }

  function autoEvalAnswered(){
    const form = document.getElementById('autoEvalForm');
    if (!form) return false;
    if (form.querySelector('input[type="checkbox"]:checked')) return true;
    return Array.from(form.querySelectorAll('textarea,input[type="text"]'))
      .some(function(el){ return String(el.value || '').trim() !== ''; });
  }

  function nextButton(){ return document.getElementById('seb-tri-next'); }

  function navigationReady(){
    return sessionStorage.getItem(READY_KEY) === '1' && fiveTrisDone();
  }

  function refreshNext(){
    const next = nextButton();
    if (!next) return;
    const ready = navigationReady();
    next.classList.toggle('seb-exercise-nav-locked', !ready);
    next.setAttribute('aria-hidden', ready ? 'false' : 'true');
    next.tabIndex = ready ? 0 : -1;
  }

  window.sebEvalProTriNavigationReady = navigationReady;

  window.sebEvalProValidateTriAutoEvaluation = function(event){
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!fiveTrisDone()) {
      window.alert('Terminez et validez les 5 tris et renseignez le nombre d’erreurs de chacun (0 si aucune erreur) avant de valider l’autoévaluation.');
      refreshNext();
      return false;
    }
    if (!autoEvalAnswered()) {
      window.alert('Merci de compléter cette autoévaluation avant de continuer : cochez au moins une proposition ou saisissez un commentaire.');
      refreshNext();
      return false;
    }

    if (typeof window.saveAutoEval === 'function') window.saveAutoEval();
    if (typeof window.saveTriResultsToQCM === 'function') window.saveTriResultsToQCM();
    sessionStorage.setItem(READY_KEY, '1');

    const validate = document.getElementById('seb-tri-auto-validate');
    if (validate) {
      validate.disabled = true;
      validate.textContent = 'Autoévaluation validée ✓';
    }
    refreshNext();
    const next = nextButton();
    if (next) setTimeout(function(){ next.focus(); }, 0);
    return false;
  };

  document.addEventListener('DOMContentLoaded', function(){
    if (!fiveTrisDone()) sessionStorage.removeItem(READY_KEY);
    refreshNext();
    ['input','change','click'].forEach(function(type){
      document.addEventListener(type, function(){ setTimeout(refreshNext, 0); }, true);
    });
  }, { once:true });
})();
</script>
`;
    out = appendBeforeBody(out, guard, 'garde navigation Tri');
  }

  if (!out.includes('seb-tri-next') || !out.includes('sebEvalProValidateTriAutoEvaluation')) {
    fail('garde Tri incomplet après correction', 6);
  }
  if (out.includes('onclick="saveAutoEval(); saveTriResultsToQCM(); passerEtapeSuivante()"')) {
    fail('ancienne navigation directe du Tri encore présente', 7);
  }
  write(file, out);
}

// -----------------------------------------------------------------------------
// 2. Règle générale des vrais exercices : aucun bouton Suivant / Continuer ne
//    permet de quitter un exercice totalement vierge. Pour les exercices avec
//    une validation dédiée, le bouton de navigation n'est déverrouillé qu'après
//    cette validation ET une activité réelle du stagiaire.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('app/web/js/seb-ui-runtime.js');
  let out = text;

  if (!out.includes('SEB_EXERCISE_NAVIGATION_GUARD98')) {
    out += `

// SEB_EXERCISE_NAVIGATION_GUARD98
(function(){
  'use strict';

  const TRUE_FILES = new Set([
    'brique.html','stock.html','planning.html','genrenombres.html',
    'tri_de_cheville.html','nwtexte.html','nvmail.html','paronymes.html','carre.html'
  ]);
  const QCM_IDS = new Set(['page2','page2_1','page3','page4','page5','page5_1','page6','pageTexteTrous','page8']);
  let scheduled = false;

  function fileName(){
    try { return decodeURIComponent((window.location.pathname.split('/').pop() || '').toLowerCase()); }
    catch (_) { return ''; }
  }

  function clean(value){
    return String(value || '')
      .replace(/\\s+/g, ' ')
      .replace(/^(?:➡️|➡|➜|→|←|✓|✔|▶️|▶|⏹️|⏹|■|📊|🧮|💾|✉️|✉)\\s*/u, '')
      .replace(/\\s*(?:->|→|➜)\\s*$/u, '')
      .trim();
  }

  function visibleQcmExercise(){
    const page = Array.from(document.querySelectorAll('.page')).find(function(node){ return node.classList.contains('visible'); });
    return page && QCM_IDS.has(page.id) ? page : null;
  }

  function context(){
    const file = fileName();
    if (file === 'qcmv1.0.html') {
      const scope = visibleQcmExercise();
      return scope ? { file:file, scope:scope, key:file + '#' + scope.id } : null;
    }
    if (!TRUE_FILES.has(file)) return null;
    return { file:file, scope:document.body, key:file };
  }

  function activityKey(ctx){ return 'seb_exercise_activity:' + ctx.key; }
  function hasActivityFlag(ctx){ return sessionStorage.getItem(activityKey(ctx)) === '1'; }
  function setActivity(ctx){
    if (!ctx) return;
    sessionStorage.setItem(activityKey(ctx), '1');
  }

  function hasMeaningfulValues(scope){
    if (!scope || !scope.querySelectorAll) return false;
    if (scope.querySelector('input[type="checkbox"]:checked,input[type="radio"]:checked,.item.selected,[aria-pressed="true"]')) return true;

    const fields = Array.from(scope.querySelectorAll('input,textarea,select'));
    for (const field of fields) {
      const type = String(field.type || '').toLowerCase();
      if (['hidden','button','submit','reset','file','checkbox','radio'].includes(type)) continue;
      if (field.tagName === 'SELECT') {
        const value = String(field.value == null ? '' : field.value).trim();
        if (field.selectedIndex > 0 && value !== '' && value !== '_') return true;
        continue;
      }
      if (String(field.value == null ? '' : field.value).trim() !== '') return true;
    }

    const editable = Array.from(scope.querySelectorAll('[contenteditable="true"],.ql-editor'));
    if (editable.some(function(node){
      const text = String(node.innerText || node.textContent || '').replace(/\\u200B/g, '').trim();
      return text !== '' || !!node.querySelector('img');
    })) return true;

    const file = fileName();
    if (file === 'stock.html' && scope.querySelector('.case .pot,#zone-tri .pot,.etagere .pot')) return true;
    return false;
  }

  function storageExists(key){ return sessionStorage.getItem(key) !== null; }

  function ready(ctx){
    if (!ctx) return true;

    if (!hasActivityFlag(ctx) && hasMeaningfulValues(ctx.scope)) setActivity(ctx);
    const activity = hasActivityFlag(ctx);

    if (ctx.file === 'tri_de_cheville.html') {
      if (typeof window.sebEvalProTriNavigationReady === 'function') return !!window.sebEvalProTriNavigationReady();
      return sessionStorage.getItem('seb_tri_navigation_ready') === '1';
    }
    if (ctx.file === 'brique.html') return activity && storageExists('eval_brique') && storageExists('eval_brique_auto');
    if (ctx.file === 'stock.html') return activity && storageExists('stockTotal');
    if (ctx.file === 'planning.html') return activity && storageExists('planningScore');
    if (ctx.file === 'genrenombres.html') return activity && storageExists('erreurs_exercice');
    if (ctx.file === 'nvmail.html') return activity && storageExists('page8_data');
    if (ctx.file === 'paronymes.html') return activity && storageExists('paronymes_score');
    if (ctx.file === 'carre.html') return activity && storageExists('carre_magique_score');
    if (ctx.file === 'nwtexte.html') return activity;

    // Pages d'exercices QCM : le bouton Suivant n'est pas disponible tant
    // qu'aucune réponse / sélection n'a été effectuée sur la page visible.
    if (ctx.file === 'qcmv1.0.html') return activity;
    return activity;
  }

  function isNavigationButton(button){
    if (!button || button.id === 'seb-evalpro-abandon-fixed') return false;
    if (button.closest('#seb-evalpro-topbar,#seb-evalpro-admin-dialog,#seb-evalpro-session-close-dialog,#seb-evalpro-abandon-layer')) return false;
    const label = clean(button.textContent).toLowerCase();
    return /^(suivant|page suivante|étape suivante|etape suivante|continuer)\\b/.test(label);
  }

  function belongsToContext(button, ctx){
    if (!ctx) return false;
    if (ctx.file === 'qcmv1.0.html') return ctx.scope.contains(button);
    return document.body.contains(button);
  }

  function ensureStyle(){
    if (document.getElementById('seb-exercise-navigation-guard-style')) return;
    const style = document.createElement('style');
    style.id = 'seb-exercise-navigation-guard-style';
    style.textContent = 'button.seb-exercise-nav-locked{display:none!important}';
    (document.head || document.documentElement).appendChild(style);
  }

  function enforce(){
    scheduled = false;
    ensureStyle();
    const ctx = context();
    if (!ctx) {
      document.querySelectorAll('.seb-exercise-nav-locked').forEach(function(button){ button.classList.remove('seb-exercise-nav-locked'); });
      return;
    }
    const unlocked = ready(ctx);
    document.querySelectorAll('button').forEach(function(button){
      if (!isNavigationButton(button) || !belongsToContext(button, ctx)) return;
      button.classList.toggle('seb-exercise-nav-locked', !unlocked);
      button.setAttribute('aria-hidden', unlocked ? 'false' : 'true');
      if (!unlocked) button.tabIndex = -1;
      else if (button.tabIndex < 0) button.removeAttribute('tabindex');
    });
  }

  function schedule(){
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enforce);
  }

  function markFromEvent(event){
    const ctx = context();
    if (!ctx) return;
    const target = event.target;
    if (!target || (ctx.file === 'qcmv1.0.html' && !ctx.scope.contains(target))) return;

    if (event.type === 'input' || event.type === 'change' || event.type === 'drop' || event.type === 'dragstart') {
      setActivity(ctx);
      schedule();
      return;
    }

    if (event.type === 'click') {
      const interactive = target.closest && target.closest('.item,[aria-pressed],td:not(.paronyme),.pot,.case,[contenteditable="true"],.fake-file-input');
      if (interactive) {
        setActivity(ctx);
        schedule();
        return;
      }
      const button = target.closest && target.closest('button');
      if (button) {
        const label = clean(button.textContent).toLowerCase();
        if (/^(démarrer|demarrer)\\b/.test(label)) {
          setActivity(ctx);
          schedule();
        }
      }
    }
  }

  document.addEventListener('click', function(event){
    const button = event.target && event.target.closest ? event.target.closest('button') : null;
    if (!button || !isNavigationButton(button)) return;
    const ctx = context();
    if (!ctx || !belongsToContext(button, ctx) || ready(ctx)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    window.alert(ctx.file === 'tri_de_cheville.html'
      ? 'Terminez les 5 tris puis validez l’autoévaluation avant de passer à l’étape suivante.'
      : 'Vous devez réaliser l’exercice avant de passer à l’étape suivante. Si vous souhaitez arrêter cet exercice, utilisez « Abandonner l’exercice ».');
  }, true);

  ['input','change','click','drop','dragstart'].forEach(function(type){
    document.addEventListener(type, markFromEvent, true);
  });

  function init(){
    ensureStyle();
    enforce();
    new MutationObserver(schedule).observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class','style','hidden','aria-pressed']
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
`;
  }

  if (!out.includes('SEB_EXERCISE_NAVIGATION_GUARD98')) fail('garde global non injecté', 8);
  if (!out.includes("ctx.file === 'tri_de_cheville.html'")) fail('règle stricte Tri absente', 9);
  if (!out.includes("ctx.file === 'nvmail.html'")) fail('règle nvmail absente', 10);
  if (!out.includes("ctx.file === 'qcmv1.0.html'")) fail('règle QCM absente', 11);
  write(file, out);
}

// Contrôles bloquants de fin de build.
{
  const tri = read('app/web/tri_de_cheville.html').text;
  const runtime = read('app/web/js/seb-ui-runtime.js').text;
  const checks = [
    [tri.includes('id="seb-tri-next"'), 'Tri: bouton Suivant identifié'],
    [tri.includes('seb_tri_navigation_ready'), 'Tri: marqueur validation autoévaluation'],
    [tri.includes('sebEvalProValidateTriAutoEvaluation'), 'Tri: validation autoévaluation sans sortie immédiate'],
    [runtime.includes('SEB_EXERCISE_NAVIGATION_GUARD98'), 'garde global navigation'],
    [runtime.includes("storageExists('page8_data')"), 'nvmail après Envoyer'],
    [runtime.includes("storageExists('planningScore')"), 'Planning après validation'],
    [runtime.includes("storageExists('paronymes_score')"), 'Paronymes après vérification'],
    [runtime.includes("storageExists('carre_magique_score')"), 'Carré après validation']
  ];
  const failed = checks.filter(function(entry){ return !entry[0]; }).map(function(entry){ return entry[1]; });
  if (failed.length) fail('contrôles finaux échoués: ' + failed.join(', '), 12);
}

console.log('SEB EvalPro #98: navigation bloquée sur exercice vierge; Tri Suivant uniquement après 5 tris + erreurs + autoévaluation validée.');
