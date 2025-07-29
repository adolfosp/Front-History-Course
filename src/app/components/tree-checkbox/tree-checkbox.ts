import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
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
  readonly node = input<TodoItemFlatNode>();
  readonly treeControl = input<FlatTreeControl<TodoItemFlatNode>>();
  readonly checklistSelection = input<SelectionModel<TodoItemFlatNode>>();
  readonly isNecessaryShowName = input<boolean>();
  readonly isLeaf = input<boolean>();

  readonly toggleSelection = output<TodoItemFlatNode>();

  descendantsAllSelected(): boolean {
    const descendants = this.treeControl()!.getDescendants(this.node()!);
    return descendants.length > 0 && descendants.every(child => this.checklistSelection()!.isSelected(child));
  }

  nodeIsSelected(): boolean {
    const node = this.node()!;
    const isSelected = this.checklistSelection()?.isSelected(node);
    return isSelected ?? false;
  }

  descendantsPartiallySelected(): boolean {
    const descendants = this.treeControl()!.getDescendants(this.node()!);
    const someSelected = descendants.some(child => this.checklistSelection()!.isSelected(child));
    return someSelected && !this.descendantsAllSelected();
  }

  onToggle(): void {
    this.toggleSelection.emit(this.node()!);
  }
}
