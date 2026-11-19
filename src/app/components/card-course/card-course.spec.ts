import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CardCourse } from './card-course';
import { ApiService } from '../../services/api.service';
import { ApiStatusService } from '../../services/api-status.service';
import { NEVER } from 'rxjs';

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
        { provide: ApiStatusService, useValue: { whenReady$: NEVER } },
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
