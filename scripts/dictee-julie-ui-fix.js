const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'app', 'web', 'dictee.html');
const marker = 'seb-dictee-fixed-audio-ui-112';

function fail(message) {
  console.error(`SEB EvalPro dictée final/UI: ${message}`);
  process.exit(2);
}

if (!fs.existsSync(target)) fail('dictee.html généré introuvable');

let html = fs.readFileSync(target, 'utf8');
if (!/<\/body>/i.test(html)) fail('balise </body> introuvable');

const newInstruction = 'Relisez votre texte avant de cliquer sur « Dictée terminée ». Votre réponse sera alors verrouillée et ne pourra plus être modifiée. Cliquez ensuite sur « Suivant » pour poursuivre l’évaluation.';

// Corriger aussi la consigne directement dans le HTML généré quand elle est
// présente sous forme de texte continu. Le runtime ci-dessous sert de garde
// supplémentaire si le texte est fragmenté par des balises.
html = html.replace(
  /Relisez votre texte avant de cliquer sur\s*(?:«|&laquo;)?\s*Vérifier\s*(?:»|&raquo;)?\.?/giu,
  newInstruction
);

const runtime = String.raw`
<script id="${marker}">
(() => {
  'use strict';

  function norm(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function allButtons() {
    return Array.from(document.querySelectorAll('button'));
  }

  function findButton(test) {
    return allButtons().find(button => test(norm(button.textContent), button)) || null;
  }

  function findActionButtons() {
    const unifiedAbandon = document.getElementById('seb-evalpro-abandon-fixed');
    return {
      abandon: unifiedAbandon || findButton(text => text === 'abandonner' || text.startsWith('abandonner ')),
      verify: findButton(text => text === 'verifier' || text.startsWith('verifier ') || text.includes(' verifier')),
      next: findButton(text => text === 'suivant' || text.startsWith('suivant ')),
      play: findButton(text => text === 'lecture' || text.startsWith('lecture ') || text === 'lire' || text.startsWith('lire ') || text.includes('ecouter')),
      restart: findButton(text => text.includes('recommencer') || text.includes('recommence'))
    };
  }

  function candidatePanelFrom(element) {
    if (!element) return null;
    const width = window.innerWidth || document.documentElement.clientWidth || 1366;
    let node = element.parentElement;
    while (node && node !== document.body) {
      const rect = node.getBoundingClientRect();
      if (rect.width >= 220 && rect.width <= width * 0.60 && rect.left < width * 0.48 && rect.height >= 120) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function findLeftPanel(actions) {
    const explicit = document.querySelector('.left, #left, .left-panel, .leftPanel, .sidebar, .consignes, .instructions');
    if (explicit) return explicit;

    const audio = document.querySelector('audio');
    const fromAudio = candidatePanelFrom(audio);
    if (fromAudio) return fromAudio;

    const fromPlay = candidatePanelFrom(actions.play);
    if (fromPlay) return fromPlay;

    const heading = Array.from(document.querySelectorAll('h1,h2,h3,h4,strong,p,div')).find(el =>
      norm(el.textContent).includes('ecouter la dictee')
    );
    return candidatePanelFrom(heading);
  }

  function moveValidationButtonsLeft() {
    const actions = findActionButtons();
    const left = findLeftPanel(actions);
    if (!left || !actions.verify || !actions.next) return false;

    let box = document.getElementById('seb-dictee-left-actions');
    if (!box) {
      box = document.createElement('div');
      box.id = 'seb-dictee-left-actions';
      box.style.cssText = [
        'display:flex',
        'flex-wrap:wrap',
        'gap:10px',
        'align-items:center',
        'margin-top:18px',
        'padding-top:12px',
        'border-top:1px solid rgba(73,80,171,.25)'
      ].join(';');
      left.appendChild(box);
    }

    box.appendChild(actions.verify);
    box.appendChild(actions.next);
    return true;
  }

  function removeObsoleteSpeedNotice() {
    const candidates = Array.from(document.querySelectorAll('p,div,section,aside,span')).filter(element => {
      const text = norm(element.textContent);
      return text.includes('le debit est fixe a la vitesse normale 1,00')
        && text.includes("il n'est pas possible d'accelerer l'enregistrement");
    });
    if (!candidates.length) return false;

    candidates.sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);
    let target = candidates[0];
    const noticeText = norm(target.textContent);

    // Remonter jusqu'au conteneur qui ne contient QUE cette note afin de
    // supprimer aussi son fond bleu et l'espace qu'il occupait.
    while (target.parentElement && target.parentElement !== document.body) {
      const parent = target.parentElement;
      if (norm(parent.textContent) !== noticeText) break;
      target = parent;
    }
    target.remove();
    return true;
  }

  function updateInstructionText() {
    const replacement = 'Relisez votre texte avant de cliquer sur « Dictée terminée ». Votre réponse sera alors verrouillée et ne pourra plus être modifiée. Cliquez ensuite sur « Suivant » pour poursuivre l’évaluation.';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);

    for (const textNode of nodes) {
      const raw = String(textNode.nodeValue || '');
      if (!norm(raw).includes('relisez votre texte avant de cliquer sur verifier')) continue;
      textNode.nodeValue = raw.replace(
        /Relisez votre texte avant de cliquer sur\s*(?:«)?\s*Vérifier\s*(?:»)?\.?/giu,
        replacement
      );
    }
  }

  function configureFixedAudio() {
    const audio = document.querySelector('audio');
    if (!audio) return false;

    const expected = 'dictee-reclamation-client.wav';
    let sourceChanged = false;
    const sources = Array.from(audio.querySelectorAll('source'));
    for (const source of sources) {
      if (source.getAttribute('src') !== expected) {
        source.setAttribute('src', expected);
        sourceChanged = true;
      }
    }
    if (audio.getAttribute('src') !== expected) {
      audio.setAttribute('src', expected);
      sourceChanged = true;
    }
    audio.defaultPlaybackRate = 1;
    audio.playbackRate = 1;
    audio.preload = 'auto';
    if (sourceChanged) {
      try { audio.load(); } catch (_) {}
    }

    const actions = findActionButtons();
    const ensurePlay = () => {
      if (!audio.paused) return;
      const promise = audio.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(error => console.error('SEB EvalPro dictée: lecture WAV impossible', error));
      }
    };

    // Ne bloque pas les gestionnaires historiques : ils continuent à compter les écoutes
    // et à gérer Pause/Stop. Ce filet garantit simplement que Lecture/Recommencer lancent
    // bien le WAV embarqué si le navigateur intégré n'a pas démarré l'audio tout seul.
    if (actions.play && !actions.play.dataset.sebFixedAudio) {
      actions.play.dataset.sebFixedAudio = '1';
      actions.play.addEventListener('click', () => {
        audio.defaultPlaybackRate = 1;
        audio.playbackRate = 1;
        ensurePlay();
      });
    }
    if (actions.restart && !actions.restart.dataset.sebFixedAudio) {
      actions.restart.dataset.sebFixedAudio = '1';
      actions.restart.addEventListener('click', () => {
        try { audio.currentTime = 0; } catch (_) {}
        audio.defaultPlaybackRate = 1;
        audio.playbackRate = 1;
        ensurePlay();
      });
    }

    return true;
  }

  function alignPrivacyButtonWithAbandon() {
    const toggle = document.getElementById('seb-evalpro-privacy-toggle');
    const abandon = findActionButtons().abandon;
    if (!toggle || !abandon) return false;

    const rect = abandon.getBoundingClientRect();
    toggle.style.setProperty('left', 'auto', 'important');
    toggle.style.setProperty('right', '18px', 'important');
    toggle.style.setProperty('top', Math.max(0, Math.round(rect.top)) + 'px', 'important');
    toggle.style.setProperty('bottom', 'auto', 'important');
    return true;
  }

  function refreshLayout() {
    removeObsoleteSpeedNotice();
    updateInstructionText();
    moveValidationButtonsLeft();
    configureFixedAudio();
    alignPrivacyButtonWithAbandon();
  }

  function init() {
    refreshLayout();
    setTimeout(refreshLayout, 100);
    setTimeout(refreshLayout, 500);

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(refreshLayout);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    window.addEventListener('resize', alignPrivacyButtonWithAbandon);
    window.addEventListener('scroll', alignPrivacyButtonWithAbandon, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
</script>`;

const abandonLoader = html.includes('id="seb-ui-runtime-loader"')
  ? ''
  : '\n<script id="seb-ui-runtime-loader" src="js/seb-ui-runtime.js"></script>';
html = html.replace(/<\/body>/i, `${runtime}${abandonLoader}\n</body>`);
fs.writeFileSync(target, html, 'utf8');

if (!html.includes(marker)) fail('correctif final UI absent');
if (!html.includes('dictee-reclamation-client.wav')) fail('WAV fixe absent de dictee.html');
if (html.includes('SpeechSynthesisUtterance') || html.includes('speechSynthesis')) fail('dépendance synthèse vocale encore présente dans la dictée');
if (!html.includes('seb-dictee-left-actions')) fail('déplacement Vérifier/Suivant absent');
if (!html.includes('alignPrivacyButtonWithAbandon')) fail('alignement écran accueil/Abandonner absent');
if (!html.includes("document.getElementById('seb-evalpro-abandon-fixed')")) fail('priorité au bouton Abandon unifié absente');
if (!html.includes('id="seb-ui-runtime-loader"') || !html.includes('src="js/seb-ui-runtime.js"')) fail('mécanisme d’abandon unifié non chargé dans la Dictée');

console.log('SEB EvalPro dictée: WAV fixe utilisé; encadré vitesse supprimé; consigne Dictée terminée/Suivant corrigée; écran d’accueil aligné avec Abandonner.');
