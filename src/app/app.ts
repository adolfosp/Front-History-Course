import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TreeTable } from "./tree-table/tree-table";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TreeTable],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected title = 'history-course';
 
}
