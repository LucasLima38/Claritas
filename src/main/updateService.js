import { autoUpdater } from 'electron-updater'

export function initAutoUpdater(mainWindow, ipcMain) {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-downloading', {
      version: info.version,
      releaseDate: info.releaseDate ?? null,
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('update-download-progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    })
  })

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
    autoUpdater.quitAndInstall(true, true)
  })

  ipcMain.removeHandler('check-for-updates')
  ipcMain.handle('check-for-updates', () => {
    autoUpdater.checkForUpdates().catch(() => {})
  })

  ipcMain.removeHandler('simulate-update')
  ipcMain.handle('simulate-update', () => {
    mainWindow.webContents.send('update-available', { version: '99.9.9', releaseDate: null })
  })

  autoUpdater.checkForUpdates().catch(() => {})
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 60 * 60 * 1000)
}
