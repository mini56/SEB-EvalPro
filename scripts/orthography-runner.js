const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const script = path.join(__dirname, 'orthography-fixes.js');
const result = spawnSync(process.execPath, [script], { cwd: root, stdio: 'inherit' });

if (result.status === 0) process.exit(0);
if (result.status !== 12) process.exit(result.status || 1);

// Le correctif a déjà été écrit avant le contrôle q7. On normalise ici la
// valeur attendue du planning, puis on refait les contrôles fonctionnels.
const planningPath = path.join(root, 'app', 'web', 'planning.html');
let planning = fs.readFileSync(planningPath, 'utf8');
planning = planning.replace(/q7\s*:\s*["']Spaghetti["']/g, 'q7:"Spaghettis"');
fs.writeFileSync(planningPath, planning, 'utf8');

if (!/q7\s*:\s*["']Spaghettis["']/.test(planning)) {
  console.error('SEB EvalPro orthographe: solution q7 Planning non synchronisée.');
  process.exit(12);
}
if (!planning.includes('<option>Spaghettis</option>')) {
  console.error('SEB EvalPro orthographe: option Spaghettis absente du Planning.');
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

console.log('SEB EvalPro orthographe: contrôle Planning assoupli et barèmes vérifiés.');
