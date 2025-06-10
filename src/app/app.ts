import { Component } from '@angular/core';
import { TreeTable } from "./tree-table/tree-table";

@Component({
  selector: 'app-root',
  imports: [TreeTable],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected title = 'history-course';
 
}
