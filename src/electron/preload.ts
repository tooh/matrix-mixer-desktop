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
  }
});
