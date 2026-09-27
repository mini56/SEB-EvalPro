const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'source');
const overridesDir = path.join(root, 'overrides');
const outputDir = path.join(root, 'app', 'web');

function fail(message) {
  console.error('SEB EvalPro prepare:web: ' + message);
  process.exit(2);
}

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

function htmlFiles(directory) {
  let out = [];
  if (!fs.existsSync(directory)) return out;
  for (const entry of fs.readdirSync(directory, { withFileTypes:true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) out = out.concat(htmlFiles(full));
    else if (/\.html?$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function assertCleanHtml(directory, label) {
  for (const file of htmlFiles(directory)) {
    const html = fs.readFileSync(file, 'utf8');
    if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) fail(label + ': script inline interdit dans ' + path.relative(root,file));
    if (/\son(?:click|change|input|submit|ended|load|error|blur|focus|keydown|keyup|keypress|mouseover|mouseout|mouseenter|mouseleave)\s*=/i.test(html)) {
      fail(label + ': événement inline interdit dans ' + path.relative(root,file));
    }
    if (/href\s*=\s*["']javascript:/i.test(html)) fail(label + ': URL javascript: interdite dans ' + path.relative(root,file));
  }
}

for (const required of ['qcmv1.0.html','bilan.html','dictee.html']) {
  if (!fs.existsSync(path.join(sourceDir,required))) fail('source obligatoire absente: ' + required);
}
for (const required of ['admin-bilan.html','admin-candidats.html']) {
  if (!fs.existsSync(path.join(overridesDir,required))) fail('override obligatoire absent: ' + required);
}

assertCleanHtml(sourceDir,'source');
assertCleanHtml(overridesDir,'overrides');

fs.rmSync(outputDir,{recursive:true,force:true});
fs.mkdirSync(outputDir,{recursive:true});
copyTree(sourceDir,outputDir,new Set(['QCM.lnk','README.md']));
copyTree(overridesDir,outputDir);
assertCleanHtml(outputDir,'app/web');

console.log('SEB EvalPro: app/web reconstruit par copie des sources canoniques, sans patch fonctionnel.');
