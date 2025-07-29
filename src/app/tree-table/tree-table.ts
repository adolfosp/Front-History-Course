import { Component, inject } from '@angular/core';
import { SelectionModel } from '@angular/cdk/collections';
import { FlatTreeControl } from '@angular/cdk/tree';
import {
  MatTreeFlattener,
  MatTreeFlatDataSource,
  MatTreeModule,
} from '@angular/material/tree';
import { of as ofObservable, Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { TodoItemNode } from '../domain/TodoItemNode';
import { TodoItemFlatNode } from '../domain/TodoItemFlatNode';
import { IVideoProgress } from '../domain/interfaces/IVideoProgress';
import { ApiService } from '../services/api.service';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { TreeCheckbox } from '../components/tree-checkbox/tree-checkbox';
import { PathService } from '../services/path.service';
import { createTransformer } from '../utils/transformer';
import { HistoryService } from '../services/history.service';

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
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    TreeCheckbox,
  ],
  providers: [ApiService],
})
export class TreeTable {
  videoUrl = '';
  videoFileName = '';

  flatNodeMap: Map<TodoItemFlatNode, TodoItemNode> = new Map<
    TodoItemFlatNode,
    TodoItemNode
  >();

  nestedNodeMap: Map<TodoItemNode, TodoItemFlatNode> = new Map<
    TodoItemNode,
    TodoItemFlatNode
  >();

  treeControl: FlatTreeControl<TodoItemFlatNode>;

  treeFlattener: MatTreeFlattener<TodoItemNode, TodoItemFlatNode>;

  dataSource: MatTreeFlatDataSource<TodoItemNode, TodoItemFlatNode>;

  checklistSelection = new SelectionModel<TodoItemFlatNode>(true);
  private fb = inject(FormBuilder);

  constructor(private database: ApiService) {
    this.treeFlattener = new MatTreeFlattener(
      createTransformer(this.flatNodeMap, this.nestedNodeMap),
      this.getLevel,
      this.isExpandable,
      this.getChildren
    );
    this.treeControl = new FlatTreeControl<TodoItemFlatNode>(
      this.getLevel,
      this.isExpandable
    );
    this.dataSource = new MatTreeFlatDataSource(
      this.treeControl,
      this.treeFlattener
    );
  }

  ngOnInit(): void {
    this.database.data$.subscribe((data) => {
      this.dataSource.data = data;
      this.applyWatchedHistory();
    });
  }

  onSubmit() {
    const caminho = this.form.value.caminho;
    this.database.initialize(caminho);
  }

  form: FormGroup = this.fb.group({
    caminho: ['', [Validators.required]],
  });

  private applyWatchedHistory(): void {
    const raw = localStorage.getItem(this.form.value.caminho);
    if (!raw) return;

    const history: { [path: string]: IVideoProgress } = JSON.parse(raw);

    this.treeControl.dataNodes.forEach((node) => {
      const path = PathService.getFullPath({node: node, treeControl: this.treeControl});
      if (history[path]?.watched) {
        this.checklistSelection.select(node);
      }
    });
  }

  getLevel = (node: TodoItemFlatNode) => {
    return node.level;
  };

  isExpandable = (node: TodoItemFlatNode) => {
    return node.expandable;
  };

  getChildren = (node: TodoItemNode): Observable<TodoItemNode[]> => {
    return ofObservable(node.children);
  };

  hasChild = (_: number, _nodeData: TodoItemFlatNode) => {
    return _nodeData.expandable;
  };

  /// Seleciona todos filhos de um nó. Ex: Documentos -> Resume.docx, CoverLetter.docx, Projects
  todoItemSelectionToggleByNodeWithChild(node: TodoItemFlatNode): void {
    this.checklistSelection.toggle(node);
    const descendants = this.treeControl.getDescendants(node);
    const nodeIsSelected = this.checklistSelection.isSelected(node);

    if (nodeIsSelected) {
      this.checklistSelection.select(...descendants);
      HistoryService.updateWatchedHistoryFromNode({parentNode: node, descendants: descendants, path: this.form.value.caminho, treeControl: this.treeControl});
    } else {
      this.checklistSelection.deselect(...descendants);
      HistoryService.removeHistoryByPathPrefix(
        PathService.getFullPath({node: node, treeControl: this.treeControl}),
        this.form.value.caminho
      );
    }
  }

  onLeafNodeChange(node: TodoItemFlatNode) {
    if (this.checklistSelection.isSelected(node)) {
      this.checklistSelection.deselect(node);
    } else {
      this.checklistSelection.select(node);
    }

    var teste = PathService.getFullPath({node: node, treeControl: this.treeControl});

    const raw = localStorage.getItem(this.form.value.caminho);
    const existingHistory: { [path: string]: IVideoProgress } = raw
      ? JSON.parse(raw)
      : {};

    if (this.checklistSelection.isSelected(node)) {
      existingHistory[teste] = {
        watched: true,
      };
    } else {
      if (existingHistory[teste]) {
        delete existingHistory[teste];
      }
    }
    localStorage.setItem(
      this.form.value.caminho,
      JSON.stringify(existingHistory)
    );
    const isVideo = node.item
      .toLowerCase()
      .match(/\.(mp4|avi|mkv|mov|wmv|flv|webm)$/);

    if (isVideo) {
      const path = this.getVideoPathFromTree(node);
      this.playVideo(node);
    }
  }

  getVideoPathFromTree(node: TodoItemFlatNode): string {
    const nested = this.flatNodeMap.get(node);
    return nested?.path || '';
  }

  playVideo(node: TodoItemFlatNode): void {
    const path = node.path;
    const encodedPath = encodeURIComponent(path);
    this.videoUrl = `http://localhost:3000/video?path=${encodedPath}`;
    this.videoFileName = node.item;
  }

  closeVideo() {
    this.videoUrl = '';
    this.videoFileName = '';
  }

  isNodeWithoutChildSelected(node: TodoItemFlatNode): boolean {
    const raw = localStorage.getItem(this.form.value.caminho);
    const existingHistory: { [path: string]: IVideoProgress } = raw
      ? JSON.parse(raw)
      : {};

    const fullPath = PathService.getFullPath({node: node, treeControl: this.treeControl});
    const historyEntry = existingHistory[fullPath];
    return historyEntry && historyEntry.watched === true && !node.expandable;
  }

  isWatched(node: TodoItemFlatNode): boolean {
    const raw = localStorage.getItem(this.form.value.caminho);
    if (!raw) return false;

    const history: { [path: string]: IVideoProgress } = JSON.parse(raw);
    const path = PathService.getFullPath({node: node, treeControl: this.treeControl});
    return history[path]?.watched === true;
  }

  toggleWatched(node: TodoItemFlatNode): void {
    const raw = localStorage.getItem(this.form.value.caminho);
    const history: { [path: string]: IVideoProgress } = raw
      ? JSON.parse(raw)
      : {};

    const path = PathService.getFullPath({node: node, treeControl: this.treeControl});

    if (history[path]?.watched) {
      delete history[path];
    } else {
      history[path] = { watched: true };
    }

    localStorage.setItem(this.form.value.caminho, JSON.stringify(history));
  }
}
