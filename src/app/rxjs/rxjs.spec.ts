import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RxjsExample } from './rxjs';

describe('Rxjs', () => {
  let component: RxjsExample;
  let fixture: ComponentFixture<RxjsExample>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RxjsExample]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RxjsExample);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
