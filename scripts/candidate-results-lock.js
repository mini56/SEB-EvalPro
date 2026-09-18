const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'app', 'web', 'qcmv1.0.html');

if (!fs.existsSync(target)) {
  console.error('SEB EvalPro: qcmv1.0.html généré introuvable pour verrouiller la page de résultats candidat.');
  process.exit(2);
}

let html = fs.readFileSync(target, 'utf8');

// À la fin du parcours, le candidat doit uniquement pouvoir consulter ses résultats.
// Les actions Impression / PDF / Bilan / Accueil restent réservées à l'environnement administrateur.
const finalActions = /(<div\s+id=["']pageFinale["'][^>]*>[\s\S]*?<div\s+id=["']resultat["'][^>]*><\/div>)\s*<div\s+style=["']margin-top:\s*12px;["']>\s*(?:<button\b[\s\S]*?<\/button>\s*)*<\/div>/i;

if (!finalActions.test(html)) {
  console.error('SEB EvalPro: bloc d’actions de la page de résultats candidat introuvable.');
  process.exit(3);
}

html = html.replace(finalActions, '$1');

const finalStart = html.search(/<div\s+id=["']pageFinale["']/i);
const nextPageStart = finalStart >= 0 ? html.indexOf('<!--', finalStart + 1) : -1;
const finalSlice = finalStart >= 0
  ? html.slice(finalStart, nextPageStart > finalStart ? nextPageStart : finalStart + 5000)
  : '';

const forbidden = [
  'window.print()',
  'savePDF()',
  "nextPage('bilanPage')",
  'goHome()'
];

for (const marker of forbidden) {
  if (finalSlice.includes(marker)) {
    console.error(`SEB EvalPro: action candidat encore présente sur la page finale : ${marker}`);
    process.exit(4);
  }
}

const adminOnlyMarker = 'seb-candidate-results-admin-only';
if (!html.includes(`id="${adminOnlyMarker}"`)) {
  const bodyEnd = html.toLowerCase().lastIndexOf('</body>');
  if (bodyEnd < 0) {
    console.error('SEB EvalPro: balise </body> introuvable pour protéger les résultats candidat.');
    process.exit(5);
  }
  const guard = `
<script id="${adminOnlyMarker}">
(function(){
  'use strict';
  function isAdminUnlocked(){
    const button = document.getElementById('seb-evalpro-admin');
    return !!(button && /^verrouiller$/i.test(String(button.textContent || '').trim()));
  }
  function applyFinalAccess(){
    const page = document.getElementById('pageFinale');
    const result = document.getElementById('resultat');
    if (!page || !result) return;
    const heading = page.querySelector('h2');
    let endMessage = document.getElementById('seb-candidate-end-message');
    if (!endMessage) {
      endMessage = document.createElement('div');
      endMessage.id = 'seb-candidate-end-message';
      endMessage.style.cssText = 'max-width:760px;margin:35px auto;padding:28px;border:1px solid #9cc2e5;border-radius:8px;background:#f7fbff;text-align:center;font-size:20px;line-height:1.5;color:#1f4e79;';
      endMessage.innerHTML = '<strong>Votre évaluation est terminée.</strong><br><span style="font-size:16px;color:#444">Merci. Vous pouvez maintenant prévenir l’administrateur.</span>';
      result.insertAdjacentElement('beforebegin', endMessage);
    }
    const admin = isAdminUnlocked();
    result.hidden = !admin;
    result.style.display = admin ? '' : 'none';
    endMessage.hidden = admin;
    if (heading) heading.textContent = admin ? 'Résultats du test' : 'Fin de l’évaluation';
  }
  function attachAdminObserver(){
    const button = document.getElementById('seb-evalpro-admin');
    if (!button || button.dataset.sebResultAccessWatch === '1') return false;
    button.dataset.sebResultAccessWatch = '1';
    new MutationObserver(applyFinalAccess).observe(button, { childList:true, characterData:true, subtree:true });
    button.addEventListener('click', () => setTimeout(applyFinalAccess, 80));
    return true;
  }
  document.addEventListener('DOMContentLoaded', () => {
    applyFinalAccess();
    if (!attachAdminObserver()) {
      let tries = 0;
      const timer = setInterval(() => {
        tries += 1;
        applyFinalAccess();
        if (attachAdminObserver() || tries >= 30) clearInterval(timer);
      }, 150);
    }
  }, { once:true });
  window.addEventListener('pageshow', applyFinalAccess);
})();
</script>
`;
  html = html.slice(0, bodyEnd) + guard + '\n' + html.slice(bodyEnd);
}

for (const required of ['seb-candidate-results-admin-only', 'Fin de l’évaluation', 'Résultats du test', 'isAdminUnlocked']) {
  if (!html.includes(required)) {
    console.error('SEB EvalPro: protection résultats Admin absente : ' + required);
    process.exit(6);
  }
}

fs.writeFileSync(target, html, 'utf8');
console.log('SEB EvalPro: parcours stagiaire arrêté sur la page de fin; résultats conservés mais visibles uniquement en mode Admin.');
