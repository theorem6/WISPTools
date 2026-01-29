<script lang="ts">
  import { projectStatusTitle, projectStatusContent } from '$lib/docs/project-status-docs';
</script>

<svelte:head>
  <title>{projectStatusTitle} – WISPTools Docs</title>
</svelte:head>

<article class="doc-article">
  <h1>{projectStatusTitle}</h1>
  <p class="intro">This page summarizes where the project stands and what to work on next. For the full lists, see the markdown files in the repository <code>docs/</code> folder.</p>
  <div class="doc-body">
    {@html projectStatusContent}
  </div>
</article>

<style>
  .doc-article {
    color: var(--text-primary);
  }
  .intro {
    margin-bottom: 1.5rem;
    color: var(--text-secondary);
  }
  .doc-body {
    line-height: 1.6;
  }
  .doc-body :global(h2) {
    font-size: 1.35rem;
    margin-top: 2rem;
    margin-bottom: 0.75rem;
  }
  .doc-body :global(h3) {
    font-size: 1.15rem;
    margin-top: 1.25rem;
    margin-bottom: 0.5rem;
  }
  .doc-body :global(ul),
  .doc-body :global(ol) {
    padding-left: 1.5rem;
    margin: 0.75rem 0;
  }
  .doc-body :global(li) {
    margin-bottom: 0.35rem;
  }
  .doc-body :global(code) {
    background: var(--bg-secondary);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-size: 0.9em;
  }
  .doc-body :global(a) {
    color: var(--primary-color);
    text-decoration: none;
  }
  .doc-body :global(a:hover) {
    text-decoration: underline;
  }
</style>
