(function () {
  'use strict';

  const STORAGE_KEY = 'dictee_data';
  const AUDIO_FILE = 'dictee-reclamation-client.wav';
  const REFERENCE = "Ce matin, un client a téléphoné au service commercial de l'entreprise. Il n'était pas content de sa dernière livraison de fournitures. En effet, plusieurs cartons étaient endommagés à l'arrivée. De plus, certains articles manquaient dans le colis. Le client a demandé un remboursement rapide ou un nouvel envoi complet. La secrétaire a noté sa réclamation avec précision. Elle lui a promis une réponse avant la fin de la semaine. Le responsable du magasin doit vérifier le stock disponible dès demain.";
  const TOTAL_WORDS = 80;

  let state = defaultState();
  let wasAtStart = true;

  function defaultState() {
    return {
      status:'draft',
      texte:'',
      scoreSur20:null,
      motsCorrects:0,
      motsTotal:TOTAL_WORDS,
      substitutions:0,
      omissions:0,
      ajouts:0,
      deplacements:0,
      erreursNotees:0,
      erreursPonctuation:0,
      erreursMajuscules:0,
      ecoutes:0,
      audioPosition:0,
      alignment:[],
      alignmentOriginal:[],
      classificationVersion:null,
      updatedAt:null
    };
  }

  function elements() {
    return {
      audio:document.getElementById('dicteeAudio'),
      playBtn:document.getElementById('playBtn'),
      pauseBtn:document.getElementById('pauseBtn'),
      stopBtn:document.getElementById('stopBtn'),
      restartBtn:document.getElementById('restartBtn'),
      progress:document.getElementById('progress'),
      audioTime:document.getElementById('audioTime'),
      listenCount:document.getElementById('listenCount'),
      status:document.getElementById('status'),
      textArea:document.getElementById('candidateText'),
      wordCount:document.getElementById('wordCount'),
      feedback:document.getElementById('feedback'),
      verifyBtn:document.getElementById('verifyBtn'),
      nextBtn:document.getElementById('nextBtn'),
      abandonBtn:document.getElementById('abandonBtn')
    };
  }

  function persistCandidate() {
    try {
      if (window.sebEvalPro?.save) window.sebEvalPro.save();
    } catch (_) {}
  }

  function parseStoredState() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
      return saved && typeof saved === 'object' ? saved : null;
    } catch (_) {
      return null;
    }
  }

  function terminal(status) {
    return status === 'verified' || status === 'abandoned';
  }

  function loadState() {
    state = Object.assign(defaultState(), parseStoredState() || {});
    state.motsTotal = TOTAL_WORDS;
    if (state.status === 'verified') normalizeVerifiedState();
    return state;
  }

  function syncExternalTerminalState() {
    const external = parseStoredState();
    if (external && terminal(external.status) && !terminal(state.status)) {
      state = Object.assign(state, external);
    }
    return state;
  }

  function saveState() {
    const ui = elements();
    syncExternalTerminalState();
    if (ui.textArea) state.texte = ui.textArea.value;
    if (ui.audio && Number.isFinite(ui.audio.currentTime)) state.audioPosition = ui.audio.currentTime;
    state.motsTotal = TOTAL_WORDS;
    state.updatedAt = new Date().toISOString();
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
    persistCandidate();
    return state;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char];
    });
  }

  function formatTime(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    return String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
  }

  function tokens(text) {
    const source = String(text == null ? '' : text).normalize('NFC');
    const out = [];
    const regex = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*(?:\s*[.,;:!?…]+)?/gu;
    let match;
    while ((match = regex.exec(source))) out.push(match[0].replace(/\s+([.,;:!?…]+)$/u, '$1'));
    return out;
  }

  function align(referenceTokens, userTokens) {
    function core(token) {
      return String(token || '')
        .normalize('NFC')
        .replace(/\s*[.,;:!?…]+$/u, '')
        .replace(/’/g, "'")
        .toLowerCase();
    }

    function distance(leftValue, rightValue) {
      const left = Array.from(leftValue || '');
      const right = Array.from(rightValue || '');
      let previous = Array.from({ length:right.length + 1 }, (_, index) => index);
      for (let i = 1; i <= left.length; i += 1) {
        const current = new Array(right.length + 1);
        current[0] = i;
        for (let j = 1; j <= right.length; j += 1) {
          current[j] = Math.min(
            current[j - 1] + 1,
            previous[j] + 1,
            previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
          );
        }
        previous = current;
      }
      return previous[right.length];
    }

    const gap = 1.6;
    const n = referenceTokens.length;
    const m = userTokens.length;
    const dp = Array.from({ length:n + 1 }, () => new Array(m + 1).fill(0));
    const op = Array.from({ length:n + 1 }, () => new Array(m + 1).fill(null));

    for (let i = 1; i <= n; i += 1) {
      dp[i][0] = i * gap;
      op[i][0] = 'delete';
    }
    for (let j = 1; j <= m; j += 1) {
      dp[0][j] = j * gap;
      op[0][j] = 'insert';
    }

    for (let i = 1; i <= n; i += 1) {
      for (let j = 1; j <= m; j += 1) {
        const left = core(referenceTokens[i - 1]);
        const right = core(userTokens[j - 1]);
        const same = left === right;
        const ratio = same ? 0 : distance(left, right) / Math.max(left.length, right.length, 1);
        const substitution = same ? 0 : Math.min(1.5, 0.5 + ratio);
        const candidates = [
          { value:dp[i - 1][j - 1] + substitution, type:same ? 'match' : 'substitute', priority:0 },
          { value:dp[i - 1][j] + gap, type:'delete', priority:1 },
          { value:dp[i][j - 1] + gap, type:'insert', priority:2 }
        ].sort((a, b) => (a.value - b.value) || (a.priority - b.priority));
        dp[i][j] = candidates[0].value;
        op[i][j] = candidates[0].type;
      }
    }

    const out = [];
    let i = n;
    let j = m;
    while (i || j) {
      const type = op[i][j];
      if ((type === 'match' || type === 'substitute') && i && j) {
        out.push({ type, expected:referenceTokens[i - 1], actual:userTokens[j - 1] });
        i -= 1;
        j -= 1;
      } else if (type === 'delete' && i) {
        out.push({ type:'delete', expected:referenceTokens[i - 1], actual:'' });
        i -= 1;
      } else if (j) {
        out.push({ type:'insert', expected:'', actual:userTokens[j - 1] });
        j -= 1;
      } else {
        out.push({ type:'delete', expected:referenceTokens[i - 1], actual:'' });
        i -= 1;
      }
    }
    return out.reverse();
  }

  function classifyAlignmentV3(alignment) {
    function core(token) {
      return String(token || '')
        .normalize('NFC')
        .replace(/\s*[.,;:!?…]+$/u, '')
        .replace(/’/g, "'")
        .toLowerCase();
    }

    function distance(leftValue, rightValue) {
      const left = Array.from(leftValue || '');
      const right = Array.from(rightValue || '');
      let previous = Array.from({ length:right.length + 1 }, (_, index) => index);
      for (let i = 1; i <= left.length; i += 1) {
        const current = new Array(right.length + 1);
        current[0] = i;
        for (let j = 1; j <= right.length; j += 1) {
          current[j] = Math.min(
            current[j - 1] + 1,
            previous[j] + 1,
            previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
          );
        }
        previous = current;
      }
      return previous[right.length];
    }

    const expected = [];
    const actual = [];
    const types = {};
    const assigned = new Map();

    alignment.forEach((item, index) => {
      types[index] = item.type;
      if (item.type === 'substitute' || item.type === 'delete') {
        expected.push({ index, token:item.expected, used:false });
      }
      if (item.type === 'substitute' || item.type === 'insert') {
        actual.push({ index, token:item.actual, used:false });
      }
    });

    const movedCandidates = [];
    actual.forEach((actualItem) => expected.forEach((expectedItem) => {
      const actualCore = core(actualItem.token);
      const expectedCore = core(expectedItem.token);
      const delta = Math.abs(actualItem.index - expectedItem.index);
      if (actualCore.length >= 4 && actualCore === expectedCore &&
          actualItem.index !== expectedItem.index && delta <= 16) {
        movedCandidates.push({ actualItem, expectedItem, delta });
      }
    }));

    movedCandidates
      .sort((left, right) =>
        (left.delta - right.delta) ||
        (left.actualItem.index - right.actualItem.index) ||
        (left.expectedItem.index - right.expectedItem.index)
      )
      .forEach(({ actualItem, expectedItem }) => {
        if (actualItem.used || expectedItem.used) return;
        actualItem.used = true;
        expectedItem.used = true;
        assigned.set(actualItem.index, { type:'moved', expected:expectedItem.token });
      });

    actual.forEach((actualItem) => {
      if (actualItem.used || types[actualItem.index] !== 'substitute') return;
      const expectedItem = expected.find((candidate) =>
        candidate.index === actualItem.index && !candidate.used
      );
      if (!expectedItem) return;
      actualItem.used = true;
      expectedItem.used = true;
      assigned.set(actualItem.index, { type:'substitute', expected:expectedItem.token });
    });

    actual.forEach((actualItem) => {
      if (actualItem.used) return;
      const actualCore = core(actualItem.token);
      const candidates = [];
      expected.forEach((expectedItem) => {
        if (expectedItem.used || Math.abs(expectedItem.index - actualItem.index) > 8) return;
        const expectedCore = core(expectedItem.token);
        const ratio = distance(actualCore, expectedCore) / Math.max(actualCore.length, expectedCore.length, 1);
        if (actualCore.length >= 3 && expectedCore.length >= 3 && ratio <= 0.35) {
          candidates.push({
            expectedItem,
            ratio,
            delta:Math.abs(expectedItem.index - actualItem.index)
          });
        }
      });
      candidates.sort((left, right) => (left.ratio - right.ratio) || (left.delta - right.delta));
      if (!candidates.length) return;
      actualItem.used = true;
      candidates[0].expectedItem.used = true;
      assigned.set(actualItem.index, {
        type:'substitute',
        expected:candidates[0].expectedItem.token
      });
    });

    actual.forEach((actualItem) => {
      if (actualItem.used) return;
      actualItem.used = true;
      assigned.set(actualItem.index, { type:'insert', expected:'' });
    });

    const missing = new Map(
      expected.filter((item) => !item.used).map((item) => [item.index, item.token])
    );
    const items = [];

    alignment.forEach((item, index) => {
      if (missing.has(index)) {
        items.push({ type:'delete', expected:missing.get(index), actual:'' });
      }
      if (item.type === 'match') {
        items.push({ type:'match', expected:item.expected, actual:item.actual });
        return;
      }
      if (!item.actual) return;
      const assignedItem = assigned.get(index) || { type:'insert', expected:'' };
      items.push({
        type:assignedItem.type,
        expected:assignedItem.expected || '',
        actual:item.actual
      });
    });

    return {
      items,
      substitutions:items.filter((item) => item.type === 'substitute').length,
      omissions:items.filter((item) => item.type === 'delete').length,
      additions:items.filter((item) => item.type === 'insert').length,
      moved:items.filter((item) => item.type === 'moved').length
    };
  }

  function evaluateText(text) {
    const referenceTokens = tokens(REFERENCE);
    const userTokens = tokens(text);
    const baseAlignment = align(referenceTokens, userTokens);
    let matches = 0;
    let substitutions = 0;
    let omissions = 0;
    let additions = 0;
    let punctuationErrors = 0;
    let capitalizationErrors = 0;

    const punctuation = (token) => {
      const match = String(token || '').trim().match(/([.,;:!?…]+)$/u);
      return match ? match[1] : '';
    };
    const capitalization = (token) =>
      String(token || '')
        .normalize('NFC')
        .replace(/\s*[.,;:!?…]+$/u, '')
        .replace(/’/g, "'");

    baseAlignment.forEach((item) => {
      if (item.type === 'match') {
        matches += 1;
        if (punctuation(item.expected) !== punctuation(item.actual)) punctuationErrors += 1;
        if (capitalization(item.expected) !== capitalization(item.actual)) capitalizationErrors += 1;
      } else if (item.type === 'substitute') {
        substitutions += 1;
        if (punctuation(item.expected) !== punctuation(item.actual)) punctuationErrors += 1;
      } else if (item.type === 'delete') {
        omissions += 1;
      } else if (item.type === 'insert') {
        additions += 1;
      }
    });

    const classified = classifyAlignmentV3(baseAlignment);
    return {
      texte:String(text == null ? '' : text),
      motsCorrects:matches,
      motsTotal:TOTAL_WORDS,
      substitutions:classified.substitutions,
      omissions:classified.omissions,
      ajouts:classified.additions,
      deplacements:classified.moved,
      erreursNotees:Math.max(0, TOTAL_WORDS - matches),
      erreursPonctuation:punctuationErrors,
      erreursMajuscules:capitalizationErrors,
      scoreSur20:Math.round(matches * 25) / 100,
      alignmentOriginal:baseAlignment,
      alignment:classified.items,
      classificationVersion:3
    };
  }

  function normalizeVerifiedState() {
    if (state.status !== 'verified') return state;
    if (state.classificationVersion === 3 && Array.isArray(state.alignment) && state.alignment.length) {
      return state;
    }

    const base = Array.isArray(state.alignmentOriginal) && state.alignmentOriginal.length
      ? state.alignmentOriginal
      : (Array.isArray(state.alignment) ? state.alignment : []);

    if (base.length) {
      const classified = classifyAlignmentV3(base);
      if (!Array.isArray(state.alignmentOriginal) || !state.alignmentOriginal.length) {
        state.alignmentOriginal = base;
      }
      state.alignment = classified.items;
      state.substitutions = classified.substitutions;
      state.omissions = classified.omissions;
      state.ajouts = classified.additions;
      state.deplacements = classified.moved;
      state.classificationVersion = 3;
    }
    return state;
  }

  function renderCorrection() {
    const ui = elements();
    if (!ui.feedback || !Array.isArray(state.alignment) || !state.alignment.length) return false;

    const parts = state.alignment.map((item) => {
      if (item.type === 'match') {
        return '<span class="word-ok">' + escapeHtml(item.actual) + '</span>';
      }
      if (item.type === 'moved') {
        return '<span style="color:#1565c0;font-weight:700;text-decoration:underline;" title="Mot déplacé — attendu : ' +
          escapeHtml(item.expected) + '">' + escapeHtml(item.actual) + '</span>';
      }
      if (item.type === 'substitute') {
        return '<span class="word-wrong" title="Attendu : ' + escapeHtml(item.expected) + '">' +
          escapeHtml(item.actual || '…') + '</span>';
      }
      if (item.type === 'insert') {
        return '<span class="word-added" title="Mot ajouté">' + escapeHtml(item.actual) + '</span>';
      }
      return '<span class="word-missing" title="Mot oublié">[' + escapeHtml(item.expected) + ']</span>';
    });

    ui.feedback.innerHTML =
      '<div class="feedback-title">Correction</div>' +
      '<div style="line-height:1.7">' + parts.join(' ') + '</div>' +
      '<div class="legend"><span class="word-ok">Vert : correct</span> · ' +
      '<span class="word-wrong">Rouge : mot incorrect</span> · ' +
      '<span class="word-missing">Orange : mot oublié</span> · ' +
      '<span style="color:#1565c0;font-weight:700;">Bleu : mot déplacé</span> · ' +
      '<span class="word-added">Violet : mot ajouté</span></div>' +
      '<div class="scoreline">Score : ' + state.scoreSur20 + '/20 — ' +
      state.motsCorrects + '/' + (state.motsTotal || TOTAL_WORDS) +
      ' mots correctement alignés — ' + state.substitutions +
      ' mot(s) incorrect(s), ' + state.omissions +
      ' omission(s), ' + state.ajouts +
      ' ajout(s), ' + (state.deplacements || 0) + ' déplacement(s).</div>' +
      '<div class="legend">Indicateurs non déduits séparément : ' +
      (state.erreursPonctuation || 0) + ' erreur(s) de ponctuation, ' +
      (state.erreursMajuscules || 0) + ' erreur(s) de majuscule.</div>';
    ui.feedback.classList.add('visible');
    return true;
  }

  function countWords() {
    const ui = elements();
    if (ui.wordCount && ui.textArea) ui.wordCount.textContent = tokens(ui.textArea.value).length;
  }

  function updateAudioUi() {
    const ui = elements();
    if (!ui.audio) return;
    ui.audio.playbackRate = 1;
    ui.audio.defaultPlaybackRate = 1;
    const duration = Number.isFinite(ui.audio.duration) ? ui.audio.duration : 0;
    const current = Number.isFinite(ui.audio.currentTime) ? ui.audio.currentTime : 0;
    if (ui.progress) ui.progress.value = duration > 0 ? Math.round((current / duration) * 1000) : 0;
    if (ui.audioTime) ui.audioTime.textContent = formatTime(current) + ' / ' + formatTime(duration);
    state.audioPosition = current;
  }

  function configureFixedAudio() {
    const ui = elements();
    if (!ui.audio) return false;

    let sourceChanged = false;
    Array.from(ui.audio.querySelectorAll('source')).forEach((source) => {
      if (source.getAttribute('src') !== AUDIO_FILE) {
        source.setAttribute('src', AUDIO_FILE);
        sourceChanged = true;
      }
    });
    if (ui.audio.getAttribute('src') !== AUDIO_FILE) {
      ui.audio.setAttribute('src', AUDIO_FILE);
      sourceChanged = true;
    }
    ui.audio.defaultPlaybackRate = 1;
    ui.audio.playbackRate = 1;
    ui.audio.preload = 'auto';
    if (sourceChanged) {
      try { ui.audio.load(); } catch (_) {}
    }
    return true;
  }

  function startPlayback(fromBeginning) {
    const ui = elements();
    if (!ui.audio || state.status !== 'draft') return false;
    ui.audio.playbackRate = 1;
    if (fromBeginning) {
      try { ui.audio.currentTime = 0; } catch (_) {}
      wasAtStart = true;
    }
    const startingAtBeginning = ui.audio.currentTime < 0.35;
    const playback = ui.audio.play();
    if (playback && typeof playback.then === 'function') {
      playback.then(() => {
        if (startingAtBeginning && wasAtStart) {
          state.ecoutes = (Number(state.ecoutes) || 0) + 1;
          if (ui.listenCount) ui.listenCount.textContent = state.ecoutes;
          wasAtStart = false;
        }
        if (ui.status) ui.status.textContent = 'Lecture en cours…';
        saveState();
      }).catch(() => {
        if (ui.status) ui.status.textContent = "Impossible de démarrer l'audio. Vérifiez la sortie son de l'ordinateur.";
      });
    }
    return true;
  }

  function lockVerified() {
    if (state.status !== 'verified') return false;
    const ui = elements();
    if (ui.textArea) ui.textArea.disabled = true;
    for (const control of [ui.verifyBtn, ui.playBtn, ui.pauseBtn, ui.stopBtn, ui.restartBtn, ui.progress]) {
      if (control) control.disabled = true;
    }
    if (ui.nextBtn) ui.nextBtn.disabled = false;
    try { ui.audio?.pause(); } catch (_) {}
    if (ui.status) ui.status.textContent = 'Dictée vérifiée. Le texte est verrouillé.';
    return true;
  }

  function readActionButton() {
    return document.getElementById('seb-dictee-action');
  }

  function ensureActionButton() {
    const ui = elements();
    let action = readActionButton();
    if (!action) {
      action = document.createElement('button');
      action.id = 'seb-dictee-action';
      action.type = 'button';
      if (ui.verifyBtn?.parentElement) ui.verifyBtn.insertAdjacentElement('beforebegin', action);
      else document.body.appendChild(action);
    }
    return action;
  }

  function setActionMode() {
    const action = ensureActionButton();
    const done = terminal(state.status);
    action.textContent = done ? 'Suivant' : 'Dictée terminée';
    action.dataset.mode = done ? 'next' : 'finish';
    action.disabled = false;
    if (state.status === 'verified') lockVerified();
    return action;
  }

  function verify() {
    const ui = elements();
    if (state.status !== 'draft') {
      setActionMode();
      return null;
    }
    if (!String(ui.textArea?.value || '').trim()) {
      window.alert('Saisissez le texte entendu avant de cliquer sur « Dictée terminée », ou utilisez « Abandonner l’exercice ».');
      try { ui.textArea?.focus(); } catch (_) {}
      return null;
    }

    try { ui.audio?.pause(); } catch (_) {}
    const result = evaluateText(ui.textArea.value);
    state = Object.assign(state, result, {
      status:'verified',
      texte:ui.textArea.value
    });
    saveState();
    renderCorrection();
    lockVerified();
    setActionMode();
    return Object.assign({}, result, { status:'verified' });
  }

  function goNext() {
    saveState();
    if (!window.sebParcours?.goNext) throw new Error('Registre de parcours indisponible.');
    window.sebParcours.goNext('dictee');
  }

  function handleAction() {
    if (terminal(state.status)) {
      goNext();
      return true;
    }
    const result = verify();
    return !!result;
  }

  function removeObsoleteSpeedNotice() {
    const normalized = (value) =>
      String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    const candidates = Array.from(document.querySelectorAll('p,div,section,aside,span')).filter((element) => {
      const text = normalized(element.textContent);
      return text.includes('le debit est fixe a la vitesse normale 1,00') &&
        text.includes("il n'est pas possible d'accelerer l'enregistrement");
    });
    if (!candidates.length) return false;

    candidates.sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);
    let target = candidates[0];
    const targetText = normalized(target.textContent);
    while (target.parentElement && target.parentElement !== document.body) {
      const parent = target.parentElement;
      if (normalized(parent.textContent) !== targetText) break;
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
    nodes.forEach((textNode) => {
      const raw = String(textNode.nodeValue || '');
      const normalized = raw
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      if (!normalized.includes('relisez votre texte avant de cliquer sur verifier')) return;
      textNode.nodeValue = raw.replace(
        /Relisez votre texte avant de cliquer sur\s*(?:«)?\s*Vérifier\s*(?:»)?\.?/giu,
        replacement
      );
    });
  }

  function alignPrivacyButtonWithAbandon() {
    const toggle = document.getElementById('seb-evalpro-privacy-toggle');
    const abandon = document.getElementById('seb-evalpro-abandon-fixed');
    if (!toggle || !abandon) return false;
    const rect = abandon.getBoundingClientRect();
    toggle.style.setProperty('left', 'auto', 'important');
    toggle.style.setProperty('right', '18px', 'important');
    toggle.style.setProperty('top', Math.max(0, Math.round(rect.top)) + 'px', 'important');
    toggle.style.setProperty('bottom', 'auto', 'important');
    return true;
  }

  function hideLegacyAbandon() {
    const ui = elements();
    if (!ui.abandonBtn) return;
    ui.abandonBtn.hidden = true;
    ui.abandonBtn.style.setProperty('display', 'none', 'important');
    ui.abandonBtn.setAttribute('aria-hidden', 'true');
    ui.abandonBtn.tabIndex = -1;
  }

  function installEvents() {
    const ui = elements();

    ui.audio?.addEventListener('loadedmetadata', function () {
      ui.audio.playbackRate = 1;
      ui.audio.defaultPlaybackRate = 1;
      if (state.status === 'draft' && Number(state.audioPosition) > 0 &&
          Number(state.audioPosition) < ui.audio.duration) {
        try { ui.audio.currentTime = Number(state.audioPosition); } catch (_) {}
        wasAtStart = false;
      }
      updateAudioUi();
    });

    ui.audio?.addEventListener('timeupdate', function () {
      updateAudioUi();
      if (Math.floor(ui.audio.currentTime) % 2 === 0) saveState();
    });

    ui.audio?.addEventListener('ratechange', function () {
      if (ui.audio.playbackRate !== 1) ui.audio.playbackRate = 1;
    });

    ui.audio?.addEventListener('ended', function () {
      wasAtStart = true;
      if (ui.status) ui.status.textContent = 'Lecture terminée.';
      updateAudioUi();
      saveState();
    });

    ui.audio?.addEventListener('pause', function () {
      if (!ui.audio.ended && ui.audio.currentTime > 0 && ui.status) {
        ui.status.textContent = 'Lecture en pause.';
      }
      saveState();
    });

    ui.playBtn?.addEventListener('click', function () { startPlayback(false); });
    ui.pauseBtn?.addEventListener('click', function () {
      if (state.status === 'draft') ui.audio?.pause();
    });
    ui.stopBtn?.addEventListener('click', function () {
      if (state.status !== 'draft') return;
      try {
        ui.audio?.pause();
        if (ui.audio) ui.audio.currentTime = 0;
      } catch (_) {}
      wasAtStart = true;
      updateAudioUi();
      if (ui.status) ui.status.textContent = 'Lecture arrêtée.';
      saveState();
    });
    ui.restartBtn?.addEventListener('click', function () { startPlayback(true); });

    ui.progress?.addEventListener('input', function () {
      if (state.status !== 'draft' || !Number.isFinite(ui.audio?.duration)) return;
      ui.audio.currentTime = (Number(ui.progress.value) / 1000) * ui.audio.duration;
      wasAtStart = ui.audio.currentTime < 0.35;
      updateAudioUi();
    });

    ui.textArea?.addEventListener('input', function () {
      countWords();
      saveState();
    });

    ui.verifyBtn?.addEventListener('click', verify);
    ui.nextBtn?.addEventListener('click', function () {
      if (state.status === 'verified') goNext();
    });

    ensureActionButton().addEventListener('click', handleAction);
    window.addEventListener('resize', alignPrivacyButtonWithAbandon);
    window.addEventListener('scroll', alignPrivacyButtonWithAbandon, true);
    window.addEventListener('beforeunload', function () {
      try { ui.audio?.pause(); } catch (_) {}
      saveState();
    });
  }

  function install() {
    const ui = elements();
    if (!ui.audio || !ui.textArea || !ui.verifyBtn || !ui.nextBtn) {
      throw new Error('Structure Dictée incomplète.');
    }

    configureFixedAudio();
    removeObsoleteSpeedNotice();
    updateInstructionText();
    hideLegacyAbandon();

    loadState();
    ui.textArea.value = state.texte || '';
    if (ui.listenCount) ui.listenCount.textContent = state.ecoutes || 0;
    countWords();
    installEvents();

    if (state.status === 'verified') {
      renderCorrection();
      lockVerified();
    }
    setActionMode();
    alignPrivacyButtonWithAbandon();
    setTimeout(alignPrivacyButtonWithAbandon, 100);

    if (state.status === 'abandoned') {
      setTimeout(goNext, 0);
    }
  }

  window.sebDictee = Object.freeze({
    reference:REFERENCE,
    totalWords:TOTAL_WORDS,
    audioFile:AUDIO_FILE,
    tokens,
    align,
    classifyAlignmentV3,
    evaluateText,
    loadState,
    saveState,
    verify,
    renderCorrection,
    lockVerified,
    configureFixedAudio,
    startPlayback,
    setActionMode,
    goNext,
    getState:() => Object.assign({}, state)
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once:true });
  } else {
    install();
  }
})();
