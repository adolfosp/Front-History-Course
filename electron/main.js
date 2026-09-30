const { app, BrowserWindow, ipcMain, screen } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  VideoWindowManager,
  isTrustedMainSender,
  isTrustedPlayerSender,
} = require('./video-window-manager');

let mainWindow = null;
let videoWindowManager = null;
let quitInProgress = false;
let allowQuit = false;

function getBoundsFilePath() {
  return path.join(app.getPath('userData'), 'video-window-bounds.json');
}

function readSavedBounds() {
  try {
    return JSON.parse(fs.readFileSync(getBoundsFilePath(), 'utf8'));
  } catch {
    return null;
  }
}

function saveBounds(bounds) {
  try {
    fs.writeFileSync(getBoundsFilePath(), JSON.stringify(bounds), 'utf8');
  } catch (error) {
    console.error('[Electron] Falha ao salvar limites do player:', error);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    }
  });

  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  const indexPath = path.join(__dirname, '../dist/history-course/browser/index.html');
  console.log('[Electron] Carregando:', indexPath);
  win.loadFile(indexPath);

  // DevTools opcional:
  //win.webContents.openDevTools();
}

function assertMainSender(event) {
  if (!isTrustedMainSender(event, mainWindow)) {
    throw new Error('IPC command rejected: untrusted sender.');
  }
}

function assertPlayerSender(event) {
  if (!videoWindowManager || !isTrustedPlayerSender(event, videoWindowManager)) {
    throw new Error('IPC player event rejected: untrusted sender.');
  }
}

function registerVideoIpc() {
  ipcMain.handle('video-windows:open', (event, request) => {
    assertMainSender(event);
    return videoWindowManager.openVideo(request);
  });

  ipcMain.handle('video-windows:replace', (event, sessionId, request) => {
    assertMainSender(event);
    return videoWindowManager.replaceVideo(sessionId, request);
  });

  ipcMain.handle('video-windows:close', (event, sessionId) => {
    assertMainSender(event);
    return videoWindowManager.closeVideo(sessionId);
  });

  ipcMain.handle('video-player:get-state', (event) => {
    assertPlayerSender(event);
    return videoWindowManager.getPlayerState(event.sender);
  });

  ipcMain.on('video-player:event', (event, playbackEvent) => {
    if (!videoWindowManager || !isTrustedPlayerSender(event, videoWindowManager)) {
      return;
    }

    try {
      videoWindowManager.handlePlayerEvent(event.sender, playbackEvent);
    } catch (error) {
      console.error('[Electron] Evento de player rejeitado:', error);
    }
  });
}

app.whenReady().then(() => {
  console.log('[Electron] App iniciado');
  createWindow();
  videoWindowManager = new VideoWindowManager({
    BrowserWindow,
    playerHtmlPath: path.join(__dirname, 'player', 'index.html'),
    playerPreloadPath: path.join(__dirname, 'player-preload.js'),
    createSessionId: () => crypto.randomUUID(),
    getSavedBounds: readSavedBounds,
    saveBounds,
    getDisplays: () => screen.getAllDisplays(),
    emitPlaybackEvent: (event) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('video-windows:playback-event', event);
      }
    },
  });
  registerVideoIpc();
});

app.on('before-quit', (event) => {
  if (allowQuit) {
    videoWindowManager?.closeAll();
    return;
  }

  event.preventDefault();
  if (quitInProgress) {
    return;
  }

  quitInProgress = true;
  const closePlayers = videoWindowManager
    ? videoWindowManager.closeAllGracefully()
    : Promise.resolve();

  void closePlayers.finally(() => {
    allowQuit = true;
    app.quit();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
