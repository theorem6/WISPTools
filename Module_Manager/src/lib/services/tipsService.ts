/**
 * Tips Service
 * Manages tips modal display and dismissal state
 */

import { browser } from '$app/environment';

const STORAGE_KEY = 'wisp_tips_dismissed';
const STORAGE_VERSION = '1';

interface DismissedTips {
  version: string;
  modules: Record<string, boolean>;
}

class TipsService {
  private dismissedTips: DismissedTips;

  constructor() {
    this.dismissedTips = this.loadDismissedTips();
  }

  private loadDismissedTips(): DismissedTips {
    if (!browser) {
      return { version: STORAGE_VERSION, modules: {} };
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Migrate old format if needed
        if (parsed.version !== STORAGE_VERSION) {
          return { version: STORAGE_VERSION, modules: {} };
        }
        return parsed;
      }
    } catch (error) {
      console.error('[TipsService] Error loading dismissed tips:', error);
    }

    return { version: STORAGE_VERSION, modules: {} };
  }

  private saveDismissedTips(): void {
    if (!browser) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.dismissedTips));
    } catch (error) {
      console.error('[TipsService] Error saving dismissed tips:', error);
    }
  }

  /**
   * Check if tips should be shown for a module
   */
  shouldShowTips(moduleId: string): boolean {
    return !this.dismissedTips.modules[moduleId];
  }

  /**
   * Dismiss tips for a module (don't show again)
   */
  dismissTips(moduleId: string): void {
    this.dismissedTips.modules[moduleId] = true;
    this.saveDismissedTips();
  }

  /**
   * Reset dismissed tips for a module (show again)
   */
  resetTips(moduleId: string): void {
    delete this.dismissedTips.modules[moduleId];
    this.saveDismissedTips();
  }

  /**
   * Reset all dismissed tips
   */
  resetAllTips(): void {
    this.dismissedTips.modules = {};
    this.saveDismissedTips();
  }

  /**
   * Check if tips are dismissed for a module
   */
  isDismissed(moduleId: string): boolean {
    return !!this.dismissedTips.modules[moduleId];
  }
}

export const tipsService = new TipsService();

/**
 * Tips Service
 * Manages tips modal display and dismissal state
 */

import { browser } from '$app/environment';

const STORAGE_KEY = 'wisp_tips_dismissed';
const STORAGE_VERSION = '1';

interface DismissedTips {
  version: string;
  modules: Record<string, boolean>;
}

class TipsService {
  private dismissedTips: DismissedTips;

  constructor() {
    this.dismissedTips = this.loadDismissedTips();
  }

  private loadDismissedTips(): DismissedTips {
    if (!browser) {
      return { version: STORAGE_VERSION, modules: {} };
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Migrate old format if needed
        if (parsed.version !== STORAGE_VERSION) {
          return { version: STORAGE_VERSION, modules: {} };
        }
        return parsed;
      }
    } catch (error) {
      console.error('[TipsService] Error loading dismissed tips:', error);
    }

    return { version: STORAGE_VERSION, modules: {} };
  }

  private saveDismissedTips(): void {
    if (!browser) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.dismissedTips));
    } catch (error) {
      console.error('[TipsService] Error saving dismissed tips:', error);
    }
  }

  /**
   * Check if tips should be shown for a module
   */
  shouldShowTips(moduleId: string): boolean {
    return !this.dismissedTips.modules[moduleId];
  }

  /**
   * Dismiss tips for a module (don't show again)
   */
  dismissTips(moduleId: string): void {
    this.dismissedTips.modules[moduleId] = true;
    this.saveDismissedTips();
  }

  /**
   * Reset dismissed tips for a module (show again)
   */
  resetTips(moduleId: string): void {
    delete this.dismissedTips.modules[moduleId];
    this.saveDismissedTips();
  }

  /**
   * Reset all dismissed tips
   */
  resetAllTips(): void {
    this.dismissedTips.modules = {};
    this.saveDismissedTips();
  }

  /**
   * Check if tips are dismissed for a module
   */
  isDismissed(moduleId: string): boolean {
    return !!this.dismissedTips.modules[moduleId];
  }
}

export const tipsService = new TipsService();

/**
 * Tips Service
 * Manages tips modal display and dismissal state
 */

import { browser } from '$app/environment';

const STORAGE_KEY = 'wisp_tips_dismissed';
const STORAGE_VERSION = '1';

interface DismissedTips {
  version: string;
  modules: Record<string, boolean>;
}

class TipsService {
  private dismissedTips: DismissedTips;

  constructor() {
    this.dismissedTips = this.loadDismissedTips();
  }

  private loadDismissedTips(): DismissedTips {
    if (!browser) {
      return { version: STORAGE_VERSION, modules: {} };
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Migrate old format if needed
        if (parsed.version !== STORAGE_VERSION) {
          return { version: STORAGE_VERSION, modules: {} };
        }
        return parsed;
      }
    } catch (error) {
      console.error('[TipsService] Error loading dismissed tips:', error);
    }

    return { version: STORAGE_VERSION, modules: {} };
  }

  private saveDismissedTips(): void {
    if (!browser) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.dismissedTips));
    } catch (error) {
      console.error('[TipsService] Error saving dismissed tips:', error);
    }
  }

  /**
   * Check if tips should be shown for a module
   */
  shouldShowTips(moduleId: string): boolean {
    return !this.dismissedTips.modules[moduleId];
  }

  /**
   * Dismiss tips for a module (don't show again)
   */
  dismissTips(moduleId: string): void {
    this.dismissedTips.modules[moduleId] = true;
    this.saveDismissedTips();
  }

  /**
   * Reset dismissed tips for a module (show again)
   */
  resetTips(moduleId: string): void {
    delete this.dismissedTips.modules[moduleId];
    this.saveDismissedTips();
  }

  /**
   * Reset all dismissed tips
   */
  resetAllTips(): void {
    this.dismissedTips.modules = {};
    this.saveDismissedTips();
  }

  /**
   * Check if tips are dismissed for a module
   */
  isDismissed(moduleId: string): boolean {
    return !!this.dismissedTips.modules[moduleId];
  }
}

export const tipsService = new TipsService();







