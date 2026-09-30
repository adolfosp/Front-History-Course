import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CardCourse } from './card-course';
import { ApiService } from '../../services/api.service';

describe('CardCourse', () => {
  let component: CardCourse;
  let fixture: ComponentFixture<CardCourse>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [CardCourse],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ApiService, useValue: {} },
      ],
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
