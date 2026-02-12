<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { isCurrentUserAdmin } from '$lib/services/adminService';
  
  let isAdmin = false;
  
  onMount(() => {
    // Check if current user is platform admin
    isAdmin = isCurrentUserAdmin();
  });
  
  // Main menu items based on GenieACS structure
  const mainMenuItems = [
    {
      id: 'overview',
      name: 'Overview',
      icon: '📊',
      description: 'System overview and statistics',
      path: '/modules/acs-cpe-management',
      adminOnly: false
    },
    {
      id: 'devices',
      name: 'Devices',
      icon: '📱',
      description: 'CPE device management and monitoring',
      path: '/modules/acs-cpe-management/devices',
      adminOnly: false
    },
    {
      id: 'tasks',
      name: 'Task Queue',
      icon: '📋',
      description: 'TR-069 task queue and pending operations',
      path: '/modules/acs-cpe-management/tasks',
      adminOnly: false
    },
    {
      id: 'presets',
      name: 'Presets',
      icon: '⚙️',
      description: 'Configuration presets and templates',
      path: '/modules/acs-cpe-management/presets',
      adminOnly: false
    },
    {
      id: 'alerts',
      name: 'Alerts',
      icon: '🚨',
      description: 'Alert rules and notifications',
      path: '/modules/acs-cpe-management/alerts',
      adminOnly: false
    },
    {
      id: 'firmware',
      name: 'Firmware',
      icon: '💾',
      description: 'Firmware version tracking and upgrades',
      path: '/modules/acs-cpe-management/firmware',
      adminOnly: false
    },
    {
      id: 'files',
      name: 'Files',
      icon: '📁',
      description: 'Upload firmware and configuration files',
      path: '/modules/acs-cpe-management/files',
      adminOnly: false
    },
    {
      id: 'faults',
      name: 'Faults',
      icon: '⚠️',
      description: 'Device faults and error management',
      path: '/modules/acs-cpe-management/faults',
      adminOnly: false
    },
    {
      id: 'monitoring',
      name: 'Monitoring',
      icon: '📈',
      description: 'Per-device TR-069 metrics and analysis',
      path: '/modules/acs-cpe-management/monitoring',
      adminOnly: false
    },
    {
      id: 'graphs',
      name: 'Graphs',
      icon: '📊',
      description: 'Multi-device comparison and charts',
      path: '/modules/acs-cpe-management/graphs',
      adminOnly: false
    },
    {
      id: 'settings',
      name: 'ACS Settings',
      icon: '⚙️',
      description: 'Device management configuration for your tenant',
      path: '/modules/acs-cpe-management/settings',
      adminOnly: false
    },
    {
      id: 'admin',
      name: 'Administration',
      icon: '🔐',
      description: 'System configuration (Admin Only)',
      path: '/modules/acs-cpe-management/admin',
      adminOnly: true
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
      {#if !item.adminOnly || (item.adminOnly && isAdmin)}
        <li class="menu-item" class:active={isActive(item.path)} class:admin-item={item.adminOnly}>
          <a href={item.path} class="menu-link">
            <div class="menu-icon">{item.icon}</div>
            <div class="menu-content">
              <div class="menu-name">{item.name}</div>
              <div class="menu-description">{item.description}</div>
            </div>
            {#if item.adminOnly}
              <div class="admin-badge">🔐</div>
            {/if}
          </a>
        </li>
      {/if}
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

  .menu-item.admin-item {
    border: 2px solid rgba(239, 68, 68, 0.3);
  }

  .menu-item.admin-item:hover {
    border-color: #ef4444;
  }

  .menu-item.admin-item.active {
    border-color: #ef4444;
    background: #ef4444;
  }

  .admin-badge {
    font-size: 1rem;
    opacity: 0.8;
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
