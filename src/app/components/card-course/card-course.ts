import { Component, OnDestroy, OnInit, output, signal } from '@angular/core';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { CardCourseType, QueuedCourseType } from '../../domain/types/CardHouse';
import { CourseStorageService } from '../../services/course-storage.service';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-card-course',
  imports: [DragDropModule, MatIconModule],
  templateUrl: './card-course.html',
  styleUrl: './card-course.css',
})
export class CardCourse implements OnInit, OnDestroy {
  clickOnCourse = output<CardCourseType>();

  items = signal<CardCourseType[]>([]);
  queuedCourses = signal<QueuedCourseType[]>([]);
  private readonly subscriptions = new Subscription();

  constructor(
    private readonly courseStorageService: CourseStorageService,
    private readonly apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.courseStorageService.courses$.subscribe((items) => {
        this.items.set(items);
      })
    );

    this.subscriptions.add(
      this.courseStorageService.queuedCourses$.subscribe((items) => {
        this.queuedCourses.set(items);
      })
    );

    this.courseStorageService.refreshCourses();
    this.syncCoursesFromFolderState();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  emitClick(event: CardCourseType): void {
    this.clickOnCourse.emit(event);
  }

  deleteCourse(event: CardCourseType): void {
    this.courseStorageService.deleteCourse(event.path);
  }

  addQueuedCourse(nameInput: HTMLInputElement, pathInput: HTMLInputElement): void {
    this.courseStorageService.addQueuedCourse(nameInput.value, pathInput.value);
    nameInput.value = '';
    pathInput.value = '';
  }

  updateQueuedCoursePath(course: QueuedCourseType, path: string): void {
    this.courseStorageService.updateQueuedCoursePath(course.id, path);
  }

  deleteQueuedCourse(course: QueuedCourseType): void {
    this.courseStorageService.deleteQueuedCourse(course.id);
  }

  dropQueuedCourse(event: CdkDragDrop<QueuedCourseType[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    const queuedCourses = [...this.queuedCourses()];
    moveItemInArray(queuedCourses, event.previousIndex, event.currentIndex);
    this.courseStorageService.reorderQueuedCourses(queuedCourses);
  }

  startQueuedCourse(course: QueuedCourseType): void {
    if (!course.path) {
      return;
    }

    this.clickOnCourse.emit({
      path: course.path,
      name: course.name,
      status: 'in-progress',
      isCompleted: false,
      isAbandoned: false,
      progress: {
        watchedVideos: 0,
        knownVideos: 0,
        percentage: 0,
      },
      bannerImage: null,
      bannerUrl: null,
    });
  }

  uploadBanner(event: Event, course: CardCourseType): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.readFileAsDataUrl(file)
      .then((content) => {
        this.apiService
          .uploadCourseBanner(course.path, file.name, content)
          .subscribe({
            next: (progress) => {
              this.courseStorageService.saveCourseProgress(course.path, progress);
              input.value = '';
            },
            error: (error) => {
              console.error('Erro ao salvar banner do curso:', error);
              input.value = '';
            },
          });
      })
      .catch((error) => {
        console.error('Erro ao ler imagem do banner:', error);
        input.value = '';
      });
  }

  removeBanner(course: CardCourseType): void {
    this.apiService.removeCourseBanner(course.path).subscribe({
      next: (progress) => {
        this.courseStorageService.saveCourseProgress(course.path, progress);
      },
      error: (error) => {
        console.error('Erro ao remover banner do curso:', error);
      },
    });
  }

  moveCourseToProgress(course: CardCourseType): void {
    const progress = this.courseStorageService.getCourseProgress(course.path);
    const updatedProgress = {
      ...progress,
      courseStatus: 'in-progress' as const,
      history: {
        ...progress.history,
        [course.name]: {
          ...progress.history[course.name],
          watched: false,
          currentTime: 0,
        },
      },
    };

    this.courseStorageService.saveCourseProgress(course.path, updatedProgress);
    this.apiService.updateCourseProgressOnFolder(course.path, updatedProgress)
      .subscribe({
        next: (serverProgress) => {
          this.courseStorageService.saveCourseProgress(course.path, serverProgress);
        },
        error: (error) => {
          console.error('Erro ao mover curso para andamento:', error);
        },
      });
  }

  getCardBackground(course: CardCourseType): string {
    if (!course.bannerUrl) {
      return 'linear-gradient(135deg, #f8fafc 0%, #dbeafe 100%)';
    }

    return `linear-gradient(180deg, rgba(15, 23, 42, 0.12) 0%, rgba(15, 23, 42, 0.86) 100%), url("${course.bannerUrl}")`;
  }

  trackByPath(_: number, item: CardCourseType): string {
    return item.path;
  }

  trackByQueuedCourse(_: number, item: QueuedCourseType): string {
    return item.id;
  }

  get inProgressCourses(): CardCourseType[] {
    return this.items().filter((item) => item.status === 'in-progress');
  }

  get completedCourses(): CardCourseType[] {
    return this.items().filter((item) => item.status === 'completed');
  }

  get abandonedCourses(): CardCourseType[] {
    return this.items().filter((item) => item.status === 'abandoned');
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }

        reject(new Error('Não foi possível converter a imagem do banner.'));
      };

      reader.onerror = () => {
        reject(reader.error ?? new Error('Falha ao ler a imagem do banner.'));
      };

      reader.readAsDataURL(file);
    });
  }

  private syncCoursesFromFolderState(): void {
    for (const course of this.courseStorageService.getCoursesSnapshot()) {
      this.apiService.getCourseProgress(course.path).subscribe({
        next: (progress) => {
          const currentProgress = this.courseStorageService.getCourseProgress(
            course.path
          );
          const mergedProgress = {
            ...progress,
            courseStatus:
              currentProgress.courseStatus !== 'in-progress'
                ? currentProgress.courseStatus
                : progress.courseStatus,
            totalVideos: Math.max(
              progress.totalVideos ?? 0,
              currentProgress.totalVideos ?? 0
            ),
          };

          this.courseStorageService.saveCourseProgress(
            course.path,
            mergedProgress
          );
          this.syncCourseVideoCount(course.path, mergedProgress);
        },
        error: (error) => {
          console.error('Erro ao sincronizar dados do curso salvo:', error);
          this.syncCourseVideoCount(
            course.path,
            this.courseStorageService.getCourseProgress(course.path)
          );
        },
      });
    }
  }

  private syncCourseVideoCount(
    coursePath: string,
    progress: ReturnType<CourseStorageService['getCourseProgress']>
  ): void {
    this.apiService.getCourseVideoCount(coursePath).subscribe({
      next: (totalVideos) => {
        if (totalVideos <= 0 || progress.totalVideos === totalVideos) {
          return;
        }

        const updatedProgress = {
          ...progress,
          totalVideos,
        };

        this.courseStorageService.saveCourseProgress(coursePath, updatedProgress);
        this.apiService.updateCourseProgressOnFolder(coursePath, updatedProgress)
          .subscribe({
            error: (error) => {
              console.error('Erro ao salvar total de videos do curso:', error);
            },
          });
      },
      error: (error) => {
        console.error('Erro ao contar videos do curso salvo:', error);
      },
    });
  }
}
