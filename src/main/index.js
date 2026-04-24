import { app, BrowserWindow, ipcMain, nativeTheme, dialog, globalShortcut, shell, clipboard, protocol, net } from 'electron'
import { promises as fsp } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { is } from '@electron-toolkit/utils'
import { ProjectStore } from './projectStore.js'
import { readEMF } from './clipboardService.js'
import { convert, setShell, isValidSVG, getSVGMetadata, exportToFormat } from './conversionService.js'
import { InkscapeShell } from './inkscapeShell.js'
import { generateFilenameWithExt, checkOutputDir } from './saveService.js'
import { ClipboardMonitor } from './clipboardMonitor.js'
import { createTray, updateTrayMenu, startTrayBlink, stopTrayBlink } from './tray.js'
import { initAutoUpdater } from './updateService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── State ─────────────────────────────────────────────────────────────────

const store = new ProjectStore()

const VALID_EXPORT_FORMATS = ['svg', 'png', 'jpg', 'pdf']

// ── Inkscape shell ────────────────────────────────────────────────────────

function resolveInkExe() {
  return is.dev
    ? path.join(process.cwd(), 'resources/inkscape/bin/inkscape.exe')
    : path.join(process.resourcesPath, 'inkscape/bin/inkscape.exe')
}

const inkscapeShell = new InkscapeShell(resolveInkExe())

let mainWindow = null
let tray = null
// Holds the last converted SVG waiting for user confirmation
let pendingSVG = null   // { svgContent: string, metadata: object }
let _registeredShortcut = ''

const clipboardMonitor = new ClipboardMonitor(async (emfBuffer) => {
  // Only auto-convert when shell is ready and not already busy
  if (!inkscapeShell.ready || inkscapeShell.busy) return
  try {
    const svgContent = await convert(emfBuffer)
    if (!isValidSVG(svgContent)) return
    const metadata = getSVGMetadata(svgContent, 0)
    pendingSVG = { svgContent, metadata }

    if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
      stopTrayBlink()
      mainWindow.webContents.send('preview-ready', { svgContent, metadata })
    } else {
      startTrayBlink()
    }
  } catch {
    // Silently ignore auto-conversion errors — user can still paste manually
  }
})

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

function applyGlobalShortcut(shortcut) {
  if (_registeredShortcut) {
    globalShortcut.unregister(_registeredShortcut)
    _registeredShortcut = ''
  }
  if (!shortcut) return
  const ok = globalShortcut.register(shortcut, () => {
    if (!mainWindow) return
    stopTrayBlink()
    mainWindow.show()
    mainWindow.focus()
    if (pendingSVG) mainWindow.webContents.send('preview-ready', pendingSVG)
  })
  if (ok) {
    _registeredShortcut = shortcut
  } else {
    console.warn('Could not register global shortcut:', shortcut)
  }
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

protocol.registerSchemesAsPrivileged([
  { scheme: 'localfile', privileges: { secure: true, standard: true, supportFetchAPI: true } },
])

app.whenReady().then(() => {
  protocol.handle('localfile', (request) => {
    const url = request.url.replace('localfile://', 'file://')
    return net.fetch(url)
  })

  mainWindow = createWindow()
  tray = createTray(mainWindow, store)

  // Start the bundled Inkscape shell (non-blocking for window show)
  inkscapeShell.start().then(() => {
    setShell(inkscapeShell)
    mainWindow.webContents.send('shell-status', { status: 'ready' })
  }).catch((err) => {
    console.error('Inkscape shell failed to start:', err.message)
    mainWindow.webContents.send('shell-status', { status: 'error', message: err.message })
  })

  applyGlobalShortcut(store.getSettings().globalShortcut)
  clipboardMonitor.start()

  mainWindow.on('show', () => {
    stopTrayBlink()
    if (pendingSVG) {
      mainWindow.webContents.send('preview-ready', pendingSVG)
    }
  })

  initAutoUpdater(mainWindow, ipcMain)

  // Show window unless startMinimized is set
  if (!store.getSettings().startMinimized) {
    mainWindow.show()
  }

  // Send theme immediately after load (listener is passive, no race condition)
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('theme-changed', {
      isDark: nativeTheme.shouldUseDarkColors,
    })
    mainWindow.webContents.send('shell-status', {
      status: inkscapeShell.ready ? 'ready' : 'starting',
    })
  })
})

app.on('window-all-closed', () => {
  // Keep running in tray — don't quit
})

app.on('before-quit', () => {
  clipboardMonitor.stop()
  inkscapeShell.stop()
  if (_registeredShortcut) globalShortcut.unregister(_registeredShortcut)
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

  if (!inkscapeShell.ready) {
    return { error: 'NOT_READY', message: 'Inkscape ainda está iniciando. Tente novamente em alguns segundos.' }
  }

  if (inkscapeShell.busy) {
    return { error: 'BUSY' }
  }

  const startTime = Date.now()

  try {
    const svgContent = await convert(emfBuffer)

    if (!isValidSVG(svgContent)) {
      return {
        error: 'INVALID_SVG',
        message: 'Conversão incompleta — o SVG gerado está em branco. Tente novamente.',
      }
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

ipcMain.handle('save-svg', async (_event, { projectId, format = 'svg' }) => {
  if (!pendingSVG) return { error: 'NO_PENDING', message: 'Nenhum SVG aguardando confirmação.' }

  if (!VALID_EXPORT_FORMATS.includes(format)) {
    return { error: 'INVALID_FORMAT', message: `Formato inválido: ${format}` }
  }

  const project = store.getProjects().find((p) => p.id === projectId)
  if (!project) return { error: 'PROJECT_NOT_FOUND', message: 'Projeto não encontrado.' }

  const dirCheck = await checkOutputDir(project.outputDir)
  if (!dirCheck.exists) {
    return { dirMissing: true, outputDir: project.outputDir }
  }

  if (format !== 'svg' && inkscapeShell.busy) {
    return { error: 'BUSY', message: 'Inkscape está ocupado. Tente novamente em instantes.' }
  }

  const filename = generateFilenameWithExt(project.prefix, project.counter + 1, format)
  const fullPath = path.join(project.outputDir, filename)

  try {
    await exportToFormat(pendingSVG.svgContent, format, fullPath)
    const { size: sizeBytes } = await fsp.stat(fullPath)
    const newCounter = store.incrementCounter(projectId)
    const entry = {
      id: crypto.randomUUID(),
      filename,
      fullPath,
      projectId,
      timestamp: new Date().toISOString(),
      sizeBytes,
    }
    store.addHistoryEntry(entry)
    pendingSVG = null
    updateTrayMenu(mainWindow, store)
    return { ok: true, filename, fullPath, entry, newCounter }
  } catch (err) {
    if (err.code === 'EACCES' || err.message?.startsWith('EACCES')) {
      return { error: 'EACCES', message: 'Sem permissão de escrita na pasta de destino.' }
    }
    if (err.message === 'TIMEOUT') {
      return { error: 'TIMEOUT', message: 'O Inkscape demorou mais de 30s ao exportar. Tente novamente.' }
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
  if (updates.globalShortcut !== undefined) {
    applyGlobalShortcut(updates.globalShortcut)
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
    shellStatus: inkscapeShell.ready ? 'ready' : 'starting',
  }
})

ipcMain.handle('show-in-folder', (_event, { fullPath }) => {
  shell.showItemInFolder(fullPath)
  return { ok: true }
})

ipcMain.handle('delete-history-file', async (_event, { entryId, fullPath }) => {
  try {
    await fsp.unlink(fullPath)
  } catch (err) {
    if (err.code !== 'ENOENT') return { error: err.message }
  }
  store.deleteHistoryEntry(entryId)
  updateTrayMenu(mainWindow, store)
  return { ok: true }
})

ipcMain.handle('copy-file-to-clipboard', (_event, { fullPath }) => {
  try {
    clipboard.writeBuffer('FileNameW', Buffer.from(fullPath + '\0', 'ucs2'))
    return { ok: true }
  } catch (err) {
    return { error: err.message }
  }
})
