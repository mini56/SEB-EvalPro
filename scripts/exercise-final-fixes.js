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

// -----------------------------------------------------------------------------
// Tri de chevilles : correction du texte demandé, sans modifier l'interface.
// -----------------------------------------------------------------------------
{
  const { target, text } = read('app/web/tri_de_cheville.html');
  let out = text;

  out = replaceOnce(out, 'Le tri de chevillles', 'Le tri de chevilles', 'titre tri de chevilles');

  const scenario = /Une mauvaise manipulation a provoqué la chute d’une caisse entière de chevilles au chargement du camion, semant le désordre,\s*tout est mélangé\. Un client important attend sa commande en urgence, et la production est à l’arrêt\.Toute l’équipe est mobilisée pour remettre de l’ordre,\s*trier les boites chevilles par couleurs et permettre à la livraison d’être honorée dans les temps\.\s*Chacun des employés doit trier cinq boites de chevilles et noter les temps passés\./;
  const corrected = 'Une mauvaise manipulation a provoqué la chute d’une caisse entière de chevilles au chargement du camion, semant le désordre, tout est mélangé. Un client important attend sa commande en urgence, et la production est à l’arrêt. Toute l’équipe est mobilisée pour remettre de l’ordre, trier les boîtes de chevilles par couleurs et permettre à la livraison d’être honorée dans les temps. Chacun des employés doit trier cinq boîtes de chevilles et noter les temps passés.';
  out = replaceOnce(out, scenario, corrected, 'scénario tri de chevilles');

  write(target, out);
}

// -----------------------------------------------------------------------------
// Brique : pas de remise à zéro ; code de validation masqué par gros points.
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

  if (out.includes('id="resetBtn"') || out.includes('getElementById("resetBtn").onclick')) {
    fail('la remise à zéro Brique est encore active', 4);
  }
  if (!out.includes('type="password" id="secretCode"')) fail('le code Brique n’est pas masqué', 5);

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
// Page 2 : supprimer les flèches/curseurs des champs numériques et bloquer les
// variations accidentelles à la molette ou avec Flèche haut/bas.
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
    out = replaceOnce(out, '</body>', js + '</body>', 'protection saisie page 2');
  }

  // Vérifie aussi que le résultat général utilise bien le total réel de l'exercice Paronymes.
  if (!out.includes('totalQuestions += totalQ;')) fail('résultat général: total Paronymes non repris dynamiquement', 10);

  write(target, out);
}

console.log('SEB EvalPro exercices: tri corrigé, Brique sans remise à zéro + code masqué, Paronymes vérifié 20/20, page 2 sans curseurs numériques.');
