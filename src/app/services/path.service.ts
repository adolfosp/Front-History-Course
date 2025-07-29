import { FlatTreeControl } from "@angular/cdk/tree";
import { TodoItemFlatNode } from "../domain/TodoItemFlatNode";

export class PathService {
   static getFullPath({node, treeControl}: {node: TodoItemFlatNode, treeControl: FlatTreeControl<TodoItemFlatNode>}): string {
      const path = [node.item];
      let level = node.level;
      let index = treeControl.dataNodes.indexOf(node) - 1;

      while (index >= 0 && level > 0) {
        const current = treeControl.dataNodes[index];
        if (current.level < level) {
          path.unshift(current.item); // adiciona ao início
          level = current.level;
        }
        index--;
      }
      return path.join('/');
    }
}
