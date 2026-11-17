const video = document.getElementById('video');
const title = document.getElementById('video-title');
const bridge = window.videoPlayerBridge;
const completionThreshold = 0.95;
const progressIntervalMs = 60_000;

let sessionId = '';
let completionSent = false;
let lastProgressSentAt = 0;

function playbackPosition() {
  return {
    currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
    duration: Number.isFinite(video.duration) ? video.duration : 0,
  };
}

function send(type) {
  if (!sessionId) {
    return;
  }

  bridge.sendEvent({ type, sessionId, ...playbackPosition() });
}

function loadVideo(state) {
  sessionId = state.sessionId;
  completionSent = false;
  lastProgressSentAt = Date.now();
  title.textContent = state.request.title;
  document.title = state.request.title;
  video.src = state.request.url;

  const seekToInitialTime = () => {
    if (state.request.initialTime > 0) {
      video.currentTime = Math.min(
        state.request.initialTime,
        Number.isFinite(video.duration) ? video.duration : state.request.initialTime
      );
    }
    video.play().catch(() => {});
  };

  video.addEventListener('loadedmetadata', seekToInitialTime, { once: true });
  video.load();
}

video.addEventListener('play', () => send('playing'));
video.addEventListener('pause', () => {
  if (!video.ended) {
    send('paused');
  }
});
video.addEventListener('timeupdate', () => {
  const now = Date.now();
  if (!video.paused && now - lastProgressSentAt >= progressIntervalMs) {
    send('progress');
    lastProgressSentAt = now;
  }

  const { currentTime, duration } = playbackPosition();
  if (
    !completionSent &&
    duration > 0 &&
    currentTime / duration >= completionThreshold
  ) {
    completionSent = true;
    send('completed');
  }
});
video.addEventListener('ended', () => send('ended'));

bridge.onLoad(loadVideo);
bridge.onPause(() => video.pause());
bridge.onPrepareClose(() => {
  send('paused');
  send('close-ready');
});

bridge.getState().then((state) => {
  if (state) {
    loadVideo(state);
  }
});
