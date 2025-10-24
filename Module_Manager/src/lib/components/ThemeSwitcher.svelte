<script lang="ts">
  import { themeStore, type ThemeMode } from '$lib/stores/themeStore';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  let mounted = false;
  let showDropdown = false;

  onMount(() => {
    mounted = true;
  });

  function handleThemeSelect(mode: ThemeMode) {
    themeStore.setMode(mode);
    showDropdown = false;
  }

  function toggleDropdown() {
    showDropdown = !showDropdown;
  }

  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.theme-switcher')) {
      showDropdown = false;
    }
  }

  // Handle click outside with proper browser guards
  $: if (browser && mounted) {
    if (showDropdown) {
      document.addEventListener('click', handleClickOutside);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }
  }

  onDestroy(() => {
    if (browser) {
      document.removeEventListener('click', handleClickOutside);
    }
  });
</script>

<div class="theme-switcher">
  <button
    class="theme-button"
    on:click={toggleDropdown}
    aria-label="Toggle theme"
    title="Change theme"
  >
    {#if mounted}
      {#if $themeStore.resolved === 'dark'}
        <!-- Moon icon for dark mode -->
        <svg
          class="icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      {:else}
        <!-- Sun icon for light mode -->
        <svg
          class="icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      {/if}
    {/if}
  </button>

  {#if showDropdown && mounted}
    <div class="dropdown">
      <button
        class="dropdown-item"
        class:active={$themeStore.mode === 'light'}
        on:click={() => handleThemeSelect('light')}
      >
        <svg
          class="dropdown-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
        <span>Light</span>
        {#if $themeStore.mode === 'light'}
          <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        {/if}
      </button>

      <button
        class="dropdown-item"
        class:active={$themeStore.mode === 'dark'}
        on:click={() => handleThemeSelect('dark')}
      >
        <svg
          class="dropdown-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <span>Dark</span>
        {#if $themeStore.mode === 'dark'}
          <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        {/if}
      </button>

      <button
        class="dropdown-item"
        class:active={$themeStore.mode === 'system'}
        on:click={() => handleThemeSelect('system')}
      >
        <svg
          class="dropdown-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
        <span>System</span>
        {#if $themeStore.mode === 'system'}
          <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        {/if}
      </button>
    </div>
  {/if}
</div>

<style>
  .theme-switcher {
    position: relative;
  }

  .theme-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--card-bg);
    color: var(--text-primary);
    cursor: pointer;
    transition: var(--transition);
    box-shadow: var(--shadow-sm);
  }

  .theme-button:hover {
    background: var(--hover-bg);
    border-color: var(--primary);
    color: var(--primary);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .theme-button:active {
    transform: translateY(0);
    box-shadow: var(--shadow-sm);
  }

  .icon {
    transition: var(--transition);
  }

  .dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: var(--spacing-xs);
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    min-width: 160px;
    overflow: hidden;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: none;
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    transition: var(--transition);
    text-align: left;
    font-size: 0.875rem;
  }

  .dropdown-item:hover {
    background: var(--hover-bg);
  }

  .dropdown-item.active {
    background: var(--primary-light);
    color: var(--primary);
  }

  .dropdown-icon {
    flex-shrink: 0;
  }

  .check-icon {
    margin-left: auto;
    color: var(--primary);
  }
</style>
