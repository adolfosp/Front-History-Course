import { Component, effect, output, signal } from '@angular/core';
import { CardCourseType } from '../../domain/types/CardHouse';

@Component({
  selector: 'app-card-course',
  imports: [],
  templateUrl: './card-course.html',
  styleUrl: './card-course.css',
})
export class CardCourse {
  clickOnCourse = output<any>();

  items = signal<CardCourseType[]>([]);
  constructor() {
    effect(() => {
      console.log('Items changed:', this.items());
    } );
  }
  ngOnInit(): void {
    const localStorageItems = getAllLocalStorage();
    this.items.set(localStorageItems);
  }

  emitClick(event: CardCourseType): void {
    this.clickOnCourse.emit(event);
  }

  deleteCourse(event: CardCourseType): void {
    localStorage.removeItem(event.path);
    this.items.set(getAllLocalStorage());
  }
}

function getAllLocalStorage(): CardCourseType[] {
  const result: CardCourseType[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== null) {
      try {
        const cardCourse = {
          path: key,
          name: key.split('\\')[2],
        } as CardCourseType;
        result.push(cardCourse);
      } catch {
        console.error(`Error accessing localStorage key: ${key}`);
        continue;
      }
    }
  }

  return result;
}
