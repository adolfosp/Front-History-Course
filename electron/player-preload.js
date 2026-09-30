const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('videoPlayerBridge', {
  getState: () => ipcRenderer.invoke('video-player:get-state'),
  sendEvent: (event) => ipcRenderer.send('video-player:event', event),
  onLoad: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('video-player:load', listener);
    return () => ipcRenderer.removeListener('video-player:load', listener);
  },
  onPause: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('video-player:pause', listener);
    return () => ipcRenderer.removeListener('video-player:pause', listener);
  },
  onPrepareClose: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('video-player:prepare-close', listener);
    return () =>
      ipcRenderer.removeListener('video-player:prepare-close', listener);
  },
});
