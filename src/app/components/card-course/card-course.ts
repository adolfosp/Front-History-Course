import { Component, output } from '@angular/core';
import { CardCourseType } from '../../domain/types/CardHouse';

@Component({
  selector: 'app-card-course',
  imports: [],
  templateUrl: './card-course.html',
  styleUrl: './card-course.css',
})
export class CardCourse {
  clickOnCourse = output<any>();

  items: CardCourseType[] = [];

  ngOnInit(): void {
    this.items = getAllLocalStorage();
  }

  emitClick(event: CardCourseType): void {
    this.clickOnCourse.emit(event);
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
