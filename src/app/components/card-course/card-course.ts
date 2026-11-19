import { Component, OnDestroy, OnInit, output, signal } from '@angular/core';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import {
  EMPTY,
  Subscription,
  catchError,
  finalize,
  from,
  map,
  mergeMap,
  switchMap,
  tap,
} from 'rxjs';
import { CardCourseType, QueuedCourseType } from '../../domain/types/CardHouse';
import { CourseStorageService } from '../../services/course-storage.service';
import { ApiService } from '../../services/api.service';
import { ApiStatusService } from '../../services/api-status.service';

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
  syncingPaths = signal<ReadonlySet<string>>(new Set());
  syncTotal = signal(0);
  syncDone = signal(0);
  private readonly maxConcurrentSyncs = 2;
  private readonly subscriptions = new Subscription();

  constructor(
    private readonly courseStorageService: CourseStorageService,
    private readonly apiService: ApiService,
    private readonly apiStatus: ApiStatusService
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

  isSyncing(path: string): boolean {
    return this.syncingPaths().has(path);
  }

  private syncCoursesFromFolderState(): void {
    const courses = this.courseStorageService.getCoursesSnapshot();

    if (!courses.length) {
      return;
    }

    this.syncTotal.set(courses.length);
    this.syncDone.set(0);
    this.syncingPaths.set(new Set(courses.map((course) => course.path)));

    // Espera a API subir e varre poucos cursos por vez: cada varredura percorre
    // a pasta inteira e disparar todas juntas sobrecarrega o disco.
    this.subscriptions.add(
      this.apiStatus.whenReady$
        .pipe(
          switchMap(() =>
            from(courses).pipe(
              mergeMap(
                (course) => this.syncCourse(course.path),
                this.maxConcurrentSyncs
              )
            )
          )
        )
        .subscribe()
    );
  }

  private syncCourse(coursePath: string) {
    return this.apiService.getCourseProgress(coursePath).pipe(
      tap((progress) => {
        const currentProgress =
          this.courseStorageService.getCourseProgress(coursePath);
        // totalVideos vem da varredura recem-feita no servidor.
        const totalVideos =
          (progress.totalVideos ?? 0) > 0
            ? progress.totalVideos
            : currentProgress.totalVideos ?? 0;
        const mergedProgress = {
          ...progress,
          courseStatus:
            currentProgress.courseStatus !== 'in-progress'
              ? currentProgress.courseStatus
              : progress.courseStatus,
          totalVideos,
        };

        this.courseStorageService.saveCourseProgress(coursePath, mergedProgress);

        if (totalVideos > 0 && totalVideos !== currentProgress.totalVideos) {
          this.apiService
            .updateCourseProgressOnFolder(coursePath, mergedProgress)
            .subscribe({
              error: (error) => {
                console.error('Erro ao salvar total de vídeos do curso:', error);
              },
            });
        }
      }),
      map(() => undefined),
      catchError((error) => {
        console.error('Erro ao sincronizar dados do curso salvo:', error);
        return EMPTY;
      }),
      finalize(() => {
        this.syncingPaths.update((paths) => {
          const next = new Set(paths);
          next.delete(coursePath);
          return next;
        });
        this.syncDone.update((done) => done + 1);
      })
    );
  }
}
