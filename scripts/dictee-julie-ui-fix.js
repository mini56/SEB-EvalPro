const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'app', 'web', 'dictee.html');
const marker = 'seb-dictee-julie-ui-110';

function fail(message) {
  console.error(`SEB EvalPro dictée Julie/UI: ${message}`);
  process.exit(2);
}

if (!fs.existsSync(target)) fail('dictee.html généré introuvable');

let html = fs.readFileSync(target, 'utf8');
if (html.includes(`id="${marker}"`)) {
  console.log('SEB EvalPro dictée Julie/UI: correctif déjà présent.');
  process.exit(0);
}
if (!/<\/body>/i.test(html)) fail('balise </body> introuvable');

const runtime = String.raw`
<script id="${marker}">
(() => {
  'use strict';

  const PHRASES = [
    "Ce matin, un client a téléphoné au service commercial de l'entreprise.",
    "Il n'était pas content de sa dernière livraison de fournitures.",
    "En effet, plusieurs cartons étaient endommagés à l'arrivée.",
    "De plus, certains articles manquaient dans le colis.",
    "Le client a demandé un remboursement rapide ou un nouvel envoi complet.",
    "La secrétaire a noté sa réclamation avec précision.",
    "Elle lui a promis une réponse avant la fin de la semaine.",
    "Le responsable du magasin doit vérifier le stock disponible dès demain."
  ];
  const RATE = 0.80;
  const GAP_MS = 1000;

  let julie = null;
  let phraseIndex = 0;
  let stopped = true;
  let paused = false;
  let waitingGap = false;
  let gapTimer = null;

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
    return allButtons().find(btn => test(norm(btn.textContent), btn)) || null;
  }

  function moveValidationButtonsLeft() {
    const left = document.querySelector('.left');
    if (!left) return false;

    const verify = findButton(text =>
      text === 'verifier' || text.startsWith('verifier ') || text.includes(' verifier')
    );
    const next = findButton(text =>
      text === 'suivant' || text.startsWith('suivant ')
    );

    if (!verify || !next) return false;

    let box = document.getElementById('seb-dictee-left-actions');
    if (!box) {
      box = document.createElement('div');
      box.id = 'seb-dictee-left-actions';
      box.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:22px;padding-top:12px;border-top:1px solid rgba(73,80,171,.25);';
      left.appendChild(box);
    }
    box.appendChild(verify);
    box.appendChild(next);
    return true;
  }

  function findJulie() {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return null;
    const voices = speechSynthesis.getVoices();
    return (
      voices.find(v => /microsoft\s+julie/i.test(v.name) && /^fr(?:-|_)?fr/i.test(v.lang || '')) ||
      voices.find(v => /julie/i.test(v.name) && /^fr/i.test(v.lang || '')) ||
      null
    );
  }

  function audioElement() {
    return document.querySelector('audio');
  }

  function silencePackagedAudio() {
    const audio = audioElement();
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (_) {}
  }

  function clearGap() {
    if (gapTimer) {
      clearTimeout(gapTimer);
      gapTimer = null;
    }
    waitingGap = false;
  }

  function updatePauseButton() {
    const button = findButton(text => text.includes('pause') || text === 'reprendre' || text.includes('reprendre'));
    if (!button) return;
    button.textContent = paused ? '▶ Reprendre' : '⏸ Pause';
  }

  function speakCurrent() {
    if (!julie || stopped || paused) return;
    if (phraseIndex >= PHRASES.length) {
      stopped = true;
      paused = false;
      updatePauseButton();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(PHRASES[phraseIndex]);
    utterance.voice = julie;
    utterance.lang = 'fr-FR';
    utterance.rate = RATE;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => {
      if (stopped) return;
      phraseIndex += 1;
      if (phraseIndex >= PHRASES.length) {
        stopped = true;
        paused = false;
        updatePauseButton();
        return;
      }
      waitingGap = true;
      gapTimer = setTimeout(() => {
        gapTimer = null;
        waitingGap = false;
        if (!stopped && !paused) speakCurrent();
      }, GAP_MS);
    };

    utterance.onerror = event => {
      if (event && (event.error === 'interrupted' || event.error === 'canceled')) return;
      console.error('SEB EvalPro dictée Julie: erreur de synthèse vocale', event && event.error);
    };

    speechSynthesis.speak(utterance);
  }

  function startFromBeginning() {
    if (!julie) return;
    speechSynthesis.cancel();
    silencePackagedAudio();
    clearGap();
    phraseIndex = 0;
    stopped = false;
    paused = false;
    updatePauseButton();
    setTimeout(speakCurrent, 60);
  }

  function pauseOrResume() {
    if (!julie || stopped) return;

    if (!paused) {
      paused = true;
      if (speechSynthesis.speaking && !speechSynthesis.paused) {
        speechSynthesis.pause();
      } else if (waitingGap) {
        clearGap();
        waitingGap = true;
      }
    } else {
      paused = false;
      if (speechSynthesis.paused) {
        speechSynthesis.resume();
      } else if (waitingGap) {
        gapTimer = setTimeout(() => {
          gapTimer = null;
          waitingGap = false;
          if (!stopped && !paused) speakCurrent();
        }, GAP_MS);
      } else {
        speakCurrent();
      }
    }
    updatePauseButton();
  }

  function stopJulie() {
    if (!julie) return;
    stopped = true;
    paused = false;
    phraseIndex = 0;
    clearGap();
    speechSynthesis.cancel();
    silencePackagedAudio();
    updatePauseButton();
  }

  function classifyAudioButton(button) {
    const text = norm(button.textContent);
    if (text.includes('recommencer') || text.includes('recommence')) return 'restart';
    if (text.includes('pause') || text === 'reprendre' || text.includes('reprendre')) return 'pause';
    if (text === 'stop' || text.includes('arreter')) return 'stop';
    if (text === 'lire' || text.startsWith('lire ') || text.includes('lecture') || text.includes('ecouter')) return 'play';
    return '';
  }

  function installJulieControlInterception() {
    document.addEventListener('click', event => {
      if (!julie) return;
      const button = event.target && event.target.closest ? event.target.closest('button') : null;
      if (!button) return;

      const action = classifyAudioButton(button);
      if (!action) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      if (action === 'play') {
        if (stopped || phraseIndex >= PHRASES.length) startFromBeginning();
        else if (paused) pauseOrResume();
      } else if (action === 'pause') {
        pauseOrResume();
      } else if (action === 'stop') {
        stopJulie();
      } else if (action === 'restart') {
        startFromBeginning();
      }
    }, true);
  }

  function activateJulieIfAvailable() {
    const found = findJulie();
    if (!found) return false;
    julie = found;
    silencePackagedAudio();
    return true;
  }

  function init() {
    if (!moveValidationButtonsLeft()) {
      console.error('SEB EvalPro dictée UI: boutons Vérifier/Suivant ou colonne gauche introuvables.');
    }

    installJulieControlInterception();

    if (activateJulieIfAvailable()) {
      console.log('SEB EvalPro dictée: Microsoft Julie active, vitesse 0,80, pause 1 s.');
    } else {
      console.warn('SEB EvalPro dictée: Microsoft Julie indisponible; audio embarqué conservé en secours.');
    }

    if ('speechSynthesis' in window) {
      const previous = speechSynthesis.onvoiceschanged;
      speechSynthesis.onvoiceschanged = event => {
        if (typeof previous === 'function') {
          try { previous.call(speechSynthesis, event); } catch (_) {}
        }
        if (!julie && activateJulieIfAvailable()) {
          console.log('SEB EvalPro dictée: Microsoft Julie détectée après chargement des voix.');
        }
      };
      setTimeout(() => { if (!julie) activateJulieIfAvailable(); }, 400);
      setTimeout(() => { if (!julie) activateJulieIfAvailable(); }, 1200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
</script>`;

html = html.replace(/<\/body>/i, `${runtime}\n</body>`);
fs.writeFileSync(target, html, 'utf8');

const verifyGuard = html.includes('seb-dictee-left-actions') &&
                    html.includes('const RATE = 0.80') &&
                    html.includes('const GAP_MS = 1000') &&
                    html.includes('microsoft\\s+julie');

if (!verifyGuard) fail('contrôle final Julie/UI incomplet');

console.log('SEB EvalPro dictée: Julie 0,80 + pause 1 s intégrées; Vérifier/Suivant déplacés dans la colonne gauche.');
