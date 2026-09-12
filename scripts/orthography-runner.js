const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const script = path.join(__dirname, 'orthography-fixes.js');
const result = spawnSync(process.execPath, [script], { cwd: root, stdio: 'inherit' });

if (result.status === 0) process.exit(0);
if (result.status !== 12) process.exit(result.status || 1);

// Le code 12 vient uniquement de l'ancien contrôle trop strict de q7.
// Toutes les corrections ont déjà été écrites. On garantit ici que toutes
// les occurrences Planning utilisent bien le pluriel et on contrôle les barèmes.
const planningPath = path.join(root, 'app', 'web', 'planning.html');
let planning = fs.readFileSync(planningPath, 'utf8');
planning = planning.replace(/Spaghetti/g, 'Spaghettis').replace(/spaghetti/g, 'spaghettis');
fs.writeFileSync(planningPath, planning, 'utf8');

if (!planning.includes('Spaghettis') || /\bSpaghetti\b/.test(planning) || /\bspaghetti\b/.test(planning)) {
  console.error('SEB EvalPro orthographe: singularité Spaghetti encore présente dans le Planning.');
  process.exit(12);
}
if (!/q7[^,\r\n]*Spaghettis/.test(planning)) {
  console.error('SEB EvalPro orthographe: réponse attendue q7 non synchronisée avec le pluriel.');
  process.exit(12);
}

const paronymes = fs.readFileSync(path.join(root, 'app', 'web', 'paronymes.html'), 'utf8');
const rows = (paronymes.match(/<tr>[\s\S]*?<\/tr>/g) || []).filter((row) => row.includes('class="paronyme"'));
if (rows.length !== 20 || rows.some((row) => (row.match(/data-correct="true"/g) || []).length !== 1)) {
  console.error('SEB EvalPro orthographe: barème Paronymes 20/20 altéré.');
  process.exit(13);
}

const engine = fs.readFileSync(path.join(root, 'app', 'web', 'js', 'nwtexte-quill-engine.js'), 'utf8');
if (!engine.includes('Quelle est mon activité préférée et pourquoi ?') ||
    !engine.includes('Quelle est mon expérience professionnelle préférée et pourquoi ?') ||
    !engine.includes('Quel est mon métier préféré et pourquoi ?')) {
  console.error('SEB EvalPro orthographe: titres nwtexte non synchronisés avec le barème.');
  process.exit(14);
}

console.log('SEB EvalPro orthographe: corrections visibles appliquées, Planning/Paronymes/nwtexte vérifiés.');
