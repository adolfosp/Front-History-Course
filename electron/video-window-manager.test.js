const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');

const {
  VideoWindowManager,
  isBoundsInsideDisplay,
  isTrustedMainSender,
  isTrustedPlayerSender,
} = require('./video-window-manager');

class FakeWebContents extends EventEmitter {
  static nextId = 1;

  constructor() {
    super();
    this.id = FakeWebContents.nextId++;
    this.messages = [];
  }

  send(channel, payload) {
    this.messages.push({ channel, payload });
  }

  setWindowOpenHandler(handler) {
    this.windowOpenHandler = handler;
  }
}

class FakeWindow extends EventEmitter {
  static instances = [];

  constructor(options) {
    super();
    this.options = options;
    this.webContents = new FakeWebContents();
    this.bounds = {
      x: options.x ?? 0,
      y: options.y ?? 0,
      width: options.width,
      height: options.height,
    };
    this.focusCount = 0;
    this.destroyed = false;
    FakeWindow.instances.push(this);
  }

  loadFile(file) {
    this.loadedFile = file;
    return Promise.resolve();
  }

  focus() {
    this.focusCount += 1;
  }

  show() {}

  getBounds() {
    return this.bounds;
  }

  isDestroyed() {
    return this.destroyed;
  }

  destroy() {
    this.destroyed = true;
    this.emit('closed');
  }
}

function createManager(overrides = {}) {
  FakeWindow.instances = [];
  FakeWebContents.nextId = 1;
  let nextSession = 1;
  const playbackEvents = [];
  const savedBounds = [];
  const manager = new VideoWindowManager({
    BrowserWindow: FakeWindow,
    playerHtmlPath: 'player.html',
    playerPreloadPath: 'player-preload.js',
    createSessionId: () => `session-${nextSession++}`,
    getSavedBounds: () => null,
    saveBounds: (bounds) => savedBounds.push(bounds),
    getDisplays: () => [
      { workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
    ],
    emitPlaybackEvent: (event) => playbackEvents.push(event),
    ...overrides,
  });

  return { manager, playbackEvents, savedBounds };
}

function request(videoKey) {
  return {
    videoKey,
    title: videoKey,
    url: `http://localhost:4047/video?path=${videoKey}`,
    initialTime: 12,
  };
}

test('opening the same video focuses and reuses its existing window', async () => {
  const { manager } = createManager();

  const first = await manager.openVideo(request('lesson-1.mp4'));
  const second = await manager.openVideo(request('lesson-1.mp4'));

  assert.deepEqual(first, { sessionId: 'session-1', reused: false });
  assert.deepEqual(second, { sessionId: 'session-1', reused: true });
  assert.equal(FakeWindow.instances.length, 1);
  assert.equal(FakeWindow.instances[0].focusCount, 1);
});

test('replacing a video keeps the same window and session', async () => {
  const { manager } = createManager();
  const opened = await manager.openVideo(request('lesson-1.mp4'));
  const originalWindow = FakeWindow.instances[0];

  const replaced = await manager.replaceVideo(
    opened.sessionId,
    request('lesson-2.mp4')
  );

  assert.deepEqual(replaced, { sessionId: opened.sessionId, reused: false });
  assert.equal(FakeWindow.instances.length, 1);
  assert.equal(FakeWindow.instances[0], originalWindow);
  assert.deepEqual(originalWindow.webContents.messages.at(-1), {
    channel: 'video-player:load',
    payload: {
      sessionId: opened.sessionId,
      request: request('lesson-2.mp4'),
    },
  });
});

test('replacing with an already open video closes the old session and focuses the existing one', async () => {
  const { manager } = createManager();
  const first = await manager.openVideo(request('lesson-1.mp4'));
  const second = await manager.openVideo(request('lesson-2.mp4'));

  const result = await manager.replaceVideo(
    first.sessionId,
    request('lesson-2.mp4')
  );

  assert.deepEqual(result, { sessionId: second.sessionId, reused: true });
  assert.equal(FakeWindow.instances[0].destroyed, true);
  assert.equal(FakeWindow.instances[1].focusCount, 1);
});

test('a playing session pauses every other registered player', async () => {
  const { manager } = createManager();
  const first = await manager.openVideo(request('lesson-1.mp4'));
  await manager.openVideo(request('lesson-2.mp4'));

  manager.handlePlayerEvent(FakeWindow.instances[0].webContents, {
    type: 'playing',
    sessionId: first.sessionId,
    currentTime: 2,
    duration: 100,
  });

  assert.deepEqual(FakeWindow.instances[1].webContents.messages.at(-1), {
    channel: 'video-player:pause',
    payload: undefined,
  });
  assert.equal(FakeWindow.instances[0].webContents.messages.length, 0);
});

test('restores saved bounds only when the whole window fits on a display', () => {
  const displays = [
    { workArea: { x: -1920, y: 0, width: 1920, height: 1080 } },
    { workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
  ];

  assert.equal(
    isBoundsInsideDisplay(
      { x: -1800, y: 20, width: 1280, height: 720 },
      displays
    ),
    true
  );
  assert.equal(
    isBoundsInsideDisplay(
      { x: 1800, y: 20, width: 1280, height: 720 },
      displays
    ),
    false
  );
});

test('ignores saved bounds that no longer fit any connected display', async () => {
  const { manager } = createManager({
    getSavedBounds: () => ({ x: 2500, y: 0, width: 1200, height: 700 }),
  });
  await manager.openVideo(request('lesson-1.mp4'));

  assert.equal(FakeWindow.instances[0].options.x, undefined);
  assert.equal(FakeWindow.instances[0].options.y, undefined);
  assert.equal(FakeWindow.instances[0].options.width, 960);
  assert.equal(FakeWindow.instances[0].options.height, 540);
});

test('persists the last bounds when a player window closes', async () => {
  const { manager, savedBounds } = createManager();
  const opened = await manager.openVideo(request('lesson-1.mp4'));
  FakeWindow.instances[0].bounds = { x: 20, y: 30, width: 900, height: 600 };

  manager.forceClose(opened.sessionId);

  assert.deepEqual(savedBounds, [
    { x: 20, y: 30, width: 900, height: 600 },
  ]);
});

test('closing cleans up a player without reading the destroyed window', async () => {
  const { manager, playbackEvents } = createManager();
  const opened = await manager.openVideo(request('lesson-1.mp4'));
  const window = FakeWindow.instances[0];
  const playerWebContents = window.webContents;
  window.destroy = function destroy() {
    this.destroyed = true;
    Object.defineProperty(this, 'webContents', {
      get() {
        throw new TypeError('Object has been destroyed');
      },
    });
    this.emit('closed');
  };

  assert.doesNotThrow(() => manager.forceClose(opened.sessionId));
  assert.equal(manager.hasPlayerWebContents(playerWebContents), false);
  assert.deepEqual(playbackEvents.at(-1), {
    type: 'closed',
    sessionId: opened.sessionId,
    currentTime: 12,
    duration: 0,
  });
});

test('IPC sender validation accepts only the main window and registered players', async () => {
  const { manager } = createManager();
  const mainWindow = { webContents: new FakeWebContents() };
  await manager.openVideo(request('lesson-1.mp4'));

  assert.equal(
    isTrustedMainSender({ sender: mainWindow.webContents }, mainWindow),
    true
  );
  assert.equal(
    isTrustedMainSender({ sender: new FakeWebContents() }, mainWindow),
    false
  );
  assert.equal(
    isTrustedPlayerSender(
      { sender: FakeWindow.instances[0].webContents },
      manager
    ),
    true
  );
  assert.equal(
    isTrustedPlayerSender({ sender: new FakeWebContents() }, manager),
    false
  );
});

test('graceful shutdown asks every player to flush before destroying windows', async () => {
  const { manager } = createManager();
  const first = await manager.openVideo(request('lesson-1.mp4'));
  const second = await manager.openVideo(request('lesson-2.mp4'));

  const closing = manager.closeAllGracefully(1_000);

  assert.equal(
    FakeWindow.instances[0].webContents.messages.at(-1).channel,
    'video-player:prepare-close'
  );
  assert.equal(
    FakeWindow.instances[1].webContents.messages.at(-1).channel,
    'video-player:prepare-close'
  );

  manager.handlePlayerEvent(FakeWindow.instances[0].webContents, {
    type: 'close-ready',
    sessionId: first.sessionId,
    currentTime: 20,
    duration: 100,
  });
  manager.handlePlayerEvent(FakeWindow.instances[1].webContents, {
    type: 'close-ready',
    sessionId: second.sessionId,
    currentTime: 30,
    duration: 100,
  });
  await closing;

  assert.equal(FakeWindow.instances.every((window) => window.destroyed), true);
});
