const PUBLIC_PLAYBACK_EVENTS = new Set([
  'progress',
  'paused',
  'completed',
  'ended',
]);

function isFiniteBounds(bounds) {
  return (
    bounds &&
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    bounds.width > 0 &&
    bounds.height > 0
  );
}

function isBoundsInsideDisplay(bounds, displays) {
  if (!isFiniteBounds(bounds) || !Array.isArray(displays)) {
    return false;
  }

  return displays.some(({ workArea }) => {
    if (!isFiniteBounds(workArea)) {
      return false;
    }

    return (
      bounds.x >= workArea.x &&
      bounds.y >= workArea.y &&
      bounds.x + bounds.width <= workArea.x + workArea.width &&
      bounds.y + bounds.height <= workArea.y + workArea.height
    );
  });
}

function validateVideoRequest(request) {
  if (!request || typeof request !== 'object') {
    throw new TypeError('Invalid video request.');
  }

  for (const field of ['videoKey', 'title', 'url']) {
    if (typeof request[field] !== 'string' || request[field].trim() === '') {
      throw new TypeError(`Invalid video request field: ${field}.`);
    }
  }

  if (!Number.isFinite(request.initialTime) || request.initialTime < 0) {
    throw new TypeError('Invalid video request field: initialTime.');
  }

  return {
    videoKey: request.videoKey,
    title: request.title,
    url: request.url,
    initialTime: request.initialTime,
  };
}

class VideoWindowManager {
  constructor({
    BrowserWindow,
    playerHtmlPath,
    playerPreloadPath,
    createSessionId,
    getSavedBounds,
    saveBounds,
    getDisplays,
    emitPlaybackEvent,
  }) {
    this.BrowserWindow = BrowserWindow;
    this.playerHtmlPath = playerHtmlPath;
    this.playerPreloadPath = playerPreloadPath;
    this.createSessionId = createSessionId;
    this.getSavedBounds = getSavedBounds;
    this.saveBounds = saveBounds;
    this.getDisplays = getDisplays;
    this.emitPlaybackEvent = emitPlaybackEvent;
    this.sessions = new Map();
    this.videoSessions = new Map();
    this.playerSessions = new Map();
    this.isQuitting = false;
  }

  async openVideo(rawRequest) {
    const request = validateVideoRequest(rawRequest);
    const existingSessionId = this.videoSessions.get(request.videoKey);
    const existing = existingSessionId
      ? this.sessions.get(existingSessionId)
      : null;

    if (existing && !existing.window.isDestroyed()) {
      existing.window.focus();
      return { sessionId: existing.sessionId, reused: true };
    }

    const sessionId = this.createSessionId();
    const savedBounds = this.getSavedBounds();
    const restoredBounds = isBoundsInsideDisplay(savedBounds, this.getDisplays())
      ? savedBounds
      : null;
    const window = new this.BrowserWindow({
      width: restoredBounds?.width ?? 960,
      height: restoredBounds?.height ?? 540,
      ...(restoredBounds
        ? { x: restoredBounds.x, y: restoredBounds.y }
        : {}),
      show: false,
      title: request.title,
      webPreferences: {
        preload: this.playerPreloadPath,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    const playerWebContentsId = window.webContents.id;
    const session = {
      sessionId,
      request,
      window,
      playerWebContentsId,
      lastPlayback: { currentTime: request.initialTime, duration: 0 },
      forceClosing: false,
    };

    this.sessions.set(sessionId, session);
    this.videoSessions.set(request.videoKey, sessionId);
    this.playerSessions.set(playerWebContentsId, sessionId);
    this.configureWindow(session);

    await window.loadFile(this.playerHtmlPath, {
      query: { sessionId },
    });

    return { sessionId, reused: false };
  }

  async replaceVideo(sessionId, rawRequest) {
    const request = validateVideoRequest(rawRequest);
    const session = this.sessions.get(sessionId);
    if (!session || session.window.isDestroyed()) {
      return this.openVideo(request);
    }

    const existingSessionId = this.videoSessions.get(request.videoKey);
    if (existingSessionId && existingSessionId !== sessionId) {
      const existing = this.sessions.get(existingSessionId);
      if (existing && !existing.window.isDestroyed()) {
        this.forceClose(sessionId);
        existing.window.focus();
        return { sessionId: existingSessionId, reused: true };
      }
    }

    this.videoSessions.delete(session.request.videoKey);
    session.request = request;
    session.lastPlayback = { currentTime: request.initialTime, duration: 0 };
    this.videoSessions.set(request.videoKey, sessionId);
    session.window.webContents.send('video-player:load', {
      sessionId,
      request,
    });

    return { sessionId, reused: false };
  }

  async closeVideo(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.window.isDestroyed()) {
      return;
    }

    session.window.webContents.send('video-player:prepare-close');
  }

  forceClose(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.window.isDestroyed()) {
      return;
    }

    session.forceClosing = true;
    this.captureBounds(session);
    session.window.destroy();
  }

  closeAll() {
    this.isQuitting = true;
    for (const sessionId of [...this.sessions.keys()]) {
      this.forceClose(sessionId);
    }
  }

  async closeAllGracefully(timeoutMs = 1_500) {
    this.isQuitting = true;
    const pendingSessions = [...this.sessions.values()].filter(
      (session) => !session.window.isDestroyed()
    );

    await Promise.all(
      pendingSessions.map(
        (session) =>
          new Promise((resolve) => {
            let settled = false;
            let timer;
            const finish = () => {
              if (settled) {
                return;
              }
              settled = true;
              clearTimeout(timer);
              resolve();
            };

            session.window.once('closed', finish);
            timer = setTimeout(() => {
              this.forceClose(session.sessionId);
              finish();
            }, timeoutMs);
            session.window.webContents.send('video-player:prepare-close');
          })
      )
    );
  }

  hasPlayerWebContents(webContents) {
    return Boolean(webContents && this.playerSessions.has(webContents.id));
  }

  getPlayerState(webContents) {
    const sessionId = webContents
      ? this.playerSessions.get(webContents.id)
      : null;
    const session = sessionId ? this.sessions.get(sessionId) : null;

    return session
      ? { sessionId: session.sessionId, request: session.request }
      : null;
  }

  handlePlayerEvent(webContents, event) {
    const sessionId = this.playerSessions.get(webContents?.id);
    const session = sessionId ? this.sessions.get(sessionId) : null;

    if (!session || !event || event.sessionId !== sessionId) {
      throw new Error('Untrusted video player event.');
    }

    if (Number.isFinite(event.currentTime) && Number.isFinite(event.duration)) {
      session.lastPlayback = {
        currentTime: Math.max(0, event.currentTime),
        duration: Math.max(0, event.duration),
      };
    }

    if (event.type === 'playing') {
      for (const other of this.sessions.values()) {
        if (other.sessionId !== sessionId && !other.window.isDestroyed()) {
          other.window.webContents.send('video-player:pause');
        }
      }
      return;
    }

    if (event.type === 'close-ready') {
      this.forceClose(sessionId);
      return;
    }

    if (!PUBLIC_PLAYBACK_EVENTS.has(event.type)) {
      throw new TypeError(`Invalid playback event type: ${event.type}.`);
    }

    this.emitPlaybackEvent({
      type: event.type,
      sessionId,
      currentTime: session.lastPlayback.currentTime,
      duration: session.lastPlayback.duration,
    });
  }

  configureWindow(session) {
    const { window } = session;

    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event) => event.preventDefault());
    window.webContents.on('did-finish-load', () => window.show());

    window.on('close', (event) => {
      this.captureBounds(session);
      if (session.forceClosing || this.isQuitting) {
        return;
      }

      event.preventDefault();
      window.webContents.send('video-player:prepare-close');
    });

    window.on('closed', () => {
      this.sessions.delete(session.sessionId);
      this.videoSessions.delete(session.request.videoKey);
      this.playerSessions.delete(session.playerWebContentsId);
      this.emitPlaybackEvent({
        type: 'closed',
        sessionId: session.sessionId,
        currentTime: session.lastPlayback.currentTime,
        duration: session.lastPlayback.duration,
      });
    });
  }

  captureBounds(session) {
    if (session.boundsSaved || session.window.isDestroyed()) {
      return;
    }

    session.boundsSaved = true;
    this.saveBounds(session.window.getBounds());
  }
}

function isTrustedMainSender(event, mainWindow) {
  return Boolean(
    event?.sender &&
      mainWindow &&
      !mainWindow.isDestroyed?.() &&
      event.sender === mainWindow.webContents
  );
}

function isTrustedPlayerSender(event, manager) {
  return Boolean(event?.sender && manager.hasPlayerWebContents(event.sender));
}

module.exports = {
  VideoWindowManager,
  isBoundsInsideDisplay,
  isTrustedMainSender,
  isTrustedPlayerSender,
  validateVideoRequest,
};
