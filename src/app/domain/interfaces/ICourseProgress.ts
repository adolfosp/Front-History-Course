import { IVideoProgress } from './IVideoProgress';

export type CourseHistory = Record<string, IVideoProgress>;
export type CourseStatus = 'in-progress' | 'completed' | 'abandoned';

export interface ICourseProgress {
  bannerImage: string | null;
  totalVideos: number;
  courseStatus: CourseStatus;
  history: CourseHistory;
}
