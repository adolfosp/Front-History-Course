import { FlatTreeControl } from '@angular/cdk/tree';
import { IVideoProgress } from '../domain/interfaces/IVideoProgress';
import { TodoItemFlatNode } from '../domain/TodoItemFlatNode';
import { PathService } from './path.service';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HistoryService {

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
  }): string {
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

    let jsonString = JSON.stringify(merged);
    localStorage.setItem(path, jsonString);

    return jsonString;
  }

  public removeHistoryByPathPrefix(
    pathPrefix: string,
    keyLocalStorage: string
  ): string {
    const raw = localStorage.getItem(keyLocalStorage);
    if (!raw) return "";

    const history: { [path: string]: IVideoProgress } = JSON.parse(raw);

    // Remove todos os registros cujo caminho começa com o prefixo
    for (const key of Object.keys(history)) {
      if (key === pathPrefix || key.startsWith(pathPrefix + '/')) {
        delete history[key];
      }
    }

    let jsonString = JSON.stringify(history);

    localStorage.setItem(keyLocalStorage, jsonString);

    return jsonString;
  }
}
