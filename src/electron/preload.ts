import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
  onMidiOutRequest: (callback: (data: { channel: number; cc: number; value: number }) => void) => {
    ipcRenderer.on('midi-out-request', (_event, data) => callback(data));
  },
  onPcOutRequest: (callback: (data: { channel: number; program: number }) => void) => {
    ipcRenderer.on('pc-out-request', (_event, data) => callback(data));
  },
  sendMidiIngress: (data: { channel: number; cc?: number; program?: number; value?: number; type: 'cc' | 'pc' }) => {
    ipcRenderer.send('midi-ingress-received', data);
  },
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  onOpenScrumModal: (callback: () => void) => {
    ipcRenderer.on('open-scrum-modal', () => callback());
  },
  onOpenDocsModal: (callback: () => void) => {
    ipcRenderer.on('open-docs-modal', () => callback());
  },
  onOpenWifiModal: (callback: () => void) => {
    ipcRenderer.on('open-wifi-modal', () => callback());
  },
  onOpenPresetsModal: (callback: () => void) => {
    ipcRenderer.on('open-presets-modal', () => callback());
  },
  onOpenMidiModal: (callback: () => void) => {
    ipcRenderer.on('open-midi-modal', () => callback());
  }
});
