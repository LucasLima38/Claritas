import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Clipboard / conversion
  pasteSchematic: () => ipcRenderer.invoke('paste-schematic'),
  saveSVG: (data) => ipcRenderer.invoke('save-svg', data),
  discardSVG: () => ipcRenderer.invoke('discard-svg'),
  createOutputDir: (data) => ipcRenderer.invoke('create-output-dir', data),

  // Projects
  getProjects: () => ipcRenderer.invoke('get-projects'),
  setActiveProject: (data) => ipcRenderer.invoke('set-active-project', data),
  addProject: (project) => ipcRenderer.invoke('add-project', project),
  updateProject: (data) => ipcRenderer.invoke('update-project', data),
  deleteProject: (data) => ipcRenderer.invoke('delete-project', data),
  reorderProjects: (data) => ipcRenderer.invoke('reorder-projects', data),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (updates) => ipcRenderer.invoke('update-settings', updates),
  chooseDirectory: () => ipcRenderer.invoke('choose-directory'),
  getLoginItemSettings: () => ipcRenderer.invoke('get-login-item-settings'),
  setLoginItemSettings: (data) => ipcRenderer.invoke('set-login-item-settings', data),

  // History
  getHistory: () => ipcRenderer.invoke('get-history'),
  syncHistory: () => ipcRenderer.invoke('sync-history'),

  // Initial data fetch (called by renderer on mount — avoids did-finish-load race)
  getInitData: () => ipcRenderer.invoke('get-init-data'),

  // Event listeners (return cleanup function)
  onThemeChanged: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('theme-changed', handler)
    return () => ipcRenderer.removeListener('theme-changed', handler)
  },
  onProjectsUpdated: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('projects-updated', handler)
    return () => ipcRenderer.removeListener('projects-updated', handler)
  },
  onNavigateTo: (cb) => {
    const handler = (_e, screen) => cb(screen)
    ipcRenderer.on('navigate-to', handler)
    return () => ipcRenderer.removeListener('navigate-to', handler)
  },
  onPreviewReady: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('preview-ready', handler)
    return () => ipcRenderer.removeListener('preview-ready', handler)
  },
  onUpdateAvailable: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('update-available', handler)
    return () => ipcRenderer.removeListener('update-available', handler)
  },
  onUpdateDownloading: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('update-downloading', handler)
    return () => ipcRenderer.removeListener('update-downloading', handler)
  },
  onUpdateDownloadProgress: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('update-download-progress', handler)
    return () => ipcRenderer.removeListener('update-download-progress', handler)
  },
  installUpdate: () => ipcRenderer.invoke('install-update'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  simulateUpdate: () => ipcRenderer.invoke('simulate-update'),
  onUpdateNotAvailable: (cb) => {
    const handler = () => cb()
    ipcRenderer.on('update-not-available', handler)
    return () => ipcRenderer.removeListener('update-not-available', handler)
  },

  // File operations
  showInFolder: (data) => ipcRenderer.invoke('show-in-folder', data),
  deleteHistoryFile: (data) => ipcRenderer.invoke('delete-history-file', data),
  copyFileToClipboard: (data) => ipcRenderer.invoke('copy-file-to-clipboard', data),

  // OCR
  runOcr: (dataURL) => ipcRenderer.invoke('run-ocr', dataURL),

  // App info
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Screenshot capture
  captureScreen: (data) => ipcRenderer.invoke('capture-screen', data),
  cancelCapture: () => ipcRenderer.invoke('cancel-capture'),
  saveImage: (data) => ipcRenderer.invoke('save-image', data),

  // Notifications
  saveNotifications: (list) => ipcRenderer.invoke('save-notifications', list),
  onCaptureReady: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('capture-ready', handler)
    return () => ipcRenderer.removeListener('capture-ready', handler)
  },
  onCaptureCancelled: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('capture-cancelled', handler)
    return () => ipcRenderer.removeListener('capture-cancelled', handler)
  },

  // Google Auth / Drive
  googleLogin: () => ipcRenderer.invoke('google-login'),
  googleLogout: () => ipcRenderer.invoke('google-logout'),
  syncProjects: () => ipcRenderer.invoke('sync-projects'),
  shareFile: (payload) => ipcRenderer.invoke('share-file', payload),
  driveListFolders: (parentId) => ipcRenderer.invoke('drive-list-folders', { parentId }),
  driveCreateProjectFolder: (projectId, parentId) => ipcRenderer.invoke('drive-create-project-folder', { projectId, parentId }),
  driveShareProjectFolder: (projectId, email) => ipcRenderer.invoke('drive-share-project-folder', { projectId, email }),
  onAccountChanged: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('account-changed', handler)
    return () => ipcRenderer.removeListener('account-changed', handler)
  },
})
