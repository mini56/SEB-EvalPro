const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error(`SEB EvalPro validation #99: ${message}`);
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
// PLANNING
// Une seule validation possible. Après validation : réponses figées,
// bouton Valider désactivé/masqué et seul Suivant reste disponible.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('app/web/planning.html');
  let out = text;

  if (!out.includes('id="seb-planning-lock99"')) {
    const patch = `
<script id="seb-planning-lock99">
(function(){
  'use strict';
  const DONE_KEY = 'seb_planning_validated';

  function btnValidate(){ return document.getElementById('btnValider'); }
  function btnNext(){ return document.getElementById('btnSuivant'); }

  function anyPlanningEntry(){
    return Array.from(document.querySelectorAll('select')).some(function(select){
      const value = String(select.value == null ? '' : select.value).trim();
      return select.selectedIndex > 0 && value !== '' && value !== '_';
    });
  }

  function lockPlanning(){
    document.querySelectorAll('select').forEach(function(select){ select.disabled = true; });
    const validate = btnValidate();
    if (validate) {
      validate.disabled = true;
      validate.style.setProperty('display', 'none', 'important');
      validate.setAttribute('aria-hidden', 'true');
      validate.tabIndex = -1;
    }
    const next = btnNext();
    if (next) {
      next.disabled = false;
      next.classList.remove('seb-exercise-nav-locked');
      next.style.setProperty('display', 'inline-flex', 'important');
      next.setAttribute('aria-hidden', 'false');
      next.removeAttribute('tabindex');
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    const validate = btnValidate();
    if (!validate) return;

    if (sessionStorage.getItem(DONE_KEY) === '1' || sessionStorage.getItem('planningScore') !== null) {
      sessionStorage.setItem(DONE_KEY, '1');
      lockPlanning();
      return;
    }

    validate.addEventListener('click', function(event){
      if (sessionStorage.getItem(DONE_KEY) === '1') {
        event.preventDefault();
        event.stopImmediatePropagation();
        lockPlanning();
        return;
      }
      if (!anyPlanningEntry()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.alert('Commencez l’exercice avant de le valider. Si vous ne souhaitez pas le réaliser, utilisez « Abandonner l’exercice ».');
        return;
      }

      // Le gestionnaire d'origine calcule et enregistre le score pendant ce clic.
      setTimeout(function(){
        if (sessionStorage.getItem('planningScore') !== null) {
          sessionStorage.setItem(DONE_KEY, '1');
          lockPlanning();
        }
      }, 0);
    }, true);
  }, { once:true });
})();
</script>
`;
    out = appendBeforeBody(out, patch, 'planning');
  }

  if (!out.includes('seb-planning-lock99') || !out.includes("validate.style.setProperty('display', 'none', 'important')")) {
    fail('verrouillage Planning incomplet', 4);
  }
  write(file, out);
}

// -----------------------------------------------------------------------------
// SINGULIER / PLURIEL - GENRE / NOMBRE
// Après le premier clic Vérifier, les réponses sont figées, Vérifier disparaît
// et un vrai bouton Suivant apparaît. Aucune deuxième vérification possible.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('app/web/genrenombres.html');
  let out = text;

  if (!out.includes('id="seb-genrenombres-lock99"')) {
    const patch = `
<script id="seb-genrenombres-lock99">
(function(){
  'use strict';
  const DONE_KEY = 'seb_genrenombres_validated';

  function checkButton(){ return document.getElementById('btnCheck'); }

  function ensureNext(){
    let next = document.getElementById('btnNextGenreNombre');
    if (!next) {
      next = document.createElement('button');
      next.id = 'btnNextGenreNombre';
      next.className = 'btn';
      next.type = 'button';
      next.textContent = 'Suivant →';
      next.onclick = function(){ window.location.href = 'tri_de_cheville.html'; };
      const check = checkButton();
      const parent = check && check.parentElement ? check.parentElement : document.querySelector('.footer');
      if (parent) parent.appendChild(next);
    }
    return next;
  }

  function lockAfterCheck(){
    document.querySelectorAll('input[data-answer]').forEach(function(input){ input.disabled = true; });
    const check = checkButton();
    if (check) {
      check.disabled = true;
      check.style.setProperty('display', 'none', 'important');
      check.setAttribute('aria-hidden', 'true');
      check.tabIndex = -1;
    }
    const next = ensureNext();
    if (next) {
      next.disabled = false;
      next.classList.remove('seb-exercise-nav-locked');
      next.style.setProperty('display', 'inline-flex', 'important');
      next.setAttribute('aria-hidden', 'false');
      next.removeAttribute('tabindex');
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    const check = checkButton();
    if (!check) return;

    const next = ensureNext();
    if (next) next.style.setProperty('display', 'none', 'important');

    if (sessionStorage.getItem(DONE_KEY) === '1' || sessionStorage.getItem('erreurs_exercice') !== null) {
      sessionStorage.setItem(DONE_KEY, '1');
      lockAfterCheck();
      return;
    }

    check.addEventListener('click', function(event){
      if (sessionStorage.getItem(DONE_KEY) === '1') {
        event.preventDefault();
        event.stopImmediatePropagation();
        lockAfterCheck();
        return;
      }
      const hasEntry = Array.from(document.querySelectorAll('input[data-answer]'))
        .some(function(input){ return String(input.value || '').trim() !== ''; });
      if (!hasEntry) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.alert('Commencez l’exercice avant de le vérifier. Si vous ne souhaitez pas le réaliser, utilisez « Abandonner l’exercice ».');
        return;
      }

      // Le gestionnaire d'origine vérifie et écrit erreurs_exercice pendant ce clic.
      setTimeout(function(){
        if (sessionStorage.getItem('erreurs_exercice') !== null) {
          sessionStorage.setItem(DONE_KEY, '1');
          lockAfterCheck();
        }
      }, 0);
    }, true);
  }, { once:true });
})();
</script>
`;
    out = appendBeforeBody(out, patch, 'genrenombres');
  }

  if (!out.includes('seb-genrenombres-lock99') || !out.includes('btnNextGenreNombre')) {
    fail('verrouillage Singulier/Pluriel incomplet', 5);
  }
  write(file, out);
}

console.log('SEB EvalPro #99: Planning validable une seule fois + réponses figées; Singulier/Pluriel vérifiable une seule fois avec bouton Suivant garanti.');
