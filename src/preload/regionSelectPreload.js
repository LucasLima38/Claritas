import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('regionAPI', {
  sendRegionSelected: (rect) => ipcRenderer.send('region-selected', rect),
  sendCancelled: () => ipcRenderer.send('region-cancelled'),
})
