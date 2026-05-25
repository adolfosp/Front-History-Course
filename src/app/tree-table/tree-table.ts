import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { SelectionModel } from '@angular/cdk/collections';
import { FlatTreeControl } from '@angular/cdk/tree';
import {
  MatTreeFlattener,
  MatTreeFlatDataSource,
  MatTreeModule,
} from '@angular/material/tree';
import { Observable, Subscription, of as ofObservable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { TodoItemNode } from '../domain/TodoItemNode';
import { TodoItemFlatNode } from '../domain/TodoItemFlatNode';
import {
  CourseStatus,
  ICourseProgress,
} from '../domain/interfaces/ICourseProgress';
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
import { CardCourse } from '../components/card-course/card-course';
import {
  NgToastComponent,
  NgToastService,
  TOAST_POSITIONS,
} from 'ng-angular-popup';
import { CardCourseType } from '../domain/types/CardHouse';
import { CourseStorageService } from '../services/course-storage.service';
import {
  buildCourseBannerUrl,
  getCourseNameFromPath,
} from '../utils/course-progress';

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
    NgToastComponent,
  ],
  providers: [HistoryService],
})
export class TreeTable implements OnInit, OnDestroy {
  videoUrl = '';
  videoFileName = '';
  selectedCourse: CardCourseType | null = null;
  isLoadingCourse = false;
  loadingCourseName = '';
  autoPlayNext = this.readBooleanPreference(
    'history-course:auto-play-next',
    true
  );
  courseStats = {
    totalVideos: 0,
    watchedVideos: 0,
    percentage: 0,
  };
  TOAST_POSITIONS = TOAST_POSITIONS;
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

  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;

  checklistSelection = new SelectionModel<TodoItemFlatNode>(true);
  private fb = inject(FormBuilder);
  private readonly subscriptions = new Subscription();
  private currentVideoNode: TodoItemFlatNode | null = null;
  private playbackCompletionRecorded = false;
  private readonly completionThreshold = 0.95;
  private readonly playbackAutosaveIntervalMs = 15_000;
  private lastPlaybackAutosaveAt = 0;
  private shouldScrollToCourseAfterLoad = false;
  pausedTimes: { [key: string]: string } = {};

  constructor(
    private apiService: ApiService,
    private cdr: ChangeDetectorRef,
    private toast: NgToastService,
    private historyService: HistoryService,
    private courseStorageService: CourseStorageService
  ) {
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
    this.subscriptions.add(
      this.apiService.data$.subscribe((data) => {
        if (!data || data.length === 0) {
          this.dataSource.data = [];
          this.finishCourseLoading();
          return;
        }

        this.dataSource.data = data;
        this.finishCourseLoading();
        this.applyWatchedHistory();
      })
    );

    this.subscriptions.add(
      this.courseStorageService.courses$.subscribe((courses) => {
        if (!this.selectedCourse) {
          return;
        }

        this.selectedCourse =
          courses.find((course) => course.path === this.selectedCourse?.path) ??
          this.selectedCourse;
      })
    );
  }

  ngOnDestroy(): void {
    this.saveCurrentVideoPlaybackProgress();
    this.subscriptions.unsubscribe();
  }

  addValueToInput(value: CardCourseType): void {
    if (this.isLoadingCourse) {
      return;
    }

    this.form.patchValue({ caminho: value.path });
    this.shouldScrollToCourseAfterLoad = true;
    this.loadCourse(value.path);
  }

  onSubmit(): void {
    if (this.isLoadingCourse) {
      return;
    }

    if (this.form.invalid) {
      return;
    }

    const coursePath = this.pathToCourse.trim();

    if (!coursePath) {
      return;
    }

    this.form.patchValue({ caminho: coursePath });
    this.loadCourse(coursePath);
  }

  onVideoPaused(event: Event): void {
    if (!this.currentVideoNode || !this.pathToCourse) {
      return;
    }

    const videoElement = event.target as HTMLVideoElement;
    if (this.shouldMarkVideoAsCompleted(videoElement)) {
      this.completeCurrentVideoPlayback();
      return;
    }

    this.saveCurrentVideoPlaybackProgress(videoElement.currentTime);
  }

  onVideoEnded(): void {
    if (!this.currentVideoNode || !this.pathToCourse) {
      return;
    }

    const node = this.treeControl.dataNodes.find(
      (item) => item.item === this.videoFileName
    );

    if (!node) {
      console.warn(`Nó do vídeo "${this.videoFileName}" não encontrado.`);
      return;
    }

    this.checklistSelection.select(node);

    const historyUpdated = this.historyService.updateWatchedHistoryFromNode({
      parentNode: node,
      descendants: [],
      path: this.pathToCourse,
      treeControl: this.treeControl,
      value: true,
    });

    this.persistCourseProgress(historyUpdated);
    this.updateParentWatchedStatus(node);

    this.toast.success(
      `Vídeo "${this.videoFileName}" concluído!`,
      'Concluído',
      3000
    );

    this.closeVideo(true);
  }

  handleVideoEnded(): void {
    if (!this.currentVideoNode || !this.pathToCourse) {
      return;
    }

    const completedNode = this.currentVideoNode;
    this.completeCurrentVideoPlayback();

    this.toast.success(
      `Video "${this.videoFileName}" concluido!`,
      'Concluido',
      3000
    );

    const nextNode = this.autoPlayNext
      ? this.getNextVideoNode(completedNode)
      : null;

    this.closeVideo(true);

    if (nextNode) {
      setTimeout(() => {
        this.playVideo(nextNode);
      }, 250);
    }
  }

  onVideoTimeUpdate(event: Event): void {
    const videoElement = event.target as HTMLVideoElement;

    if (this.shouldMarkVideoAsCompleted(videoElement)) {
      this.completeCurrentVideoPlayback();
      return;
    }

    this.autosaveVideoPlaybackProgress(videoElement);
  }

  private autosaveVideoPlaybackProgress(videoElement: HTMLVideoElement): void {
    if (!this.currentVideoNode || !this.pathToCourse || videoElement.paused) {
      return;
    }

    const now = Date.now();
    if (now - this.lastPlaybackAutosaveAt < this.playbackAutosaveIntervalMs) {
      return;
    }

    this.saveCurrentVideoPlaybackProgress(videoElement.currentTime);
    this.lastPlaybackAutosaveAt = now;
  }

  public form: FormGroup = this.fb.group({
    caminho: ['', [Validators.required]],
  });

  private applyWatchedHistory(): void {
    if (!this.pathToCourse) {
      return;
    }

    const history = this.courseStorageService.getCourseProgress(
      this.pathToCourse
    ).history;

    this.checklistSelection.clear();
    this.pausedTimes = {};

    this.treeControl.dataNodes.forEach((node) => {
      const fullPath = PathService.getFullPath({
        node,
        treeControl: this.treeControl,
      });

      this.pausedTimes[node.item] = history[fullPath]?.currentTime?.toString() || '0';

      if (history[fullPath]?.watched) {
        this.checklistSelection.select(node);
        const descendants = this.treeControl.getDescendants(node);

        if (descendants.length === 0) {
          return;
        }

        this.checklistSelection.select(...descendants);
      }
    });

    this.refreshCourseStats();
    this.cdr.detectChanges();
  }

  getLevel = (node: TodoItemFlatNode) => {
    return node.level;
  };

  getTimePublished(fileName: string): string {
    if (!this.pathToCourse) {
      return '';
    }

    const history = this.courseStorageService.getCourseProgress(
      this.pathToCourse
    ).history;

    const node = this.treeControl.dataNodes.find((item) => item.item === fileName);
    if (!node) {
      return '';
    }

    const fullPath = PathService.getFullPath({
      node,
      treeControl: this.treeControl,
    });

    const progress = history[fullPath]?.currentTime ?? 0;
    if (progress <= 0) {
      return '';
    }

    const minutes = Math.floor(progress / 60);
    const seconds = Math.floor(progress % 60)
      .toString()
      .padStart(2, '0');

    return `${minutes}:${seconds}`;
  }

  getVideoWatchCount(node: TodoItemFlatNode): number {
    return this.getVideoHistory(node)?.watchCount ?? 0;
  }

  getVideoCompletedAt(node: TodoItemFlatNode): string {
    const completedAt = this.getVideoHistory(node)?.completedAt;

    if (!completedAt) {
      return '';
    }

    return new Date(completedAt).toLocaleString('pt-BR');
  }

  toggleAutoPlayNext(): void {
    this.autoPlayNext = !this.autoPlayNext;
    localStorage.setItem(
      'history-course:auto-play-next',
      JSON.stringify(this.autoPlayNext)
    );
  }

  markSelectedCourseAsCompleted(): void {
    if (!this.pathToCourse || this.isLoadingCourse) {
      return;
    }

    const updatedProgress = this.updateSelectedCourseStatus('completed');
    const now = new Date().toISOString();
    const history = { ...updatedProgress.history };
    let lastLeafPath = '';

    this.checklistSelection.select(...this.treeControl.dataNodes);

    for (const node of this.treeControl.dataNodes) {
      const nodePath = PathService.getFullPath({
        node,
        treeControl: this.treeControl,
      });
      const existing = history[nodePath];

      history[nodePath] = {
        ...existing,
        watched: true,
        currentTime: 0,
        completedAt: node.expandable ? existing?.completedAt ?? null : existing?.completedAt ?? now,
        watchCount: existing?.watchCount ?? 0,
      };

      if (!node.expandable) {
        lastLeafPath = nodePath;
      }
    }

    if (lastLeafPath && history[lastLeafPath]) {
      history[lastLeafPath].lastWatched = true;
    }

    this.persistCourseProgress({
      ...updatedProgress,
      history,
    });

    this.toast.success('Curso marcado como concluido.', 'Concluido', 3000);
  }

  abandonSelectedCourse(): void {
    if (!this.pathToCourse || this.isLoadingCourse) {
      return;
    }

    this.persistCourseProgress(this.updateSelectedCourseStatus('abandoned'));
    this.toast.success('Curso marcado como desistido.', 'Desistido', 3000);
  }

  moveSelectedCourseToProgress(): void {
    if (!this.pathToCourse || this.isLoadingCourse) {
      return;
    }

    this.persistCourseProgress(this.updateSelectedCourseStatus('in-progress'));
    this.toast.success('Curso voltou para andamento.', 'Em andamento', 3000);
  }

  isExpandable = (node: TodoItemFlatNode) => {
    return node.expandable;
  };

  getChildren = (node: TodoItemNode): Observable<TodoItemNode[]> => {
    return ofObservable(node.children);
  };

  hasChild = (_: number, nodeData: TodoItemFlatNode) => {
    return nodeData.expandable;
  };

  get pathToCourse(): string {
    return this.form.value.caminho ?? '';
  }

  toggleBranchSelection(node: TodoItemFlatNode): void {
    this.checklistSelection.toggle(node);
    const descendants = this.treeControl.getDescendants(node);
    const nodeIsSelected = this.checklistSelection.isSelected(node);

    if (nodeIsSelected) {
      this.checklistSelection.select(...descendants);
    } else {
      this.checklistSelection.deselect(...descendants);
    }

    const historyUpdated = this.historyService.markNodesWatched({
      parentNode: node,
      descendants,
      path: this.pathToCourse,
      treeControl: this.treeControl,
      watched: nodeIsSelected,
    });

    this.persistCourseProgress(historyUpdated);
    this.syncAncestors(node);
  }

  toggleLeafSelection(node: TodoItemFlatNode): void {
    this.checklistSelection.toggle(node);
    const nodeIsSelected = this.checklistSelection.isSelected(node);

    const historyUpdated = nodeIsSelected
      ? this.historyService.markNodesWatched({
          parentNode: node,
          descendants: [],
          path: this.pathToCourse,
          treeControl: this.treeControl,
          watched: true,
        })
      : this.historyService.resetVideoProgress({
          node,
          path: this.pathToCourse,
          treeControl: this.treeControl,
        });

    this.persistCourseProgress(historyUpdated);
    this.syncAncestors(node);
  }

  resetLeafVideo(node: TodoItemFlatNode): void {
    const historyUpdated = this.historyService.resetVideoProgress({
      node,
      path: this.pathToCourse,
      treeControl: this.treeControl,
    });

    this.checklistSelection.deselect(node);
    this.persistCourseProgress(historyUpdated);
    this.syncAncestors(node);

    if (this.currentVideoNode?.path === node.path) {
      this.closeVideo(true);
    }
  }

  todoItemSelectionToggleByNodeWithChild(node: TodoItemFlatNode): void {
    this.checklistSelection.toggle(node);
    const descendants = this.treeControl.getDescendants(node);
    const nodeIsSelected = this.checklistSelection.isSelected(node);

    if (nodeIsSelected) {
      this.checklistSelection.select(...descendants);
      const historyUpdated = this.historyService.updateWatchedHistoryFromNode({
        parentNode: node,
        descendants,
        path: this.pathToCourse,
        treeControl: this.treeControl,
      });

      this.persistCourseProgress(historyUpdated);
    } else {
      this.checklistSelection.deselect(...descendants);
      const historyUpdated = this.historyService.removeHistoryByPathPrefix(
        PathService.getFullPath({ node, treeControl: this.treeControl }),
        this.pathToCourse
      );

      this.persistCourseProgress(historyUpdated);
    }

    this.updateParentWatchedStatus(node);
  }

  todoItemSelectionToggleLeaf(node: TodoItemFlatNode): void {
    this.checklistSelection.toggle(node);
    const nodeIsSelected = this.checklistSelection.isSelected(node);

    if (nodeIsSelected) {
      const historyUpdated = this.historyService.updateWatchedHistoryFromNode({
        parentNode: node,
        descendants: [],
        path: this.pathToCourse,
        treeControl: this.treeControl,
      });

      this.persistCourseProgress(historyUpdated);
    } else {
      const historyUpdated = this.historyService.removeHistoryByPathPrefix(
        PathService.getFullPath({ node, treeControl: this.treeControl }),
        this.pathToCourse
      );

      this.persistCourseProgress(historyUpdated);
    }

    this.updateParentWatchedStatus(node);
  }

  public playVideo(node: TodoItemFlatNode): void {
    const encodedPath = encodeURIComponent(node.path);
    this.videoUrl = `${environment.videoPath}?path=${encodedPath}`;
    this.videoFileName = node.item;
    this.currentVideoNode = node;
    this.playbackCompletionRecorded = false;
    this.lastPlaybackAutosaveAt = Date.now();

    const history = this.courseStorageService.getCourseProgress(
      this.pathToCourse
    ).history;

    const fullPath = PathService.getFullPath({
      node,
      treeControl: this.treeControl,
    });

    const progress = history[fullPath]?.currentTime ?? 0;

    setTimeout(() => {
      const video = document.querySelector('video');
      if (video && progress > 0) {
        video.currentTime = progress;
      }
    }, 500);
  }

  public closeVideo(fromEndedVideo: boolean = false): void {
    if (!fromEndedVideo && this.videoPlayer?.nativeElement) {
      this.onVideoPaused({
        target: this.videoPlayer.nativeElement,
      } as unknown as Event);
    }

    this.videoUrl = '';
    this.videoFileName = '';
    this.currentVideoNode = null;
    this.playbackCompletionRecorded = false;
    this.lastPlaybackAutosaveAt = 0;
  }

  getSelectedCourseBackground(): string {
    if (!this.selectedCourse?.bannerUrl) {
      return 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 45%, #bfdbfe 100%)';
    }

    return `linear-gradient(180deg, rgba(15, 23, 42, 0.14) 0%, rgba(15, 23, 42, 0.84) 100%), url("${this.selectedCourse.bannerUrl}")`;
  }

  private updateParentWatchedStatus(node: TodoItemFlatNode): void {
    const parent = this.getParentNode(node);
    if (!parent) {
      return;
    }

    const descendants = this.treeControl.getDescendants(parent);
    const allSelected = descendants.every((item) =>
      this.checklistSelection.isSelected(item)
    );

    const historyUpdated = this.historyService.updateWatchedHistoryFromNode({
      parentNode: parent,
      descendants: [],
      path: this.pathToCourse,
      treeControl: this.treeControl,
      value: allSelected,
      currentTime: 0,
    });

    this.persistCourseProgress(historyUpdated);
  }

  private getParentNode(node: TodoItemFlatNode): TodoItemFlatNode | null {
    const nodeIndex = this.treeControl.dataNodes.indexOf(node);
    for (let index = nodeIndex - 1; index >= 0; index--) {
      const current = this.treeControl.dataNodes[index];
      if (current.level < node.level) {
        return current;
      }
    }
    return null;
  }

  private loadCourse(coursePath: string): void {
    this.isLoadingCourse = true;
    this.loadingCourseName = getCourseNameFromPath(coursePath);
    this.resetCourseState();
    this.courseStorageService.ensureCourse(coursePath);
    this.syncSelectedCourse(coursePath);

    this.apiService.getCourseProgress(coursePath).subscribe({
      next: (progress) => {
        const currentProgress =
          this.courseStorageService.getCourseProgress(coursePath);
        this.courseStorageService.saveCourseProgress(coursePath, {
          ...progress,
          courseStatus:
            currentProgress.courseStatus !== 'in-progress'
              ? currentProgress.courseStatus
              : progress.courseStatus,
        });
        this.syncSelectedCourse(coursePath);
        this.initializeCourseTree(coursePath);
      },
      error: (error) => {
        console.error('Erro ao sincronizar progresso do curso:', error);
        this.initializeCourseTree(coursePath);
      },
    });
  }

  private initializeCourseTree(coursePath: string): void {
    this.apiService.initialize(coursePath).subscribe({
      next: () => {
        this.finishCourseLoading();
      },
      error: (error) => {
        console.error('Erro ao carregar conteudo do curso:', error);
        this.finishCourseLoading();
      },
    });
  }

  private finishCourseLoading(): void {
    this.isLoadingCourse = false;
    this.loadingCourseName = '';
    this.scrollToCourseAfterLoad();
  }

  private persistCourseProgress(progress: ICourseProgress): void {
    if (!this.pathToCourse) {
      return;
    }

    this.courseStorageService.saveCourseProgress(this.pathToCourse, progress);
    this.syncSelectedCourse(this.pathToCourse);
    this.refreshCourseStats();

    this.apiService.updateCourseProgressOnFolder(this.pathToCourse, progress).subscribe({
      next: (serverProgress) => {
        this.courseStorageService.saveCourseProgress(
          this.pathToCourse,
          serverProgress
        );
        this.syncSelectedCourse(this.pathToCourse);
        this.refreshCourseStats();
      },
      error: (error) => {
        console.error('Erro ao salvar progresso do curso no servidor:', error);
      },
    });
  }

  private resetCourseState(): void {
    this.videoUrl = '';
    this.videoFileName = '';
    this.pausedTimes = {};
    this.checklistSelection.clear();
    this.dataSource.data = [];
    this.courseStats = {
      totalVideos: 0,
      watchedVideos: 0,
      percentage: 0,
    };
    this.currentVideoNode = null;
    this.playbackCompletionRecorded = false;
    this.lastPlaybackAutosaveAt = 0;
  }

  private scrollToCourseAfterLoad(): void {
    if (!this.shouldScrollToCourseAfterLoad) {
      return;
    }

    this.shouldScrollToCourseAfterLoad = false;

    setTimeout(() => {
      document.getElementById('tree-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  private completeCurrentVideoPlayback(): void {
    if (
      !this.currentVideoNode ||
      !this.pathToCourse ||
      this.playbackCompletionRecorded
    ) {
      return;
    }

    this.playbackCompletionRecorded = true;
    this.checklistSelection.select(this.currentVideoNode);

    const historyUpdated = this.historyService.markVideoAsCompleted({
      node: this.currentVideoNode,
      path: this.pathToCourse,
      treeControl: this.treeControl,
    });

    this.persistCourseProgress(historyUpdated);
    this.syncAncestors(this.currentVideoNode);
  }

  private saveCurrentVideoPlaybackProgress(currentTime?: number): void {
    if (!this.currentVideoNode || !this.pathToCourse) {
      return;
    }

    const playbackTime =
      currentTime ?? this.videoPlayer?.nativeElement?.currentTime ?? 0;

    const historyUpdated = this.historyService.updateNodePlaybackProgress({
      node: this.currentVideoNode,
      path: this.pathToCourse,
      treeControl: this.treeControl,
      currentTime: playbackTime,
    });

    this.persistCourseProgress(historyUpdated);
  }

  private syncAncestors(node: TodoItemFlatNode): void {
    let parent = this.getParentNode(node);

    while (parent) {
      const descendants = this.treeControl.getDescendants(parent);
      const allSelected =
        descendants.length > 0 &&
        descendants.every((item) => this.checklistSelection.isSelected(item));

      if (allSelected) {
        this.checklistSelection.select(parent);
      } else {
        this.checklistSelection.deselect(parent);
      }

      parent = this.getParentNode(parent);
    }

    const historyUpdated = this.historyService.syncAncestorStatuses({
      node,
      path: this.pathToCourse,
      treeControl: this.treeControl,
      isNodeSelected: (target) => this.checklistSelection.isSelected(target),
    });

    this.persistCourseProgress(historyUpdated);
  }

  private getVideoHistory(node: TodoItemFlatNode) {
    if (!this.pathToCourse) {
      return null;
    }

    const history = this.courseStorageService.getCourseProgress(
      this.pathToCourse
    ).history;

    return history[
      PathService.getFullPath({
        node,
        treeControl: this.treeControl,
      })
    ] ?? null;
  }

  private shouldMarkVideoAsCompleted(video: HTMLVideoElement): boolean {
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      return false;
    }

    return video.currentTime / video.duration >= this.completionThreshold;
  }

  private getNextVideoNode(
    currentNode: TodoItemFlatNode
  ): TodoItemFlatNode | null {
    const leafNodes = this.treeControl.dataNodes.filter((node) => !node.expandable);
    const currentIndex = leafNodes.findIndex(
      (node) => node.path === currentNode.path
    );

    if (currentIndex === -1 || currentIndex === leafNodes.length - 1) {
      return null;
    }

    return leafNodes[currentIndex + 1];
  }

  private refreshCourseStats(): void {
    const leafNodes = this.treeControl.dataNodes.filter((node) => !node.expandable);
    const history = this.pathToCourse
      ? this.courseStorageService.getCourseProgress(this.pathToCourse).history
      : {};
    const watchedVideos = leafNodes.filter((node) => {
      const progress =
        history[
          PathService.getFullPath({
            node,
            treeControl: this.treeControl,
          })
        ];

      return progress?.watched === true;
    }).length;
    const totalVideos = leafNodes.length;

    this.courseStats = {
      totalVideos,
      watchedVideos,
      percentage:
        totalVideos > 0 ? Math.round((watchedVideos / totalVideos) * 100) : 0,
    };
    this.persistTotalVideosForSelectedCourse();
  }

  private persistTotalVideosForSelectedCourse(): void {
    if (!this.pathToCourse || this.courseStats.totalVideos <= 0) {
      return;
    }

    const progress = this.courseStorageService.getCourseProgress(this.pathToCourse);

    if (progress.totalVideos === this.courseStats.totalVideos) {
      return;
    }

    this.courseStorageService.saveCourseProgress(this.pathToCourse, {
      ...progress,
      totalVideos: this.courseStats.totalVideos,
    });
    this.syncSelectedCourse(this.pathToCourse);
  }

  private updateSelectedCourseStatus(status: CourseStatus): ICourseProgress {
    const coursePath = this.pathToCourse;
    const courseProgress = this.courseStorageService.getCourseProgress(coursePath);
    const courseName = getCourseNameFromPath(coursePath);
    const courseEntry = courseProgress.history[courseName];
    const isCompleted = status === 'completed';

    return {
      ...courseProgress,
      courseStatus: status,
      history: {
        ...courseProgress.history,
        [courseName]: {
          ...courseEntry,
          watched: isCompleted,
          currentTime: 0,
          completedAt: isCompleted
            ? courseEntry?.completedAt ?? new Date().toISOString()
            : null,
          watchCount: courseEntry?.watchCount ?? 0,
        },
      },
    };
  }

  private readBooleanPreference(key: string, fallback: boolean): boolean {
    const rawValue = localStorage.getItem(key);

    if (rawValue === null) {
      return fallback;
    }

    try {
      return JSON.parse(rawValue) === true;
    } catch {
      return fallback;
    }
  }

  private syncSelectedCourse(coursePath: string): void {
    const courseProgress = this.courseStorageService.ensureCourse(coursePath);
    const courseName = getCourseNameFromPath(coursePath);

    this.selectedCourse = {
      path: coursePath,
      name: courseName,
      status:
        courseProgress.courseStatus === 'in-progress' &&
        courseProgress.history[courseName]?.watched === true
          ? 'completed'
          : courseProgress.courseStatus,
      isCompleted:
        courseProgress.courseStatus === 'completed' ||
        (courseProgress.courseStatus === 'in-progress' &&
          courseProgress.history[courseName]?.watched === true),
      isAbandoned: courseProgress.courseStatus === 'abandoned',
      progress: {
        watchedVideos: this.courseStats.watchedVideos,
        knownVideos: this.courseStats.totalVideos,
        percentage: this.courseStats.percentage,
      },
      bannerImage: courseProgress.bannerImage,
      bannerUrl: buildCourseBannerUrl(coursePath, courseProgress.bannerImage),
    };
  }
}

