import { Injectable, OnDestroy, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  Subscription,
  catchError,
  exhaustMap,
  filter,
  first,
  map,
  of,
  take,
  timeout,
  timer,
} from 'rxjs';
import { environment } from '../../environments/environment';

export type ApiStatus = 'starting' | 'ready' | 'error';

/**
 * Acompanha se a API local ja esta respondendo. No app instalado ela sobe em
 * um processo separado e pode demorar alguns segundos depois da janela abrir.
 */
@Injectable({ providedIn: 'root' })
export class ApiStatusService implements OnDestroy {
  private readonly pollIntervalMs = 500;
  private readonly requestTimeoutMs = 2_000;
  private readonly giveUpAfterMs = 30_000;
  private readonly slowAfterMs = 6_000;

  private readonly statusSubject = new BehaviorSubject<ApiStatus>('starting');
  private pollSubscription?: Subscription;
  private slowTimer?: ReturnType<typeof setTimeout>;

  readonly status = signal<ApiStatus>('starting');
  readonly slow = signal(false);

  /** Emite uma vez, assim que a API estiver pronta (imediatamente se ja estiver). */
  readonly whenReady$ = this.statusSubject.pipe(
    filter((status) => status === 'ready'),
    take(1),
    map(() => undefined)
  );

  constructor(private readonly http: HttpClient) {
    this.check();
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
    clearTimeout(this.slowTimer);
  }

  retry(): void {
    this.check();
  }

  private check(): void {
    this.pollSubscription?.unsubscribe();
    clearTimeout(this.slowTimer);
    this.setStatus('starting');
    this.slow.set(false);

    this.slowTimer = setTimeout(() => this.slow.set(true), this.slowAfterMs);

    this.pollSubscription = timer(0, this.pollIntervalMs)
      .pipe(
        exhaustMap(() =>
          this.http.get(`${environment.apiUrl}/health`).pipe(
            timeout(this.requestTimeoutMs),
            map(() => true),
            catchError(() => of(false))
          )
        ),
        first((isUp) => isUp),
        timeout({ first: this.giveUpAfterMs })
      )
      .subscribe({
        next: () => {
          clearTimeout(this.slowTimer);
          this.slow.set(false);
          this.setStatus('ready');
        },
        error: () => {
          clearTimeout(this.slowTimer);
          this.setStatus('error');
        },
      });
  }

  private setStatus(status: ApiStatus): void {
    this.status.set(status);
    this.statusSubject.next(status);
  }
}
