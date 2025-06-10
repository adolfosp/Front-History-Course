import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TreeTable } from './tree-table';

describe('TreeTable', () => {
  let component: TreeTable;
  let fixture: ComponentFixture<TreeTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreeTable]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TreeTable);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
