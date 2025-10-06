<script lang="ts">
  import { page } from '$app/stores';
  
  // Main menu items based on GenieACS structure
  const mainMenuItems = [
    {
      id: 'overview',
      name: 'Overview',
      icon: '📊',
      description: 'System overview and statistics',
      path: '/modules/acs-cpe-management'
    },
    {
      id: 'devices',
      name: 'Devices',
      icon: '📱',
      description: 'CPE device management and monitoring',
      path: '/modules/acs-cpe-management/devices'
    },
    {
      id: 'faults',
      name: 'Faults',
      icon: '⚠️',
      description: 'Device faults and error management',
      path: '/modules/acs-cpe-management/faults'
    },
    {
      id: 'admin',
      name: 'Administration',
      icon: '⚙️',
      description: 'System configuration and management',
      path: '/modules/acs-cpe-management/admin'
    }
  ];

  function isActive(path: string): boolean {
    return $page.url.pathname === path || 
           ($page.url.pathname.startsWith(path) && path !== '/modules/acs-cpe-management');
  }
</script>

<nav class="main-menu">
  <ul class="menu-items">
    {#each mainMenuItems as item}
      <li class="menu-item" class:active={isActive(item.path)}>
        <a href={item.path} class="menu-link">
          <div class="menu-icon">{item.icon}</div>
          <div class="menu-content">
            <div class="menu-name">{item.name}</div>
            <div class="menu-description">{item.description}</div>
          </div>
        </a>
      </li>
    {/each}
  </ul>
</nav>

<style>
  .main-menu {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 2rem;
  }

  .menu-items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    gap: 1rem;
    overflow-x: auto;
  }

  .menu-item {
    flex-shrink: 0;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    transition: all 0.2s ease;
    min-width: 200px;
  }

  .menu-item:hover {
    border-color: var(--accent-color);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .menu-item.active {
    border-color: var(--accent-color);
    background: var(--accent-color);
    color: white;
  }

  .menu-item.active .menu-name {
    color: white;
  }

  .menu-item.active .menu-description {
    color: rgba(255, 255, 255, 0.8);
  }

  .menu-link {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    text-decoration: none;
    color: inherit;
    height: 100%;
  }

  .menu-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .menu-content {
    flex: 1;
  }

  .menu-name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .menu-description {
    font-size: 0.75rem;
    color: var(--text-secondary);
    line-height: 1.3;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .menu-items {
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .menu-item {
      min-width: auto;
    }
    
    .menu-link {
      padding: 0.75rem;
    }
    
    .menu-icon {
      font-size: 1.25rem;
    }
  }
</style>
