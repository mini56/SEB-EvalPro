const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'app', 'web', 'dictee.html');
const MARKER = 'seb-dictee-single-finish-flow';

function fail(message) {
  console.error('SEB EvalPro dictée flux final: ' + message);
  process.exit(2);
}

if (!fs.existsSync(target)) fail('dictee.html généré introuvable');
let html = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
if (html.includes(MARKER)) fail('correctif flux Dictée déjà présent');

const style = [
  '<style id="seb-dictee-single-finish-style">',
  '#verifyBtn,#nextBtn,#feedback{display:none!important}',
  '#seb-dictee-finish-next{display:inline-flex!important}',
  '</style>'
].join('\n');

if (!/<\/head>/i.test(html)) fail('balise </head> absente');
html = html.replace(/<\/head>/i, style + '\n</head>');

const runtimeLines = [
  '<script id="' + MARKER + '">',
  '(function(){',
  "  'use strict';",
  "  const TRI_PAGE = 'tri_de_cheville.html';",
  "  const STORAGE_KEY = 'dictee_data';",
  '',
  '  function readState(){',
  '    try {',
  "      const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');",
  "      return value && typeof value === 'object' ? value : null;",
  '    } catch (_) { return null; }',
  '  }',
  '',
  '  function persist(){',
  '    try {',
  "      if (window.sebEvalPro && typeof window.sebEvalPro.save === 'function') window.sebEvalPro.save();",
  '    } catch (_) {}',
  '  }',
  '',
  '  function hideCorrection(){',
  "    const feedback = document.getElementById('feedback');",
  '    if (!feedback) return;',
  "    feedback.classList.remove('visible');",
  '    feedback.hidden = true;',
  "    feedback.setAttribute('aria-hidden', 'true');",
  "    if (feedback.innerHTML) feedback.innerHTML = '';",
  '  }',
  '',
  '  function hideLegacyButtons(){',
  "    const engine = document.getElementById('verifyBtn');",
  "    const legacyNext = document.getElementById('nextBtn');",
  '    [engine, legacyNext].forEach(function(button){',
  '      if (!button) return;',
  '      button.hidden = true;',
  '      if (button === legacyNext) button.disabled = true;',
  '      button.tabIndex = -1;',
  "      button.setAttribute('aria-hidden', 'true');",
  "      button.style.setProperty('display', 'none', 'important');",
  '    });',
  '  }',
  '',
  '  function setStatus(text){',
  "    const status = document.getElementById('status');",
  '    if (status) status.textContent = text;',
  '  }',
  '',
  '  function goNext(){',
  '    persist();',
  '    window.location.href = TRI_PAGE;',
  '  }',
  '',
  '  function install(){',
  "    const engine = document.getElementById('verifyBtn');",
  "    const textArea = document.getElementById('candidateText');",
  '    if (!engine || !textArea) return false;',
  '    hideLegacyButtons();',
  '    hideCorrection();',
  '',
  "    let action = document.getElementById('seb-dictee-finish-next');",
  '    if (!action) {',
  "      action = document.createElement('button');",
  "      action.id = 'seb-dictee-finish-next';",
  "      action.type = 'button';",
  "      action.className = engine.className || 'primary';",
  "      action.classList.add('seb-action-btn', 'seb-btn-nav');",
  '      engine.parentNode.insertBefore(action, engine);',
  '    }',
  '',
  '    function refreshMode(){',
  '      const state = readState();',
  "      const verified = !!(state && state.status === 'verified');",
  '      action.disabled = false;',
  "      action.textContent = verified ? 'Suivant' : 'Dictée terminée';",
  "      action.dataset.mode = verified ? 'next' : 'finish';",
  '      if (verified) {',
  '        textArea.disabled = true;',
  "        setStatus('Dictée terminée. Cliquez sur Suivant pour poursuivre.');",
  '      }',
  '      hideLegacyButtons();',
  '      hideCorrection();',
  '    }',
  '',
  "    if (action.dataset.sebInstalled !== '1') {",
  "      action.dataset.sebInstalled = '1';",
  "      action.addEventListener('click', function(){",
  '        const state = readState();',
  "        if (state && state.status === 'verified') {",
  '          action.disabled = true;',
  '          goNext();',
  '          return;',
  '        }',
  "        if (state && state.status === 'abandoned') {",
  '          action.disabled = true;',
  '          goNext();',
  '          return;',
  '        }',
  "        if (!String(textArea.value || '').trim()) {",
  "          window.alert('Saisissez le texte entendu avant de cliquer sur « Dictée terminée », ou utilisez « Abandonner l’exercice ».');",
  '          try { textArea.focus(); } catch (_) {}',
  '          return;',
  '        }',
  '        action.disabled = true;',
  '        try { engine.click(); } catch (_) {}',
  '        hideCorrection();',
  '        setTimeout(function(){',
  '          hideCorrection();',
  '          const after = readState();',
  "          if (!after || after.status !== 'verified') {",
  '            action.disabled = false;',
  "            action.textContent = 'Dictée terminée';",
  "            setStatus('La dictée n’a pas pu être enregistrée. Cliquez de nouveau sur « Dictée terminée ».');",
  '            return;',
  '          }',
  '          persist();',
  '          refreshMode();',
  '        }, 100);',
  '      });',
  '    }',
  '',
  "    const feedback = document.getElementById('feedback');",
  "    if (feedback && feedback.dataset.sebHiddenWatch !== '1') {",
  "      feedback.dataset.sebHiddenWatch = '1';",
  '      new MutationObserver(function(){ hideCorrection(); }).observe(feedback, {',
  "        childList:true, subtree:true, attributes:true, attributeFilter:['class','style','hidden']",
  '      });',
  '    }',
  '    refreshMode();',
  '    return true;',
  '  }',
  '',
  '  function init(){',
  '    if (install()) return;',
  '    let attempts = 0;',
  '    const timer = setInterval(function(){',
  '      attempts += 1;',
  '      if (install() || attempts >= 30) clearInterval(timer);',
  '    }, 100);',
  '  }',
  '',
  "  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });",
  '  else init();',
  '})();',
  '</script>'
];
const runtime = runtimeLines.join('\n');

if (!/<\/body>/i.test(html)) fail('balise </body> absente');
html = html.replace(/<\/body>/i, runtime + '\n</body>');

for (const token of [
  'id="seb-dictee-single-finish-style"',
  'id="seb-dictee-single-finish-flow"',
  "action.textContent = verified ? 'Suivant' : 'Dictée terminée'",
  'engine.click()',
  'window.location.href = TRI_PAGE',
  '#verifyBtn,#nextBtn,#feedback{display:none!important}',
  "state.status === 'verified'",
  'new MutationObserver(function(){ hideCorrection(); })'
]) {
  if (!html.includes(token)) fail('contrôle absent: ' + token);
}

const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match, index = 0;
while ((match = scriptRe.exec(html))) {
  index += 1;
  const code = match[1].trim();
  if (!code) continue;
  try { new vm.Script(code); }
  catch (error) { fail('JavaScript final invalide (script ' + index + '): ' + error.message); }
}

fs.writeFileSync(target, html, 'utf8');
console.log('SEB EvalPro dictée: bouton unique Dictée terminée -> Suivant; correction candidat masquée; reprise verified -> Suivant.');
