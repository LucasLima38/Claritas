import { app, BrowserWindow, ipcMain, nativeTheme, dialog, globalShortcut, shell, clipboard, protocol } from 'electron'
import { promises as fsp } from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { is } from '@electron-toolkit/utils'
import { ProjectStore } from './projectStore.js'
import { readEMF } from './clipboardService.js'
import { convert, setShell, isValidSVG, getSVGMetadata, exportToFormat, generateThumbnail } from './conversionService.js'
import { Libemf2svgShell } from './libemf2svgShell.js'
import { generateFilenameWithExt, checkOutputDir, saveImage, saveBuffer, applyResolution } from './saveService.js'
import { captureFullscreen, captureWindow, captureRegion } from './screenshotService.js'
import { showCountdown, hideCountdown } from './countdownOverlay.js'
import { ClipboardMonitor } from './clipboardMonitor.js'
import { createTray, updateTrayMenu, startTrayBlink, stopTrayBlink } from './tray.js'
import { initAutoUpdater } from './updateService.js'
import { recognizeDataURL, terminateOcr } from './ocrService.js'
import { loginWithGoogle, loadStoredSession, logout, getAuthClient, getStoredUser } from './authService.js'
import { uploadFile, shareFileWithEmail, listDriveFolders, createDriveFolder, deleteDriveFolder, deleteDriveFile, uploadFileToDriveFolder, shareFolderWithEmail } from './driveService.js'
import { pullProjects, pushProjects } from './syncService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── State ─────────────────────────────────────────────────────────────────

const store = new ProjectStore()

const VALID_EXPORT_FORMATS = ['svg', 'png', 'jpg', 'pdf']

function mimeTypeForExt(ext) {
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  return 'image/png'
}

// ── Conversion shell ──────────────────────────────────────────────────────

function resolveLibemf2svgDir() {
  return is.dev
    ? path.join(process.cwd(), 'resources/libemf2svg')
    : path.join(process.resourcesPath, 'libemf2svg')
}

const conversionShell = new Libemf2svgShell(resolveLibemf2svgDir())

let mainWindow = null
let tray = null
let isQuitting = false
// Queue of converted SVGs waiting for user action — each item: { svgContent, metadata, sent }
// 'sent' = already delivered to renderer via preview-ready (items captured while window hidden are not yet sent)
let pendingQueue = []
let _registeredShortcut = ''

function flushUnsentToRenderer() {
  for (const item of pendingQueue) {
    if (!item.sent) {
      item.sent = true
      mainWindow.webContents.send('preview-ready', { svgContent: item.svgContent, metadata: item.metadata })
    }
  }
}

const clipboardMonitor = new ClipboardMonitor(async (emfBuffer) => {
  try {
    const svgContent = await convert(emfBuffer)
    if (!isValidSVG(svgContent)) return
    const metadata = getSVGMetadata(svgContent, 0)

    if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
      stopTrayBlink()
      pendingQueue.push({ svgContent, metadata, sent: true })
      mainWindow.webContents.send('preview-ready', { svgContent, metadata })
    } else {
      pendingQueue.push({ svgContent, metadata, sent: false })
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
  'black-moon':   { color: '#121212',  symbolColor: '#f7f7f7' },
  'blue-moon':    { color: '#0c0f18',  symbolColor: '#ecedee' },
  claritas:       { color: '#faf6ee',  symbolColor: '#3d2510' },
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
    flushUnsentToRenderer()
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

  if (is.dev) {
    mainWindow.webContents.on('before-input-event', (_e, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') {
        mainWindow.webContents.toggleDevTools()
      }
    })
  }

  mainWindow.on('close', (e) => {
    if (!isQuitting && store.getSettings().closeHides) {
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

// ── Single instance lock ──────────────────────────────────────────────────

const gotInstanceLock = app.requestSingleInstanceLock()
if (!gotInstanceLock) {
  app.quit()
}

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
})

app.whenReady().then(() => {
  protocol.handle('localfile', async (request) => {
    const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.pdf': 'application/pdf' }
    try {
      // Strip scheme: "localfile:///C:/path/..." → "C:/path/..."
      const filePath = decodeURIComponent(request.url.slice('localfile:///'.length))
      const data = await fsp.readFile(filePath)
      const mime = MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
      return new Response(data, { headers: { 'Content-Type': mime } })
    } catch (err) {
      console.error('[localfile]', err.message)
      return new Response(null, { status: 404 })
    }
  })

  mainWindow = createWindow()
  tray = createTray(mainWindow, store)

  setShell(conversionShell)

  applyGlobalShortcut(store.getSettings().globalShortcut)
  clipboardMonitor.start()

  mainWindow.on('show', () => {
    stopTrayBlink()
    flushUnsentToRenderer()
  })

  initAutoUpdater(mainWindow, ipcMain)

  // Restore Google session on startup
  loadStoredSession().then((user) => {
    if (!user) return
    const localState = {
      updatedAt: store.getProjectsUpdatedAt(),
      projects: store.getProjects(),
    }
    const authClient = getAuthClient()
    pullProjects(authClient, localState).then((result) => {
      if (result.action === 'pull' && result.projects) {
        store.setProjects(result.projects)
        store.touchProjectsUpdatedAt()
        mainWindow?.webContents.send('projects-updated', {
          projects: store.getProjects(),
          activeProjectId: store.getActiveProjectId(),
        })
      }
      mainWindow?.webContents.send('account-changed', user)
    }).catch(() => {
      mainWindow?.webContents.send('account-changed', user)
    })
  }).catch(() => {})

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

app.on('before-quit', () => {
  isQuitting = true
  stopTrayBlink()
  tray?.destroy()
  clipboardMonitor.stop()
  conversionShell.stop()
  terminateOcr()
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

ipcMain.handle('run-ocr', async (_e, dataURL) => {
  const text = await recognizeDataURL(dataURL)
  return text
})

ipcMain.handle('paste-schematic', async () => {
  const emfBuffer = await readEMF()
  if (!emfBuffer) {
    return { error: 'NO_EMF', message: 'Nenhum esquemático vetorial encontrado no clipboard.' }
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
    pendingQueue.push({ svgContent, metadata, sent: true })

    return { ok: true, svgContent, metadata }
  } catch (err) {
    if (err.message === 'TIMEOUT') {
      return { error: 'TIMEOUT', message: 'A conversão demorou mais de 15s. Tente novamente.' }
    }
    return { error: 'ERROR', message: `Erro de conversão: ${err.message}` }
  }
})

ipcMain.handle('save-svg', async (_event, { projectId, format = 'svg' }) => {
  const pendingSVG = pendingQueue[0]
  if (!pendingSVG) return { error: 'NO_PENDING', message: 'Nenhum SVG aguardando confirmação.' }

  if (!VALID_EXPORT_FORMATS.includes(format)) {
    return { error: 'INVALID_FORMAT', message: `Formato inválido: ${format}` }
  }

  const project = store.getProjects().find((p) => p.id === projectId)
  if (!project) return { error: 'PROJECT_NOT_FOUND', message: 'Projeto não encontrado.' }

  const mode = project.outputMode ?? 'local'

  // ── Drive-only path ────────────────────────────────────────────────────────
  if (mode === 'drive') {
    if (!project.driveFolderId) {
      return { ok: false, error: 'NO_DRIVE_FOLDER', message: 'Pasta do Drive não configurada.' }
    }
    const authClient = getAuthClient()
    if (!authClient) {
      return { ok: false, error: 'NOT_LOGGED_IN', message: 'Login necessário para salvar no Drive.' }
    }

    const filename = generateFilenameWithExt(project.prefix, project.counter + 1, format)
    const tmpPath = path.join(os.tmpdir(), filename)
    const entryId = crypto.randomUUID()

    try {
      await exportToFormat(pendingSVG.svgContent, format, tmpPath)

      // Always generate a thumbnail for drive-only entries (no local file to display)
      const thumbsDir = path.join(app.getPath('userData'), 'thumbs')
      await fsp.mkdir(thumbsDir, { recursive: true })
      const thumbPath = path.join(thumbsDir, `${entryId}.png`)
      const thumbBuffer = await generateThumbnail(pendingSVG.svgContent)
      await fsp.writeFile(thumbPath, thumbBuffer)

      const { size: sizeBytes } = await fsp.stat(tmpPath)
      const uploadResult = await uploadFileToDriveFolder(
        authClient, tmpPath, filename, mimeTypeForExt(format), project.driveFolderId
      )
      await fsp.unlink(tmpPath).catch(() => {})

      if (!uploadResult.ok) {
        return { ok: false, error: 'UPLOAD_FAILED', message: 'Falha ao enviar para o Drive.' }
      }

      const newCounter = store.incrementCounter(projectId)
      const entry = {
        id: entryId,
        filename,
        fullPath: null,
        thumbPath,
        driveFileId: uploadResult.fileId,
        driveFileUrl: uploadResult.webViewLink ?? `https://drive.google.com/file/d/${uploadResult.fileId}/view`,
        driveFolderUrl: project.driveFolderUrl ?? null,
        projectId,
        timestamp: new Date().toISOString(),
        sizeBytes,
      }
      store.addHistoryEntry(entry)
      pendingQueue.shift()
      updateTrayMenu(mainWindow, store)
      return { ok: true, filename, fullPath: null, entry, newCounter }
    } catch (err) {
      await fsp.unlink(tmpPath).catch(() => {})
      return { ok: false, error: 'EXPORT_FAILED', message: err.message }
    }
  }

  // ── Local path (default) ───────────────────────────────────────────────────
  const dirCheck = await checkOutputDir(project.outputDir)
  if (!dirCheck.exists) {
    return { dirMissing: true, outputDir: project.outputDir }
  }

  const filename = generateFilenameWithExt(project.prefix, project.counter + 1, format)
  const fullPath = path.join(project.outputDir, filename)

  try {
    await exportToFormat(pendingSVG.svgContent, format, fullPath)
    const { size: sizeBytes } = await fsp.stat(fullPath)
    const newCounter = store.incrementCounter(projectId)
    const entryId = crypto.randomUUID()

    let thumbPath = null
    if (format === 'pdf') {
      const thumbsDir = path.join(app.getPath('userData'), 'thumbs')
      await fsp.mkdir(thumbsDir, { recursive: true })
      thumbPath = path.join(thumbsDir, `${entryId}.png`)
      const thumbBuffer = await generateThumbnail(pendingSVG.svgContent)
      await fsp.writeFile(thumbPath, thumbBuffer)
    }

    const entry = {
      id: entryId,
      filename,
      fullPath,
      ...(thumbPath && { thumbPath }),
      projectId,
      timestamp: new Date().toISOString(),
      sizeBytes,
    }
    store.addHistoryEntry(entry)
    pendingQueue.shift()
    updateTrayMenu(mainWindow, store)
    return { ok: true, filename, fullPath, entry, newCounter }
  } catch (err) {
    if (err.code === 'EACCES' || err.message?.startsWith('EACCES')) {
      return { error: 'EACCES', message: 'Sem permissão de escrita na pasta de destino.' }
    }
    if (err.message === 'TIMEOUT') {
      return { error: 'TIMEOUT', message: 'A exportação demorou mais de 30s. Tente novamente.' }
    }
    return { error: 'ERROR', message: err.message }
  }
})

ipcMain.handle('discard-svg', async () => {
  pendingQueue.shift()
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

ipcMain.handle('add-project', async (_event, project) => {
  store.touchProjectsUpdatedAt()
  store.addProject(project)
  if (!store.getActiveProjectId()) store.setActiveProject(project.id)
  updateTrayMenu(mainWindow, store)
  const authClient = getAuthClient()
  if (authClient) pushProjects(authClient, store.getProjects()).catch(() => {})
  return { projects: store.getProjects(), activeProjectId: store.getActiveProjectId() }
})

ipcMain.handle('update-project', async (_event, { id, updates }) => {
  store.touchProjectsUpdatedAt()
  store.updateProject(id, updates)
  updateTrayMenu(mainWindow, store)
  const authClient = getAuthClient()
  if (authClient) pushProjects(authClient, store.getProjects()).catch(() => {})
  return { projects: store.getProjects() }
})

ipcMain.handle('delete-project', async (_event, { id }) => {
  store.touchProjectsUpdatedAt()
  store.deleteProject(id)
  updateTrayMenu(mainWindow, store)
  const authClient = getAuthClient()
  if (authClient) pushProjects(authClient, store.getProjects()).catch(() => {})
  return { projects: store.getProjects(), activeProjectId: store.getActiveProjectId() }
})

ipcMain.handle('reorder-projects', async (_event, { ids }) => {
  store.touchProjectsUpdatedAt()
  store.reorderProjects(ids)
  updateTrayMenu(mainWindow, store)
  const authClient = getAuthClient()
  if (authClient) pushProjects(authClient, store.getProjects()).catch(() => {})
  return { projects: store.getProjects() }
})

ipcMain.handle('get-app-info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
}))

ipcMain.handle('open-external', (_e, url) => shell.openExternal(url))

ipcMain.handle('get-settings', () => store.getSettings())

ipcMain.handle('set-titlebar-dim', (_event, { dimmed }) => {
  if (!mainWindow) return
  const overlay = dimmed
    ? { color: '#000000', symbolColor: '#666666', height: 40 }
    : titleBarColors(store.getSettings().theme ?? 'system', nativeTheme.shouldUseDarkColors)
  mainWindow.setTitleBarOverlay(overlay)
})

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

ipcMain.handle('save-notifications', (_event, list) => {
  store.saveNotifications(list)
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
    notifications: store.getNotifications(),
    account: getStoredUser(),
    shellStatus: 'ready',
  }
})

ipcMain.handle('show-in-folder', (_event, { fullPath }) => {
  shell.showItemInFolder(fullPath)
  return { ok: true }
})

ipcMain.handle('sync-history', async () => {
  const entries = store.getHistory()
  const surviving = []
  for (const entry of entries) {
    if (!entry.fullPath) {
      // Drive-only entry — no local file to check, always keep
      surviving.push(entry)
      continue
    }
    try {
      await fsp.access(entry.fullPath)
      surviving.push(entry)
    } catch {
      store.deleteHistoryEntry(entry.id)
    }
  }
  updateTrayMenu(mainWindow, store)
  return { history: surviving }
})

ipcMain.handle('delete-history-file', async (_event, { entryId, fullPath, thumbPath, driveFileId }) => {
  if (fullPath) {
    try {
      await fsp.unlink(fullPath)
    } catch (err) {
      if (err.code !== 'ENOENT') return { error: err.message }
    }
  }
  if (thumbPath) await fsp.unlink(thumbPath).catch(() => {})
  if (driveFileId) {
    const authClient = getAuthClient()
    if (authClient) {
      await deleteDriveFile(authClient, driveFileId).catch(() => {})
    }
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

ipcMain.handle('capture-screen', async (_event, { mode, delay }) => {
  const doCapture = async () => {
    try {
      let result
      if (mode === 'fullscreen') {
        result = await captureFullscreen(mainWindow)
      } else if (mode === 'window') {
        result = await captureWindow()
      } else if (mode === 'region') {
        result = await captureRegion(mainWindow)
      } else {
        throw new Error(`Unknown capture mode: ${mode}`)
      }
      mainWindow.show()
      mainWindow.webContents.send('capture-ready', result)
    } catch (err) {
      mainWindow.show()
      const cancelled = err.message === 'CANCELLED'
      mainWindow.webContents.send('capture-cancelled', { cancelled, error: cancelled ? null : err.message })
    }
  }

  if (!delay || delay === 0) {
    mainWindow.hide()
    await doCapture()
  } else {
    mainWindow.hide()
    showCountdown(
      delay,
      doCapture,
      () => {
        mainWindow.show()
        mainWindow.webContents.send('capture-cancelled')
      }
    )
  }
  return { ok: true }
})

ipcMain.handle('cancel-capture', async () => {
  hideCountdown()
  ipcMain.emit('region-cancelled')
  mainWindow.show()
  return { ok: true }
})

ipcMain.handle('save-image', async (_event, { dataURL, projectId, format, resolution }) => {
  const project = store.getProjects().find((p) => p.id === projectId)
  if (!project) return { error: 'PROJECT_NOT_FOUND', message: 'Projeto não encontrado.' }

  const mode = project.outputMode ?? 'local'
  const ext = format === 'jpg' ? 'jpg' : 'png'
  const filename = generateFilenameWithExt(project.prefix, project.counter + 1, ext)

  // ── Drive-only path ────────────────────────────────────────────────────────
  if (mode === 'drive') {
    if (!project.driveFolderId) {
      return { ok: false, error: 'NO_DRIVE_FOLDER', message: 'Pasta do Drive não configurada.' }
    }
    const authClient = getAuthClient()
    if (!authClient) {
      return { ok: false, error: 'NOT_LOGGED_IN', message: 'Login necessário para salvar no Drive.' }
    }

    const entryId = crypto.randomUUID()
    let tmpPath

    try {
      // Decode raw buffer and apply resolution scaling for the uploaded file
      const base64Data = dataURL.replace(/^data:image\/\w+;base64,/, '')
      const rawBuffer = Buffer.from(base64Data, 'base64')
      const processedBuffer = await applyResolution(rawBuffer, resolution)
      tmpPath = await saveBuffer(processedBuffer, os.tmpdir(), filename)

      // Generate thumbnail from the raw dataURL (do NOT apply resolution scaling to thumbnails)
      const thumbsDir = path.join(app.getPath('userData'), 'thumbs')
      await fsp.mkdir(thumbsDir, { recursive: true })
      const thumbPath = path.join(thumbsDir, `${entryId}.png`)
      await fsp.writeFile(thumbPath, Buffer.from(base64Data, 'base64'))

      const { size: sizeBytes } = await fsp.stat(tmpPath)
      const uploadResult = await uploadFileToDriveFolder(
        authClient, tmpPath, filename, mimeTypeForExt(ext), project.driveFolderId
      )
      await fsp.unlink(tmpPath).catch(() => {})

      if (!uploadResult.ok) {
        return { ok: false, error: 'UPLOAD_FAILED', message: 'Falha ao enviar para o Drive.' }
      }

      const newCounter = store.incrementCounter(projectId)
      const entry = {
        id: entryId,
        filename,
        fullPath: null,
        thumbPath,
        driveFileId: uploadResult.fileId,
        driveFileUrl: uploadResult.webViewLink ?? `https://drive.google.com/file/d/${uploadResult.fileId}/view`,
        driveFolderUrl: project.driveFolderUrl ?? null,
        projectId,
        timestamp: new Date().toISOString(),
        sizeBytes,
      }
      store.addHistoryEntry(entry)
      updateTrayMenu(mainWindow, store)
      return { ok: true, filename, fullPath: null, entry, newCounter }
    } catch (err) {
      if (tmpPath) await fsp.unlink(tmpPath).catch(() => {})
      return { ok: false, error: err.message }
    }
  }

  // ── Local path (default) ───────────────────────────────────────────────────
  const dirCheck = await checkOutputDir(project.outputDir)
  if (!dirCheck.exists) {
    return { ok: false, dirMissing: true, outputDir: project.outputDir }
  }

  try {
    const base64Data = dataURL.replace(/^data:image\/\w+;base64,/, '')
    const rawBuffer = Buffer.from(base64Data, 'base64')
    const processedBuffer = await applyResolution(rawBuffer, resolution)
    const fullPath = await saveBuffer(processedBuffer, project.outputDir, filename)
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
    updateTrayMenu(mainWindow, store)
    return { ok: true, filename, fullPath, entry, newCounter }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('google-login', async () => {
  try {
    const result = await loginWithGoogle()
    if (!result.ok) return { ok: false, error: 'Login falhou' }
    const localState = {
      updatedAt: store.getProjectsUpdatedAt(),
      projects: store.getProjects(),
    }
    const authClient = getAuthClient()
    const syncResult = await pullProjects(authClient, localState).catch(() => ({ action: 'none' }))
    if (syncResult.action === 'pull' && syncResult.projects) {
      store.setProjects(syncResult.projects)
      store.touchProjectsUpdatedAt()
      mainWindow?.webContents.send('projects-updated', {
        projects: store.getProjects(),
        activeProjectId: store.getActiveProjectId(),
      })
    } else {
      await pushProjects(authClient, store.getProjects()).catch(() => {})
    }
    mainWindow?.webContents.send('account-changed', result.user)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('google-logout', async () => {
  try {
    const result = await logout()
    mainWindow?.webContents.send('account-changed', null)
    return result
  } catch (err) {
    mainWindow?.webContents.send('account-changed', null)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('sync-projects', async () => {
  try {
    const authClient = getAuthClient()
    if (!authClient) return { ok: false, error: 'Não autenticado' }
    const localState = {
      updatedAt: store.getProjectsUpdatedAt(),
      projects: store.getProjects(),
    }
    const result = await pullProjects(authClient, localState)
    if (result.action === 'pull' && result.projects) {
      store.setProjects(result.projects)
      store.touchProjectsUpdatedAt()
      mainWindow?.webContents.send('projects-updated', {
        projects: store.getProjects(),
        activeProjectId: store.getActiveProjectId(),
      })
    } else {
      pushProjects(authClient, store.getProjects()).catch(() => {})
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('share-file', async (_event, { fullPath, email }) => {
  try {
    const authClient = getAuthClient()
    if (!authClient) return { ok: false, error: 'Não autenticado' }
    try { await fsp.access(fullPath) } catch { return { ok: false, error: 'Arquivo não encontrado' } }
    const filename = path.basename(fullPath)
    const ext = path.extname(filename).toLowerCase()
    const mimeTypes = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.pdf': 'application/pdf' }
    const mimeType = mimeTypes[ext] ?? 'application/octet-stream'
    const uploadResult = await uploadFile(authClient, fullPath, filename, mimeType)
    if (!uploadResult.ok) return { ok: false, error: 'Falha no upload' }
    await shareFileWithEmail(authClient, uploadResult.fileId, email)
    return { ok: true, webViewLink: uploadResult.webViewLink }
  } catch (err) {
    if (err.code === 400) return { ok: false, error: 'E-mail inválido' }
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('drive-list-folders', async (_e, { parentId } = {}) => {
  const authClient = getAuthClient()
  if (!authClient) return { ok: false, error: 'NOT_LOGGED_IN' }
  try {
    const folders = await listDriveFolders(authClient, parentId)
    return { ok: true, folders }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('drive-create-folder', async (_e, { parentId, name }) => {
  const authClient = getAuthClient()
  if (!authClient) return { ok: false, error: 'NOT_LOGGED_IN' }
  try {
    const folder = await createDriveFolder(authClient, name, parentId)
    return { ok: true, folderId: folder.id, folderUrl: folder.webViewLink }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('drive-delete-folder', async (_e, { folderId }) => {
  const authClient = getAuthClient()
  if (!authClient) return { ok: false, error: 'NOT_LOGGED_IN' }
  try {
    await deleteDriveFolder(authClient, folderId)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('drive-create-project-folder', async (_e, { projectId, parentId }) => {
  const authClient = getAuthClient()
  if (!authClient) return { ok: false, error: 'NOT_LOGGED_IN' }
  const project = store.getProjects().find((p) => p.id === projectId)
  if (!project) return { ok: false, error: 'PROJECT_NOT_FOUND' }
  try {
    const folder = await createDriveFolder(authClient, project.name, parentId)
    store.updateProject(projectId, { driveFolderId: folder.id, driveFolderUrl: folder.webViewLink, driveFolderName: project.name })
    return { ok: true, folderId: folder.id, folderUrl: folder.webViewLink, folderName: project.name, projects: store.getProjects() }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('drive-share-project-folder', async (_e, { projectId, email }) => {
  const authClient = getAuthClient()
  if (!authClient) return { ok: false, error: 'NOT_LOGGED_IN' }
  const project = store.getProjects().find((p) => p.id === projectId)
  if (!project?.driveFolderId) return { ok: false, error: 'NO_DRIVE_FOLDER' }
  try {
    return await shareFolderWithEmail(authClient, project.driveFolderId, email)
  } catch (err) {
    return { ok: false, error: err.message }
  }
})
