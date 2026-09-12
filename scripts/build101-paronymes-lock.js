const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'app', 'web', 'paronymes.html');

function fail(message, code = 2) {
  console.error(`SEB EvalPro Paronymes #101: ${message}`);
  process.exit(code);
}

if (!fs.existsSync(file)) fail('page paronymes.html introuvable');
let html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

if (!html.includes('id="seb-paronymes-lock101"')) {
  const patch = `
<script id="seb-paronymes-lock101">
(function(){
  'use strict';
  const DONE_KEY = 'seb_paronymes_validated';
  const ACTIVITY_KEY = 'seb_exercise_activity:paronymes.html';

  function checkButton(){ return document.getElementById('btnCheck'); }

  function hasSelection(){
    return !!document.querySelector('td:not(.paronyme).selected');
  }

  function ensureNext(){
    let next = document.getElementById('btnNextParonymes');
    if (!next) {
      next = document.createElement('button');
      next.id = 'btnNextParonymes';
      next.className = 'btn';
      next.type = 'button';
      next.textContent = 'Suivant →';
      next.onclick = function(){ window.location.href = 'carre.html'; };
      const check = checkButton();
      const parent = check && check.parentElement ? check.parentElement : document.querySelector('.footer');
      if (parent) parent.appendChild(next);
    }
    return next;
  }

  function lockAnswers(){
    document.querySelectorAll('td:not(.paronyme)').forEach(function(cell){
      cell.style.pointerEvents = 'none';
      cell.setAttribute('aria-disabled', 'true');
    });
  }

  function finishValidation(){
    if (sessionStorage.getItem('paronymes_score') === null) return false;
    sessionStorage.setItem(DONE_KEY, '1');
    sessionStorage.setItem(ACTIVITY_KEY, '1');
    lockAnswers();

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
    return true;
  }

  document.addEventListener('click', function(event){
    const check = event.target && event.target.closest ? event.target.closest('#btnCheck') : null;
    if (!check) return;

    if (sessionStorage.getItem(DONE_KEY) === '1' || sessionStorage.getItem('paronymes_score') !== null) {
      event.preventDefault();
      event.stopImmediatePropagation();
      finishValidation();
      return;
    }

    if (!hasSelection()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.alert('Commencez l’exercice avant de le vérifier. Si vous ne souhaitez pas le réaliser, utilisez « Abandonner l’exercice ».');
      return;
    }

    // Laisse le gestionnaire d'origine calculer/enregistrer le score, puis verrouille.
    setTimeout(function(){ finishValidation(); }, 0);
  }, true);

  document.addEventListener('DOMContentLoaded', function(){
    const next = ensureNext();
    if (sessionStorage.getItem(DONE_KEY) === '1' || sessionStorage.getItem('paronymes_score') !== null) {
      finishValidation();
    } else if (next) {
      next.style.setProperty('display', 'none', 'important');
      next.setAttribute('aria-hidden', 'true');
      next.tabIndex = -1;
    }
  }, { once:true });
})();
</script>
`;
  const index = html.toLowerCase().lastIndexOf('</body>');
  if (index < 0) fail('balise </body> introuvable', 3);
  html = html.slice(0, index) + patch + html.slice(index);
}

for (const required of [
  'seb-paronymes-lock101',
  'btnNextParonymes',
  "sessionStorage.setItem(ACTIVITY_KEY, '1')",
  "check.style.setProperty('display', 'none', 'important')",
  "cell.style.pointerEvents = 'none'"
]) {
  if (!html.includes(required)) fail(`contrôle final absent: ${required}`, 4);
}

fs.writeFileSync(file, html, 'utf8');
console.log('SEB EvalPro #101: Paronymes vérifiable une seule fois, réponses figées et bouton Suivant garanti après vérification.');
