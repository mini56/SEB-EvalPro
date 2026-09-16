const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'src', 'preload.js');

function fail(message) {
  console.error('IA locale - correction barre Admin: ' + message);
  process.exit(2);
}

let source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

if (!source.includes('function injectAdminBar()')) fail('fonction injectAdminBar introuvable');
if (!source.includes("window.addEventListener('DOMContentLoaded'")) fail('initialisation DOM introuvable');

// Correctif volontairement indépendant du flux IPC existant :
// même si le listener principal attend admin:status, ce second listener crée
// immédiatement la barre dès que le DOM est disponible. injectAdminBar() est
// idempotente, donc l'initialisation historique peut continuer sans régression.
const marker = '// SEB_LOCAL_AI_ADMIN_BAR_FAILSAFE';
if (!source.includes(marker)) {
  const addon = `\n\n${marker}\nfunction sebLocalAiEnsureAdminBar() {\n  try {\n    if (document.body) injectAdminBar();\n  } catch (error) {\n    console.error('SEB EvalPro: impossible d’injecter la barre Administrateur', error);\n  }\n}\n\nif (document.readyState === 'loading') {\n  document.addEventListener('DOMContentLoaded', sebLocalAiEnsureAdminBar, { once: true });\n} else {\n  sebLocalAiEnsureAdminBar();\n}\nsetTimeout(sebLocalAiEnsureAdminBar, 250);\n`;
  source += addon;
}

for (const required of [
  marker,
  'function sebLocalAiEnsureAdminBar()',
  "document.addEventListener('DOMContentLoaded', sebLocalAiEnsureAdminBar",
  'setTimeout(sebLocalAiEnsureAdminBar, 250)'
]) {
  if (!source.includes(required)) fail('garde Admin absente: ' + required);
}

try { new vm.Script(source); }
catch (error) { fail('preload.js invalide après correctif: ' + error.message); }

fs.writeFileSync(file, source, 'utf8');
console.log('IA locale: garde indépendante installée pour garantir la barre Administrateur au chargement.');
