const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nexusNative', {
  isDesktopApp: true,
  getPrimaryScreenId: () => ipcRenderer.invoke('get-primary-screen'),
  sendNativeInput: (data) => ipcRenderer.send('execute-native-input', data)
});
