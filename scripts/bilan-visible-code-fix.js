const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webDir = path.join(root, 'app', 'web');
const files = ['bilan.html', 'admin-bilan.html'];

function fail(message) {
  console.error('SEB EvalPro bilan affichage: ' + message);
  process.exit(2);
}

function markerIsInsideScript(html, index) {
  const open = html.lastIndexOf('<script', index);
  const close = html.lastIndexOf('</script>', index);
  return open >= 0 && open > close;
}

let removedLeaks = 0;

for (const name of files) {
  const target = path.join(webDir, name);
  if (!fs.existsSync(target)) continue;
  let html = fs.readFileSync(target, 'utf8');

  const leakRe = /;\s*\/\/[\s\S]{0,220}?NOM DE FICHIER PERSONNALISÉ[\s\S]*?setTimeout\(\(\)\s*=>\s*URL\.revokeObjectURL\(url\),\s*100\);\s*\}/g;
  html = html.replace(leakRe, (match, offset) => {
    const markerOffset = match.indexOf('NOM DE FICHIER PERSONNALISÉ');
    const absoluteMarker = offset + Math.max(0, markerOffset);
    if (markerIsInsideScript(html, absoluteMarker)) return match;
    removedLeaks += 1;
    return '';
  });

  if (name === 'bilan.html') {
    const filenameSetup = `const sebCandidateForWordFilename = (() => {\n    try { return JSON.parse(sessionStorage.getItem('candidat_data') || '{}') || {}; } catch (_) { return {}; }\n  })();\n  const sebCleanFilenamePart = (value) => String(value || '')\n    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')\n    .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');\n  const sebNom = sebCleanFilenamePart(sebCandidateForWordFilename.nom);\n  const sebPrenom = sebCleanFilenamePart(sebCandidateForWordFilename['prénom'] || sebCandidateForWordFilename.prenom);\n  let sebFilename = 'Evaluation_SEB';\n  if (sebNom && sebPrenom) sebFilename = 'Evaluation_' + sebNom + '_' + sebPrenom;\n  sebFilename += '_' + new Date().toISOString().split('T')[0] + '.doc';`;

    if (!html.includes('sebCandidateForWordFilename')) {
      const staticLine = "link.download = 'Evaluation_SEB_' + new Date().toISOString().split('T')[0] + '.doc';";
      if (html.includes(staticLine)) {
        html = html.replace(staticLine, filenameSetup + "\n  link.download = sebFilename;");
      } else if (html.includes('link.download = filename;')) {
        html = html.replace('link.download = filename;', filenameSetup + "\n  link.download = sebFilename;");
      } else {
        fail('ligne de nom de fichier Word introuvable dans bilan.html');
      }
    }
  }

  const visibleMarker = html.indexOf('NOM DE FICHIER PERSONNALISÉ');
  if (visibleMarker >= 0 && !markerIsInsideScript(html, visibleMarker)) {
    fail('code JavaScript encore visible hors <script> dans ' + name);
  }

  fs.writeFileSync(target, html, 'utf8');
}

if (removedLeaks === 0) {
  fail('aucun bloc JavaScript visible détecté : correction non vérifiée');
}

const bilanPath = path.join(webDir, 'bilan.html');
const bilan = fs.readFileSync(bilanPath, 'utf8');
if (!bilan.includes('link.download = sebFilename;') || !bilan.includes("sessionStorage.getItem('candidat_data')")) {
  fail('export Word personnalisé non préservé dans bilan.html');
}

console.log(`SEB EvalPro bilan: ${removedLeaks} bloc(s) JavaScript visible(s) supprimé(s); export Word personnalisé conservé.`);
