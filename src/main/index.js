import { app, BrowserWindow, ipcMain, nativeTheme, dialog } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { is } from '@electron-toolkit/utils'
import { ProjectStore } from './projectStore.js'
import { readEMF } from './clipboardService.js'
import { convert, findInkscape, isValidSVG, getSVGMetadata, checkInkscapeVersion } from './conversionService.js'
import { generateFilename, saveSVG, checkOutputDir } from './saveService.js'
import { createTray, updateTrayMenu } from './tray.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── State ─────────────────────────────────────────────────────────────────

const store = new ProjectStore()
let mainWindow = null
let tray = null
// Holds the last converted SVG waiting for user confirmation
let pendingSVG = null   // { svgContent: string, metadata: object }

// ── Window ────────────────────────────────────────────────────────────────

function titleBarColors(isDark) {
  return {
    color: isDark ? '#1f1f1f' : '#ffffff',
    symbolColor: isDark ? '#e6e6e3' : '#37352f',
    height: 40,
  }
}

function updateTitleBarOverlay(isDark) {
  mainWindow?.setTitleBarOverlay(titleBarColors(isDark))
}

function createWindow() {
  store.initSession()

  mainWindow = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 760,
    minHeight: 500,
    titleBarStyle: 'hidden',
    titleBarOverlay: titleBarColors(nativeTheme.shouldUseDarkColors),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, '../../resources/icon.png'),
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('close', (e) => {
    e.preventDefault()
    mainWindow.hide()
  })

  return mainWindow
}

// ── App lifecycle ─────────────────────────────────────────────────────────

app.whenReady().then(() => {
  mainWindow = createWindow()
  tray = createTray(mainWindow, store)

  // Auto-detect Inkscape if not yet configured
  const settings = store.getSettings()
  if (!settings.inkscapePath) {
    const found = findInkscape()
    if (found) store.updateSettings({ inkscapePath: found })
  }

  // Send theme immediately after load (listener is passive, no race condition)
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('theme-changed', {
      isDark: nativeTheme.shouldUseDarkColors,
    })
  })
})

app.on('window-all-closed', () => {
  // Keep running in tray — don't quit
})

nativeTheme.on('updated', () => {
  // For 'system' theme, keep titleBarOverlay in sync with OS dark mode
  const settings = store.getSettings()
  const theme = settings.theme ?? 'system'
  if (theme === 'system') {
    updateTitleBarOverlay(nativeTheme.shouldUseDarkColors)
  }
  mainWindow?.webContents.send('theme-changed', {
    isDark: nativeTheme.shouldUseDarkColors,
  })
})

// ── IPC Handlers ──────────────────────────────────────────────────────────

ipcMain.handle('paste-schematic', async () => {
  const emfBuffer = await readEMF()
  if (!emfBuffer) {
    return { error: 'NO_EMF', message: 'Nenhum esquemático vetorial encontrado no clipboard.' }
  }

  const settings = store.getSettings()
  if (!settings.inkscapePath) {
    return { error: 'INKSCAPE_NOT_FOUND', message: 'Inkscape não encontrado. Configure o caminho nas configurações.' }
  }

  const startTime = Date.now()

  try {
    const svgContent = await convert(emfBuffer, settings.inkscapePath, settings.conversionTimeout)

    if (!isValidSVG(svgContent)) {
      return { error: 'INVALID_SVG', message: 'Conversão incompleta — o SVG gerado está em branco. Verifique o Inkscape.' }
    }

    const metadata = getSVGMetadata(svgContent, Date.now() - startTime)
    pendingSVG = { svgContent, metadata }

    return { ok: true, svgContent, metadata }
  } catch (err) {
    pendingSVG = null
    if (err.message === 'TIMEOUT') {
      return { error: 'TIMEOUT', message: 'O Inkscape demorou mais de 15s. Tente novamente.' }
    }
    return { error: 'ERROR', message: `Erro de conversão: ${err.message}` }
  }
})

ipcMain.handle('save-svg', async (_event, { projectId }) => {
  if (!pendingSVG) return { error: 'NO_PENDING', message: 'Nenhum SVG aguardando confirmação.' }

  const project = store.getProjects().find((p) => p.id === projectId)
  if (!project) return { error: 'PROJECT_NOT_FOUND', message: 'Projeto não encontrado.' }

  // Check if output directory exists — if not, signal renderer to show dialog
  const dirCheck = await checkOutputDir(project.outputDir)
  if (!dirCheck.exists) {
    return { dirMissing: true, outputDir: project.outputDir }
  }

  const filename = generateFilename(project.prefix, project.counter + 1)

  try {
    const fullPath = await saveSVG(pendingSVG.svgContent, project.outputDir, filename)
    const newCounter = store.incrementCounter(projectId)

    const entry = {
      id: crypto.randomUUID(),
      filename,
      fullPath,
      projectId,
      timestamp: new Date().toISOString(),
      sizeBytes: pendingSVG.metadata.sizeBytes,
    }
    store.addHistoryEntry(entry)
    pendingSVG = null

    updateTrayMenu(mainWindow, store)
    return { ok: true, filename, fullPath, entry, newCounter }
  } catch (err) {
    if (err.code === 'EACCES' || err.message?.startsWith('EACCES')) {
      return { error: 'EACCES', message: 'Sem permissão de escrita na pasta de destino.' }
    }
    return { error: 'ERROR', message: err.message }
  }
})

ipcMain.handle('discard-svg', async () => {
  pendingSVG = null
  return { ok: true }
})

ipcMain.handle('create-output-dir', async (_event, { dir }) => {
  try {
    const { promises: fsp } = await import('fs')
    await fsp.mkdir(dir, { recursive: true })
    return { ok: true }
  } catch (err) {
    return { error: 'ERROR', message: err.message }
  }
})

ipcMain.handle('get-projects', () => ({
  projects: store.getProjects(),
  activeProjectId: store.getActiveProjectId(),
}))

ipcMain.handle('set-active-project', (_event, { id }) => {
  store.setActiveProject(id)
  updateTrayMenu(mainWindow, store)
  return { ok: true }
})

ipcMain.handle('add-project', (_event, project) => {
  store.addProject(project)
  // Auto-activate if this is the first (or only) project
  if (!store.getActiveProjectId()) {
    store.setActiveProject(project.id)
  }
  updateTrayMenu(mainWindow, store)
  return { projects: store.getProjects(), activeProjectId: store.getActiveProjectId() }
})

ipcMain.handle('update-project', (_event, { id, updates }) => {
  store.updateProject(id, updates)
  updateTrayMenu(mainWindow, store)
  return { projects: store.getProjects() }
})

ipcMain.handle('delete-project', (_event, { id }) => {
  store.deleteProject(id)
  updateTrayMenu(mainWindow, store)
  return { projects: store.getProjects(), activeProjectId: store.getActiveProjectId() }
})

ipcMain.handle('get-settings', () => store.getSettings())

ipcMain.handle('update-settings', (_event, updates) => {
  store.updateSettings(updates)
  // Sync titleBarOverlay when theme changes
  if (updates.theme !== undefined) {
    const isDark =
      updates.theme === 'dark' ? true :
      updates.theme === 'light' ? false :
      nativeTheme.shouldUseDarkColors
    updateTitleBarOverlay(isDark)
  }
  return store.getSettings()
})

ipcMain.handle('choose-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })
  if (result.canceled) return { canceled: true }
  return { path: result.filePaths[0] }
})

ipcMain.handle('get-history', () => store.getHistory())

ipcMain.handle('check-inkscape-version', async (_event, { path: inkPath }) => {
  return await checkInkscapeVersion(inkPath)
})

// Renderer calls this once on mount to get initial state (avoids did-finish-load race condition)
ipcMain.handle('get-init-data', () => {
  const projects = store.getProjects()
  let activeProjectId = store.getActiveProjectId()
  // Fallback: if activeProjectId is null but projects exist, auto-activate first project
  if (!activeProjectId && projects.length > 0) {
    activeProjectId = projects[0].id
    store.setActiveProject(activeProjectId)
  }
  return {
    projects,
    activeProjectId,
    settings: store.getSettings(),
    history: store.getHistory(),
  }
})
