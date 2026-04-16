import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CardCourseType } from '../domain/types/CardHouse';
import { ICourseProgress } from '../domain/interfaces/ICourseProgress';
import {
  buildCourseBannerUrl,
  getCourseNameFromPath,
  normalizeCourseProgress,
  serializeCourseProgress,
} from '../utils/course-progress';

@Injectable({ providedIn: 'root' })
export class CourseStorageService {
  private readonly coursesSubject = new BehaviorSubject<CardCourseType[]>(
    this.readAllCourses()
  );

  readonly courses$ = this.coursesSubject.asObservable();

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

  refreshCourses(): void {
    this.coursesSubject.next(this.readAllCourses());
  }

  private readAllCourses(): CardCourseType[] {
    const result: CardCourseType[] = [];

    for (let index = 0; index < localStorage.length; index++) {
      const path = localStorage.key(index);

      if (!path) {
        continue;
      }

      const progress = normalizeCourseProgress(localStorage.getItem(path));

      result.push({
        path,
        name: getCourseNameFromPath(path),
        bannerImage: progress.bannerImage,
        bannerUrl: buildCourseBannerUrl(path, progress.bannerImage),
      });
    }

    return result.sort((left, right) => left.name.localeCompare(right.name));
  }
}
