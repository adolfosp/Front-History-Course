import { TodoItemFlatNode } from "../domain/TodoItemFlatNode";
import { TodoItemNode } from "../domain/TodoItemNode";

export function createTransformer(
  flatNodeMap: Map<TodoItemFlatNode, TodoItemNode>,
  nestedNodeMap: Map<TodoItemNode, TodoItemFlatNode>
) {
  return (node: TodoItemNode, level: number): TodoItemFlatNode => {
    let flatNode =
      nestedNodeMap.has(node) &&
      nestedNodeMap.get(node)!.item === node.item
        ? nestedNodeMap.get(node)!
        : new TodoItemFlatNode();

    flatNode.item = node.item;
    flatNode.level = level;
    flatNode.path = node.path;
    flatNode.expandable = !!node.children;

    flatNodeMap.set(flatNode, node);
    nestedNodeMap.set(node, flatNode);

    return flatNode;
  };
}

  export function transformTree(node: any): TodoItemNode[] {
    const convert = (n: any): TodoItemNode => {
      const treeNode = new TodoItemNode();
      treeNode.item = n.name;
      treeNode.path = n.path;
      if (n.children?.length) {
        treeNode.children = n.children.map(convert);
      }
      return treeNode;
    };
    return [convert(node)];
  }
