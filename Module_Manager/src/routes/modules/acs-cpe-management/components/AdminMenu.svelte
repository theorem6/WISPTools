<script lang="ts">
  import { page } from '$app/stores';
  
  // Admin menu items based on GenieACS structure
  const adminMenuItems = [
    {
      id: 'presets',
      name: 'Presets',
      icon: '⚙️',
      description: 'Device provisioning presets and templates',
      path: '/modules/acs-cpe-management/admin/presets'
    },
    {
      id: 'provisions',
      name: 'Provisions',
      icon: '📜',
      description: 'JavaScript provisioning scripts',
      path: '/modules/acs-cpe-management/admin/provisions'
    },
    {
      id: 'virtualParameters',
      name: 'Virtual Parameters',
      icon: '🔧',
      description: 'Custom parameter definitions',
      path: '/modules/acs-cpe-management/admin/virtual-parameters'
    },
    {
      id: 'files',
      name: 'Files',
      icon: '📁',
      description: 'Firmware and configuration files',
      path: '/modules/acs-cpe-management/admin/files'
    },
    {
      id: 'config',
      name: 'Configuration',
      icon: '🔨',
      description: 'System configuration settings',
      path: '/modules/acs-cpe-management/admin/config'
    },
    {
      id: 'users',
      name: 'Users',
      icon: '👥',
      description: 'User management and permissions',
      path: '/modules/acs-cpe-management/admin/users'
    }
  ];

  function isActive(path: string): boolean {
    return $page.url.pathname === path;
  }
</script>

<nav class="admin-menu">
  <div class="menu-header">
    <h3>Administration</h3>
    <p>Manage ACS configuration and devices</p>
  </div>
  
  <ul class="menu-items">
    {#each adminMenuItems as item}
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
  .admin-menu {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .menu-header {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
  }

  .menu-header h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    color: var(--text-primary);
  }

  .menu-header p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .menu-items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
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
    padding: 1.5rem;
    text-decoration: none;
    color: inherit;
    height: 100%;
  }

  .menu-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .menu-content {
    flex: 1;
  }

  .menu-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .menu-description {
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .menu-items {
      grid-template-columns: 1fr;
    }
    
    .menu-link {
      padding: 1rem;
    }
    
    .menu-icon {
      font-size: 1.5rem;
    }
  }
</style>
