import { Routes } from '@angular/router';
import { RxjsExample } from './rxjs/rxjs';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'tree-table',
    pathMatch: 'full',
  },
  {
    path: 'tree-table',
    loadComponent: () => import('./tree-table/tree-table').then(m => m.TreeTable),
  },
  {
    path: 'rxjs',
    component: RxjsExample,
    title: 'RxJS Example',
  }
];