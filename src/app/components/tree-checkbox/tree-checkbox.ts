import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { TodoItemFlatNode } from '../../domain/TodoItemFlatNode';
import { SelectionModel } from '@angular/cdk/collections';
import { FlatTreeControl } from '@angular/cdk/tree';

@Component({
  selector: 'app-tree-checkbox',
  imports: [CommonModule, MatCheckboxModule],
  templateUrl: './tree-checkbox.html',
  styleUrl: './tree-checkbox.css',
  standalone: true,
})
export class TreeCheckbox {
  @Input() node!: TodoItemFlatNode;
  @Input() treeControl!: FlatTreeControl<TodoItemFlatNode>;
  @Input() checklistSelection!: SelectionModel<TodoItemFlatNode>;

  @Output() toggleSelection = new EventEmitter<TodoItemFlatNode>();

  descendantsAllSelected(): boolean {
    const descendants = this.treeControl.getDescendants(this.node);
    return descendants.length > 0 && descendants.every(child => this.checklistSelection.isSelected(child));
  }

  descendantsPartiallySelected(): boolean {
    const descendants = this.treeControl.getDescendants(this.node);
    const someSelected = descendants.some(child => this.checklistSelection.isSelected(child));
    return someSelected && !this.descendantsAllSelected();
  }

  onToggle(): void {
    this.toggleSelection.emit(this.node);
  }
}
