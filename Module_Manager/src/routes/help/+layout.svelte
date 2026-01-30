<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { authService } from '$lib/services/authService';

  let checking = true;

  onMount(async () => {
    if (!browser) {
      checking = false;
      return;
    }
    // Wait for Firebase auth to initialize (same pattern as TenantGuard)
    let currentUser = authService.getCurrentUser();
    if (!currentUser) {
      let retries = 0;
      const maxRetries = 5;
      while (!currentUser && retries < maxRetries) {
        await new Promise((r) => setTimeout(r, 100));
        currentUser = authService.getCurrentUser();
        retries++;
      }
    }
    if (!currentUser) {
      await goto('/login', { replaceState: true });
      return;
    }
    checking = false;
  });
</script>

{#if checking}
  <div class="help-auth-check">
    <div class="spinner"></div>
    <p>Checking authentication...</p>
  </div>
{:else}
  <slot />
{/if}

<style>
  .help-auth-check {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--color-background-primary, #f1f5f9);
  }
  .help-auth-check .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--color-border, #e2e8f0);
    border-top-color: var(--color-primary, #3b82f6);
    border-radius: 50%;
    animation: help-spin 1s linear infinite;
    margin-bottom: 1rem;
  }
  @keyframes help-spin {
    to { transform: rotate(360deg); }
  }
  .help-auth-check p {
    color: var(--color-text-secondary, #475569);
    font-size: 0.875rem;
  }
</style>
