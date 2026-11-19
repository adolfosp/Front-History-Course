import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, catchError, map, tap, throwError } from 'rxjs';
import { TodoItemNode } from '../domain/TodoItemNode';
import { transformTree } from '../utils/transformer';
import { environment } from '../../environments/environment';
import { ICourseProgress } from '../domain/interfaces/ICourseProgress';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private _dataSubject = new BehaviorSubject<TodoItemNode[] | null>(null);
  data$ = this._dataSubject.asObservable();

  constructor(private http: HttpClient) {}

  initialize(dirPath: string) {
    const params = new HttpParams().set('dir', dirPath).set('depth', '10');

    return this.http.get<any>(`${environment.apiUrl}/tree`, { params }).pipe(
      map((tree) => transformTree(tree)),
      tap((data) => {
        this._dataSubject.next(data);
      }),
      catchError((err) => {
        console.error('Erro ao buscar diretório:', err);
        this._dataSubject.next([]);
        return throwError(() => err);
      })
    );
  }

  updateDataHistoryOnFolder(history: string, path: string): void {
    this.http
      .post(`${environment.apiUrl}/update-history`, {
        history,
        path,
      })
      .subscribe({
        next: () => {
          console.log('Histórico atualizado com sucesso no servidor.');
        },
        error: (err) => {
          console.error('Erro ao atualizar histórico no servidor:', err);
        },
      });
  }

  getCourseProgress(path: string) {
    const params = new HttpParams().set('path', path);

    return this.http.get<ICourseProgress>(`${environment.apiUrl}/course-progress`, {
      params,
    });
  }

  updateCourseProgressOnFolder(path: string, progress: ICourseProgress) {
    return this.http.post<ICourseProgress>(`${environment.apiUrl}/course-progress`, {
      path,
      progress,
    });
  }

  uploadCourseBanner(path: string, fileName: string, content: string) {
    return this.http.post<ICourseProgress>(`${environment.apiUrl}/course-banner`, {
      path,
      fileName,
      content,
    });
  }

  removeCourseBanner(path: string) {
    return this.http.post<ICourseProgress>(
      `${environment.apiUrl}/course-banner/remove`,
      {
        path,
      }
    );
  }
}
