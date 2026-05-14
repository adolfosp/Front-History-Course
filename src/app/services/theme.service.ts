import { Injectable } from '@angular/core';

export type AppTheme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'history-course:theme';
  private readonly fallbackTheme: AppTheme = 'dark';
  private currentTheme: AppTheme = this.fallbackTheme;

  constructor() {
    this.currentTheme = this.getStoredTheme();
    this.applyTheme(this.currentTheme);
  }

  get theme(): AppTheme {
    return this.currentTheme;
  }

  get isDarkTheme(): boolean {
    return this.currentTheme === 'dark';
  }

  toggleTheme(): void {
    this.setTheme(this.isDarkTheme ? 'light' : 'dark');
  }

  setTheme(theme: AppTheme): void {
    this.currentTheme = theme;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, theme);
    }
    this.applyTheme(theme);
  }

  private getStoredTheme(): AppTheme {
    if (typeof localStorage === 'undefined') {
      return this.fallbackTheme;
    }

    const storedTheme = localStorage.getItem(this.storageKey);
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }

    return this.fallbackTheme;
  }

  private applyTheme(theme: AppTheme): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }
}
