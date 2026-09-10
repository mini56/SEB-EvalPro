const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'source');
const outputDir = path.join(root, 'app', 'web');
const overridesDir = path.join(root, 'overrides');

function copyTree(source, destination, skipNames = new Set()) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (skipNames.has(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyTree(from, to, skipNames);
    else fs.copyFileSync(from, to);
  }
}

function resolveCaseInsensitive(targetPath) {
  const directory = path.dirname(targetPath);
  const basename = path.basename(targetPath);
  if (!fs.existsSync(directory)) return null;
  const match = fs.readdirSync(directory).find((name) => name.toLowerCase() === basename.toLowerCase());
  return match ? path.join(directory, match) : null;
}

function repairCaseSensitiveReferences() {
  const htmlFiles = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (/\.html?$/i.test(entry.name)) htmlFiles.push(fullPath);
    }
  };
  visit(outputDir);

  const references = new Set();
  const attrRegex = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  const urlRegex = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;

  for (const htmlFile of htmlFiles) {
    const text = fs.readFileSync(htmlFile, 'utf8');
    for (const regex of [attrRegex, urlRegex]) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(text))) {
        const ref = match[1].trim();
        if (!ref || /^(?:https?:|data:|mailto:|javascript:|#)/i.test(ref)) continue;
        references.add(JSON.stringify({ htmlFile, ref }));
      }
    }
  }

  let repaired = 0;
  for (const item of references) {
    const { htmlFile, ref } = JSON.parse(item);
    const cleanRef = ref.split('#')[0].split('?')[0];
    if (!cleanRef) continue;
    const expected = path.resolve(path.dirname(htmlFile), cleanRef);
    if (fs.existsSync(expected)) continue;
    const actual = resolveCaseInsensitive(expected);
    if (!actual || actual === expected) continue;
    fs.mkdirSync(path.dirname(expected), { recursive: true });
    fs.copyFileSync(actual, expected);
    repaired += 1;
  }

  return repaired;
}

if (!fs.existsSync(sourceDir)) {
  console.error('SEB EvalPro: le dossier source/ est absent.');
  process.exit(2);
}

const requiredSourceFiles = ['qcmv1.0.html', 'bilan.html', 'nwtexte.html'];
for (const required of requiredSourceFiles) {
  if (!fs.existsSync(path.join(sourceDir, required))) {
    console.error(`SEB EvalPro: fichier obligatoire absent de source/ : ${required}`);
    process.exit(3);
  }
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

copyTree(sourceDir, outputDir, new Set(['QCM.lnk', 'README.md']));
copyTree(overridesDir, outputDir);

const repaired = repairCaseSensitiveReferences();
console.log(`SEB EvalPro: plateau préparé depuis les fichiers source/ (${repaired} référence(s) de casse réparée(s)).`);
