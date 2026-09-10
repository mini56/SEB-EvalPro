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

function extractInstitutionalLogo() {
  const qcmPath = path.join(outputDir, 'qcmv1.0.html');
  const html = fs.readFileSync(qcmPath, 'utf8');
  const match = html.match(/<svg\b[^>]*id=["']Calque_1["'][\s\S]*?<\/svg>/i);
  if (!match) {
    console.error('SEB EvalPro: logo institutionnel Sauvegarde 56 introuvable dans qcmv1.0.html.');
    process.exit(4);
  }
  fs.writeFileSync(path.join(outputDir, 'sauvegarde56-logo.svg'), match[0], 'utf8');
}

function patchFile(relativePath, transform) {
  const target = path.join(outputDir, relativePath);
  if (!fs.existsSync(target)) {
    console.error(`SEB EvalPro: fichier à corriger introuvable : ${relativePath}`);
    process.exit(5);
  }
  const before = fs.readFileSync(target, 'utf8');
  const after = transform(before);
  if (typeof after !== 'string' || after.length === 0) {
    console.error(`SEB EvalPro: correction invalide pour ${relativePath}`);
    process.exit(6);
  }
  fs.writeFileSync(target, after, 'utf8');
}

function injectBeforeBodyEnd(html, script) {
  const marker = '</body>';
  const index = html.toLowerCase().lastIndexOf(marker);
  if (index < 0) return html + script;
  return html.slice(0, index) + script + '\n' + html.slice(index);
}

function patchGeneratedPages() {
  patchFile('qcmv1.0.html', (html) => {
    let out = html.replace(/<button\s+onclick=["']nextPage\(['"]bilanPage['"]\)["']>Bilan<\/button>/i, '');
    out = out.replace(/imageqcm\/qcm_posture\.PNG/g, 'imageqcm/qcm_posture.png');
    return out;
  });

  patchFile('planning.html', (html) => html.replace(/\bSpaghetti\b/g, 'Spaghettis').replace(/\bspaghetti\b/g, 'spaghettis'));

  patchFile('paronymes.html', (html) => {
    let out = html.replace(
      '<tr><td class="paronyme">Apitoiement</td><td>Pitié</td><td>Appétence</td><td data-correct="true">Attendrissement</td><td>Capiteux</td><td>Piété</td></tr>',
      '<tr><td class="paronyme">Apitoiement</td><td data-correct="true">Pitié</td><td>Appétence</td><td>Attendrissement</td><td>Capiteux</td><td>Piété</td></tr>'
    );
    out = out.replace(
      '<tr><td class="paronyme">Quittance</td><td>Paye</td><td>Facture</td><td data-correct="true">Reçu</td><td>Prix</td><td>Quitter</td></tr>',
      '<tr><td class="paronyme">Quittance</td><td>Paye</td><td>Facture</td><td data-correct="true">Reçu</td><td>Prix</td><td>Quitter</td></tr>'
    );
    return out;
  });

  patchFile('brique.html', (html) => {
    let out = html.replace(/imageqcm\/brique\.JPG/g, 'imageqcm/brique.jpg');
    out = out.replace(/window\.addEventListener\('DOMContentLoaded',\s*clearPageData\);/g, '// Conservation des données : ne pas effacer à l’ouverture.');
    const patch = `
<script id="seb-evalpro-brique-fixes">
(function(){
  document.addEventListener('DOMContentLoaded', function(){
    const resetBtn = document.getElementById('resetBtn');
    if (!resetBtn) return;
    resetBtn.onclick = async function(){
      const password = window.prompt('Mot de passe administrateur requis pour remettre le chronomètre à zéro :');
      if (password === null) return;
      const ok = window.sebEvalPro && window.sebEvalPro.verifyAdminPassword
        ? await window.sebEvalPro.verifyAdminPassword(password)
        : false;
      if (!ok) {
        window.alert('Mot de passe incorrect. Remise à zéro annulée.');
        return;
      }
      clearInterval(chronoInterval);
      chronoInterval = null;
      chronoSeconds = 0;
      updateChrono();
      const temps = document.getElementById('temps');
      if (temps) temps.value = '';
      const start = document.getElementById('startBtn');
      const stop = document.getElementById('stopBtn');
      if (start) start.disabled = false;
      if (stop) stop.disabled = true;
    };
  });
})();
</script>`;
    return injectBeforeBodyEnd(out, patch);
  });

  patchFile('tri_de_cheville.html', (html) => {
    let out = html;
    out = out.replace(/window\.addEventListener\('DOMContentLoaded',\s*clearPageData\);/g, '// Conservation des données : ne pas effacer à l’ouverture.');
    out = out.replace('<button id="resetBtn" type="button" onclick="resetChrono()">Remise à zéro</button>', '<button id="resetBtn" type="button">Valider le tri</button>');
    out = out.replace(/\s*<button id="reset" type="button" onclick="resetAll\(\)">Remise à zéro<\/button>/, '');
    out = out.replace('onclick="saveTriResultsToQCM(; passerEtapeSuivante()"', 'onclick="saveTriResultsToQCM(); passerEtapeSuivante()"');

    const patch = `
<script id="seb-evalpro-tri-fixes">
(function(){
  let currentTri = 1;

  function integerValue(id){
    const value = parseInt(document.getElementById(id)?.value || '0', 10);
    return Number.isNaN(value) ? 0 : value;
  }

  function computeAndPersist(){
    const tris = [];
    let totalSeconds = 0;
    let count = 0;
    let totalErreurs = 0;
    for (let i = 1; i <= 5; i += 1) {
      const minutes = integerValue('m' + i);
      const secondes = integerValue('s' + i);
      const erreurs = integerValue('e' + i);
      tris.push({ minutes: String(minutes), secondes: String(secondes), erreurs: String(erreurs) });
      if (minutes || secondes) {
        totalSeconds += minutes * 60 + secondes;
        count += 1;
      }
      totalErreurs += erreurs;
    }
    let moyenne = '00:00';
    if (count > 0) {
      const avg = Math.round(totalSeconds / count);
      moyenne = String(Math.floor(avg / 60)).padStart(2, '0') + ':' + String(avg % 60).padStart(2, '0');
    }
    const auto = Array.from(document.querySelectorAll("#autoEvalForm input[type='checkbox']:checked"))
      .map((c) => c.labels && c.labels[0] ? c.labels[0].innerText : c.value);
    const commentaire = document.getElementById('autoComment')?.value || '';
    sessionStorage.setItem('tri_cheville_data', JSON.stringify({
      tris,
      moyenne,
      totalErreurs: String(totalErreurs),
      auto,
      commentaire,
      currentTri
    }));
    const resMS = document.getElementById('resMS');
    const resErr = document.getElementById('resErr');
    if (resMS) resMS.textContent = count > 0 ? moyenne : '—';
    if (resErr) resErr.textContent = String(totalErreurs);
    if (window.sebEvalPro?.save) window.sebEvalPro.save();
  }

  function updateTriState(){
    const validate = document.getElementById('resetBtn');
    const start = document.getElementById('startBtn');
    const stop = document.getElementById('stopBtn');
    if (!validate) return;
    if (currentTri > 5) {
      validate.textContent = '5 tris validés';
      validate.disabled = true;
      if (start) start.disabled = true;
      if (stop) stop.disabled = true;
    } else {
      validate.textContent = 'Valider le tri';
      validate.disabled = false;
      if (start) start.disabled = false;
    }
  }

  function findNextTri(){
    for (let i = 1; i <= 5; i += 1) {
      const m = document.getElementById('m' + i)?.value;
      const s = document.getElementById('s' + i)?.value;
      if ((m === '' || m == null) && (s === '' || s == null)) return i;
    }
    return 6;
  }

  function restoreTri(){
    let data = null;
    try { data = JSON.parse(sessionStorage.getItem('tri_cheville_data') || 'null'); } catch (_) {}
    if (data && Array.isArray(data.tris)) {
      data.tris.slice(0, 5).forEach((tri, index) => {
        const i = index + 1;
        const m = document.getElementById('m' + i);
        const s = document.getElementById('s' + i);
        const e = document.getElementById('e' + i);
        const hasTime = Number(tri.minutes) > 0 || Number(tri.secondes) > 0;
        if (m) m.value = hasTime ? (tri.minutes || '0') : '';
        if (s) s.value = hasTime ? (tri.secondes || '0') : '';
        if (e && tri.erreurs !== undefined && tri.erreurs !== null) e.value = tri.erreurs;
      });
      const resMS = document.getElementById('resMS');
      const resErr = document.getElementById('resErr');
      if (resMS && data.moyenne && data.moyenne !== '00:00') resMS.textContent = data.moyenne;
      if (resErr && data.totalErreurs !== undefined) resErr.textContent = String(data.totalErreurs);
      if (Array.isArray(data.auto)) {
        document.querySelectorAll("#autoEvalForm input[type='checkbox']").forEach((cb) => {
          const label = cb.labels && cb.labels[0] ? cb.labels[0].innerText : cb.value;
          cb.checked = data.auto.includes(label) || data.auto.includes(cb.value);
        });
      }
      const comment = document.getElementById('autoComment');
      if (comment && data.commentaire) comment.value = data.commentaire;
    }
    const savedCurrent = Number(data && data.currentTri);
    currentTri = Number.isInteger(savedCurrent) && savedCurrent >= 1 && savedCurrent <= 6 ? savedCurrent : findNextTri();
    updateTriState();
  }

  function validateCurrentTri(){
    if (currentTri > 5) return;
    if (typeof stopChrono === 'function') stopChrono();
    const minutes = Math.floor(chronoSeconds / 60);
    const secondes = chronoSeconds % 60;
    const m = document.getElementById('m' + currentTri);
    const s = document.getElementById('s' + currentTri);
    if (m) m.value = String(minutes);
    if (s) s.value = String(secondes);
    currentTri += 1;
    computeAndPersist();
    chronoSeconds = 0;
    if (typeof updateChronoDisplay === 'function') updateChronoDisplay();
    updateTriState();
  }

  document.addEventListener('DOMContentLoaded', function(){
    restoreTri();
    const validate = document.getElementById('resetBtn');
    if (validate) validate.onclick = validateCurrentTri;
    for (let i = 1; i <= 5; i += 1) {
      ['m','s','e'].forEach((prefix) => {
        const input = document.getElementById(prefix + i);
        if (input) input.addEventListener('change', computeAndPersist);
      });
    }
    const comment = document.getElementById('autoComment');
    if (comment) comment.addEventListener('input', computeAndPersist);
    document.querySelectorAll("#autoEvalForm input[type='checkbox']").forEach((cb) => cb.addEventListener('change', computeAndPersist));
  });
})();
</script>`;
    return injectBeforeBodyEnd(out, patch);
  });
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
patchGeneratedPages();
extractInstitutionalLogo();

const repaired = repairCaseSensitiveReferences();
console.log(`SEB EvalPro: plateau préparé depuis les fichiers source/ (${repaired} référence(s) de casse réparée(s)), correctifs terrain appliqués, logo institutionnel extrait.`);
