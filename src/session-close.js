module.exports = function registerSessionClose({
  app,
  ipcMain,
  getMainWindow,
  getAdminUnlocked,
  setAdminUnlocked
}) {
  ipcMain.handle('admin:quit-application', async () => {
    if (!getAdminUnlocked()) return false;

    // Quitter ferme uniquement SEB EvalPro. Le parcours actif, son pointeur
    // et sa dernière page restent intacts afin de reprendre au prochain démarrage.
    setTimeout(() => app.quit(), 80);
    return true;
  });

  ipcMain.handle('admin:close-session', async () => {
    if (!getAdminUnlocked()) return false;

    // Le parcours candidat actif est clôturé par le preload avant cet appel.
    // Ici, on quitte uniquement après cette clôture et la remise à zéro de l'état global.
    setAdminUnlocked(false);

    const mainWindow = getMainWindow();
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        await mainWindow.webContents.session.clearStorageData({ storages: ['localstorage'] });
      }
    } catch (_) {}

    setTimeout(() => app.quit(), 80);
    return true;
  });
};
