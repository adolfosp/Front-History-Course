import { IVideoProgress } from './IVideoProgress';

export type CourseHistory = Record<string, IVideoProgress>;

export interface ICourseProgress {
  bannerImage: string | null;
  history: CourseHistory;
}
