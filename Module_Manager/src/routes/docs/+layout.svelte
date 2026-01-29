<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  const nav = [
    { label: 'Docs Home', path: '/docs' },
    { label: 'Getting Started', path: '/docs/getting-started' },
    { label: 'Deployment', path: '/docs/deployment' },
    { label: 'Reference', path: '/docs/reference' },
    { label: 'Project Status & Next Steps', path: '/docs/reference/project-status' },
    { label: 'Help (by topic)', path: '/help' },
    { label: 'Wizards', path: '/wizards' }
  ];
</script>

<div class="docs-layout">
  <aside class="docs-sidebar">
    <a href="/dashboard" class="back-link">← Back to App</a>
    <nav aria-label="Documentation">
      <ul>
        {#each nav as item}
          <li>
            <a
              href={item.path}
              class:active={$page.url.pathname === item.path}
            >{item.label}</a>
          </li>
        {/each}
      </ul>
    </nav>
  </aside>
  <main class="docs-main">
    <slot />
  </main>
</div>

<style>
  .docs-layout {
    display: grid;
    grid-template-columns: 240px 1fr;
    min-height: 100vh;
    background: var(--bg-primary);
  }
  .docs-sidebar {
    background: var(--card-bg);
    border-right: 1px solid var(--border-color);
    padding: 1.5rem 1rem;
    position: sticky;
    top: 0;
    height: 100vh;
  }
  .back-link {
    display: block;
    margin-bottom: 1.5rem;
    color: var(--primary-color);
    text-decoration: none;
    font-weight: 500;
  }
  .back-link:hover {
    text-decoration: underline;
  }
  .docs-sidebar ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .docs-sidebar li {
    margin-bottom: 0.25rem;
  }
  .docs-sidebar a {
    display: block;
    padding: 0.5rem 0.75rem;
    color: var(--text-primary);
    text-decoration: none;
    border-radius: var(--radius-md);
  }
  .docs-sidebar a:hover {
    background: var(--bg-secondary);
  }
  .docs-sidebar a.active {
    background: var(--primary-color);
    color: var(--text-inverse);
  }
  .docs-main {
    padding: 2rem;
    max-width: 900px;
  }
  @media (max-width: 768px) {
    .docs-layout {
      grid-template-columns: 1fr;
    }
    .docs-sidebar {
      position: relative;
      height: auto;
    }
  }
</style>
