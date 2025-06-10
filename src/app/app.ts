import { Component } from '@angular/core';
import { TreeTable } from "./tree-table/tree-table";
import { RouterModule } from '@angular/router';


@Component({
  selector: 'app-root',
  imports: [TreeTable, RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected title = 'history-course';
 
}
