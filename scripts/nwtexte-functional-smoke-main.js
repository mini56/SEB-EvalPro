const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'nwtexte.html');

function fail(message, detail) {
  console.error('NWTEXTE_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

async function waitForEditor(win) {
  for (let i = 0; i < 80; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      "Boolean(window.Quill && window.sebNwtexteEditor && window.sebNwtexteSave && window.sebNwtexteDialogs && window.sebParcours && document.querySelector('#editor .ql-editor'))",
      true
    );
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Moteur Quill ou contrôleur nwtexte non initialisé.');
}

async function runFunctionalScenario(win) {
  return win.webContents.executeJavaScript(`
    (async function(){
      const assert = (condition, message) => {
        if (!condition) throw new Error(message);
      };
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const container = document.getElementById('editor');
      const q = Quill.find(container);
      assert(q && typeof q.setText === 'function', 'Instance Quill introuvable.');

      sessionStorage.clear();
      localStorage.removeItem('nwtexte_save_simulation');
      sessionStorage.setItem('candidat_data', JSON.stringify({
        nom:'TEST',
        prenom:'CANDIDAT',
        lieu:'Lorient',
        groupe:'7',
        date:'2026-09-26'
      }));

      q.setText('', 'silent');
      const title = 'Quelle est mon activité préférée et pourquoi ?';
      const bodyLines = Array.from({length:10}, (_, index) =>
        'Ligne ' + (index + 1) + ' du texte de test avec suffisamment de mots.'
      );
      const body = bodyLines.join('\\n');
      q.setText(title + '\\n' + body + '\\n', 'user');

      // Titre : utiliser réellement les contrôles de l'interface.
      q.setSelection(0, title.length, 'user');
      document.getElementById('btn-bold').click();
      const font = document.getElementById('nw-font');
      font.value = 'Arial';
      font.dispatchEvent(new Event('change', { bubbles:true }));
      const size = document.getElementById('nw-size');
      size.value = '16px';
      size.dispatchEvent(new Event('change', { bubbles:true }));

      let titleFormat = q.getFormat(0, title.length);
      assert(titleFormat.bold === true, 'Bouton Gras non fonctionnel.');
      assert(titleFormat.font === 'Arial', 'Police Arial du titre non appliquée.');
      assert(titleFormat.size === '16px', 'Taille 16px du titre non appliquée.');

      // Corps du texte : Arial 12 via les mêmes listes.
      const bodyStart = title.length + 1;
      q.setSelection(bodyStart, body.length, 'user');
      font.value = 'Arial';
      font.dispatchEvent(new Event('change', { bubbles:true }));
      size.value = '12px';
      size.dispatchEvent(new Event('change', { bubbles:true }));

      const bodyFormat = q.getFormat(bodyStart, Math.min(20, body.length));
      assert(bodyFormat.font === 'Arial', 'Police Arial du corps non appliquée.');
      assert(bodyFormat.size === '12px', 'Taille 12px du corps non appliquée.');

      // Italique et souligné : activation/désactivation sans polluer le document final.
      q.setSelection(bodyStart, 5, 'user');
      document.getElementById('btn-italic').click();
      assert(q.getFormat(bodyStart, 5).italic === true, 'Bouton Italique non fonctionnel.');
      document.getElementById('btn-italic').click();
      assert(q.getFormat(bodyStart, 5).italic !== true, 'Désactivation Italique non fonctionnelle.');
      document.getElementById('btn-underline').click();
      assert(q.getFormat(bodyStart, 5).underline === true, 'Bouton Souligné non fonctionnel.');
      document.getElementById('btn-underline').click();
      assert(q.getFormat(bodyStart, 5).underline !== true, 'Désactivation Souligné non fonctionnelle.');

      // Liste, alignement et interligne : vérifier puis restaurer.
      const lastLineStart = bodyStart + body.lastIndexOf('Ligne 10');
      q.setSelection(lastLineStart, 6, 'user');
      document.getElementById('btn-ul').click();
      assert(q.getFormat(lastLineStart, 1).list === 'bullet', 'Liste à puces non fonctionnelle.');
      document.getElementById('btn-ul').click();

      document.getElementById('btn-center').click();
      assert(q.getFormat(lastLineStart, 1).align === 'center', 'Centrage non fonctionnel.');
      document.getElementById('btn-left').click();
      assert(!q.getFormat(lastLineStart, 1).align, 'Retour alignement gauche non fonctionnel.');

      const lineHeight = document.getElementById('nw-line-height');
      lineHeight.value = '1.5';
      lineHeight.dispatchEvent(new Event('change', { bubbles:true }));
      assert(q.getFormat(lastLineStart, 1).lineHeight === '1.5', 'Interligne 1.5 non fonctionnel.');
      lineHeight.value = '1';
      lineHeight.dispatchEvent(new Event('change', { bubbles:true }));

      // Fenêtres Ouvrir / Image doivent rester internes à SEB EvalPro.
      document.getElementById('nw-file-open').click();
      await wait(20);
      assert(document.getElementById('seb-nwtexte-picker-window'), 'Fenêtre fictive Ouvrir absente.');
      assert(!document.querySelector('input[type="file"]'), 'Sélecteur fichier Windows présent.');
      document.getElementById('seb-nwtexte-picker-cancel').click();

      document.getElementById('nw-image-button').click();
      await wait(20);
      assert(document.getElementById('seb-nwtexte-picker-window'), 'Fenêtre fictive Image absente.');
      assert(!document.querySelector('input[type="file"]'), 'Sélecteur image Windows présent.');
      document.getElementById('seb-nwtexte-picker-cancel').click();

      // Enregistrement simulé : tester le vrai dialogue interne.
      window.sebNwtexteSave.saveAs();
      await wait(20);
      const folder = document.getElementById('seb-fake-folder-seb');
      assert(folder, 'Dossier SEB fictif absent.');
      folder.dispatchEvent(new MouseEvent('dblclick', { bubbles:true }));
      const nameInput = document.getElementById('seb-fake-save-name');
      assert(nameInput, 'Champ nom Enregistrer sous absent.');
      nameInput.value = 'TEST_Evaluation_Bureautique_SEB';
      document.getElementById('seb-fake-save-button').click();
      await wait(20);

      const saveState = JSON.parse(localStorage.getItem('nwtexte_save_simulation') || 'null');
      assert(saveState && saveState.enregistre === true, 'Enregistrement simulé non mémorisé.');
      assert(saveState.dossier === 'Bureau\\\\SEB', 'Dossier d’enregistrement incorrect.');
      assert(saveState.nomConforme === true, 'Nom de fichier conforme non reconnu.');

      // Barème actuel : 8/8 et contrat historique conservé pour Résultats.
      const analyse = window.sebNwtexteEditor.saveEvaluation();
      assert(analyse && analyse.score && analyse.score.total === 8, 'Score nwtexte attendu 8/8, obtenu ' + (analyse?.score?.total));
      for (const key of ['titre_present','titre_gras','titre_police','titre_taille','texte_lignes','texte_police','texte_taille','enregistrement']) {
        assert(analyse.score[key] === 1, 'Critère nwtexte non validé : ' + key);
      }
      assert(analyse.lignes >= 10, 'Comptage des 10 lignes incorrect.');

      const responses = JSON.parse(sessionStorage.getItem('reponses_data') || '{}');
      const scores = JSON.parse(sessionStorage.getItem('scores_data') || '{}');
      assert(responses.page7_contenu_html, 'page7_contenu_html absent.');
      assert(responses.page7_contenu_texte, 'page7_contenu_texte absent.');
      assert(responses.page7_delta, 'page7_delta absent.');
      assert(responses.page7_analyse && responses.page7_analyse.score.total === 8, 'page7_analyse absent ou incorrect.');
      assert(scores.page7 === 8, 'scores_data.page7 attendu à 8.');
      assert(scores.page7_detail && scores.page7_detail.enregistrement === 1, 'page7_detail.enregistrement absent.');

      // Navigation découplée : seule la configuration centrale connaît la page suivante.
      assert(window.sebParcours.nextFile('nwtexte') === 'nvmail.html', 'Registre parcours nwtexte -> nvmail incorrect.');

      return {
        score:analyse.score.total,
        lines:analyse.lignes,
        text:window.sebNwtexteEditor.editorText(),
        route:window.sebParcours.nextFile('nwtexte')
      };
    })()
  `, true);
}

async function verifyReload(win, expectedText) {
  await win.reload();
  await waitForEditor(win);
  const result = await win.webContents.executeJavaScript(`
    (function(){
      const text = window.sebNwtexteEditor.editorText();
      const responses = JSON.parse(sessionStorage.getItem('reponses_data') || '{}');
      const scores = JSON.parse(sessionStorage.getItem('scores_data') || '{}');
      return {
        text,
        hasPage7:Boolean(responses.page7_delta && responses.page7_analyse),
        score:scores.page7,
        route:window.sebParcours.nextFile('nwtexte')
      };
    })()
  `, true);

  if (!result.text.includes('Quelle est mon activité préférée et pourquoi ?')) {
    throw new Error('Contenu Quill perdu après rechargement.');
  }
  if (!result.text.includes('Ligne 10 du texte de test')) {
    throw new Error('Corps du texte perdu après rechargement.');
  }
  if (!result.hasPage7 || result.score !== 8) {
    throw new Error('Résultats Page 7 perdus après rechargement.');
  }
  if (result.route !== 'nvmail.html') {
    throw new Error('Registre parcours perdu après rechargement.');
  }
  if (!String(expectedText || '').includes('Ligne 10')) {
    throw new Error('Scénario de référence invalide.');
  }
  return result;
}

// Runner GitHub Linux uniquement : le binaire Electron téléchargé ne peut pas
// utiliser le helper SUID chrome-sandbox sans privilèges root. Ce switch ne
// concerne que ce smoke test, jamais l'application SEB EvalPro packagée.
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show:false,
    width:1600,
    height:900,
    webPreferences:{
      contextIsolation:true,
      nodeIntegration:false,
      sandbox:true,
      devTools:false
    }
  });

  try {
    await win.loadFile(page);
    await waitForEditor(win);
    const first = await runFunctionalScenario(win);
    const reloaded = await verifyReload(win, first.text);
    console.log('NWTEXTE_FUNCTIONAL_SMOKE: OK');
    console.log('NWTEXTE_SCORE=' + first.score + '/8');
    console.log('NWTEXTE_LINES=' + first.lines);
    console.log('NWTEXTE_RELOAD_SCORE=' + reloaded.score + '/8');
    console.log('NWTEXTE_ROUTE=' + reloaded.route);
    win.destroy();
    app.exit(0);
  } catch (error) {
    try { if (!win.isDestroyed()) win.destroy(); } catch (_) {}
    fail(error && error.message ? error.message : String(error), error && error.stack ? error.stack : '');
  }
}).catch((error) => fail('Electron initialization failed', error && error.stack ? error.stack : String(error)));

setTimeout(() => fail('Timeout global du smoke test nwtexte.'), 45000);
