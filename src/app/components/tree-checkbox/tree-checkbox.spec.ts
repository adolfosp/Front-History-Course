import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TreeCheckbox } from './tree-checkbox';

describe('TreeCheckbox', () => {
  let component: TreeCheckbox;
  let fixture: ComponentFixture<TreeCheckbox>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreeCheckbox]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TreeCheckbox);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
