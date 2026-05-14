export type CardCourseType = {
  path: string;
  name: string;
  isCompleted: boolean;
  bannerImage?: string | null;
  bannerUrl?: string | null;
};

export type QueuedCourseType = {
  id: string;
  name: string;
  path: string;
};
