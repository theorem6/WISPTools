<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  
  export let items: Array<{ label: string; path?: string }> = [];
  
  // Default home item
  const homeItem = { label: 'Admin Management', path: '/admin/management' };
  
  // Get current path to determine active item
  $: currentPath = $page.url.pathname;
  
  function handleClick(path: string | undefined) {
    if (path) {
      goto(path);
    }
  }
</script>

<nav class="breadcrumb">
  <ol class="breadcrumb-list">
    <!-- Home/Admin Management link -->
    <li class="breadcrumb-item">
      <a 
        href={homeItem.path} 
        class="breadcrumb-link"
        class:active={currentPath === homeItem.path}
        on:click|preventDefault={() => handleClick(homeItem.path)}
      >
        <span class="breadcrumb-icon">⚙️</span>
        {homeItem.label}
      </a>
    </li>
    
    <!-- Additional breadcrumb items -->
    {#each items as item, index}
      <li class="breadcrumb-separator">/</li>
      <li class="breadcrumb-item">
        {#if item.path && index < items.length - 1}
          <a 
            href={item.path} 
            class="breadcrumb-link"
            class:active={currentPath === item.path}
            on:click|preventDefault={() => handleClick(item.path)}
          >
            {item.label}
          </a>
        {:else}
          <span class="breadcrumb-current">{item.label}</span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>

<style>
  .breadcrumb {
    margin-bottom: var(--spacing-md, 1rem);
  }
  
  .breadcrumb-list {
    display: flex;
    align-items: center;
    list-style: none;
    margin: 0;
    padding: 0;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  
  .breadcrumb-item {
    display: flex;
    align-items: center;
  }
  
  .breadcrumb-separator {
    color: var(--text-secondary, #6b7280);
    margin: 0 0.5rem;
    user-select: none;
  }
  
  .breadcrumb-link {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    color: var(--text-secondary, #6b7280);
    text-decoration: none;
    font-size: 0.875rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  .breadcrumb-link:hover {
    color: var(--primary-color, #3b82f6);
    background: var(--hover-bg, rgba(59, 130, 246, 0.1));
  }
  
  .breadcrumb-link.active {
    color: var(--primary-color, #3b82f6);
    font-weight: 500;
  }
  
  .breadcrumb-current {
    color: var(--text-primary, #111827);
    font-size: 0.875rem;
    font-weight: 500;
    padding: 0.25rem 0.5rem;
  }
  
  .breadcrumb-icon {
    font-size: 1rem;
  }
</style>

