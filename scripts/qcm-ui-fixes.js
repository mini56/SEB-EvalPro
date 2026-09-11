const fs = require('fs');
const path = require('path');

function readTarget(name) {
  const target = path.resolve(__dirname, '..', 'app', 'web', name);
  if (!fs.existsSync(target)) {
    console.error(`SEB EvalPro UI: ${name} généré introuvable.`);
    process.exit(2);
  }
  return { target, html: fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') };
}

function replaceRequired(state, search, replacement, label) {
  if (!state.html.includes(search)) {
    console.error(`SEB EvalPro UI: cible introuvable pour ${label}.`);
    process.exit(3);
  }
  state.html = state.html.replace(search, replacement);
}

// nvmail : dans l'archive Electron, la casse du chemin doit correspondre exactement
// au nom réel des images du dossier imageqcm.
{
  const state = readTarget('nvmail.html');
  replaceRequired(
    state,
    'imageqcm/scenario.PNG',
    'imageqcm/scenario.png',
    'image scénario de nvmail'
  );
  replaceRequired(
    state,
    'imageqcm/avatar_transparant.PNG',
    'imageqcm/avatar_transparant.png',
    'image consigne de nvmail'
  );
  fs.writeFileSync(state.target, state.html, 'utf8');
}

// Bilan administrateur : conserver les couleurs de niveau mais ne plus écrire
// NE / I / II / III dans les cellules de chaque test. Les libellés de l'en-tête
// restent intacts car ils sont écrits directement dans les <th>.
{
  const state = readTarget('admin-bilan.html');
  replaceRequired(
    state,
    '.level.on:after{content:attr(data-l);font-weight:700;font-size:14pt}',
    '',
    'symboles de niveau dans les cellules du bilan'
  );

  const wordLevelLabel = "const lab=document.createElement('div');lab.className='word-level-label';lab.style.fontWeight='700';lab.style.fontSize='14pt';lab.style.textAlign='center';lab.textContent=l;el.appendChild(lab)";
  replaceRequired(
    state,
    wordLevelLabel,
    '',
    'symboles de niveau dans export Word'
  );

  fs.writeFileSync(state.target, state.html, 'utf8');
}

console.log('SEB EvalPro UI: images nvmail corrigées et symboles de niveau retirés du corps du bilan.');
