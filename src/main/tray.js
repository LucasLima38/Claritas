import { app, Tray, Menu, nativeImage } from 'electron'
import { getIconPath } from './paths.js'

let tray = null
let _blinkInterval = null
let _normalIcon = null

/**
 * Creates the system tray icon and initial context menu.
 * @param {BrowserWindow} mainWindow
 * @param {ProjectStore} projectStore
 */
export function createTray(mainWindow, projectStore) {
  const icon = nativeImage.createFromPath(getIconPath()).resize({ width: 16, height: 16 })
  _normalIcon = icon

  tray = new Tray(icon)
  tray.setToolTip('Claritas')
  updateTrayMenu(mainWindow, projectStore)

  tray.on('click', () => {
    stopTrayBlink()
    if (mainWindow.isDestroyed()) return
    if (mainWindow.isVisible()) {
      mainWindow.focus()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  return tray
}

/**
 * Starts blinking the tray icon to alert the user that a new schematic is ready.
 * Alternates between the normal icon and an empty icon every 500 ms.
 * Safe to call multiple times — will not create duplicate intervals.
 */
export function startTrayBlink() {
  if (_blinkInterval || !tray || tray.isDestroyed()) return
  let showIcon = true
  const emptyIcon = nativeImage.createEmpty()
  _blinkInterval = setInterval(() => {
    if (!tray || tray.isDestroyed()) { clearInterval(_blinkInterval); _blinkInterval = null; return }
    tray.setImage(showIcon ? _normalIcon : emptyIcon)
    showIcon = !showIcon
  }, 500)
}

/**
 * Stops the tray icon blink and restores the normal icon.
 */
export function stopTrayBlink() {
  if (!_blinkInterval) return
  clearInterval(_blinkInterval)
  _blinkInterval = null
  if (tray && !tray.isDestroyed() && _normalIcon) tray.setImage(_normalIcon)
}

/**
 * Rebuilds the tray context menu from current project state.
 * Call this whenever the active project changes.
 */
export function updateTrayMenu(mainWindow, projectStore) {
  if (!tray || tray.isDestroyed()) return

  const projects = projectStore.getProjects()
  const activeId = projectStore.getActiveProjectId()

  const projectItems = projects.map((p) => ({
    label: p.name,
    type: 'radio',
    checked: p.id === activeId,
    click: () => {
      projectStore.setActiveProject(p.id)
      updateTrayMenu(mainWindow, projectStore)
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('projects-updated', {
          projects: projectStore.getProjects(),
          activeProjectId: p.id,
        })
      }
    },
  }))

  const menu = Menu.buildFromTemplate([
    {
      label: 'Claritas',
      enabled: false,
    },
    { type: 'separator' },
    ...(projectItems.length > 0 ? projectItems : [{ label: 'Nenhum projeto', enabled: false }]),
    { type: 'separator' },
    {
      label: 'Abrir janela',
      click: () => {
        if (mainWindow.isDestroyed()) return
        mainWindow.show()
        mainWindow.focus()
      },
    },
    {
      label: 'Configurações',
      click: () => {
        if (mainWindow.isDestroyed()) return
        mainWindow.show()
        mainWindow.focus()
        mainWindow.webContents.send('navigate-to', 'settings')
      },
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        stopTrayBlink()
        tray.destroy()
        app.quit()
      },
    },
  ])

  tray.setContextMenu(menu)
}
