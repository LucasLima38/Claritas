import { app, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let tray = null

/**
 * Creates the system tray icon and initial context menu.
 * @param {BrowserWindow} mainWindow
 * @param {ProjectStore} projectStore
 */
export function createTray(mainWindow, projectStore) {
  const iconPath = path.join(__dirname, '../../resources/icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })

  tray = new Tray(icon)
  tray.setToolTip('SchematicClip')
  updateTrayMenu(mainWindow, projectStore)

  tray.on('click', () => {
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
 * Rebuilds the tray context menu from current project state.
 * Call this whenever the active project changes.
 */
export function updateTrayMenu(mainWindow, projectStore) {
  if (!tray) return

  const projects = projectStore.getProjects()
  const activeId = projectStore.getActiveProjectId()

  const projectItems = projects.map((p) => ({
    label: p.name,
    type: 'radio',
    checked: p.id === activeId,
    click: () => {
      projectStore.setActiveProject(p.id)
      updateTrayMenu(mainWindow, projectStore)
      mainWindow.webContents.send('projects-updated', {
        projects: projectStore.getProjects(),
        activeProjectId: p.id,
      })
    },
  }))

  const menu = Menu.buildFromTemplate([
    {
      label: 'SchematicClip',
      enabled: false,
    },
    { type: 'separator' },
    ...(projectItems.length > 0 ? projectItems : [{ label: 'Nenhum projeto', enabled: false }]),
    { type: 'separator' },
    {
      label: 'Abrir janela',
      click: () => { mainWindow.show(); mainWindow.focus() },
    },
    {
      label: 'Configurações',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
        mainWindow.webContents.send('navigate-to', 'settings')
      },
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        tray.destroy()
        app.quit()
      },
    },
  ])

  tray.setContextMenu(menu)
}
