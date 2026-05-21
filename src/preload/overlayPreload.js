import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('overlayAPI', {
  onCountdownTick: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('countdown-tick', handler)
    return () => ipcRenderer.removeListener('countdown-tick', handler)
  },
  sendCancelCapture: () => ipcRenderer.send('cancel-capture-from-overlay'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
})
