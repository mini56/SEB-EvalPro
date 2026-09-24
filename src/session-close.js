module.exports = function registerSessionClose({
  app,
  ipcMain,
  getMainWindow,
  getAdminUnlocked,
  setAdminUnlocked
}) {
  ipcMain.handle('admin:close-session', async () => {
    if (!getAdminUnlocked()) return false;

    // Fermer la session sert uniquement à quitter proprement SEB EvalPro.
    // Le parcours candidat actif reste intact et reprenable.
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
