const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('videoWindows', {
  isAvailable: true,
  openVideo: (request) => ipcRenderer.invoke('video-windows:open', request),
  replaceVideo: (sessionId, request) =>
    ipcRenderer.invoke('video-windows:replace', sessionId, request),
  closeVideo: (sessionId) =>
    ipcRenderer.invoke('video-windows:close', sessionId),
  onPlaybackEvent: (callback) => {
    const listener = (_event, playbackEvent) => callback(playbackEvent);
    ipcRenderer.on('video-windows:playback-event', listener);
    return () => {
      ipcRenderer.removeListener('video-windows:playback-event', listener);
    };
  },
});
