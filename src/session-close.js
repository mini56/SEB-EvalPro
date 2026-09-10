module.exports = function registerSessionClose({ app, ipcMain, getMainWindow, getAdminUnlocked, setAdminUnlocked, writeState, defaultState }) {
  ipcMain.handle('admin:close-session', async () => {
    if (!getAdminUnlocked()) return false;
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
