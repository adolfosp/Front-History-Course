import { of } from 'rxjs';
import { ApiService } from './api.service';
import { CourseStorageService } from './course-storage.service';
import { HistoryService } from './history.service';
import {
  VideoPlaybackEvent,
  VideoPlaylistItem,
  VideoWindowBridge,
  VideoWindowService,
} from './video-window.service';

class FakeVideoWindowBridge implements VideoWindowBridge {
  isAvailable = true;
  openCalls: unknown[] = [];
  replaceCalls: unknown[] = [];
  closeCalls: string[] = [];
  private listener: ((event: VideoPlaybackEvent) => void) | null = null;
  private nextSession = 1;

  async openVideo(request: unknown) {
    this.openCalls.push(request);
    return { sessionId: `session-${this.nextSession++}`, reused: false };
  }

  async replaceVideo(sessionId: string, request: unknown) {
    this.replaceCalls.push({ sessionId, request });
    return { sessionId, reused: false };
  }

  async closeVideo(sessionId: string) {
    this.closeCalls.push(sessionId);
  }

  onPlaybackEvent(callback: (event: VideoPlaybackEvent) => void) {
    this.listener = callback;
    return () => {
      this.listener = null;
    };
  }

  emit(event: VideoPlaybackEvent) {
    this.listener?.(event);
  }
}

describe('VideoWindowService', () => {
  let bridge: FakeVideoWindowBridge;
  let storage: CourseStorageService;
  let history: HistoryService;
  let api: jasmine.SpyObj<ApiService>;
  let service: VideoWindowService;
  const playlist: VideoPlaylistItem[] = [
    {
      videoKey: 'Module 1/lesson-1.mp4',
      title: 'Lesson 1',
      url: 'http://localhost:4047/video?path=lesson-1',
    },
    {
      videoKey: 'Module 1/lesson-2.mp4',
      title: 'Lesson 2',
      url: 'http://localhost:4047/video?path=lesson-2',
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    bridge = new FakeVideoWindowBridge();
    storage = new CourseStorageService();
    history = new HistoryService(storage);
    api = jasmine.createSpyObj<ApiService>('ApiService', [
      'updateCourseProgressOnFolder',
    ]);
    api.updateCourseProgressOnFolder.and.callFake((_path, progress) =>
      of(progress)
    );
    service = new VideoWindowService(history, storage, api, bridge);
  });

  afterEach(() => service.ngOnDestroy());

  it('opens the selected video with its saved initial time', async () => {
    storage.saveCourseProgress('C:/Course A', {
      bannerImage: null,
      totalVideos: 2,
      courseStatus: 'in-progress',
      history: {
        'Module 1/lesson-1.mp4': { watched: false, currentTime: 42 },
      },
    });

    await service.openPlaylist({
      coursePath: 'C:/Course A',
      playlist,
      startVideoKey: 'Module 1/lesson-1.mp4',
      autoplay: true,
    });

    expect(bridge.openCalls).toEqual([
      {
        ...playlist[0],
        initialTime: 42,
      },
    ]);
  });

  it('persists progress against the session course after another course is opened', async () => {
    await service.openPlaylist({
      coursePath: 'C:/Course A',
      playlist,
      startVideoKey: playlist[0].videoKey,
      autoplay: false,
    });
    await service.openPlaylist({
      coursePath: 'D:/Course B',
      playlist,
      startVideoKey: playlist[1].videoKey,
      autoplay: false,
    });

    bridge.emit({
      type: 'progress',
      sessionId: 'session-1',
      currentTime: 31,
      duration: 100,
    });

    expect(
      storage.getCourseProgress('C:/Course A').history[playlist[0].videoKey]
        .currentTime
    ).toBe(31);
    expect(api.updateCourseProgressOnFolder).toHaveBeenCalledWith(
      'C:/Course A',
      jasmine.any(Object)
    );
  });

  it('records completion and watchCount once for completed followed by ended', async () => {
    await service.openPlaylist({
      coursePath: 'C:/Course A',
      playlist,
      startVideoKey: playlist[0].videoKey,
      autoplay: false,
    });

    bridge.emit({
      type: 'completed',
      sessionId: 'session-1',
      currentTime: 95,
      duration: 100,
    });
    bridge.emit({
      type: 'ended',
      sessionId: 'session-1',
      currentTime: 100,
      duration: 100,
    });
    await Promise.resolve();

    const progress = storage.getCourseProgress('C:/Course A').history[
      playlist[0].videoKey
    ];
    expect(progress.watched).toBeTrue();
    expect(progress.watchCount).toBe(1);
    expect(bridge.closeCalls).toEqual(['session-1']);
  });

  it('loads the next video in the same session when autoplay is enabled', async () => {
    await service.openPlaylist({
      coursePath: 'C:/Course A',
      playlist,
      startVideoKey: playlist[0].videoKey,
      autoplay: true,
    });

    bridge.emit({
      type: 'ended',
      sessionId: 'session-1',
      currentTime: 100,
      duration: 100,
    });
    await Promise.resolve();

    expect(bridge.replaceCalls).toEqual([
      {
        sessionId: 'session-1',
        request: { ...playlist[1], initialTime: 0 },
      },
    ]);
    expect(bridge.closeCalls).toEqual([]);
  });
});
