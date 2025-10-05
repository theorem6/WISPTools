// Dark Mode Management for LTE PCI Mapper
import { browser } from '$app/environment';
import { writable } from 'svelte/store';

// Dark mode store
export const isDarkMode = writable(false);

// Theme management functions
export class DarkModeManager {
  private static instance: DarkModeManager;
  private currentTheme: 'light' | 'dark' = 'light';

  private constructor() {
    if (browser) {
      this.initializeTheme();
    }
  }

  public static getInstance(): DarkModeManager {
    if (!DarkModeManager.instance) {
      DarkModeManager.instance = new DarkModeManager();
    }
    return DarkModeManager.instance;
  }

  private initializeTheme(): void {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
      this.currentTheme = savedTheme as 'light' | 'dark';
    } else if (prefersDark) {
      this.currentTheme = 'dark';
    }

    this.applyTheme(this.currentTheme);
    isDarkMode.set(this.currentTheme === 'dark');

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        this.currentTheme = e.matches ? 'dark' : 'light';
        this.applyTheme(this.currentTheme);
        isDarkMode.set(this.currentTheme === 'dark');
      }
    });
  }

  public toggleTheme(): void {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(this.currentTheme);
    isDarkMode.set(this.currentTheme === 'dark');
    localStorage.setItem('theme', this.currentTheme);
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.currentTheme = theme;
    this.applyTheme(this.currentTheme);
    isDarkMode.set(this.currentTheme === 'dark');
    localStorage.setItem('theme', this.currentTheme);
  }

  public getCurrentTheme(): 'light' | 'dark' {
    return this.currentTheme;
  }

  private applyTheme(theme: 'light' | 'dark'): void {
    if (!browser) return;

    const html = document.documentElement;
    
    if (theme === 'dark') {
      html.setAttribute('data-theme', 'dark');
      html.classList.add('dark');
    } else {
      html.removeAttribute('data-theme');
      html.classList.remove('dark');
    }

    // Update ArcGIS theme
    this.updateArcGISTheme(theme);
  }

  private updateArcGISTheme(theme: 'light' | 'dark'): void {
    if (!browser) return;

    // Update ArcGIS CSS import
    const existingLink = document.querySelector('link[href*="esri/themes"]');
    if (existingLink) {
      existingLink.remove();
    }

    const newLink = document.createElement('link');
    newLink.rel = 'stylesheet';
    newLink.href = theme === 'dark' 
      ? 'https://js.arcgis.com/4.32/esri/themes/dark/main.css'
      : 'https://js.arcgis.com/4.32/esri/themes/light/main.css';
    
    document.head.appendChild(newLink);
  }

  public isDarkMode(): boolean {
    return this.currentTheme === 'dark';
  }
}

// Export singleton instance
export const darkModeManager = DarkModeManager.getInstance();

// Utility functions
export function toggleDarkMode(): void {
  darkModeManager.toggleTheme();
}

export function setDarkMode(enabled: boolean): void {
  darkModeManager.setTheme(enabled ? 'dark' : 'light');
}

export function getDarkMode(): boolean {
  return darkModeManager.isDarkMode();
}
