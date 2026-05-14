import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CardCourseType, QueuedCourseType } from '../domain/types/CardHouse';
import { ICourseProgress } from '../domain/interfaces/ICourseProgress';
import {
  buildCourseBannerUrl,
  getCourseNameFromPath,
  isStoredCourseProgress,
  normalizeCourseProgress,
  serializeCourseProgress,
} from '../utils/course-progress';

@Injectable({ providedIn: 'root' })
export class CourseStorageService {
  private readonly appPreferenceKeyPrefix = 'history-course:';
  private readonly queuedCoursesKey = 'history-course:course-queue';
  private readonly coursesSubject = new BehaviorSubject<CardCourseType[]>(
    this.readAllCourses()
  );
  private readonly queuedCoursesSubject = new BehaviorSubject<QueuedCourseType[]>(
    this.readQueuedCourses()
  );

  readonly courses$ = this.coursesSubject.asObservable();
  readonly queuedCourses$ = this.queuedCoursesSubject.asObservable();

  getCourseProgress(path: string): ICourseProgress {
    return normalizeCourseProgress(localStorage.getItem(path));
  }

  ensureCourse(path: string): ICourseProgress {
    const progress = this.getCourseProgress(path);
    const currentValue = localStorage.getItem(path);

    if (!currentValue) {
      this.saveCourseProgress(path, progress);
      return progress;
    }

    const normalizedValue = serializeCourseProgress(progress);
    if (normalizedValue !== currentValue) {
      localStorage.setItem(path, normalizedValue);
      this.refreshCourses();
    }

    return progress;
  }

  saveCourseProgress(path: string, progress: ICourseProgress): void {
    localStorage.setItem(path, serializeCourseProgress(progress));
    this.refreshCourses();
  }

  deleteCourse(path: string): void {
    localStorage.removeItem(path);
    this.refreshCourses();
  }

  getCoursesSnapshot(): CardCourseType[] {
    return this.coursesSubject.value;
  }

  getQueuedCoursesSnapshot(): QueuedCourseType[] {
    return this.queuedCoursesSubject.value;
  }

  addQueuedCourse(name: string, path = ''): void {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return;
    }

    const queuedCourses = [
      ...this.queuedCoursesSubject.value,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: trimmedName,
        path: path.trim(),
      },
    ];

    this.saveQueuedCourses(queuedCourses);
  }

  updateQueuedCoursePath(id: string, path: string): void {
    const queuedCourses = this.queuedCoursesSubject.value.map((course) =>
      course.id === id ? { ...course, path: path.trim() } : course
    );

    this.saveQueuedCourses(queuedCourses);
  }

  deleteQueuedCourse(id: string): void {
    this.saveQueuedCourses(
      this.queuedCoursesSubject.value.filter((course) => course.id !== id)
    );
  }

  refreshCourses(): void {
    this.coursesSubject.next(this.readAllCourses());
    this.queuedCoursesSubject.next(this.readQueuedCourses());
  }

  private readAllCourses(): CardCourseType[] {
    const result: CardCourseType[] = [];

    for (let index = 0; index < localStorage.length; index++) {
      const path = localStorage.key(index);

      if (!path) {
        continue;
      }

      if (path.startsWith(this.appPreferenceKeyPrefix)) {
        continue;
      }

      const storedValue = localStorage.getItem(path);

      if (!isStoredCourseProgress(storedValue)) {
        continue;
      }

      const progress = normalizeCourseProgress(storedValue);
      const courseName = getCourseNameFromPath(path);
      const courseProgress = this.getCardProgress(progress);

      result.push({
        path,
        name: courseName,
        isCompleted: this.isCourseCompleted(courseName, progress),
        progress: courseProgress,
        bannerImage: progress.bannerImage,
        bannerUrl: buildCourseBannerUrl(path, progress.bannerImage),
      });
    }

    return result.sort((left, right) => {
      if (left.isCompleted !== right.isCompleted) {
        return Number(left.isCompleted) - Number(right.isCompleted);
      }

      return left.name.localeCompare(right.name);
    });
  }

  private isCourseCompleted(
    courseName: string,
    progress: ICourseProgress
  ): boolean {
    return progress.history[courseName]?.watched === true;
  }

  private getCardProgress(progress: ICourseProgress): CardCourseType['progress'] {
    const videoEntries = Object.entries(progress.history).filter(([path]) =>
      this.isVideoPath(path)
    );
    const watchedVideos = videoEntries.filter(
      ([, videoProgress]) => videoProgress.watched === true
    ).length;
    const knownVideos = Math.max(progress.totalVideos ?? 0, videoEntries.length);

    return {
      watchedVideos,
      knownVideos,
      percentage:
        knownVideos > 0 ? Math.round((watchedVideos / knownVideos) * 100) : 0,
    };
  }

  private isVideoPath(path: string): boolean {
    return /\.(mp4|m4v|mov|webm|mkv|avi)$/i.test(path);
  }

  private readQueuedCourses(): QueuedCourseType[] {
    const rawValue = localStorage.getItem(this.queuedCoursesKey);

    if (!rawValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((course): QueuedCourseType | null => {
          if (!course || typeof course !== 'object') {
            return null;
          }

          const candidate = course as Record<string, unknown>;
          const name =
            typeof candidate['name'] === 'string'
              ? candidate['name'].trim()
              : '';

          if (!name) {
            return null;
          }

          return {
            id:
              typeof candidate['id'] === 'string' && candidate['id'].trim()
                ? candidate['id']
                : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name,
            path:
              typeof candidate['path'] === 'string'
                ? candidate['path'].trim()
                : '',
          };
        })
        .filter((course): course is QueuedCourseType => course !== null);
    } catch {
      return [];
    }
  }

  private saveQueuedCourses(courses: QueuedCourseType[]): void {
    localStorage.setItem(this.queuedCoursesKey, JSON.stringify(courses));
    this.queuedCoursesSubject.next(courses);
  }
}
