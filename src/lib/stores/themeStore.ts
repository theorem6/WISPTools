// Centralized Theme Management Store
import { writable, derived, type Writable } from 'svelte/store';
import { browser } from '$app/environment';

// ============================================================================
// Theme Types
// ============================================================================

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeState {
  mode: ThemeMode;              // User preference: 'light', 'dark', or 'system'
  resolved: ResolvedTheme;      // Actual theme applied: 'light' or 'dark'
  systemPreference: ResolvedTheme; // System's preferred theme
}

// ============================================================================
// Initial State
// ============================================================================

const getSystemPreference = (): ResolvedTheme => {
  if (!browser) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getSavedThemeMode = (): ThemeMode => {
  if (!browser) return 'system';
  const saved = localStorage.getItem('theme-mode');
  if (saved === 'light' || saved === 'dark' || saved === 'system') {
    return saved;
  }
  return 'system';
};

const resolveTheme = (mode: ThemeMode, systemPreference: ResolvedTheme): ResolvedTheme => {
  return mode === 'system' ? systemPreference : mode;
};

// ============================================================================
// Theme Store
// ============================================================================

function createThemeStore() {
  const systemPreference = getSystemPreference();
  const mode = getSavedThemeMode();
  const resolved = resolveTheme(mode, systemPreference);

  const { subscribe, set, update }: Writable<ThemeState> = writable({
    mode,
    resolved,
    systemPreference,
  });

  return {
    subscribe,
    
    /**
     * Set theme mode (light, dark, or system)
     */
    setMode: (newMode: ThemeMode) => {
      update(state => {
        const resolved = resolveTheme(newMode, state.systemPreference);
        
        // Save preference
        if (browser) {
          localStorage.setItem('theme-mode', newMode);
        }
        
        return {
          ...state,
          mode: newMode,
          resolved,
        };
      });
    },
    
    /**
     * Toggle between light and dark (skips system)
     */
    toggle: () => {
      update(state => {
        const newMode: ThemeMode = state.resolved === 'light' ? 'dark' : 'light';
        
        if (browser) {
          localStorage.setItem('theme-mode', newMode);
        }
        
        return {
          ...state,
          mode: newMode,
          resolved: newMode,
        };
      });
    },
    
    /**
     * Update system preference (called when system theme changes)
     */
    updateSystemPreference: (newPreference: ResolvedTheme) => {
      update(state => {
        const resolved = resolveTheme(state.mode, newPreference);
        return {
          ...state,
          systemPreference: newPreference,
          resolved,
        };
      });
    },
    
    /**
     * Reset to initial state
     */
    reset: () => {
      if (browser) {
        localStorage.removeItem('theme-mode');
      }
      const systemPreference = getSystemPreference();
      set({
        mode: 'system',
        resolved: systemPreference,
        systemPreference,
      });
    },
  };
}

export const themeStore = createThemeStore();

// ============================================================================
// Derived Stores
// ============================================================================

export const isDarkMode = derived(
  themeStore,
  ($theme) => $theme.resolved === 'dark'
);

export const isLightMode = derived(
  themeStore,
  ($theme) => $theme.resolved === 'light'
);

export const isSystemMode = derived(
  themeStore,
  ($theme) => $theme.mode === 'system'
);

// ============================================================================
// Theme Manager Class
// ============================================================================

export class ThemeManager {
  private static instance: ThemeManager;
  private unsubscribe?: () => void;
  private mediaQuery?: MediaQueryList;

  private constructor() {
    if (browser) {
      this.initialize();
    }
  }

  public static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  private initialize(): void {
    // Apply initial theme
    this.applyTheme(resolveTheme(getSavedThemeMode(), getSystemPreference()));

    // Subscribe to theme changes
    this.unsubscribe = themeStore.subscribe(state => {
      this.applyTheme(state.resolved);
    });

    // Listen for system theme changes
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQuery.addEventListener('change', this.handleSystemThemeChange);
  }

  private handleSystemThemeChange = (e: MediaQueryListEvent) => {
    const newPreference: ResolvedTheme = e.matches ? 'dark' : 'light';
    themeStore.updateSystemPreference(newPreference);
  };

  private applyTheme(theme: ResolvedTheme): void {
    if (!browser) return;

    const html = document.documentElement;
    
    // Apply theme attribute
    html.setAttribute('data-theme', theme);
    
    // Apply theme class
    if (theme === 'dark') {
      html.classList.add('dark');
      html.classList.remove('light');
    } else {
      html.classList.add('light');
      html.classList.remove('dark');
    }

    // Update meta theme-color
    this.updateMetaThemeColor(theme);
    
    // Update ArcGIS theme
    this.updateArcGISTheme(theme);
  }

  private updateMetaThemeColor(theme: ResolvedTheme): void {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const color = theme === 'dark' ? '#1e293b' : '#ffffff';
      metaThemeColor.setAttribute('content', color);
    }
  }

  private updateArcGISTheme(theme: ResolvedTheme): void {
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

  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    if (this.mediaQuery) {
      this.mediaQuery.removeEventListener('change', this.handleSystemThemeChange);
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

export const setTheme = (mode: ThemeMode) => themeStore.setMode(mode);
export const toggleTheme = () => themeStore.toggle();
export const resetTheme = () => themeStore.reset();

// Initialize theme manager singleton
export const themeManager = browser ? ThemeManager.getInstance() : null;

