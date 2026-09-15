const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'src', 'preload.js');

function fail(message, code = 2) {
  console.error('SEB EvalPro Build #154 scrollbar stability: ' + message);
  process.exit(code);
}

if (!fs.existsSync(target)) fail('src/preload.js introuvable');
let source = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');

// Réserver en permanence la gouttière de la scrollbar principale sans forcer
// l'affichage de la scrollbar et sans verrouiller le scroll de la page.
const before = '    html{box-sizing:border-box}';
const after = '    html{box-sizing:border-box;scrollbar-gutter:stable}';

if (!source.includes(after)) {
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) fail(`cible html shell trouvée ${occurrences} fois au lieu de 1`, 3);
  source = source.replace(before, after);
}

// Contrôles anti-régression : ne surtout pas réintroduire les anciens mécanismes
// qui provoquaient eux-mêmes des déplacements ou des sauts de page.
if (/html\{[^}]*overflow-y\s*:/i.test(source)) fail('overflow-y global interdit sur html', 4);
if (/html\{[^}]*overflow\s*:\s*hidden/i.test(source)) fail('overflow hidden global interdit sur html', 5);
if (/body\{[^}]*overflow\s*:\s*hidden/i.test(source)) fail('overflow hidden global interdit sur body', 6);
if (source.includes('lockHorizontalPosition') || source.includes('window.scrollTo(0, window.scrollY)')) {
  fail('ancien verrouillage horizontal réapparu', 7);
}

const stableCount = (source.match(/html\{box-sizing:border-box;scrollbar-gutter:stable\}/g) || []).length;
if (stableCount !== 1) fail(`scrollbar-gutter stable présent ${stableCount} fois au lieu de 1`, 8);

try { new vm.Script(source); }
catch (error) { fail('src/preload.js invalide après correction: ' + error.message, 9); }

fs.writeFileSync(target, source, 'utf8');
console.log('SEB EvalPro Build #154: gouttière de scrollbar principale réservée en permanence, sans overflow forcé ni repositionnement de page.');
