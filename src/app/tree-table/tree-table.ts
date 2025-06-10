import { Component } from '@angular/core';
import { FlatTreeControl } from '@angular/cdk/tree';
import { MatTreeFlattener, MatTreeFlatDataSource, MatTreeModule } from '@angular/material/tree';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

interface FileNode {
  name: string;
  type: string;
  children?: FileNode[];
}

interface FlatNode {
  expandable: boolean;
  name: string;
  level: number;
  type: string;
}

const TREE_DATA: FileNode[] = [
  {
    name: 'Documents',
    type: 'folder',
    children: [
      { name: 'Resume.pdf', type: 'file' },
      { name: 'CoverLetter.docx', type: 'file' },
    ]
  },
  {
    name: 'Pictures',
    type: 'folder',
    children: [
      {
        name: 'Vacation',
        type: 'folder',
        children: [
          { name: 'beach.png', type: 'file' },
          { name: 'mountain.jpg', type: 'file' }
        ]
      }
    ]
  }
];

@Component({
  selector: 'app-tree-table',
  imports: [CommonModule,
    MatTreeModule,
    MatIconModule,
    MatButtonModule],
  templateUrl: './tree-table.html',
  styleUrls: ['./tree-table.css']
})
export class TreeTable {
  private transformer = (node: FileNode, level: number): FlatNode => ({
    expandable: !!node.children && node.children.length > 0,
    name: node.name,
    level,
    type: node.type,
  });

  treeControl = new FlatTreeControl<FlatNode>(
    node => node.level,
    node => node.expandable
  );

  treeFlattener = new MatTreeFlattener(
    this.transformer,
    node => node.level,
    node => node.expandable,
    node => node.children
  );

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  constructor() {
    this.dataSource.data = TREE_DATA;
  }

  hasChild = (_: number, node: FlatNode) => node.expandable;
}
