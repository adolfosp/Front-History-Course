import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import packageJson from '../../package.json';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected title = 'history-course';
  version = packageJson.version;

  constructor(private readonly themeService: ThemeService) {}

  get isDarkTheme(): boolean {
    return this.themeService.isDarkTheme;
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
