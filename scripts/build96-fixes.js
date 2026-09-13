const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const buildNumber = String(process.env.SEB_BUILD_LABEL || process.env.GITHUB_RUN_NUMBER || 'DEV');

function fail(message, code = 2) {
  console.error(`SEB EvalPro corrections #96: ${message}`);
  process.exit(code);
}

function read(relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) fail(`fichier introuvable: ${relativePath}`);
  return { file, text: fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') };
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

function replaceOnce(text, search, replacement, label) {
  if (!text.includes(search)) fail(`cible introuvable pour ${label}`, 3);
  return text.replace(search, replacement);
}

// 1) Le bouton Abandonner était encore visible partout :
//    .seb-action-btn impose display:inline-flex!important, ce qui annulait display:none.
{
  const { file, text } = read('app/web/js/seb-ui-runtime.js');
  let out = text;
  const oldBlock = `  function refreshAbandonButton() {\n    const button = ensureAbandonButton();\n    const context = currentExerciseContext();\n    button.style.display = context ? 'inline-flex' : 'none';\n    if (context) button.title = 'Abandonner : ' + context.label;\n  }`;
  const newBlock = `  function refreshAbandonButton() {\n    const button = ensureAbandonButton();\n    const context = currentExerciseContext();\n    if (context) {\n      button.style.setProperty('display', 'inline-flex', 'important');\n      button.title = 'Abandonner : ' + context.label;\n    } else {\n      button.style.setProperty('display', 'none', 'important');\n      button.title = '';\n    }\n  }`;
  out = replaceOnce(out, oldBlock, newBlock, 'visibilité réelle du bouton Abandonner');
  if (!out.includes("button.style.setProperty('display', 'none', 'important')")) fail('masquage important Abandonner absent', 4);
  write(file, out);
}

// 2) Paronymes : Vérifier restait visuellement actif à cause du même !important
//    et recréait un nouveau bouton Suivant à chaque clic.
{
  const { file, text } = read('app/web/paronymes.html');
  let out = text;
  out = replaceOnce(
    out,
    "        btnCheck.style.display = 'none';",
    "        btnCheck.style.setProperty('display', 'none', 'important');\n        btnCheck.disabled = true;",
    'masquage définitif Vérifier paronymes'
  );

  const oldNext = `        const btnNext = document.createElement('button');\n        btnNext.className = 'btn';\n        btnNext.textContent = 'Suivant →';\n        btnNext.onclick = () => window.location.href = 'carre.html';\n        \n        btnCheck.parentElement.appendChild(btnNext);`;
  const newNext = `        let btnNext = document.getElementById('btnNextParonymes');\n        if (!btnNext) {\n            btnNext = document.createElement('button');\n            btnNext.id = 'btnNextParonymes';\n            btnNext.className = 'btn';\n            btnNext.textContent = 'Suivant →';\n            btnNext.onclick = () => window.location.href = 'carre.html';\n            btnCheck.parentElement.appendChild(btnNext);\n        }`;
  out = replaceOnce(out, oldNext, newNext, 'bouton Suivant unique paronymes');
  if (!out.includes("id = 'btnNextParonymes'") && !out.includes("btnNext.id = 'btnNextParonymes'")) fail('identifiant bouton Suivant paronymes absent', 5);
  write(file, out);
}

// 3) Afficher le numéro du build dans la barre Administrateur.
//    Le numéro vient de GitHub Actions ou d'un libellé explicite de test.
{
  const { file, text } = read('src/preload.js');
  let out = text;
  const nameLine = '    <div class="seb-evalpro-name">SEB EvalPro</div>';
  if (!out.includes('id="seb-evalpro-build"')) {
    out = replaceOnce(
      out,
      nameLine,
      `${nameLine}\n    <div id="seb-evalpro-build" class="seb-evalpro-build">Build #${buildNumber}</div>`,
      'numéro de build dans barre admin'
    );
  }
  const styleLine = '    #seb-evalpro-topbar .seb-evalpro-name{font-size:18px;font-weight:700;white-space:nowrap}';
  if (!out.includes('.seb-evalpro-build{')) {
    out = replaceOnce(
      out,
      styleLine,
      `${styleLine}\n    #seb-evalpro-topbar .seb-evalpro-build{font-size:12px;font-weight:700;white-space:nowrap;opacity:.9;padding:3px 7px;border:1px solid rgba(255,255,255,.55);border-radius:10px}`,
      'style numéro build'
    );
  }
  if (!out.includes(`Build #${buildNumber}`)) fail('numéro de build non injecté dans preload', 6);
  write(file, out);
}

console.log(`SEB EvalPro #96: Abandonner réellement masqué hors exercices, Paronymes avec un seul bouton Suivant, barre admin = Build #${buildNumber}.`);
