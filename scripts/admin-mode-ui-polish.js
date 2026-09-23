const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error('SEB EvalPro Admin UI/Windows: ' + message);
  process.exit(2);
}
function read(relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + relative);
  return { file, text: fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') };
}
function write(file, text) { fs.writeFileSync(file, text, 'utf8'); }
function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) fail('motif introuvable: ' + label);
  return source.replace(before, after);
}
function checkJs(source, label) {
  try { new vm.Script(source); }
  catch (error) { fail(label + ' invalide: ' + error.message); }
}

// -----------------------------------------------------------------------------
// 1) Mode Admin Windows : la session reste déverrouillée jusqu'à "Verrouiller".
//    Déverrouillé = sortie du kiosque + fenêtre maximisée + barre Windows visible
//    + badge rouge sur l'icône de la barre des tâches.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/main.js');
  let out = text;
  const marker = '// SEB_ADMIN_WINDOWS_SHELL_MODE';
  if (!out.includes(marker)) {
    out = out.replace(
      /const \{([^}]+)\} = require\('electron'\);/,
      (all, names) => {
        const parts = names.split(',').map((v) => v.trim()).filter(Boolean);
        if (!parts.includes('nativeImage')) parts.push('nativeImage');
        return 'const { ' + parts.join(', ') + " } = require('electron');";
      }
    );

    const anchor = out.includes("const localAi = editionCapabilities.canAi ? createLocalAiService({ app }) : null;")
      ? "const localAi = editionCapabilities.canAi ? createLocalAiService({ app }) : null;"
      : "const localAi = createLocalAiService({ app });";
    const helper = `

${marker}
const ADMIN_TASKBAR_OVERLAY_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAEZklEQVR4nLWXW3bbNhCGP4AgRYmS49hpmofuI4vok12voQ/JBrqEbsB+yBra5KmLyE7aJr5LFC8g0AfMxLQin8huO+fMASWC+P8Z3P4xjMyAsYBNrc3BOsgKsAXkk/Sc5eAc2Ez6B2CA6CH04DsYWhg66DsIHoYeQkgeAxAhArgxuBHw7D6wK5PnJbgJuAJcfkfABIgDxB5CB74Fn4Nv0nvfCYRPbRBwEyG6DXCbgckTuCvBTSGfJS9miUReJgLZFgJDk4D7OnnmoF+DNeCNBBshxpQN4xQ8S+A2BzsR4AqKORQLmMyTF1MoypSFzKWBTZT0d0JgDd0yuSugdWCt4IiFQbi4TfAS3EyA96Dcg3Jf2jlMqkTC5VsI9DCswa8SeHsDebGRLSExGMBDcDrnGvlMIn4G5XOYqj+D6UIIvInxPQ/YmTHHK+huhagsWs2AJqFv5cHJgrOFpH0u4AcwO4TZgfg+lG9j/PAQsJqSOzXmaJJ2S5ZJpmT+0/JXAi5Fn5XgqpT2yXOYHsLsBVSHUB3A9OcYf9OPPo5nc8NexzT82xg/vDPmJJPoBTzKNvzCw+zDtEyRF/tQHkL1EuYvoXoB819i/GMX4IeIAPxqzI+fYfk3rD7B8gLqG2hr6Fwh0c8g35j72QFMnwKu/ZXEAUyHtEhDB75PuyAC0fwA+xL99DuoXsHiFSy+h7nO+TbwcYSbwNv6nRpz9Bcs/4TbT7C6gHoJrZ2MMiD7frKAyVPAt73T79/G+GEhY8+hqNLBVrhCjlc98Sp5+SDCDtG+jnErcT3YVlA04D0Eq8euZCIvwelWemz02n/zO/39Jsb3JeRTwSnBWdmGSiQrRhfUY6L/1v9qeplpa7O720/9ccv9kbaBZfUyuue7DLTLVGwz0Rt6AxsrV+M9fwrorv2CuGLZId3lwd/5bihPtA2sYOUaDX2SUEMH/v8k0CaF5LW1AuzbJCb6BvyZMcewe8q/ZTrOmTHHTVJIvSgn7wQ8W4uMWkG3gu4/Qd4wESqdYqyhtxK5V/AltLfQnhpzNGb/VBvfBbcytpKoobOdpKIW8GtorqG5guadMSfjQXa9EbWffvfOmJMrGfcGmltolYDrYLDgRRW1ekqJ7LbjSD4aszOJceYuYH0J9SWsrxOBRgj0poKiGOmBsRr6N4pII7+A9TmsPoufQ32VCLRr8EaizUSQ5qqCn6oJ1U6NObqC5gLqC6jPpb2SKVgnYeqNnMmZquLqa1U8E1Vc7kE5S6r494eAz4z5qYbuRub88uv0t7WA9zAYleUP1QXPRr6AshrJ7QyyUW04dKO64FYIXI8W31IWXgODTx5cTB8HjcCkk9AgRaRouaGFoYa+gokScJAZ0tnt7xNol0JCtl5Xp8h9e6cJQ4DotFBUEr38VgJR7goVlA14LVJVckttGNr7W7pbpe3Wr1LUfZuq5GFIY4eAiA8lIQNBKp0iykTIBCHSiIKSDGhpNrTJ/TqB97Wcdk0q07+o4XGJ/g/1kYxVdSt3vwAAAABJRU5ErkJggg==';
let adminTaskbarOverlayIcon = null;

function getAdminTaskbarOverlayIcon() {
  if (!adminTaskbarOverlayIcon || adminTaskbarOverlayIcon.isEmpty()) {
    adminTaskbarOverlayIcon = nativeImage.createFromDataURL(ADMIN_TASKBAR_OVERLAY_DATA_URL);
  }
  return adminTaskbarOverlayIcon;
}

function applyAdminWindowMode(unlocked) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const isUnlocked = !!unlocked;

  if (isUnlocked) {
    try { stopCandidateKeyGuard(); } catch (_) {}
    try { mainWindow.setAlwaysOnTop(false); } catch (_) {}
    try { mainWindow.setSkipTaskbar(false); } catch (_) {}
    try { mainWindow.setKiosk(false); } catch (_) {}
    try { mainWindow.setFullScreen(false); } catch (_) {}
    if (process.platform === 'win32') {
      try { mainWindow.setOverlayIcon(getAdminTaskbarOverlayIcon(), 'Mode administrateur déverrouillé'); } catch (_) {}
    }
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed() || !adminSessionUnlocked) return;
      try { mainWindow.maximize(); } catch (_) {}
      try { applyAdaptiveZoom(); } catch (_) {}
    }, 120);
  } else {
    const restoreCandidateShell = () => {
      if (!mainWindow || mainWindow.isDestroyed() || adminSessionUnlocked) return;
      try { startCandidateKeyGuard(); } catch (_) {}
      try { mainWindow.setSkipTaskbar(true); } catch (_) {}
      try { mainWindow.setAlwaysOnTop(true); } catch (_) {}
      try { mainWindow.setFullScreen(true); } catch (_) {}
      try { mainWindow.setKiosk(true); } catch (_) {}
      try { mainWindow.moveTop(); } catch (_) {}
      try { mainWindow.show(); } catch (_) {}
      try { mainWindow.focus(); } catch (_) {}
      try { mainWindow.webContents.focus(); } catch (_) {}
      try { enforceCandidateWindowLock(true); } catch (_) {}
      try { applyAdaptiveZoom(); } catch (_) {}
    };
    if (process.platform === 'win32') {
      try { mainWindow.setOverlayIcon(null, ''); } catch (_) {}
    }
    restoreCandidateShell();
    [40, 120, 300, 700].forEach((delay) => setTimeout(restoreCandidateShell, delay));
  }

  try { mainWindow.setMenuBarVisibility(false); } catch (_) {}
  try { mainWindow.focus(); } catch (_) {}
}
`;
    out = replaceRequired(out, anchor, anchor + helper, 'ancrage mode Admin Windows');

    out = replaceRequired(
      out,
      "    mainWindow.show();\n    enforceCandidateWindowLock(true);",
      "    mainWindow.show();\n    applyAdminWindowMode(adminSessionUnlocked);\n    if (!adminSessionUnlocked) enforceCandidateWindowLock(true);",
      'démarrage kiosque renforcé'
    );

    out = replaceRequired(
      out,
      "  mainWindow.webContents.on('did-finish-load', () => {\n    applyAdaptiveZoom();\n  });",
      "  mainWindow.webContents.on('did-finish-load', () => {\n    applyAdminWindowMode(adminSessionUnlocked);\n    applyAdaptiveZoom();\n  });",
      'persistance mode Admin après navigation'
    );

    out = replaceRequired(
      out,
      "ipcMain.handle('admin:verify', (_event, password) => {\n  const ok = verifyAdminPassword(password);\n  if (ok) {\n    adminSessionUnlocked = true;\n    if (mainWindow && !mainWindow.isDestroyed()) {\n      mainWindow.setAlwaysOnTop(false);\n      mainWindow.setSkipTaskbar(false);\n      mainWindow.setKiosk(false);\n      mainWindow.setFullScreen(false);\n      mainWindow.focus();\n    }\n  }\n  return ok;\n});",
      "ipcMain.handle('admin:verify', (_event, password) => {\n  const ok = verifyAdminPassword(password);\n  if (ok) {\n    adminSessionUnlocked = true;\n    applyAdminWindowMode(true);\n  }\n  return ok;\n});",
      'déverrouillage Admin persistant'
    );

    out = replaceRequired(
      out,
      "ipcMain.handle('admin:lock', () => {\n  adminSessionUnlocked = false;\n  adminExportCandidateDir = null;\n  if (mainWindow && !mainWindow.isDestroyed()) {\n    mainWindow.setSkipTaskbar(true);\n    mainWindow.setKiosk(true);\n    mainWindow.setFullScreen(true);\n    mainWindow.setAlwaysOnTop(true);\n    reinforceCandidateWindowLock();\n  }\n  return true;\n});",
      "ipcMain.handle('admin:lock', () => {\n  adminSessionUnlocked = false;\n  adminExportCandidateDir = null;\n  applyAdminWindowMode(false);\n  return true;\n});",
      'reverrouillage Admin manuel'
    );

    out = replaceRequired(
      out,
      "  setAdminUnlocked: (value) => { adminSessionUnlocked = !!value; },",
      "  setAdminUnlocked: (value) => { adminSessionUnlocked = !!value; applyAdminWindowMode(adminSessionUnlocked); },",
      'synchronisation fermeture session'
    );
  }

  const lockReturnMarker = '// SEB_ADMIN_LOCK_RETURNS_TO_PRIVACY';
  if (!out.includes(lockReturnMarker)) {
    out = replaceRequired(
      out,
      "ipcMain.handle('admin:lock', () => {\n  adminSessionUnlocked = false;\n  adminExportCandidateDir = null;\n  applyAdminWindowMode(false);\n  return true;\n});",
      "ipcMain.handle('admin:lock', () => {\n  " + lockReturnMarker + "\n  adminSessionUnlocked = false;\n  adminExportCandidateDir = null;\n  adminCandidateResultsMode = false;\n  applyAdminWindowMode(false);\n  if (mainWindow && !mainWindow.isDestroyed()) {\n    const state = readState();\n    const target = existingWebPage(state.lastEvaluationPage || 'qcmv1.0.html');\n    setTimeout(() => {\n      if (!mainWindow || mainWindow.isDestroyed() || adminSessionUnlocked) return;\n      mainWindow.loadFile(target);\n    }, 90);\n  }\n  return true;\n});",
      'Verrouiller doit quitter toute page Admin'
    );
  }

  for (const required of [
    marker,
    'function applyAdminWindowMode(unlocked)',
    'mainWindow.setKiosk(false)',
    'mainWindow.setFullScreen(false)',
    'mainWindow.maximize()',
    "mainWindow.setOverlayIcon(getAdminTaskbarOverlayIcon(), 'Mode administrateur déverrouillé')",
    'applyAdminWindowMode(true)',
    'applyAdminWindowMode(false)',
    'applyAdminWindowMode(adminSessionUnlocked)'
  ]) if (!out.includes(required)) fail('contrôle mode Admin absent: ' + required);

  checkJs(out, 'src/main.js après mode Admin Windows');
  write(file, out);
}

// -----------------------------------------------------------------------------
// 2) Style professionnel des commandes Admin uniquement.
//    Aucun bouton du parcours stagiaire n'est modifié.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/preload.js');
  let out = text;
  const marker = '/* SEB_ADMIN_BUTTON_POLISH */';
  if (!out.includes(marker)) {
    const cssAnchor = "    #seb-evalpro-topbar #seb-evalpro-close-session:hover{background:#a00000}";
    const css = `
    ${marker}
    #seb-evalpro-topbar button,
    #seb-evalpro-admin-dialog button,
    #seb-evalpro-session-close-dialog button,
    #seb-evalpro-transfer-dialog button,
    #seb-evalpro-results-dialog button,
    #seb-replay-chooser button,
    #seb-replay-viewer button,
    #seb-bilan-history-chooser button,
    #seb-bilan-history-editor button{
      background:#fff!important;color:#0070c0!important;border:2px solid #0070c0!important;border-radius:6px!important;
      box-shadow:0 2px 5px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.95)!important;
      font-weight:700!important;cursor:pointer;transition:background .12s ease,box-shadow .12s ease,transform .12s ease
    }
    /* La barre Admin reste volontairement plus légère que les boutons de dialogue. */
    #seb-evalpro-topbar button{font-weight:400!important}
    #seb-evalpro-topbar button:hover,
    #seb-evalpro-admin-dialog button:hover,
    #seb-evalpro-session-close-dialog button:hover,
    #seb-evalpro-transfer-dialog button:hover,
    #seb-evalpro-results-dialog button:hover,
    #seb-replay-chooser button:hover,
    #seb-replay-viewer button:hover,
    #seb-bilan-history-chooser button:hover,
    #seb-bilan-history-editor button:hover{
      background:#f5f9fd!important;box-shadow:0 3px 7px rgba(0,0,0,.22),inset 0 1px 0 #fff!important;transform:translateY(-1px)
    }
    #seb-evalpro-topbar button:active,
    #seb-evalpro-admin-dialog button:active,
    #seb-evalpro-session-close-dialog button:active,
    #seb-evalpro-transfer-dialog button:active,
    #seb-evalpro-results-dialog button:active,
    #seb-replay-chooser button:active,
    #seb-replay-viewer button:active,
    #seb-bilan-history-chooser button:active,
    #seb-bilan-history-editor button:active{transform:translateY(0);box-shadow:inset 0 1px 3px rgba(0,0,0,.20)!important}
    #seb-evalpro-topbar #seb-evalpro-close-session,
    #seb-evalpro-session-close-dialog button.danger,
    #seb-bilan-history-chooser button.danger,
    #seb-bilan-history-editor button.danger{
      background:#fff!important;color:#c00000!important;border-color:#c00000!important
    }
    #seb-evalpro-topbar #seb-evalpro-close-session:hover,
    #seb-evalpro-session-close-dialog button.danger:hover,
    #seb-bilan-history-chooser button.danger:hover,
    #seb-bilan-history-editor button.danger:hover{background:#fff4f4!important}
    #seb-evalpro-topbar button:disabled,
    #seb-evalpro-admin-dialog button:disabled,
    #seb-evalpro-session-close-dialog button:disabled,
    #seb-evalpro-transfer-dialog button:disabled,
    #seb-evalpro-results-dialog button:disabled,
    #seb-replay-chooser button:disabled,
    #seb-replay-viewer button:disabled,
    #seb-bilan-history-chooser button:disabled,
    #seb-bilan-history-editor button:disabled{opacity:.48!important;transform:none!important;cursor:default!important}
`;
    out = replaceRequired(out, cssAnchor, cssAnchor + css, 'style boutons Admin');
  }
  const syncMarker = '// SEB_ADMIN_STATE_SYNC_AFTER_EARLY_BAR';
  if (!out.includes(syncMarker)) {
    const syncHelper = `
${syncMarker}
function sebSyncAdminBarState() {
  const bar = document.getElementById('seb-evalpro-topbar');
  if (!bar) return;
  const adminButton = document.getElementById('seb-evalpro-admin');
  const bilanButton = document.getElementById('seb-evalpro-bilan');
  const returnButton = document.getElementById('seb-evalpro-return');
  const exportCandidatesButton = document.getElementById('seb-evalpro-export-candidates');
  const importCandidatesButton = document.getElementById('seb-evalpro-import-candidates');
  const closeSessionButton = document.getElementById('seb-evalpro-close-session');
  const onBilan = isAdminBilanPage();
  const onCandidateResults = !!adminCandidateResultsWorkspace;
  const onAdminDetail = onBilan || onCandidateResults;
  if (adminButton) {
    adminButton.hidden = false;
    adminButton.textContent = adminUnlocked ? 'Verrouiller' : 'Administrateur';
  }
  if (bilanButton) bilanButton.hidden = true;
  if (returnButton) {
    returnButton.hidden = !adminUnlocked || !onAdminDetail;
    returnButton.textContent = 'Retour au candidat';
  }
  if (exportCandidatesButton) exportCandidatesButton.hidden = !adminUnlocked;
  if (importCandidatesButton) importCandidatesButton.hidden = !adminUnlocked;
  if (closeSessionButton) closeSessionButton.hidden = !adminUnlocked;
}
`;
    out = replaceRequired(out, 'function injectAdminBar() {', syncHelper + '\nfunction injectAdminBar() {', 'helper synchronisation Admin');

    if (!out.includes('// SEB_ADMIN_NAVIGATION_SAFE_LOCK')) {
      out = replaceRequired(
        out,
        "    if (adminUnlocked) {\n      await ipcRenderer.invoke('admin:lock');",
        "    if (adminUnlocked) {\n      try { window.localStorage.setItem('seb_evalpro_privacy_screen', 'temporary'); } catch (_) {}\n      try { saveNow(true); } catch (_) {}\n      await ipcRenderer.invoke('admin:lock');",
        'préparer écran SEB EvalPro avant verrouillage'
      );
    }

    out = replaceRequired(
      out,
      "  adminUnlocked = await ipcRenderer.invoke('admin:status');\n  injectAdminBar();",
      "  adminUnlocked = await ipcRenderer.invoke('admin:status');\n  injectAdminBar();\n  sebSyncAdminBarState();\n  setTimeout(sebSyncAdminBarState, 80);\n  setTimeout(sebSyncAdminBarState, 300);",
      'synchronisation après lecture état Admin'
    );

    const contextAnchor = "window.addEventListener('beforeunload', () => {";
    const pageShow = `
window.addEventListener('pageshow', async () => {
  try { adminUnlocked = await ipcRenderer.invoke('admin:status'); } catch (_) {}
  sebSyncAdminBarState();
});

`;
    out = replaceRequired(out, contextAnchor, pageShow + contextAnchor, 'synchronisation pageshow');
  }

  if (!out.includes(marker)) fail('style boutons Admin non injecté');
  if (!out.includes(syncMarker) || !out.includes("adminButton.textContent = adminUnlocked ? 'Verrouiller' : 'Administrateur'") || !out.includes("exportCandidatesButton.hidden = !adminUnlocked")) fail('synchronisation état Admin absente');
  checkJs(out, 'src/preload.js après style Admin');
  write(file, out);
}

// -----------------------------------------------------------------------------
// 3) Bilan Admin : style forcé des 3 boutons, Enregistrer agrandi, PDF supprimé.
// -----------------------------------------------------------------------------
{
  const { file, text } = read(path.join('app', 'web', 'admin-bilan.html'));
  let out = text;
  out = out.replace(/<button\s+id=["']pdf["'][^>]*>Exporter PDF<\/button>/gi, '');
  out = out.replace(/function\s+pdf\(\)\{[\s\S]*?\}\n?/g, '');
  out = out.replace(/;?\$\('#pdf'\)\.onclick=pdf/g, '');

  const marker = 'seb-admin-bilan-button-polish';
  out = out.replace(new RegExp('<style id="' + marker + '">[\\s\\S]*?<\\/style>\\s*', 'g'), '');
  const style = `
<style id="${marker}">
html body .tools #auto,
html body .tools #save,
html body .tools #word{
  background:#fff!important;
  color:#0070c0!important;
  border:2px solid #0070c0!important;
  border-radius:6px!important;
  padding:9px 14px!important;
  box-shadow:0 2px 5px rgba(0,0,0,.18),inset 0 1px 0 #fff!important;
  font-weight:700!important;
  cursor:pointer!important;
  transition:background .12s ease,box-shadow .12s ease,transform .12s ease!important
}
html body .tools #auto:hover,
html body .tools #save:hover,
html body .tools #word:hover{
  background:#f5f9fd!important;
  box-shadow:0 3px 7px rgba(0,0,0,.22),inset 0 1px 0 #fff!important;
  transform:translateY(-1px)
}
html body .tools #auto:active,
html body .tools #save:active,
html body .tools #word:active{
  transform:translateY(0);
  box-shadow:inset 0 1px 3px rgba(0,0,0,.20)!important
}
html body .tools #save{
  min-width:290px!important;
  padding:12px 26px!important;
  font-size:12pt!important;
  border-width:2px!important
}
</style>
`;
  const bodyEnd = out.toLowerCase().lastIndexOf('</body>');
  if (bodyEnd < 0) fail('fin body admin-bilan introuvable');
  out = out.slice(0, bodyEnd) + style + out.slice(bodyEnd);

  if (out.includes('id="pdf"') || out.includes("$('#pdf').onclick=pdf") || /function\s+pdf\s*\(/.test(out)) {
    fail('export PDF encore présent dans le bilan Admin');
  }
  for (const required of [`id="${marker}"`, 'html body .tools #auto', 'html body .tools #save', 'html body .tools #word', 'min-width:290px', 'Exporter Word', 'Enregistrer les modifications']) {
    if (!out.includes(required)) fail('contrôle bilan Admin absent: ' + required);
  }
  write(file, out);
}

console.log('SEB EvalPro Admin: navigation candidat séparée du parcours, retour au candidat et verrouillage sécurisé.');
