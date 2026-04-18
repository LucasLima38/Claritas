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

// Exact hex values derived from CSS vars in index.css for each theme.
// These must match --background and --foreground of each theme class.
const TITLE_BAR_PALETTE = {
  light:          { color: '#ffffff',  symbolColor: '#09090b' },
  dark:           { color: '#09090b',  symbolColor: '#fafafa' },
  snnabb:         { color: '#f8f6f2',  symbolColor: '#332619' },
  charcoal:       { color: '#1a1a1a',  symbolColor: '#e5e5e5' },
  'black-moon':   { color: '#121416',  symbolColor: '#e4e4e8' },
  'blue-moon':    { color: '#16181c',  symbolColor: '#e4e4e8' },
}

function titleBarColors(theme, systemIsDark) {
  const key = theme === 'system' ? (systemIsDark ? 'dark' : 'light') : (theme ?? 'light')
  const palette = TITLE_BAR_PALETTE[key] ?? (systemIsDark ? TITLE_BAR_PALETTE.dark : TITLE_BAR_PALETTE.light)
  return { ...palette, height: 40 }
}

function updateTitleBarOverlay(theme, systemIsDark) {
  mainWindow?.setTitleBarOverlay(titleBarColors(theme, systemIsDark))
}

function createWindow() {
  store.initSession()

  mainWindow = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 760,
    minHeight: 500,
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: titleBarColors(store.getSettings().theme ?? 'system', nativeTheme.shouldUseDarkColors),
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
    if (store.getSettings().closeHides) {
      e.preventDefault()
      mainWindow.hide()
    }
    // closeHides = false → window closes; app remains in tray
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

  // Show window unless startMinimized is set
  if (!store.getSettings().startMinimized) {
    mainWindow.show()
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
  const settings = store.getSettings()
  const theme = settings.theme ?? 'system'
  updateTitleBarOverlay(theme, nativeTheme.shouldUseDarkColors)
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
  if (updates.theme !== undefined) {
    updateTitleBarOverlay(updates.theme, nativeTheme.shouldUseDarkColors)
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

ipcMain.handle('get-login-item-settings', () => {
  try {
    return { openAtLogin: app.getLoginItemSettings().openAtLogin }
  } catch {
    return { openAtLogin: false }
  }
})

ipcMain.handle('set-login-item-settings', (_event, { openAtLogin }) => {
  try {
    app.setLoginItemSettings({ openAtLogin })
  } catch {
    // Non-critical — silently ignore (e.g. sandboxed environments)
  }
  return { ok: true }
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
