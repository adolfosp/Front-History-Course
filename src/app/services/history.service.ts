import { FlatTreeControl } from '@angular/cdk/tree';
import { Injectable } from '@angular/core';
import { ICourseProgress } from '../domain/interfaces/ICourseProgress';
import { IVideoProgress } from '../domain/interfaces/IVideoProgress';
import { TodoItemFlatNode } from '../domain/TodoItemFlatNode';
import { CourseStorageService } from './course-storage.service';
import { PathService } from './path.service';

@Injectable({ providedIn: 'root' })
export class HistoryService {
  constructor(private readonly courseStorageService: CourseStorageService) {}

  getCourseProgress(path: string): ICourseProgress {
    return this.courseStorageService.ensureCourse(path);
  }

  updateNodePlaybackProgress({
    node,
    path,
    treeControl,
    currentTime,
  }: {
    node: TodoItemFlatNode;
    path: string;
    treeControl: FlatTreeControl<TodoItemFlatNode>;
    currentTime: number;
  }): ICourseProgress {
    return this.updateEntries(path, (history) => {
      const nodePath = this.getNodePath(node, treeControl);
      const existing = history[nodePath];

      history[nodePath] = {
        ...this.createProgressEntry(existing),
        watched: existing?.watched ?? false,
        currentTime,
      };
    });
  }

  markVideoAsCompleted({
    node,
    path,
    treeControl,
  }: {
    node: TodoItemFlatNode;
    path: string;
    treeControl: FlatTreeControl<TodoItemFlatNode>;
  }): ICourseProgress {
    return this.updateEntries(path, (history) => {
      this.clearLastWatched(history);

      const nodePath = this.getNodePath(node, treeControl);
      const existing = history[nodePath];

      history[nodePath] = {
        ...this.createProgressEntry(existing),
        watched: true,
        currentTime: 0,
        completedAt: new Date().toISOString(),
        watchCount: (existing?.watchCount ?? 0) + 1,
        lastWatched: true,
      };
    });
  }

  resetVideoProgress({
    node,
    path,
    treeControl,
  }: {
    node: TodoItemFlatNode;
    path: string;
    treeControl: FlatTreeControl<TodoItemFlatNode>;
  }): ICourseProgress {
    return this.updateEntries(path, (history) => {
      const nodePath = this.getNodePath(node, treeControl);
      delete history[nodePath];
    });
  }

  syncAncestorStatuses({
    node,
    path,
    treeControl,
    isNodeSelected,
  }: {
    node: TodoItemFlatNode;
    path: string;
    treeControl: FlatTreeControl<TodoItemFlatNode>;
    isNodeSelected: (target: TodoItemFlatNode) => boolean;
  }): ICourseProgress {
    return this.updateEntries(path, (history) => {
      let parent = this.getParentNode(node, treeControl);

      while (parent) {
        const parentPath = this.getNodePath(parent, treeControl);
        const descendants = treeControl
          .getDescendants(parent)
          .filter((item) => !item.expandable);
        const allSelected =
          descendants.length > 0 &&
          descendants.every((item) => isNodeSelected(item));
        const existing = history[parentPath];

        if (allSelected) {
          history[parentPath] = {
            ...this.createProgressEntry(existing),
            watched: true,
            currentTime: 0,
          };
        } else if (existing) {
          history[parentPath] = {
            ...this.createProgressEntry(existing),
            watched: false,
            currentTime: 0,
          };
        } else {
          delete history[parentPath];
        }

        parent = this.getParentNode(parent, treeControl);
      }
    });
  }

  markNodesWatched({
    parentNode,
    descendants,
    path,
    treeControl,
    watched,
  }: {
    parentNode: TodoItemFlatNode;
    descendants: TodoItemFlatNode[];
    path: string;
    treeControl: FlatTreeControl<TodoItemFlatNode>;
    watched: boolean;
  }): ICourseProgress {
    return this.updateEntries(path, (history) => {
      this.clearLastWatched(history);

      const nodes = [parentNode, ...descendants];
      let lastLeafPath = '';

      for (const node of nodes) {
        const nodePath = this.getNodePath(node, treeControl);
        const existing = history[nodePath];

        if (watched) {
          history[nodePath] = {
            ...this.createProgressEntry(existing),
            watched: true,
            currentTime: 0,
            completedAt:
              !node.expandable && existing?.completedAt
                ? existing.completedAt
                : node.expandable
                  ? existing?.completedAt ?? null
                  : new Date().toISOString(),
          };
        } else {
          delete history[nodePath];
        }

        if (!node.expandable) {
          lastLeafPath = nodePath;
        }
      }

      if (watched && lastLeafPath && history[lastLeafPath]) {
        history[lastLeafPath].lastWatched = true;
      }
    });
  }

  private updateEntries(
    coursePath: string,
    updater: (history: Record<string, IVideoProgress>) => void
  ): ICourseProgress {
    const courseProgress = this.courseStorageService.ensureCourse(coursePath);
    const history: Record<string, IVideoProgress> = { ...courseProgress.history };

    updater(history);

    const updatedCourseProgress: ICourseProgress = {
      ...courseProgress,
      history,
    };

    this.courseStorageService.saveCourseProgress(coursePath, updatedCourseProgress);
    return updatedCourseProgress;
  }

  private clearLastWatched(history: Record<string, IVideoProgress>): void {
    for (const key of Object.keys(history)) {
      delete history[key].lastWatched;
    }
  }

  private createProgressEntry(progress?: IVideoProgress): IVideoProgress {
    return {
      watched: progress?.watched ?? false,
      currentTime: progress?.currentTime ?? 0,
      completedAt: progress?.completedAt ?? null,
      watchCount: progress?.watchCount ?? 0,
    };
  }

  private getNodePath(
    node: TodoItemFlatNode,
    treeControl: FlatTreeControl<TodoItemFlatNode>
  ): string {
    return PathService.getFullPath({
      node,
      treeControl,
    });
  }

  private getParentNode(
    node: TodoItemFlatNode,
    treeControl: FlatTreeControl<TodoItemFlatNode>
  ): TodoItemFlatNode | null {
    const nodeIndex = treeControl.dataNodes.indexOf(node);

    for (let index = nodeIndex - 1; index >= 0; index--) {
      const current = treeControl.dataNodes[index];
      if (current.level < node.level) {
        return current;
      }
    }

    return null;
  }

   public updateWatchedHistoryFromNode({
    parentNode,
    descendants,
    path,
    treeControl,
    value = true,
    currentTime = 0,
  }: {
    parentNode: TodoItemFlatNode;
    descendants: TodoItemFlatNode[];
    path: string;
    treeControl: FlatTreeControl<TodoItemFlatNode>;
    value?: boolean
    currentTime?: number;
  }): ICourseProgress {
    const courseProgress = this.courseStorageService.ensureCourse(path);
    const existingHistory: { [path: string]: IVideoProgress } = {
      ...courseProgress.history,
    };

    // Limpa lastWatched
    for (const key in existingHistory) {
      delete existingHistory[key].lastWatched;
    }

    const newHistory: { [path: string]: IVideoProgress } = {};
    let lastWatchedPathKey = '';

    // Inclui o próprio pai
    const parentPath = PathService.getFullPath({
      node: parentNode,
      treeControl: treeControl,
    });
    newHistory[parentPath] = { watched: value, currentTime: currentTime };

    for (const node of descendants) {
      const path = PathService.getFullPath({
        node: node,
        treeControl: treeControl,
      });
      newHistory[path] = { watched: value, currentTime: currentTime };

      if (!node.expandable) {
        lastWatchedPathKey = path;
      }
    }

    if (lastWatchedPathKey) {
      newHistory[lastWatchedPathKey].lastWatched = true;
      newHistory[lastWatchedPathKey].currentTime = currentTime;
    }

    // Mescla
    const merged = {
      ...existingHistory,
      ...newHistory,
    };

    const updatedCourseProgress: ICourseProgress = {
      ...courseProgress,
      history: merged,
    };

    this.courseStorageService.saveCourseProgress(path, updatedCourseProgress);

    return updatedCourseProgress;
  }

  public removeHistoryByPathPrefix(
    pathPrefix: string,
    keyLocalStorage: string
  ): ICourseProgress {
    const courseProgress = this.courseStorageService.ensureCourse(keyLocalStorage);
    const history: { [path: string]: IVideoProgress } = {
      ...courseProgress.history,
    };

    // Remove todos os registros cujo caminho começa com o prefixo
    for (const key of Object.keys(history)) {
      if (key === pathPrefix || key.startsWith(pathPrefix + '/')) {
        delete history[key];
      }
    }

    const updatedCourseProgress: ICourseProgress = {
      ...courseProgress,
      history,
    };

    this.courseStorageService.saveCourseProgress(
      keyLocalStorage,
      updatedCourseProgress
    );

    return updatedCourseProgress;
  }
}
