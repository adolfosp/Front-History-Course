const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  const indexPath = path.join(__dirname, '../dist/history-course/browser/index.html');
  console.log('[Electron] Carregando:', indexPath);
  win.loadFile(indexPath);

  // DevTools opcional:
  win.webContents.openDevTools();
}

app.whenReady().then(() => {
  console.log('[Electron] App iniciado');
  createWindow();
});
