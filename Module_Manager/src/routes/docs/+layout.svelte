<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  const nav = [
    { label: 'Docs Home', path: '/docs' },
    { label: 'Getting Started', path: '/docs/getting-started' },
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
