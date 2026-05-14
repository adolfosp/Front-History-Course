export type CardCourseType = {
  path: string;
  name: string;
  isCompleted: boolean;
  progress: {
    watchedVideos: number;
    knownVideos: number;
    percentage: number;
  };
  bannerImage?: string | null;
  bannerUrl?: string | null;
};

export type QueuedCourseType = {
  id: string;
  name: string;
  path: string;
};
