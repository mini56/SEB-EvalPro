const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error(`SEB EvalPro exercices: ${message}`);
  process.exit(code);
}

function read(relativePath) {
  const target = path.join(root, relativePath);
  if (!fs.existsSync(target)) fail(`fichier introuvable: ${relativePath}`);
  return { target, text: fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') };
}

function write(target, text) {
  fs.writeFileSync(target, text, 'utf8');
}

function replaceOnce(text, search, replacement, label) {
  const found = typeof search === 'string' ? text.includes(search) : search.test(text);
  if (!found) fail(`cible introuvable pour ${label}`, 3);
  if (search instanceof RegExp) search.lastIndex = 0;
  return text.replace(search, replacement);
}

function insertBeforeLast(text, marker, addition, label) {
  const index = text.toLowerCase().lastIndexOf(marker.toLowerCase());
  if (index < 0) fail(`point d'insertion introuvable pour ${label}`, 3);
  return text.slice(0, index) + addition + text.slice(index);
}

// -----------------------------------------------------------------------------
// Tri de chevilles : correction du texte demandé, sans modifier l'interface.
// -----------------------------------------------------------------------------
{
  const { target, text } = read('app/web/tri_de_cheville.html');
  let out = text;

  out = replaceOnce(out, 'Le tri de chevillles', 'Le tri de chevilles', 'titre tri de chevilles');

  const scenario = /Une mauvaise manipulation a provoqué la chute d’une caisse entière de chevilles au chargement du camion, semant le désordre,\s*tout est mélangé\. Un client important attend sa commande en urgence, et la production est à l’arrêt\.\s*Toute l’équipe est mobilisée pour remettre de l’ordre,\s*trier les bo[iî]tes(?: de)? chevilles par couleurs et permettre à la livraison d’être honorée dans les temps\.\s*Chacun des employés doit trier (?:cinq bo[iî]tes de chevilles|de trois à cinq bo[iî]tes de chevilles, selon le temps disponible,) et noter les temps passés\./;
  const corrected = 'Une mauvaise manipulation a provoqué la chute d’une caisse entière de chevilles au chargement du camion, semant le désordre, tout est mélangé. Un client important attend sa commande en urgence, et la production est à l’arrêt. Toute l’équipe est mobilisée pour remettre de l’ordre, trier les boîtes de chevilles par couleurs et permettre à la livraison d’être honorée dans les temps. Chacun des employés doit trier de trois à cinq boîtes de chevilles, selon le temps disponible, et noter les temps passés.';
  out = replaceOnce(out, scenario, corrected, 'scénario tri de chevilles');

  write(target, out);
}

// -----------------------------------------------------------------------------
// Brique : pas de remise à zéro ; code de validation masqué par gros points.
// Le code doit être reconnu immédiatement. Le nombre d'erreurs reste obligatoire
// avant l'enregistrement final.
// -----------------------------------------------------------------------------
{
  const { target, text } = read('app/web/brique.html');
  let out = text;

  out = replaceOnce(
    out,
    '            <button id="resetBtn" type="button">Remise à zéro</button>\n',
    '',
    'bouton remise à zéro Brique'
  );

  out = replaceOnce(
    out,
    /\n\s*document\.getElementById\("resetBtn"\)\.onclick = function \(\) \{[\s\S]*?\n\s*\};\n/,
    '\n',
    'fonction remise à zéro Brique'
  );

  out = replaceOnce(
    out,
    '<input type="text" id="secretCode" maxlength="10" placeholder="Entrez le code" style="width: 120px;">',
    '<input type="password" id="secretCode" maxlength="10" placeholder="Entrez le code" autocomplete="off" spellcheck="false" style="width: 150px; font-size: 28px; letter-spacing: 7px; line-height: 1;">',
    'masquage code Brique'
  );

  if (!out.includes('id="seb-brique-secret-style"')) {
    const secretStyle = `\n<style id="seb-brique-secret-style">\n#secretCode::placeholder {\n  font-size: 14px;\n  letter-spacing: 0;\n  line-height: normal;\n  color: #64748b;\n  opacity: 1;\n}\n</style>\n`;
    out = replaceOnce(out, '</head>', secretStyle + '</head>', 'style placeholder Brique');
  }

  out = replaceOnce(
    out,
    `    function checkInputs() {\n      const errFilled = errInput.value.trim() !== "";\n      const codeValid = /^svg56$/i.test(codeInput.value.trim());\n      validBtn.disabled = !(errFilled && codeValid);\n      if (!codeValid && codeInput.value.trim().length >= 5) {\n        msgDiv.textContent = "Code incorrect !";\n      } else {\n        msgDiv.textContent = "";\n      }\n    }`,
    `    function checkInputs() {\n      const rawCode = codeInput.value.trim();\n      const errFilled = errInput.value.trim() !== "";\n      const codeValid = rawCode.toLowerCase() === "svg56";\n\n      // Le mot de passe déverrouille immédiatement le bouton.\n      // Le nombre d'erreurs reste contrôlé au clic sur Valider.\n      validBtn.disabled = !codeValid;\n\n      if (!rawCode) {\n        msgDiv.textContent = "";\n      } else if (!codeValid && rawCode.length >= 5) {\n        msgDiv.textContent = "Code incorrect !";\n      } else if (codeValid && !errFilled) {\n        msgDiv.textContent = "Code correct — renseignez le nombre d’erreurs.";\n      } else if (codeValid) {\n        msgDiv.textContent = "Code correct.";\n      } else {\n        msgDiv.textContent = "";\n      }\n    }`,
    'validation code Brique'
  );

  out = replaceOnce(
    out,
    `    validBtn.onclick = function () {\n  const datas = {`,
    `    validBtn.onclick = function () {\n  if (codeInput.value.trim().toLowerCase() !== "svg56") {\n    msgDiv.textContent = "Code incorrect !";\n    codeInput.focus();\n    return;\n  }\n  if (errInput.value.trim() === "") {\n    msgDiv.textContent = "Renseignez le nombre d’erreurs avant de valider.";\n    errInput.focus();\n    return;\n  }\n  const datas = {`,
    'contrôle final Brique'
  );

  if (out.includes('id="resetBtn"') || out.includes('getElementById("resetBtn").onclick')) {
    fail('la remise à zéro Brique est encore active', 4);
  }
  if (!out.includes('type="password" id="secretCode"')) fail('le code Brique n’est pas masqué', 5);
  if (!out.includes('Code correct — renseignez le nombre d’erreurs.')) fail('retour de validation du code Brique absent', 5);

  write(target, out);
}

// -----------------------------------------------------------------------------
// Paronymes : contrôle bloquant du barème 20/20 + correction d'un </tr> mal fermé.
// -----------------------------------------------------------------------------
{
  const { target, text } = read('app/web/paronymes.html');
  let out = text;

  if (out.includes('Interdire</td></td>')) {
    out = out.replace('Interdire</td></td>', 'Interdire</td></tr>');
  }

  const rows = (out.match(/<tr>[\s\S]*?<\/tr>/g) || []).filter((row) => row.includes('class="paronyme"'));
  if (rows.length !== 20) fail(`Paronymes: ${rows.length} lignes évaluées au lieu de 20`, 6);
  rows.forEach((row, index) => {
    const correctCount = (row.match(/data-correct="true"/g) || []).length;
    if (correctCount !== 1) fail(`Paronymes: ligne ${index + 1} contient ${correctCount} bonne(s) réponse(s)`, 7);
  });

  if (!out.includes('score++;') || !out.includes('total++;')) {
    fail('Paronymes: logique 1 point par ligne introuvable', 8);
  }

  write(target, out);
}

// -----------------------------------------------------------------------------
// Page 2 + résultat Brique : supprimer les flèches/curseurs des champs numériques,
// bloquer les variations accidentelles, éviter la fuite JavaScript à l'écran et
// supprimer le décalage avant les réponses cochées de l'autoévaluation Brique.
// -----------------------------------------------------------------------------
{
  const { target, text } = read('app/web/qcmv1.0.html');
  let out = text;

  const page2Inputs = (out.match(/id="reponse2_[1-5]"/g) || []).length;
  if (page2Inputs !== 5) fail(`Page 2: ${page2Inputs} champs réponse trouvés au lieu de 5`, 9);

  if (!out.includes('id="seb-page2-no-spinner"')) {
    const css = `\n<style id="seb-page2-no-spinner">\n#page2 input[type="number"]::-webkit-inner-spin-button,\n#page2 input[type="number"]::-webkit-outer-spin-button {\n  -webkit-appearance: none;\n  margin: 0;\n}\n#page2 input[type="number"] {\n  -webkit-appearance: none;\n  appearance: textfield;\n  -moz-appearance: textfield;\n}\n</style>\n`;
    out = replaceOnce(out, '</head>', css + '</head>', 'style sans curseur page 2');
  }

  if (!out.includes('id="seb-page2-safe-number-inputs"')) {
    const js = `\n<script id="seb-page2-safe-number-inputs">\ndocument.addEventListener('DOMContentLoaded', function () {\n  document.querySelectorAll('#page2 input[type="number"]').forEach(function (input) {\n    input.addEventListener('wheel', function (event) {\n      event.preventDefault();\n    }, { passive: false });\n    input.addEventListener('keydown', function (event) {\n      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') event.preventDefault();\n    });\n  });\n});\n</script>\n`;
    out = insertBeforeLast(out, '</body>', js, 'protection saisie page 2');
  }

  out = replaceOnce(
    out,
    '<div style="margin:5px 0 5px 20px;">',
    '<div style="margin:5px 0;">',
    'alignement autoévaluation Brique dans les résultats'
  );

  const safeScriptPos = out.indexOf('id="seb-page2-safe-number-inputs"');
  const exportMarkerPos = out.indexOf('NOM DE FICHIER PERSONNALISÉ');
  if (safeScriptPos >= 0 && exportMarkerPos >= 0 && safeScriptPos < exportMarkerPos) {
    fail('Page 2: le script de protection a été injecté dans le modèle Word', 10);
  }
  if (out.includes('margin:5px 0 5px 20px;')) {
    fail('Résultat Brique: décalage des réponses autoévaluation encore présent', 11);
  }

  // Vérifie aussi que le résultat général utilise bien le total réel de l'exercice Paronymes.
  if (!out.includes('totalQuestions += totalQ;')) fail('résultat général: total Paronymes non repris dynamiquement', 10);

  write(target, out);
}

console.log('SEB EvalPro exercices: tri corrigé, Brique sans remise à zéro + code masqué/validé + résultat aligné, Paronymes vérifié 20/20, page 2 sans curseurs numériques et sans fuite JavaScript.');
