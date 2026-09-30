import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TreeCheckbox } from './tree-checkbox';
import { FlatTreeControl } from '@angular/cdk/tree';
import { SelectionModel } from '@angular/cdk/collections';
import { TodoItemFlatNode } from '../../domain/TodoItemFlatNode';

describe('TreeCheckbox', () => {
  let component: TreeCheckbox;
  let fixture: ComponentFixture<TreeCheckbox>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreeCheckbox],
      providers: [provideZonelessChangeDetection()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(TreeCheckbox);
    component = fixture.componentInstance;
    const node = new TodoItemFlatNode();
    node.item = 'Lesson';
    node.level = 0;
    node.expandable = false;
    node.path = 'C:/Course/Lesson.mp4';
    const treeControl = new FlatTreeControl<TodoItemFlatNode>(
      (item) => item.level,
      (item) => item.expandable
    );
    treeControl.dataNodes = [node];
    fixture.componentRef.setInput('node', node);
    fixture.componentRef.setInput('treeControl', treeControl);
    fixture.componentRef.setInput(
      'checklistSelection',
      new SelectionModel<TodoItemFlatNode>(true)
    );
    fixture.componentRef.setInput('isNecessaryShowName', true);
    fixture.componentRef.setInput('isLeaf', true);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
