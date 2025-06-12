import {Component, Injectable} from '@angular/core';
import {SelectionModel} from '@angular/cdk/collections';
import {FlatTreeControl} from '@angular/cdk/tree';
import {MatTreeFlattener, MatTreeFlatDataSource, MatTreeModule} from '@angular/material/tree';
import {of as ofObservable, Observable} from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';

export class TodoItemNode {
  children!: TodoItemNode[];
  item!: string;
}

export class TodoItemFlatNode {
  item!: string;
  level!: number;
  expandable!: boolean;
}

interface VideoProgress {
  watched: boolean;
  lastWatched?: boolean;
}
type VideoHistory = { [path: string]: VideoProgress };

const TREE_DATA = {
  'Documents': {
    'Resume.docx': null,
    'CoverLetter.docx': null,
    'Projects': {
      'ProjectA': {
        'README.md': null,
        'main.ts': null,
        'utils.ts': null
      },
      'ProjectB': {
        'index.html': null,
        'styles.css': null,
        'app.js': null
      }
    }
  },
  'Pictures': {
    'Vacation': {
      'beach.png': null,
      'mountains.jpg': null
    },
    'Family': {
      'birthday.jpg': null,
      'wedding.png': null
    }
  },
  'Music': {
    'Rock': {
      'song1.mp3': null,
      'song2.mp3': null
    },
    'Jazz': {
      'jazz1.mp3': null
    }
  }
};



@Injectable()
export class ChecklistDatabase {
  _data: TodoItemNode[] = [];

  get data(): TodoItemNode[] { return this._data; }

  constructor() {
    this.initialize();
  }

  initialize() {
    this._data = this.buildFileTree(TREE_DATA, 0);
  }


  buildFileTree(value: any, level: number) {
    let data: any[] = [];
    for (let k in value) {
      let v = value[k];
      let node = new TodoItemNode();
      node.item = `${k}`;
      if (v === null || v === undefined) {
      } else if (typeof v === 'object') {
        node.children = this.buildFileTree(v, level + 1);
      } else {
        node.item = v;
      }
      data.push(node);
    }
    return data;
  }

}


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
    MatCheckboxModule
  ],
  providers: [ChecklistDatabase]
})
export class TreeTable {

  flatNodeMap: Map<TodoItemFlatNode, TodoItemNode> = new Map<TodoItemFlatNode, TodoItemNode>();

  nestedNodeMap: Map<TodoItemNode, TodoItemFlatNode> = new Map<TodoItemNode, TodoItemFlatNode>();

  treeControl: FlatTreeControl<TodoItemFlatNode>;

  treeFlattener: MatTreeFlattener<TodoItemNode, TodoItemFlatNode>;

  dataSource: MatTreeFlatDataSource<TodoItemNode, TodoItemFlatNode>;

  checklistSelection = new SelectionModel<TodoItemFlatNode>(true);
  readonly LOCAL_STORAGE_KEY = 'video-history';

  constructor(private database: ChecklistDatabase) {
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
  // descendantsPartiallySelected(node: TodoItemFlatNode): boolean {
  //   const descendants = this.treeControl.getDescendants(node);
  //   const result = descendants.some(child => this.checklistSelection.isSelected(child));
  //   return result && !this.descendantsAllSelected(node);
  // }


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
      removeHistoryByPathPrefix(node.item);
    }

  }
  onLeafNodeChange(node: TodoItemFlatNode) {
    var teste = this.getFullPath(node);
     const LOCAL_STORAGE_KEY = 'video-history';

    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const existingHistory: { [path: string]: VideoProgress } = raw ? JSON.parse(raw) : {};

    existingHistory[teste] = {
      watched: this.checklistSelection.isSelected(node),
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existingHistory));
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
  const existingHistory: { [path: string]: VideoProgress } = raw ? JSON.parse(raw) : {};

  // Limpa lastWatched
  for (const key in existingHistory) {
    delete existingHistory[key].lastWatched;
  }

  const newHistory: { [path: string]: VideoProgress } = {};
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




}


function removeHistoryByPathPrefix(pathPrefix: string): void {
  const LOCAL_STORAGE_KEY = 'video-history';
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return;

  const history: { [path: string]: VideoProgress } = JSON.parse(raw);

  // Remove todos os registros cujo caminho começa com o prefixo
  for (const key of Object.keys(history)) {
    if (key === pathPrefix || key.startsWith(pathPrefix + '/')) {
      delete history[key];
    }
  }

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(history));
}



// {
//   "Videos/CursoReact/Aula1.mp4": {
//     "watched": true,
//     "completedAt": "2025-06-11T12:45:00Z"
//   },
//   "Videos/CursoReact/Aula2.mp4": {
//     "watched": true
//   },
//   "Videos/CursoReact/Aula3.mp4": {
//     "watched": false,
//     "lastWatched": true,
//     "currentTime": 134
//   }
// }
