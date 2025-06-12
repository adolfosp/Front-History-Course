import {Component} from '@angular/core';
import {SelectionModel} from '@angular/cdk/collections';
import {FlatTreeControl} from '@angular/cdk/tree';
import {MatTreeFlattener, MatTreeFlatDataSource, MatTreeModule} from '@angular/material/tree';
import {of as ofObservable, Observable} from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { TodoItemNode } from '../domain/TodoItemNode';
import { TodoItemFlatNode } from '../domain/TodoItemFlatNode';
import { IVideoProgress } from '../domain/interfaces/IVideoProgress';
import { Database } from '../services/database';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-tree-table',
  templateUrl: 'tree-table.html',
  styleUrls: ['tree-table.css'],
  imports: [
    CommonModule,
    MatTreeModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatCheckboxModule,
    FormsModule
  ],
  providers: [Database]
})
export class TreeTable {
  caminho: string = '';


  flatNodeMap: Map<TodoItemFlatNode, TodoItemNode> = new Map<TodoItemFlatNode, TodoItemNode>();

  nestedNodeMap: Map<TodoItemNode, TodoItemFlatNode> = new Map<TodoItemNode, TodoItemFlatNode>();

  treeControl: FlatTreeControl<TodoItemFlatNode>;

  treeFlattener: MatTreeFlattener<TodoItemNode, TodoItemFlatNode>;

  dataSource: MatTreeFlatDataSource<TodoItemNode, TodoItemFlatNode>;

  checklistSelection = new SelectionModel<TodoItemFlatNode>(true);
  readonly LOCAL_STORAGE_KEY = 'video-history';

  constructor(private database: Database) {
    this.treeFlattener = new MatTreeFlattener(this.transformer, this.getLevel,
      this.isExpandable, this.getChildren);
    this.treeControl = new FlatTreeControl<TodoItemFlatNode>(this.getLevel, this.isExpandable);
    this.dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

    this.dataSource.data = database.data;

  }

  getLevel = (node: TodoItemFlatNode) => { return node.level; };

  isExpandable = (node: TodoItemFlatNode) => { return node.expandable; };

  getChildren = (node: TodoItemNode): Observable<TodoItemNode[]> => {
    return ofObservable(node.children);
  }

  hasChild = (_: number, _nodeData: TodoItemFlatNode) => { return _nodeData.expandable; };

  transformer = (node: TodoItemNode, level: number) => {
    let flatNode = this.nestedNodeMap.has(node) && this.nestedNodeMap.get(node)!.item === node.item
      ? this.nestedNodeMap.get(node)!
      : new TodoItemFlatNode();
    flatNode.item = node.item;
    flatNode.level = level;
    flatNode.expandable = !!node.children;
    this.flatNodeMap.set(flatNode, node);
    this.nestedNodeMap.set(node, flatNode);
    return flatNode;
  }

  /// retorna true se todos os filhos de um nó estão selecionados. Ex: Documentos -> Resume.docx, CoverLetter.docx, Projects
  descendantsAllSelected(node: TodoItemFlatNode): boolean {
    const descendants = this.treeControl.getDescendants(node);
    return descendants.every(child => this.checklistSelection.isSelected(child));
  }

  /// retorna true se algum filho de um nó está selecionado, mas não todos. Ex: Documentos -> Resume.docx, CoverLetter.docx, Projects
  descendantsPartiallySelected(node: TodoItemFlatNode): boolean {
    const descendants = this.treeControl.getDescendants(node);
    const result = descendants.some(child => this.checklistSelection.isSelected(child));
    return result && !this.descendantsAllSelected(node);
  }


  /// Seleciona todos filhos de um nó. Ex: Documentos -> Resume.docx, CoverLetter.docx, Projects
  todoItemSelectionToggleByNodeWithChild(node: TodoItemFlatNode): void {
    this.checklistSelection.toggle(node);
    const descendants = this.treeControl.getDescendants(node);
    const nodeIsSelected = this.checklistSelection.isSelected(node)

    if (nodeIsSelected) {
      this.checklistSelection.select(...descendants)
      this.updateWatchedHistoryFromNode(node, descendants)
    }else{
      this.checklistSelection.deselect(...descendants);
      removeHistoryByPathPrefix(this.getFullPath(node));
    }

  }
  onLeafNodeChange(node: TodoItemFlatNode) {

    if (this.checklistSelection.isSelected(node)) {
      this.checklistSelection.deselect(node);
    }else{
      this.checklistSelection.select(node);
    }

    var teste = this.getFullPath(node);
     const LOCAL_STORAGE_KEY = 'video-history';

    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const existingHistory: { [path: string]: IVideoProgress } = raw ? JSON.parse(raw) : {};

    if(this.checklistSelection.isSelected(node)){
      existingHistory[teste] = {
        watched: true,
      }
    }else{
      if (existingHistory[teste]) {
        delete existingHistory[teste];
      }
    }


    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existingHistory));
  }

  isNodeWithoutChildSelected(node: TodoItemFlatNode): boolean {
   const LOCAL_STORAGE_KEY = 'video-history';

    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const existingHistory: { [path: string]: IVideoProgress } = raw ? JSON.parse(raw) : {};

    const fullPath = this.getFullPath(node);
    const historyEntry = existingHistory[fullPath];
    return historyEntry && historyEntry.watched === true && !node.expandable;
  }

  getFullPath(node: TodoItemFlatNode): string {
  const path = [node.item];
  let level = node.level;
  let index = this.treeControl.dataNodes.indexOf(node) - 1;

  while (index >=  0 && level > 0) {
    const current = this.treeControl.dataNodes[index];
    if (current.level < level) {
      path.unshift(current.item); // adiciona ao início
      level = current.level;
    }
    index--;
  }

  return path.join('/');
}



updateWatchedHistoryFromNode(
  parentNode: TodoItemFlatNode,
  descendants: TodoItemFlatNode[]

): void {
  const LOCAL_STORAGE_KEY = 'video-history';

  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  const existingHistory: { [path: string]: IVideoProgress } = raw ? JSON.parse(raw) : {};

  // Limpa lastWatched
  for (const key in existingHistory) {
    delete existingHistory[key].lastWatched;
  }

  const newHistory: { [path: string]: IVideoProgress } = {};
  let lastWatchedPathKey = '';

  // Inclui o próprio pai
  const parentPath = this.getFullPath(parentNode);
  newHistory[parentPath] = { watched: true };

  for (const node of descendants) {
    const path = this.getFullPath(node);
    newHistory[path] = { watched: true };

    if (!node.expandable) {
      lastWatchedPathKey = path;
    }
  }

  if (lastWatchedPathKey) {
    newHistory[lastWatchedPathKey].lastWatched = true;
  }

  // Mescla
  const merged = {
    ...existingHistory,
    ...newHistory,
  };

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
}


onFolderSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    const files = Array.from(input.files);
    files.forEach(file => {
      console.log('Arquivo:', file.name);
      console.log('Caminho relativo:', file.webkitRelativePath);
    });
  }
}


}


function removeHistoryByPathPrefix(pathPrefix: string): void {
  const LOCAL_STORAGE_KEY = 'video-history';
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return;

  const history: { [path: string]: IVideoProgress } = JSON.parse(raw);

  // Remove todos os registros cujo caminho começa com o prefixo
  for (const key of Object.keys(history)) {
    if (key === pathPrefix || key.startsWith(pathPrefix + '/')) {
      delete history[key];
    }
  }

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(history));
}
