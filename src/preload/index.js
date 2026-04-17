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

  // History
  getHistory: () => ipcRenderer.invoke('get-history'),

  // Initial data fetch (called by renderer on mount — avoids did-finish-load race)
  getInitData: () => ipcRenderer.invoke('get-init-data'),

  // Event listeners (return cleanup function)
  onInit: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('init', handler)
    return () => ipcRenderer.removeListener('init', handler)
  },
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
})
