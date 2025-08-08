import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
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
import { environment } from '../../environments/environment';
import { CardCourse } from "../components/card-course/card-course";
import { NgToastComponent, NgToastService, TOAST_POSITIONS } from 'ng-angular-popup';
import { CardCourseType } from '../domain/types/CardHouse';

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
    CardCourse,
    NgToastComponent
],
  providers: [ApiService],
})
export class TreeTable implements OnInit {
  videoUrl = '';
  videoFileName = '';
TOAST_POSITIONS = TOAST_POSITIONS
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

  constructor(private database: ApiService, private cdr: ChangeDetectorRef, private toast: NgToastService) {
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
      if(data?.length === 0) {
        this.toast.danger('Houve um erro ao carregar o curso', 'Error', 3000);
      }
      this.dataSource.data = data!;

      this.applyWatchedHistory();
    });
  }

  addValueToInput(value: CardCourseType) {
    this.form.patchValue({ caminho: value.path });
    this.onSubmit();
  }

  onSubmit() {
    this.database.initialize(this.pathToCourse);
  }

  public form: FormGroup = this.fb.group({
    caminho: ['', [Validators.required]],
  });

  private applyWatchedHistory(): void {
    const raw = localStorage.getItem(this.pathToCourse);
    if (!raw) return;

    const history: { [path: string]: IVideoProgress } = JSON.parse(raw);

    this.treeControl.dataNodes.forEach((node) => {
      const path = PathService.getFullPath({
        node: node,
        treeControl: this.treeControl,
      });
      if (history[path]?.watched) {
        this.checklistSelection.select(node);
        const descendants = this.treeControl.getDescendants(node);
        if (descendants.length == 0) return;
        this.checklistSelection.select(...descendants);
      }
    });
    this.cdr.detectChanges();
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

  get pathToCourse(): string {
    return this.form.value.caminho;
  }

  /// Seleciona todos filhos de um nó. Ex: Documentos -> Resume.docx, CoverLetter.docx, Projects
  todoItemSelectionToggleByNodeWithChild(node: TodoItemFlatNode): void {
    this.checklistSelection.toggle(node);
    const descendants = this.treeControl.getDescendants(node);
    const nodeIsSelected = this.checklistSelection.isSelected(node);

    if (nodeIsSelected) {
      this.checklistSelection.select(...descendants);
      HistoryService.updateWatchedHistoryFromNode({
        parentNode: node,
        descendants: descendants,
        path: this.pathToCourse,
        treeControl: this.treeControl,
      });
    } else {
      this.checklistSelection.deselect(...descendants);
      HistoryService.removeHistoryByPathPrefix(
        PathService.getFullPath({ node: node, treeControl: this.treeControl }),
        this.pathToCourse
      );
    }
    this.updateParentWatchedStatus(node);
  }

  todoItemSelectionToggleLeaf(node: TodoItemFlatNode): void {
    this.checklistSelection.toggle(node);
    const nodeIsSelected = this.checklistSelection.isSelected(node);

    if (nodeIsSelected) {
      HistoryService.updateWatchedHistoryFromNode({
        parentNode: node,
        descendants: [],
        path: this.pathToCourse,
        treeControl: this.treeControl,
      });
    } else {
      HistoryService.removeHistoryByPathPrefix(
        PathService.getFullPath({ node: node, treeControl: this.treeControl }),
        this.pathToCourse
      );
    }

    this.updateParentWatchedStatus(node);
  }

  public playVideo(node: TodoItemFlatNode): void {
    const path = node.path;
    const encodedPath = encodeURIComponent(path);
    this.videoUrl = `${environment.videoPath}?path=${encodedPath}`;
    this.videoFileName = node.item;
  }

  public closeVideo() {
    this.videoUrl = '';
    this.videoFileName = '';
  }

  private updateParentWatchedStatus(node: TodoItemFlatNode) {
    const parent = this.getParentNode(node);
    if (parent) {
      const descendants = this.treeControl.getDescendants(parent);
      const allSelected = descendants.every((d) =>
        this.checklistSelection.isSelected(d)
      );

      HistoryService.updateWatchedHistoryFromNode({
        parentNode: parent,
        descendants: [],
        path: this.pathToCourse,
        treeControl: this.treeControl,
        value: allSelected,
      });
    }
  }

  private getParentNode(node: TodoItemFlatNode): TodoItemFlatNode | null {
    const nodeIndex = this.treeControl.dataNodes.indexOf(node);
    for (let i = nodeIndex - 1; i >= 0; i--) {
      const current = this.treeControl.dataNodes[i];
      if (current.level < node.level) {
        return current;
      }
    }
    return null;
  }
}
