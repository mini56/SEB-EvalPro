const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'app', 'web', 'tri_de_cheville.html');

function fail(message, code = 2) {
  console.error(`SEB EvalPro tri boutons: ${message}`);
  process.exit(code);
}

if (!fs.existsSync(file)) fail('page tri_de_cheville.html introuvable');
let html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

if (!html.includes('id="seb-tri-chrono-button-state107"')) {
  const patch = `
<script id="seb-tri-chrono-button-state107">
(function(){
  'use strict';
  const LIVE_KEY = 'seb_evalpro_tri_live_chrono';

  function isRunning(){
    try { return typeof chronoInterval !== 'undefined' && chronoInterval !== null; }
    catch (_) { return false; }
  }

  function isFinished(){
    const validate = document.getElementById('resetBtn');
    return !!(validate && /5\\s+tris\\s+validés/i.test(validate.textContent || ''));
  }

  function refreshPassiveState(){
    const start = document.getElementById('startBtn');
    const stop = document.getElementById('stopBtn');
    if (!start || !stop) return;

    if (isFinished()) {
      start.disabled = true;
      stop.disabled = true;
      return;
    }

    if (isRunning()) {
      start.disabled = true;
      stop.disabled = false;
      return;
    }

    // Hors chronométrage, Stop ne doit jamais sembler actif alors qu'il ne fait rien.
    stop.disabled = true;

    // Après une reprise d'application en plein tri, le chrono sauvegardé est restauré
    // mais n'est pas relancé automatiquement : Démarrer doit donc permettre de reprendre.
    const savedSeconds = Number(sessionStorage.getItem(LIVE_KEY) || '0');
    if (Number.isFinite(savedSeconds) && savedSeconds > 0) start.disabled = false;
  }

  document.addEventListener('DOMContentLoaded', function(){
    const start = document.getElementById('startBtn');
    const stop = document.getElementById('stopBtn');
    const validate = document.getElementById('resetBtn');

    refreshPassiveState();

    if (start) {
      start.addEventListener('click', function(){
        setTimeout(function(){
          if (!isRunning()) return;
          start.disabled = true;
          if (stop) stop.disabled = false;
        }, 0);
      });
    }

    if (stop) {
      stop.addEventListener('click', function(){
        setTimeout(function(){
          if (isRunning()) return;
          stop.disabled = true;
          if (start && !isFinished()) start.disabled = false;
        }, 0);
      });
    }

    // « Valider le tri » arrête aussi le chrono par code. On laisse d'abord la logique
    // existante décider si le prochain Démarrer doit être bloqué par une erreur manquante,
    // puis on corrige uniquement l'état passif de Stop.
    if (validate) validate.addEventListener('click', function(){ setTimeout(refreshPassiveState, 0); });

    setTimeout(refreshPassiveState, 0);
  }, { once: true });
})();
</script>
`;

  const index = html.toLowerCase().lastIndexOf('</body>');
  if (index < 0) fail('balise </body> introuvable', 3);
  html = html.slice(0, index) + patch + html.slice(index);
}

if (!html.includes('id="seb-tri-chrono-button-state107"')) fail('correctif état boutons non injecté', 4);
if (!html.includes('start.disabled = true;')) fail('désactivation Démarrer pendant chrono absente', 5);
if (!html.includes('stop.disabled = true;')) fail('désactivation Stop hors chrono absente', 6);
if (!html.includes('stop.disabled = false;')) fail('activation Stop pendant chrono absente', 7);

fs.writeFileSync(file, html, 'utf8');
console.log('SEB EvalPro tri boutons: Démarrer désactivé pendant le chrono, Stop désactivé hors chrono, reprise conservée.');
