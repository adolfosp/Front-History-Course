import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import packageJson from '../../package.json';

@Component({
  selector: 'app-root',
  imports: [RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected title = 'history-course';
  version = packageJson.version;
}
