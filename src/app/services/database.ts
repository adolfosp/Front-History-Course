import { Injectable } from '@angular/core';
import { TodoItemNode } from '../domain/TodoItemNode';


const TREE_DATA = {
  'Documents': {
    'Resume.docx': null,
    'CoverLetter.docx': null,
    'Projects': {
      'ProjectA': {
        'README.md': null,
        'main.ts': null,
        'utils.ts': null
      },
      'ProjectB': {
        'index.html': null,
        'styles.css': null,
        'app.js': null
      }
    }
  },
  'Pictures': {
    'Vacation': {
      'beach.png': null,
      'mountains.jpg': null
    },
    'Family': {
      'birthday.jpg': null,
      'wedding.png': null
    }
  },
  'Music': {
    'Rock': {
      'song1.mp3': null,
      'song2.mp3': null
    },
    'Jazz': {
      'jazz1.mp3': null
    }
  }
};


@Injectable({
  providedIn: 'root'
})

export class Database {
  _data: TodoItemNode[] = [];

  get data(): TodoItemNode[] { return this._data; }

  constructor() {
    this.initialize();
  }

  initialize() {
    this._data = this.buildFileTree(TREE_DATA, 0);
  }


  buildFileTree(value: any, level: number) {
    let data: any[] = [];
    for (let k in value) {
      let v = value[k];
      let node = new TodoItemNode();
      node.item = `${k}`;
      if (v === null || v === undefined) {
      } else if (typeof v === 'object') {
        node.children = this.buildFileTree(v, level + 1);
      } else {
        node.item = v;
      }
      data.push(node);
    }
    return data;
  }

}
