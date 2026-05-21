import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function overlayPath(filename) {
  return app.isPackaged
    ? path.join(__dirname, '../renderer/overlay', filename)
    : path.resolve(process.cwd(), 'src/renderer/overlay', filename)
}

let overlayWin = null
let tickInterval = null
let cancelListener = null

/**
 * Shows a fullscreen countdown overlay.
 * @param {number} seconds - Countdown duration (3, 5, or 10)
 * @param {Function} onComplete - Called when countdown reaches 0
 * @param {Function} onCancel - Called when user presses ESC
 */
export function showCountdown(seconds, onComplete, onCancel) {
  if (overlayWin) hideCountdown()

  overlayWin = new BrowserWindow({
    fullscreen: true,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    resizable: false,
    movable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/overlayPreload.js'),
    },
  })

  overlayWin.loadFile(overlayPath('countdown.html'))
  overlayWin.setAlwaysOnTop(true, 'screen-saver')

  let remaining = seconds

  // Give the window time to load before starting ticks
  overlayWin.webContents.once('did-finish-load', () => {
    overlayWin.webContents.send('countdown-tick', { remaining })

    tickInterval = setInterval(() => {
      remaining -= 1
      if (!overlayWin || overlayWin.isDestroyed()) {
        clearInterval(tickInterval)
        return
      }
      overlayWin.webContents.send('countdown-tick', { remaining })

      if (remaining <= 0) {
        clearInterval(tickInterval)
        hideCountdown()
        onComplete()
      }
    }, 1000)
  })

  cancelListener = () => {
    hideCountdown()
    onCancel()
  }
  ipcMain.once('cancel-capture-from-overlay', cancelListener)
}

/**
 * Destroys the countdown overlay window and clears all timers/listeners.
 */
export function hideCountdown() {
  if (tickInterval) {
    clearInterval(tickInterval)
    tickInterval = null
  }
  if (cancelListener) {
    ipcMain.removeListener('cancel-capture-from-overlay', cancelListener)
    cancelListener = null
  }
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.destroy()
  }
  overlayWin = null
}
