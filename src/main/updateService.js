import { autoUpdater } from 'electron-updater'

export function initAutoUpdater(mainWindow, ipcMain) {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseDate: info.releaseDate ?? null,
    })
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('update-not-available')
  })

  autoUpdater.on('error', (err) => {
    console.error('[auto-updater]', err.message)
    mainWindow.webContents.send('update-not-available')
  })

  ipcMain.removeHandler('install-update')
  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  ipcMain.removeHandler('check-for-updates')
  ipcMain.handle('check-for-updates', () => {
    autoUpdater.checkForUpdates().catch(() => {})
  })

  autoUpdater.checkForUpdates().catch(() => {})
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 60 * 60 * 1000)
}
