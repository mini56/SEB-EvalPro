const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'app', 'web', 'planning.html');

function fail(message) {
  console.error('SEB EvalPro Planning spaghetti: ' + message);
  process.exit(2);
}

if (!fs.existsSync(target)) fail('planning.html généré introuvable');

const before = fs.readFileSync(target, 'utf8');

function normalizeSpaghetti(text) {
  return String(text)
    .replace(/\bSpaghettis*\b/g, 'Spaghettis')
    .replace(/\bspaghettis*\b/g, 'spaghettis');
}

const once = normalizeSpaghetti(before);
const twice = normalizeSpaghetti(once);

if (once !== twice) fail('normalisation non idempotente');

const upper = once.match(/\bSpaghettis*\b/g) || [];
const lower = once.match(/\bspaghettis*\b/g) || [];
if (!upper.length && !lower.length) fail('aucune occurrence spaghetti trouvée');
if (upper.some((word) => word !== 'Spaghettis')) fail('variante majuscule incorrecte restante');
if (lower.some((word) => word !== 'spaghettis')) fail('variante minuscule incorrecte restante');
if (/\bSpaghettiss+\b/.test(once) || /\bspaghettiss+\b/.test(once)) fail('s supplémentaire encore présent');

fs.writeFileSync(target, once, 'utf8');
console.log(`SEB EvalPro Planning: ${upper.length + lower.length} occurrence(s) normalisée(s) exactement en « Spaghettis », sans s supplémentaire.`);
