import { Component, OnDestroy, OnInit, output, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { CardCourseType } from '../../domain/types/CardHouse';
import { CourseStorageService } from '../../services/course-storage.service';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-card-course',
  imports: [],
  templateUrl: './card-course.html',
  styleUrl: './card-course.css',
})
export class CardCourse implements OnInit, OnDestroy {
  clickOnCourse = output<CardCourseType>();

  items = signal<CardCourseType[]>([]);
  private subscription?: Subscription;

  constructor(
    private readonly courseStorageService: CourseStorageService,
    private readonly apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.subscription = this.courseStorageService.courses$.subscribe((items) => {
      this.items.set(items);
    });

    this.courseStorageService.refreshCourses();
    this.syncCoursesFromFolderState();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  emitClick(event: CardCourseType): void {
    this.clickOnCourse.emit(event);
  }

  deleteCourse(event: CardCourseType): void {
    this.courseStorageService.deleteCourse(event.path);
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

  getCardBackground(course: CardCourseType): string {
    if (!course.bannerUrl) {
      return 'linear-gradient(135deg, #f8fafc 0%, #dbeafe 100%)';
    }

    return `linear-gradient(180deg, rgba(15, 23, 42, 0.12) 0%, rgba(15, 23, 42, 0.86) 100%), url("${course.bannerUrl}")`;
  }

  trackByPath(_: number, item: CardCourseType): string {
    return item.path;
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
          this.courseStorageService.saveCourseProgress(course.path, progress);
        },
        error: (error) => {
          console.error('Erro ao sincronizar dados do curso salvo:', error);
        },
      });
    }
  }
}
