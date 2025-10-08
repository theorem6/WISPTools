<script lang="ts">
  import { isDarkMode, toggleDarkMode } from '$lib/darkMode';
  import { onMount } from 'svelte';

  let mounted = false;

  onMount(() => {
    mounted = true;
  });

  function handleToggle() {
    toggleDarkMode();
  }
</script>

<button
  class="dark-mode-toggle"
  on:click={handleToggle}
  aria-label="Toggle dark mode"
  title="Toggle dark mode"
>
  {#if mounted}
    {#if $isDarkMode}
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
    {:else}
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
    {/if}
  {/if}
</button>

<style>
  .dark-mode-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: var(--card-bg);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--border-color);
  }

  .dark-mode-toggle:hover {
    background: var(--hover-bg);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .dark-mode-toggle:active {
    transform: translateY(0);
  }

  .icon {
    transition: transform 0.3s ease;
  }

  .dark-mode-toggle:hover .icon {
    transform: scale(1.1);
  }
</style>
