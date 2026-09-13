const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const web = path.join(root, 'app', 'web');
const genrePath = path.join(web, 'genrenombres.html');
const triPath = path.join(web, 'tri_de_cheville.html');
const nvmailPath = path.join(web, 'nvmail.html');
const runtimePath = path.join(web, 'js', 'seb-ui-runtime.js');

function fail(message) {
  console.error('SEB EvalPro #128 dictée/nvmail: ' + message);
  process.exit(2);
}

for (const file of [genrePath, triPath, nvmailPath, runtimePath]) {
  if (!fs.existsSync(file)) fail('fichier généré introuvable: ' + path.relative(root, file));
}

// 1) Parcours normal : Genre/Nombres -> Dictée.
let genre = fs.readFileSync(genrePath, 'utf8');
genre = genre.replace(
  /window\.location\.href\s*=\s*(['"])tri_de_cheville\.html\1\s*;/gi,
  "window.location.href = 'dictee.html';"
);
if (!/window\.location\.href\s*=\s*['"]dictee\.html['"]/i.test(genre)) {
  fail('Genre/Nombres ne pointe pas vers dictee.html');
}
fs.writeFileSync(genrePath, genre, 'utf8');

// 2) Parcours après abandon de Genre/Nombres : il doit lui aussi passer par la Dictée.
let runtime = fs.readFileSync(runtimePath, 'utf8');
runtime = runtime.replace(
  /(['"]genrenombres\.html['"]\s*:\s*)['"]tri_de_cheville\.html['"]/g,
  "$1'dictee.html'"
);
if (!/['"]genrenombres\.html['"]\s*:\s*['"]dictee\.html['"]/.test(runtime)) {
  fail('NEXT_BY_FILE ne route pas Genre/Nombres vers Dictée');
}
fs.writeFileSync(runtimePath, runtime, 'utf8');

// 3) Garde anti-contournement : une reprise ancienne ne peut plus ouvrir directement le Tri
//    si la dictée n'a pas été terminée (vérifiée ou abandonnée).
let tri = fs.readFileSync(triPath, 'utf8');
const triMarker = 'seb-dictee-required-before-tri';
if (!tri.includes(triMarker)) {
  const guard = `\n<script id="${triMarker}">\n(function(){\n  'use strict';\n  try {\n    const raw = sessionStorage.getItem('dictee_data');\n    const data = raw ? JSON.parse(raw) : null;\n    const done = data && (data.status === 'verified' || data.status === 'abandoned');\n    if (!done) window.location.replace('dictee.html');\n  } catch (_) {\n    window.location.replace('dictee.html');\n  }\n})();\n</script>\n`;
  if (!/<\/head>/i.test(tri)) fail('balise </head> absente de tri_de_cheville.html');
  tri = tri.replace(/<\/head>/i, guard + '</head>');
}
if (!tri.includes(triMarker) || !tri.includes("window.location.replace('dictee.html')")) {
  fail('garde Dictée avant Tri absent');
}
fs.writeFileSync(triPath, tri, 'utf8');

// 4) nvmail : son CSS global met width:100% sur tous les input, y compris les checkbox
//    de la fenêtre d'abandon. On isole uniquement cette modale sur cette page.
let nvmail = fs.readFileSync(nvmailPath, 'utf8');
const nvMarker = 'seb-nvmail-abandon-layout-fix';
if (!nvmail.includes(nvMarker)) {
  const css = `\n<style id="${nvMarker}">\n#seb-evalpro-abandon-box label.seb-abandon-choice {\n  display:grid !important;\n  grid-template-columns:20px minmax(0,1fr) !important;\n  align-items:start !important;\n  column-gap:12px !important;\n  width:100% !important;\n  margin:0 !important;\n  padding:8px 4px !important;\n  box-sizing:border-box !important;\n}\n#seb-evalpro-abandon-box label.seb-abandon-choice input[type="checkbox"] {\n  width:16px !important;\n  min-width:16px !important;\n  max-width:16px !important;\n  height:16px !important;\n  min-height:16px !important;\n  padding:0 !important;\n  margin:2px 0 0 0 !important;\n  display:block !important;\n  box-sizing:border-box !important;\n}\n#seb-evalpro-abandon-box label.seb-abandon-choice span {\n  display:block !important;\n  width:auto !important;\n  margin:0 !important;\n  padding:0 !important;\n  text-align:left !important;\n  line-height:1.35 !important;\n}\n#seb-evalpro-abandon-comment {\n  width:100% !important;\n  max-width:100% !important;\n  box-sizing:border-box !important;\n}\n</style>\n`;
  if (!/<\/head>/i.test(nvmail)) fail('balise </head> absente de nvmail.html');
  nvmail = nvmail.replace(/<\/head>/i, css + '</head>');
}
if (!nvmail.includes(nvMarker) || !/input\[type="checkbox"\][\s\S]*width:16px !important/.test(nvmail)) {
  fail('correctif checkbox nvmail absent');
}
fs.writeFileSync(nvmailPath, nvmail, 'utf8');

console.log('SEB EvalPro #128: Dictée obligatoire avant Tri (parcours normal, abandon et reprise) ; fenêtre Abandon nvmail corrigée (checkbox 16px + libellé aligné).');
