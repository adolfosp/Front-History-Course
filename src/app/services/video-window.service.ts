import { Inject, Injectable, InjectionToken, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { ICourseProgress } from '../domain/interfaces/ICourseProgress';
import { ApiService } from './api.service';
import { CourseStorageService } from './course-storage.service';
import { HistoryService } from './history.service';

export interface VideoWindowRequest {
  videoKey: string;
  title: string;
  url: string;
  initialTime: number;
}

export interface VideoPlaylistItem {
  videoKey: string;
  historyKey?: string;
  title: string;
  url: string;
}

export type VideoPlaybackEventType =
  | 'progress'
  | 'paused'
  | 'completed'
  | 'ended'
  | 'closed';

export interface VideoPlaybackEvent {
  type: VideoPlaybackEventType;
  sessionId: string;
  currentTime: number;
  duration: number;
}

export interface VideoWindowResult {
  sessionId: string;
  reused: boolean;
}

export interface VideoWindowBridge {
  isAvailable: boolean;
  openVideo(request: VideoWindowRequest): Promise<VideoWindowResult>;
  replaceVideo(
    sessionId: string,
    request: VideoWindowRequest
  ): Promise<VideoWindowResult>;
  closeVideo(sessionId: string): Promise<void>;
  onPlaybackEvent(callback: (event: VideoPlaybackEvent) => void): () => void;
}

export interface VideoWindowUpdate {
  coursePath: string;
  videoKey: string;
  completed: boolean;
}

interface SessionContext {
  coursePath: string;
  playlist: VideoPlaylistItem[];
  currentIndex: number;
  autoplay: boolean;
}

const unavailableBridge: VideoWindowBridge = {
  isAvailable: false,
  openVideo: () => Promise.reject(new Error('Video windows unavailable.')),
  replaceVideo: () => Promise.reject(new Error('Video windows unavailable.')),
  closeVideo: () => Promise.resolve(),
  onPlaybackEvent: () => () => {},
};

export const VIDEO_WINDOW_BRIDGE = new InjectionToken<VideoWindowBridge>(
  'VIDEO_WINDOW_BRIDGE',
  {
    providedIn: 'root',
    factory: () => window.videoWindows ?? unavailableBridge,
  }
);

@Injectable({ providedIn: 'root' })
export class VideoWindowService implements OnDestroy {
  private readonly sessions = new Map<string, SessionContext>();
  private readonly completedPlaybacks = new Set<string>();
  private readonly updatesSubject = new Subject<VideoWindowUpdate>();
  private readonly removePlaybackListener: () => void;

  readonly updates$ = this.updatesSubject.asObservable();

  constructor(
    private readonly historyService: HistoryService,
    private readonly courseStorageService: CourseStorageService,
    private readonly apiService: ApiService,
    @Inject(VIDEO_WINDOW_BRIDGE) private readonly bridge: VideoWindowBridge
  ) {
    this.removePlaybackListener = this.bridge.onPlaybackEvent((event) => {
      void this.handlePlaybackEvent(event);
    });
  }

  get isAvailable(): boolean {
    return this.bridge.isAvailable;
  }

  async openPlaylist({
    coursePath,
    playlist,
    startVideoKey,
    autoplay,
  }: {
    coursePath: string;
    playlist: VideoPlaylistItem[];
    startVideoKey: string;
    autoplay: boolean;
  }): Promise<VideoWindowResult | null> {
    if (!this.isAvailable) {
      return null;
    }

    const currentIndex = playlist.findIndex(
      (item) => item.videoKey === startVideoKey
    );
    if (currentIndex < 0) {
      throw new Error(`Video not found in playlist: ${startVideoKey}`);
    }

    const result = await this.bridge.openVideo(
      this.buildRequest(coursePath, playlist[currentIndex])
    );

    if (!this.sessions.has(result.sessionId)) {
      this.sessions.set(result.sessionId, {
        coursePath,
        playlist: [...playlist],
        currentIndex,
        autoplay,
      });
    }

    return result;
  }

  async closeSession(sessionId: string): Promise<void> {
    await this.bridge.closeVideo(sessionId);
  }

  ngOnDestroy(): void {
    this.removePlaybackListener();
    this.updatesSubject.complete();
  }

  private async handlePlaybackEvent(event: VideoPlaybackEvent): Promise<void> {
    const context = this.sessions.get(event.sessionId);
    if (!context) {
      return;
    }

    const item = context.playlist[context.currentIndex];
    const completionKey = `${event.sessionId}:${item.videoKey}`;

    if (event.type === 'progress' || event.type === 'paused') {
      if (!this.completedPlaybacks.has(completionKey)) {
        this.saveProgress(context, item, event.currentTime);
      }
      return;
    }

    if (event.type === 'completed') {
      if (event.duration > 0 && event.currentTime / event.duration >= 0.95) {
        this.completePlayback(event.sessionId, context, item);
      }
      return;
    }

    if (event.type === 'ended') {
      this.completePlayback(event.sessionId, context, item);
      const nextIndex = context.currentIndex + 1;

      if (context.autoplay && nextIndex < context.playlist.length) {
        const nextItem = context.playlist[nextIndex];
        const result = await this.bridge.replaceVideo(
          event.sessionId,
          this.buildRequest(context.coursePath, nextItem)
        );

        if (result.sessionId === event.sessionId) {
          context.currentIndex = nextIndex;
        } else {
          this.sessions.delete(event.sessionId);
          if (!this.sessions.has(result.sessionId)) {
            this.sessions.set(result.sessionId, {
              ...context,
              currentIndex: nextIndex,
            });
          }
        }
      } else {
        await this.bridge.closeVideo(event.sessionId);
      }
      return;
    }

    if (event.type === 'closed') {
      if (!this.completedPlaybacks.has(completionKey)) {
        this.saveProgress(context, item, event.currentTime);
      }
      this.completedPlaybacks.delete(completionKey);
      this.sessions.delete(event.sessionId);
    }
  }

  private saveProgress(
    context: SessionContext,
    item: VideoPlaylistItem,
    currentTime: number
  ): void {
    const progress = this.historyService.updateVideoPlaybackProgress({
      coursePath: context.coursePath,
      videoKey: this.getHistoryKey(item),
      currentTime,
    });
    this.persist(context.coursePath, progress);
    this.emitUpdate(context.coursePath, item, false);
  }

  private completePlayback(
    sessionId: string,
    context: SessionContext,
    item: VideoPlaylistItem
  ): void {
    const completionKey = `${sessionId}:${item.videoKey}`;
    if (this.completedPlaybacks.has(completionKey)) {
      return;
    }

    this.completedPlaybacks.add(completionKey);
    this.historyService.markVideoAsCompletedByKey({
      coursePath: context.coursePath,
      videoKey: this.getHistoryKey(item),
    });
    const progress = this.historyService.syncAncestorStatusesByKeys({
      coursePath: context.coursePath,
      videoKey: this.getHistoryKey(item),
      playlistKeys: context.playlist.map((entry) => this.getHistoryKey(entry)),
    });
    this.persist(context.coursePath, progress);
    this.emitUpdate(context.coursePath, item, true);
  }

  private buildRequest(
    coursePath: string,
    item: VideoPlaylistItem
  ): VideoWindowRequest {
    const initialTime =
      this.courseStorageService.getCourseProgress(coursePath).history[
        this.getHistoryKey(item)
      ]?.currentTime ?? 0;

    return {
      videoKey: item.videoKey,
      title: item.title,
      url: item.url,
      initialTime,
    };
  }

  private getHistoryKey(item: VideoPlaylistItem): string {
    return item.historyKey ?? item.videoKey;
  }

  private persist(coursePath: string, progress: ICourseProgress): void {
    this.courseStorageService.saveCourseProgress(coursePath, progress);
    this.apiService.updateCourseProgressOnFolder(coursePath, progress).subscribe({
      next: (serverProgress) => {
        this.courseStorageService.saveCourseProgress(coursePath, serverProgress);
      },
      error: (error) => {
        console.error('Erro ao salvar progresso do player:', error);
      },
    });
  }

  private emitUpdate(
    coursePath: string,
    item: VideoPlaylistItem,
    completed: boolean
  ): void {
    this.updatesSubject.next({
      coursePath,
      videoKey: this.getHistoryKey(item),
      completed,
    });
  }
}

declare global {
  interface Window {
    videoWindows?: VideoWindowBridge;
  }
}
