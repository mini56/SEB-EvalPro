const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const allowedParcoursNames = new Set(['katell', 'lizig', 'jean', 'jacqueline', 'julie']);
const neutralIdentityTokens = new Set([
  'xx','yy','zz','ww','vv','uu','tt',
  'test','positif','difficulte','difficultes','abandon','abandons',
  'motif','attribution','chiffres','chiffre','style','commentaires',
  'appui','contraste','stress','ne','incomplet'
]);

const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'app', '_ai-download', '_ai-llama', 'ai-runtime']);
const textExtensions = new Set(['.js','.cjs','.mjs','.html','.htm','.json','.md','.yml','.yaml','.ps1','.nsi','.nsh','.cpp','.h','.css','.txt']);

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .trim();
}

function allowedIdentity(value) {
  const v = normalize(value);
  if (!v) return true;
  if (allowedParcoursNames.has(v) || neutralIdentityTokens.has(v)) return true;
  if (/^(?:xx|yy|zz|ww|vv|uu|tt)[a-z0-9_-]*$/i.test(v)) return true;
  if (/\$\{|\b(?:candidate|candidat|value|input|data|state|row|item)\b/i.test(value)) return true;
  return false;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (textExtensions.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

const findings = [];
const patterns = [
  { kind: 'champ-identite', regex: /\b(?:nom|prenom|prénom|firstName|lastName)\s*[:=]\s*['"`]([^'"`\r\n]{1,100})['"`]/gi },
  { kind: 'json-identite', regex: /"(?:nom|prenom|prénom|firstName|lastName)"\s*:\s*"([^"\r\n]{1,100})"/gi },
  { kind: 'civilite-nom', regex: /\b(?:Monsieur|Madame|Mme|M\.)\s+([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'-]{2,})/g }
];

for (const file of walk(root)) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const text = fs.readFileSync(file, 'utf8');
  for (const { kind, regex } of patterns) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text))) {
      const value = match[1];
      if (allowedIdentity(value)) continue;
      const line = text.slice(0, match.index).split(/\r?\n/).length;
      findings.push({ rel, line, kind, value });
    }
  }
}

for (const name of allowedParcoursNames) {
  const sources = ['source/planning.html', 'source/nvmail.html'];
  const present = sources.some((rel) => {
    const file = path.join(root, rel);
    return fs.existsSync(file) && normalize(fs.readFileSync(file, 'utf8')).includes(name);
  });
  if (!present) findings.push({ rel: '(règle)', line: 0, kind: 'nom-autorise-absent-du-parcours', value: name });
}

if (findings.length) {
  console.error('AUDIT_NOMS_DEPOT: ECHEC');
  for (const f of findings) console.error(`${f.rel}:${f.line} [${f.kind}] ${f.value}`);
  process.exit(2);
}

console.log('AUDIT_NOMS_DEPOT: OK — aucune identité humaine non autorisée hors noms présents dans le parcours.');
