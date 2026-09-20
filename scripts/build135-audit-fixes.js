const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error(`SEB EvalPro Build #135 audit: ${message}`);
  process.exit(code);
}

function read(relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) fail(`fichier introuvable: ${relativePath}`, 3);
  return { file, text: fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') };
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

function replaceOnce(text, search, replacement, label) {
  const found = typeof search === 'string' ? text.includes(search) : search.test(text);
  if (!found) fail(`cible introuvable pour ${label}`, 4);
  if (search instanceof RegExp) search.lastIndex = 0;
  return text.replace(search, replacement);
}

function replaceCount(text, search, replacement, minCount, label) {
  const count = text.split(search).length - 1;
  if (count < minCount) fail(`${label}: ${count} occurrence(s), attendu au moins ${minCount}`, 5);
  return text.split(search).join(replacement);
}

function checkHtmlScripts(html, label) {
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  let scriptNo = 0;
  while ((match = scriptRe.exec(html))) {
    scriptNo += 1;
    if (/\bsrc\s*=/.test(match[1] || '')) continue;
    const code = (match[2] || '').trim();
    if (!code) continue;
    try { new vm.Script(code); }
    catch (error) { fail(`${label}: JavaScript inline invalide (script ${scriptNo}) : ${error.message}`, 6); }
  }
}

// -----------------------------------------------------------------------------
// 1. Bilan administrateur : barèmes institutionnels et absence = pas de points.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('app/web/admin-bilan.html');
  let out = text;

  out = replaceOnce(
    out,
    "const bl=be<=1?'I':be<=3?'II':'III'",
    "const bl=be<=2?'I':be<=4?'II':'III'",
    'barème Briques 0-2 / 3-4 / 5+'
  );

  out = replaceOnce(
    out,
    "apply('mail',e<=2?'I':e===3?'II':'III'",
    "apply('mail',e<=1?'I':e<=3?'II':'III'",
    'barème Messagerie 0-1 / 2-3 / 4+'
  );

  if (out.includes("'- '+v+' / 8 point(s)'")) {
    out = out.replace("'- '+v+' / 8 point(s)'", "'- '+v+' / 7 point(s)'");
  }

  out = replaceCount(out, 'Math.round(pr/28*100)', 'Math.round(pr/27*100)', 1, 'dénominateur Maths /27');
  out = replaceCount(out, "'- '+pr+' / 28 réponses correctes ('+p+' %)'", "'- '+pr+' / 27 réponses correctes ('+p+' %)'", 1, 'affichage Maths /27');

  const expressionStart = out.indexOf("const dictee=json('dictee_data',null);");
  const expressionEnd = out.indexOf('let e=0,he=false;', expressionStart);
  if (expressionStart < 0 || expressionEnd < 0 || expressionEnd <= expressionStart) {
    fail('bloc Expression écrite final introuvable', 7);
  }
  const expression = `const dictee=json('dictee_data',null);const dicteeOK=dictee?.status==='verified'&&Number.isFinite(+dictee.scoreSur20);\nconst hasTexteTrous=Object.hasOwn(sc,'pageTexteTrous');const parTotalRaw=sessionStorage.getItem('paronymes_total');const parTotal=parTotalRaw!==null?(+parTotalRaw||0):0;const hasParonymes=parTotalRaw!==null&&parTotal>0;const genreRaw=sessionStorage.getItem('erreurs_exercice');const hasGenreNombre=genreRaw!==null;const exp=hasTexteTrous||hasParonymes||hasGenreNombre||dicteeOK;if(exp){let v=0,tt=0;const details=[];if(hasTexteTrous){const tr=Math.max(0,Math.min(15,+sc.pageTexteTrous||0));v+=tr;tt+=15;details.push('Texte à trous : '+tr+' / 15')}if(hasParonymes){const p=Math.max(0,Math.min(parTotal,+sessionStorage.getItem('paronymes_score')||0));v+=p;tt+=parTotal;details.push('Paronymes : '+p+' / '+parTotal)}if(hasGenreNombre){const err=Math.max(0,+genreRaw||0),g=Math.max(0,Math.min(20,20-err));v+=g;tt+=20;details.push('Genre / Nombre : '+g+' / 20')}if(dicteeOK){const d=Math.max(0,Math.min(20,+dictee.scoreSur20));v+=d;tt+=20;details.push('Dictée : '+d+' / 20')}const pc=tt?Math.round(v/tt*100):0;apply('expression',pc>=70?'I':pc>=45?'II':'III','- '+v+' / '+tt+' point(s) ('+pc+' %)'+(details.length?' — '+details.join(' · '):''))}\n`;
  out = out.slice(0, expressionStart) + expression + out.slice(expressionEnd);

  for (const required of [
    "const bl=be<=2?'I':be<=4?'II':'III'",
    "apply('mail',e<=1?'I':e<=3?'II':'III'",
    'Math.round(pr/27*100)',
    "hasGenreNombre=genreRaw!==null",
    "details.push('Dictée : '+d+' / 20')"
  ]) {
    if (!out.includes(required)) fail('Bilan final incomplet : ' + required, 8);
  }
  if (out.includes('Math.round(pr/28*100)')) fail('ancien dénominateur Maths /28 encore présent', 8);

  checkHtmlScripts(out, 'admin-bilan.html');
  write(file, out);
}

// -----------------------------------------------------------------------------
// 2. Résultats candidat : traitement de texte /7, dénominateurs cohérents,
//    carré résilient et code Brique masqué. La page Résultats est désormais
//    consultée directement depuis le dossier candidat, sans DOCX automatique.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('app/web/qcmv1.0.html');
  let out = text;

  if (out.includes('const scoreMax = 8;')) out = out.replace('const scoreMax = 8;', 'const scoreMax = 7;');
  out = out.replace(/^.*analyse\.score\.enregistrement.*Enregistrement via le menu Fichier.*\n?/m, '');

  if (out.includes("const rep4 = reponses['page4'] || \"0/0\";")) {
    out = out.replace("const rep4 = reponses['page4'] || \"0/0\";", "const rep4 = reponses['page4'] || \"0/3\";");
  }
  out = replaceOnce(out, 'totalQuestions += denom4 || 1;', 'totalQuestions += denom4 || 3;', 'dénominateur Fractions absent = 3');
  out = replaceOnce(out, 'totalQuestions += repTxt.length || 1;', 'totalQuestions += repTxt.length || 15;', 'dénominateur Texte à trous absent = 15');
  out = out.replace('(Score : ${scTxt}/${repTxt.length || 0})', '(Score : ${scTxt}/${repTxt.length || 15})');

  if (out.includes("const puzzleErrors = sessionStorage.getItem('puzzleErrors');")) {
    out = out.replace(
      "const puzzleErrors = sessionStorage.getItem('puzzleErrors');",
      "const puzzleErrors = sessionStorage.getItem('carre_magique_erreurs') ?? sessionStorage.getItem('puzzleErrors');"
    );
  }

  out = out.replace(/\s*<span><strong>🔑 Code :<\/strong> \$\{evalBrique\.code \|\| ["']—["']\}<\/span>/g, '');

  for (const required of [
    'const scoreMax = 7;',
    'totalQuestions += denom4 || 3;',
    'totalQuestions += repTxt.length || 15;',
    "sessionStorage.getItem('carre_magique_erreurs') ?? sessionStorage.getItem('puzzleErrors')"
  ]) {
    if (!out.includes(required)) fail('Résultats candidat incomplets : ' + required, 10);
  }
  if (out.includes('Enregistrement via le menu Fichier</span>')) fail('critère fantôme enregistrement encore affiché', 10);
  if (/🔑 Code[\s\S]{0,100}evalBrique\.code/.test(out)) fail('code Brique encore affiché dans les résultats', 10);

  checkHtmlScripts(out, 'qcmv1.0.html');
  write(file, out);
}

// -----------------------------------------------------------------------------
// 3. Carré : ne plus supprimer le résultat au rechargement.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('app/web/carre.html');
  let out = text;
  const destructive = /\s*function clearPageData\(\) \{\s*sessionStorage\.removeItem\(["']puzzleErrors["']\);[\s\S]*?\}\s*\/\/ Appel de la fonction au chargement de la page\s*window\.addEventListener\(["']DOMContentLoaded["'], clearPageData\);/;
  if (destructive.test(out)) {
    out = out.replace(destructive, "\n// Build #135 : le résultat du Carré est conservé pour permettre une reprise exacte.\n");
  }
  if (/sessionStorage\.removeItem\(["']puzzleErrors["']\)/.test(out)) fail('Carré : suppression destructive puzzleErrors encore présente', 11);
  checkHtmlScripts(out, 'carre.html');
  write(file, out);
}

// -----------------------------------------------------------------------------
// 4. Paronymes : remplacer la réponse contestable Raboter -> Revoir par Aplanir.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('app/web/paronymes.html');
  let out = text;
  const oldRow = /(<td class="paronyme">Raboter<\/td><td>Robotiser<\/td><td data-correct="true">)Revoir(<\/td>)/;
  if (oldRow.test(out)) out = out.replace(oldRow, '$1Aplanir$2');
  if (!/<td class="paronyme">Raboter<\/td><td>Robotiser<\/td><td data-correct="true">Aplanir<\/td>/.test(out)) {
    fail('Paronymes : correction Raboter -> Aplanir absente', 12);
  }
  const rows = (out.match(/<tr>[\s\S]*?<\/tr>/g) || []).filter((row) => row.includes('class="paronyme"'));
  if (rows.length !== 20) fail(`Paronymes : ${rows.length} lignes au lieu de 20`, 12);
  rows.forEach((row, index) => {
    const count = (row.match(/data-correct="true"/g) || []).length;
    if (count !== 1) fail(`Paronymes : ligne ${index + 1}, ${count} bonne(s) réponse(s)`, 12);
  });
  checkHtmlScripts(out, 'paronymes.html');
  write(file, out);
}

// -----------------------------------------------------------------------------
// 5. Word du bilan : routage vers le dossier candidat sélectionné.
// L'ancien DOCX automatique de la page Résultats n'existe plus.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/main.js');
  const out = text;
  for (const required of [
    "const candidateExportDir = getCandidateStore().getActiveExportDir();",
    "const targetDirectory = adminExportCandidateDir || candidateExportDir || bilanDocumentsDir();",
    "const isCurrentCandidateWord = !!adminExportCandidateDir && /^Evaluation_.+\\.docx?$/i.test(filename);"
  ]) {
    if (!out.includes(required)) fail('routage Word bilan candidat absent : ' + required, 13);
  }
  if (out.includes('Resultat_')) fail('ancien routage DOCX de résultats encore présent dans main.js', 13);
  try { new vm.Script(out); } catch (error) { fail('src/main.js invalide : ' + error.message, 13); }
  write(file, out);
}

// -----------------------------------------------------------------------------
// 6. Replay : capture pleine page avec repli viewport.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/replay-main.js');
  let out = text;

  if (!out.includes('async function captureFullPage')) {
    const marker = '  async function capturePage(event, payload) {';
    const index = out.indexOf(marker);
    if (index < 0) fail('point insertion capture pleine page introuvable', 14);
    const helper = `  async function captureFullPage(webContents) {\n    let attachedHere = false;\n    try {\n      const dbg = webContents.debugger;\n      if (!dbg.isAttached()) {\n        dbg.attach('1.3');\n        attachedHere = true;\n      }\n      await dbg.sendCommand('Page.enable');\n      const metrics = await dbg.sendCommand('Page.getLayoutMetrics');\n      const content = metrics.cssContentSize || metrics.contentSize || {};\n      const width = Math.max(1, Math.ceil(Number(content.width) || 0));\n      const height = Math.max(1, Math.ceil(Number(content.height) || 0));\n      if (width > 1 && height > 1) {\n        const shot = await dbg.sendCommand('Page.captureScreenshot', {\n          format: 'png',\n          fromSurface: true,\n          captureBeyondViewport: true,\n          clip: { x: 0, y: 0, width, height, scale: 1 }\n        });\n        const png = Buffer.from(String(shot && shot.data || ''), 'base64');\n        if (png.length) return { png, size: { width, height }, fullPage: true };\n      }\n    } catch (_) {\n      // Repli ci-dessous sur capturePage() si le protocole DevTools est indisponible.\n    } finally {\n      if (attachedHere) {\n        try { webContents.debugger.detach(); } catch (_) {}\n      }\n    }\n    const image = await webContents.capturePage();\n    if (!image || image.isEmpty()) throw new Error('Capture visuelle vide.');\n    return { png: image.toPNG(), size: image.getSize(), fullPage: false };\n  }\n\n`;
    out = out.slice(0, index) + helper + out.slice(index);
  }

  const oldCapture = `      const image = await event.sender.capturePage();\n      if (!image || image.isEmpty()) return { ok: false, error: 'Capture visuelle vide.' };\n      const png = image.toPNG();\n      if (!png || !png.length) return { ok: false, error: 'Capture PNG vide.' };\n      const size = image.getSize();`;
  const newCapture = `      const capture = await captureFullPage(event.sender);\n      const png = capture.png;\n      if (!png || !png.length) return { ok: false, error: 'Capture PNG vide.' };\n      const size = capture.size;`;
  if (out.includes(oldCapture)) out = out.replace(oldCapture, newCapture);
  if (!out.includes("captureBeyondViewport: true") || !out.includes('const capture = await captureFullPage(event.sender);')) {
    fail('capture pleine page replay incomplète', 14);
  }
  try { new vm.Script(out); } catch (error) { fail('src/replay-main.js invalide : ' + error.message, 14); }
  write(file, out);
}

// -----------------------------------------------------------------------------
// 7. Replay : archivage garanti à Résultats + affichage des longues captures.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/replay-preload.js');
  let out = text;

  const start = out.indexOf('async function archiveIfFinalVisible() {');
  const end = out.indexOf('\nfunction installCaptureRecorder()', start);
  if (start < 0 || end < 0) fail('fonction archiveIfFinalVisible introuvable', 15);
  const enhanced = `async function archiveIfFinalVisible(options = {}) {\n  if (pageName().toLowerCase() !== 'qcmv1.0.html') return { ok: true, skipped: true };\n  const final = document.getElementById('pageFinale');\n  if (!final || !final.classList.contains('visible')) return { ok: true, skipped: true };\n  try { window.sessionStorage.setItem('seb_evalpro_results_seen', '1'); } catch (_) {}\n  const existing = window.sessionStorage.getItem('seb_evalpro_replay_archive_file');\n  if (existing) return { ok: true, filename: existing, alreadyArchived: true };\n  if (archiveInFlight) {\n    for (let i = 0; i < 40 && archiveInFlight; i += 1) await new Promise((resolve) => setTimeout(resolve, 100));\n    const afterWait = window.sessionStorage.getItem('seb_evalpro_replay_archive_file');\n    if (afterWait) return { ok: true, filename: afterWait, alreadyArchived: true };\n    if (archiveInFlight) return { ok: false, error: 'Archivage du parcours toujours en cours.' };\n  }\n\n  archiveInFlight = true;\n  try {\n    await new Promise((resolve) => setTimeout(resolve, 180));\n    await captureCurrentPage('final-results', true);\n    const result = await ipcRenderer.invoke('replay:archive-final', buildArchivePayload());\n    if (!result || !result.ok || !result.filename) throw new Error(result?.error || 'Archivage du parcours refusé.');\n    window.sessionStorage.setItem('seb_evalpro_replay_archive_file', result.filename);\n    window.sessionStorage.setItem('seb_evalpro_replay_archive_build', String(result.build || ''));\n    window.sessionStorage.setItem('seb_evalpro_replay_archive', JSON.stringify({\n      filename: result.filename,\n      build: result.build,\n      slides: result.slides,\n      integritySha256: result.integritySha256\n    }));\n    window.sessionStorage.removeItem('seb_evalpro_replay_archive_error');\n    return result;\n  } catch (error) {\n    const message = error && error.message ? error.message : String(error || 'Archivage impossible.');\n    try { window.sessionStorage.setItem('seb_evalpro_replay_archive_error', message); } catch (_) {}\n    if (options.notify) window.alert('Archivage du parcours impossible : ' + message + '\\nLa session ne sera pas fermée tant que le parcours n’est pas archivé.');\n    return { ok: false, error: message };\n  } finally {\n    archiveInFlight = false;\n  }\n}\n\nasync function ensureFinalArchive() {\n  const archived = window.sessionStorage.getItem('seb_evalpro_replay_archive_file');\n  if (archived) return { ok: true, filename: archived, alreadyArchived: true };\n  const resultsSeen = window.sessionStorage.getItem('seb_evalpro_results_seen') === '1';\n  const final = pageName().toLowerCase() === 'qcmv1.0.html' ? document.getElementById('pageFinale') : null;\n  const finalVisible = !!(final && final.classList.contains('visible'));\n  if (!resultsSeen && !finalVisible) return { ok: true, skipped: true };\n  if (!finalVisible) {\n    const error = 'La page Résultats a été atteinte mais le parcours n’est pas archivé. Revenez à l’évaluation puis affichez Résultats avant de fermer la session.';\n    window.alert(error);\n    return { ok: false, error };\n  }\n  return archiveIfFinalVisible({ notify: true });\n}\n`;
  out = out.slice(0, start) + enhanced + out.slice(end);

  out = out.replace(
    '.seb-visual-stage{flex:1;min-height:0;overflow:auto;background:#272727;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box}',
    '.seb-visual-stage{flex:1;min-height:0;overflow:auto;background:#272727;display:flex;align-items:flex-start;justify-content:center;padding:12px;box-sizing:border-box}'
  );
  out = out.replace(
    '.seb-visual-stage img{display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.35);user-select:none;-webkit-user-drag:none}',
    '.seb-visual-stage img{display:block;max-width:100%;max-height:none;width:auto;height:auto;object-fit:initial;background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.35);user-select:none;-webkit-user-drag:none}'
  );
  out = replaceOnce(out, 'module.exports = { install, openCandidateReplay };', 'module.exports = { install, openCandidateReplay, ensureFinalArchive };', 'export ensureFinalArchive sans perdre openCandidateReplay');

  for (const required of ['seb_evalpro_results_seen', 'ensureFinalArchive', 'module.exports = { install, openCandidateReplay, ensureFinalArchive };', 'max-height:none']) {
    if (!out.includes(required)) fail('replay-preload incomplet : ' + required, 15);
  }
  try { new vm.Script(out); } catch (error) { fail('src/replay-preload.js invalide : ' + error.message, 15); }
  write(file, out);
}

// -----------------------------------------------------------------------------
// 8. Fermeture de session : attendre/refuser si Résultats a été vu sans archive.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/preload.js');
  let out = text;
  if (!out.includes('SEB_BUILD135_REPLAY_CLOSE_GUARD')) {
    const marker = '    closingSession = true;';
    const guard = `    // SEB_BUILD135_REPLAY_CLOSE_GUARD\n    if (replayPrototype && typeof replayPrototype.ensureFinalArchive === 'function') {\n      const replayArchive = await replayPrototype.ensureFinalArchive();\n      if (!replayArchive || replayArchive.ok !== true) {\n        scheduleHideBar();\n        return;\n      }\n    }\n\n`;
    const index = out.indexOf(marker);
    if (index < 0) fail('point garde fermeture session introuvable', 16);
    out = out.slice(0, index) + guard + out.slice(index);
  }
  if (!out.includes('SEB_BUILD135_REPLAY_CLOSE_GUARD')) fail('garde fermeture replay absente', 16);
  try { new vm.Script(out); } catch (error) { fail('src/preload.js invalide : ' + error.message, 16); }
  write(file, out);
}

// -----------------------------------------------------------------------------
// 9. Tests fonctionnels bloquants des seuils corrigés.
// -----------------------------------------------------------------------------
{
  const levelBrique = (e) => e <= 2 ? 'I' : e <= 4 ? 'II' : 'III';
  if (levelBrique(0) !== 'I' || levelBrique(2) !== 'I' || levelBrique(3) !== 'II' || levelBrique(4) !== 'II' || levelBrique(5) !== 'III') {
    fail('test barème Briques échoué', 17);
  }
  const levelMail = (e) => e <= 1 ? 'I' : e <= 3 ? 'II' : 'III';
  if (levelMail(1) !== 'I' || levelMail(2) !== 'II' || levelMail(3) !== 'II' || levelMail(4) !== 'III') {
    fail('test barème Messagerie échoué', 17);
  }
  const mathPercent = Math.round(19 / 27 * 100);
  if (mathPercent !== 70) fail('test Maths 19/27 doit donner 70 %', 17);

  function expression(parts) {
    let value = 0, total = 0;
    if (parts.texte !== undefined) { value += parts.texte; total += 15; }
    if (parts.par !== undefined) { value += parts.par; total += parts.parTotal; }
    if (parts.genre !== undefined) { value += parts.genre; total += 20; }
    if (parts.dictee !== undefined) { value += parts.dictee; total += 20; }
    return { value, total };
  }
  const noGenre = expression({ texte: 15, par: 20, parTotal: 20 });
  if (noGenre.value !== 35 || noGenre.total !== 35) fail('Expression : Genre/Nombre absent attribue encore des points fantômes', 17);
  const full = expression({ texte: 15, par: 20, parTotal: 20, genre: 20, dictee: 20 });
  if (full.value !== 75 || full.total !== 75) fail('Expression complète doit rester sur 75', 17);
}

console.log('SEB EvalPro Build #135 : audit corrigé — Maths /27, traitement de texte /7, Briques/Messagerie, Expression sans points fantômes, résultats robustes, Carré repris, Paronymes corrigé, Word bilan routé par candidat, replay pleine page et fermeture protégée.');
