export interface IVideoProgress {
  watched: boolean;
  lastWatched?: boolean;
  currentTime?: number;
  completedAt?: string | null;
  watchCount?: number;
}
