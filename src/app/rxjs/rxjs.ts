import { Component, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { of, from, take, map } from 'rxjs';


@Component({
  selector: 'app-rxjs',
  imports: [RouterModule],
  templateUrl: './rxjs.html',
  styleUrl: './rxjs.css'
})
export class RxjsExample implements OnDestroy {

  constructor() {
    console.log('RxJS Example Component Loaded');
  }

  ngOnDestroy(): void {
  }

  ngOnInit() {
    of(2,4,6,8).pipe(
      map(value => value * 2), // Multiplica cada valor por 2
      take(3) // Limita a 3 valores
    ).subscribe({
      next: (value) => {
        console.log(`Valor do of: ${value}`);
      }
    });

      of([1, 2, 3, 4, 5]).subscribe({
      next: (value) => {
        console.log(`Valor do of array: ${value}`);
      }
    });

    from([1, 2, 3, 4, 5]).subscribe({
      next: (value) => {
        console.log(`Valor do from: ${value}`);
      },
      complete: () => {
        console.log('Observable from completed');
      }
    });
  }

}
