import { desktopCapturer, screen, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Converts a nativeImage to { dataURL, width, height }.
 * If cropRect is provided, crops the image before converting.
 */
export function makeDataURLFromSource(nativeImage, cropRect) {
  const img = cropRect ? nativeImage.crop(cropRect) : nativeImage
  const size = img.getSize()
  return {
    dataURL: img.toDataURL(),
    width: size.width,
    height: size.height,
  }
}

/**
 * Captures the entire screen that contains the Claritas window.
 * Falls back to the primary display if no match found.
 * @param {BrowserWindow} mainWindow
 */
export async function captureFullscreen(mainWindow) {
  const display = screen.getDisplayMatching(mainWindow.getBounds())
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: display.bounds.width, height: display.bounds.height },
  })

  if (sources.length === 0) throw new Error('No screen source found')

  const source = sources.find((s) =>
    s.display_id === String(display.id)
  ) ?? sources[0]

  return makeDataURLFromSource(source.thumbnail, null)
}

/**
 * Captures the active/frontmost window using desktopCapturer.
 */
export async function captureWindow() {
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 3840, height: 2160 },
    fetchWindowIcons: false,
  })

  if (sources.length === 0) throw new Error('No window source found')

  const source = sources[0]
  return makeDataURLFromSource(source.thumbnail, null)
}

/**
 * Opens a fullscreen transparent region-selector window.
 * Returns a Promise that resolves with { dataURL, width, height }
 * once the user selects a region, or rejects if cancelled.
 * @param {BrowserWindow} mainWindow
 */
export function captureRegion(mainWindow) {
  return new Promise((resolve, reject) => {
    const display = screen.getDisplayMatching(mainWindow.getBounds())
    const { x, y, width, height } = display.bounds

    const selWin = new BrowserWindow({
      x,
      y,
      width,
      height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      fullscreenable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../../preload/regionSelectPreload.js'),
      },
    })

    selWin.loadFile(
      path.join(__dirname, '../../renderer/overlay/region-select.html')
    )
    selWin.setAlwaysOnTop(true, 'screen-saver')

    const onRegionSelected = async (_event, rect) => {
      selWin.destroy()
      cleanup()
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: display.bounds.width, height: display.bounds.height },
        })
        if (sources.length === 0) {
          reject(new Error('No screen source found'))
          return
        }
        const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
        const thumbSize = source.thumbnail.getSize()
        const scaleX = thumbSize.width / width
        const scaleY = thumbSize.height / height
        const cropRect = {
          x: Math.round(rect.x * scaleX),
          y: Math.round(rect.y * scaleY),
          width: Math.round(rect.width * scaleX),
          height: Math.round(rect.height * scaleY),
        }
        resolve(makeDataURLFromSource(source.thumbnail, cropRect))
      } catch (err) {
        reject(err)
      }
    }

    const onCancelled = () => {
      selWin.destroy()
      cleanup()
      reject(new Error('CANCELLED'))
    }

    function cleanup() {
      ipcMain.removeListener('region-selected', onRegionSelected)
      ipcMain.removeListener('region-cancelled', onCancelled)
    }

    ipcMain.once('region-selected', onRegionSelected)
    ipcMain.once('region-cancelled', onCancelled)

    selWin.on('closed', () => {
      cleanup()
      reject(new Error('CANCELLED'))
    })
  })
}
