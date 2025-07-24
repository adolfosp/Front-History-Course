import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { TodoItemNode } from '../domain/TodoItemNode';

@Injectable({ providedIn: 'root' })
export class Database {
  private _dataSubject = new BehaviorSubject<TodoItemNode[]>([]);
  data$ = this._dataSubject.asObservable();

  constructor(private http: HttpClient) {}

  initialize(dirPath: string): void {
    const params = new HttpParams().set('dir', dirPath).set('depth', '10');

    this.http.get<any>('http://localhost:3000/tree', { params }).subscribe({
      next: (tree) => {
        const data = this.transformTree(tree);
        this._dataSubject.next(data);
      },
      error: (err) => {
        console.error('Erro ao buscar diretório:', err);
        this._dataSubject.next([]);
      }
    });
  }

  private transformTree(node: any): TodoItemNode[] {
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
}
