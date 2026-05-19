import { CourseStatus } from '../interfaces/ICourseProgress';

export type CardCourseType = {
  path: string;
  name: string;
  status: CourseStatus;
  isCompleted: boolean;
  isAbandoned: boolean;
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
