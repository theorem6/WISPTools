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
      id: 'monitoring',
      name: 'Monitoring',
      icon: '📈',
      description: 'Per-device TR-069 metrics and analysis',
      path: '/modules/acs-cpe-management/monitoring'
    },
    {
      id: 'graphs',
      name: 'Graphs',
      icon: '📊',
      description: 'Multi-device comparison and charts',
      path: '/modules/acs-cpe-management/graphs'
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
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 0.75rem;
  }

  .menu-item {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    transition: all 0.2s ease;
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
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .menu-description {
    font-size: 0.7rem;
    color: var(--text-secondary);
    line-height: 1.3;
  }

  /* Responsive design */
  @media (max-width: 1200px) {
    .menu-items {
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.5rem;
    }

    .menu-link {
      padding: 0.75rem;
      gap: 0.75rem;
    }

    .menu-icon {
      font-size: 1.25rem;
    }

    .menu-name {
      font-size: 0.875rem;
    }

    .menu-description {
      font-size: 0.65rem;
    }
  }

  @media (max-width: 768px) {
    .menu-items {
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
    }
    
    .menu-link {
      padding: 0.75rem 0.5rem;
      gap: 0.5rem;
    }
    
    .menu-icon {
      font-size: 1.125rem;
    }

    .menu-name {
      font-size: 0.8rem;
    }

    .menu-description {
      display: none;
    }
  }

  @media (max-width: 480px) {
    .menu-items {
      grid-template-columns: 1fr;
    }

    .menu-description {
      display: block;
      font-size: 0.7rem;
    }
  }
</style>
