<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { authStore, currentUser, isAuthenticated } from '../stores/authStore';
  import { authService } from '../services/authService';
  
  const dispatch = createEventDispatcher();
  
  let showDropdown = false;
  
  function toggleDropdown() {
    showDropdown = !showDropdown;
  }
  
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-profile')) {
      showDropdown = false;
    }
  }
  
  $: if (browser) {
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
  
  function handleSignIn() {
    dispatch('signIn');
    showDropdown = false;
  }
  
  function handleNetworks() {
    dispatch('networks');
    showDropdown = false;
  }
  
  async function handleSignOut() {
    showDropdown = false;
    await authService.signOut();
  }
  
  function getInitials(name: string | undefined, email: string): string {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }
    return email[0].toUpperCase();
  }
</script>

<div class="user-profile">
  {#if $isAuthenticated && $currentUser}
    <button class="profile-button" on:click={toggleDropdown}>
      <div class="avatar">
        {#if $currentUser.photoURL}
          <img src={$currentUser.photoURL} alt={$currentUser.displayName || $currentUser.email} />
        {:else}
          <span class="initials">{getInitials($currentUser.displayName, $currentUser.email)}</span>
        {/if}
      </div>
      <span class="user-name">{$currentUser.displayName || $currentUser.email.split('@')[0]}</span>
    </button>
    
    {#if showDropdown}
      <div class="dropdown-menu">
        <div class="user-info">
          <div class="user-email">{$currentUser.email}</div>
        </div>
        
        <div class="dropdown-divider"></div>
        
        <button class="dropdown-item" on:click={handleNetworks}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          My Networks
        </button>
        
        <div class="dropdown-divider"></div>
        
        <button class="dropdown-item danger" on:click={handleSignOut}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          Sign Out
        </button>
      </div>
    {/if}
  {:else}
    <button class="sign-in-btn" on:click={handleSignIn}>
      Sign In
    </button>
  {/if}
</div>

<style>
  .user-profile {
    position: relative;
  }

  .profile-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 36px;
    padding: 0 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 18px;
    background: var(--card-bg);
    cursor: pointer;
    transition: all var(--transition);
  }

  .profile-button:hover {
    background: var(--hover-bg);
    box-shadow: var(--shadow-sm);
  }

  .avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .initials {
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .user-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sign-in-btn {
    height: 36px;
    padding: 0 1.25rem;
    border: 1px solid var(--primary-color);
    border-radius: 18px;
    background: var(--primary-color);
    color: white;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition);
  }

  .sign-in-btn:hover {
    background: var(--button-primary-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    min-width: 220px;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    box-shadow: var(--shadow-xl);
    padding: 0.5rem;
    z-index: 1000;
    animation: slideDown var(--transition-fast);
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .user-info {
    padding: 0.75rem;
  }

  .user-email {
    font-size: 0.85rem;
    color: var(--text-secondary);
    word-break: break-word;
  }

  .dropdown-divider {
    height: 1px;
    background: var(--border-color);
    margin: 0.5rem 0;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: none;
    border-radius: var(--border-radius);
    background: transparent;
    color: var(--text-primary);
    font-size: 0.9rem;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .dropdown-item:hover {
    background: var(--hover-bg);
  }

  .dropdown-item.danger {
    color: var(--danger-color);
  }

  .dropdown-item.danger:hover {
    background: var(--danger-light);
  }

  @media (max-width: 640px) {
    .user-name {
      display: none;
    }

    .profile-button {
      padding: 0 0.5rem;
    }
  }
</style>

