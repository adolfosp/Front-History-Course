import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CardCourse } from './card-course';

describe('CardCourse', () => {
  let component: CardCourse;
  let fixture: ComponentFixture<CardCourse>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardCourse]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CardCourse);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
