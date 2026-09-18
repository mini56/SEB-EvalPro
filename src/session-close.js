module.exports = function registerSessionClose({
  app,
  ipcMain,
  getMainWindow,
  getAdminUnlocked,
  setAdminUnlocked,
  readState,
  writeState,
  defaultState,
  finalizeCandidateSession
}) {
  ipcMain.handle('admin:close-session', async () => {
    if (!getAdminUnlocked()) return false;

    const currentState = typeof readState === 'function' ? readState() : defaultState();

    try {
      if (typeof finalizeCandidateSession === 'function') {
        finalizeCandidateSession(currentState);
      }
    } catch (error) {
      console.error('Fermeture du dossier candidat impossible:', error && error.message ? error.message : error);
      return false;
    }

    setAdminUnlocked(false);

    const mainWindow = getMainWindow();
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        await mainWindow.webContents.session.clearStorageData({ storages: ['localstorage'] });
      }
    } catch (_) {}

    try {
      writeState(defaultState());
    } catch (_) {}

    setTimeout(() => app.quit(), 80);
    return true;
  });
};
