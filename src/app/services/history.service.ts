import { FlatTreeControl } from '@angular/cdk/tree';
import { IVideoProgress } from '../domain/interfaces/IVideoProgress';
import { TodoItemFlatNode } from '../domain/TodoItemFlatNode';
import { PathService } from './path.service';

export class HistoryService {
  static updateWatchedHistoryFromNode({
    parentNode,
    descendants,
    path,
    treeControl,
    value = true,
  }: {
    parentNode: TodoItemFlatNode;
    descendants: TodoItemFlatNode[];
    path: string;
    treeControl: FlatTreeControl<TodoItemFlatNode>;
    value?: boolean
  }): void {
    const raw = localStorage.getItem(path);
    const existingHistory: { [path: string]: IVideoProgress } = raw
      ? JSON.parse(raw)
      : {};

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
    newHistory[parentPath] = { watched: value };

    for (const node of descendants) {
      const path = PathService.getFullPath({
        node: node,
        treeControl: treeControl,
      });
      newHistory[path] = { watched: value };

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

    localStorage.setItem(path, JSON.stringify(merged));
  }

  static removeHistoryByPathPrefix(
    pathPrefix: string,
    keyLocalStorage: string
  ): void {
    const raw = localStorage.getItem(keyLocalStorage);
    if (!raw) return;

    const history: { [path: string]: IVideoProgress } = JSON.parse(raw);

    // Remove todos os registros cujo caminho começa com o prefixo
    for (const key of Object.keys(history)) {
      if (key === pathPrefix || key.startsWith(pathPrefix + '/')) {
        delete history[key];
      }
    }

    localStorage.setItem(keyLocalStorage, JSON.stringify(history));
  }
}
