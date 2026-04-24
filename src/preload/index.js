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

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (updates) => ipcRenderer.invoke('update-settings', updates),
  chooseDirectory: () => ipcRenderer.invoke('choose-directory'),
  getLoginItemSettings: () => ipcRenderer.invoke('get-login-item-settings'),
  setLoginItemSettings: (data) => ipcRenderer.invoke('set-login-item-settings', data),

  // History
  getHistory: () => ipcRenderer.invoke('get-history'),

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
  onShellStatus: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('shell-status', handler)
    return () => ipcRenderer.removeListener('shell-status', handler)
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
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // File operations
  showInFolder: (data) => ipcRenderer.invoke('show-in-folder', data),
  deleteHistoryFile: (data) => ipcRenderer.invoke('delete-history-file', data),
  copyFileToClipboard: (data) => ipcRenderer.invoke('copy-file-to-clipboard', data),
})
