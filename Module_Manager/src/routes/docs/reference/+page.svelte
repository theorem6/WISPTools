<script lang="ts">
  import { goto } from '$app/navigation';
</script>

<svelte:head>
  <title>Reference – WISPTools Docs</title>
</svelte:head>

<h1>Reference</h1>
<p>Reference documentation for status, deployment, and planning.</p>

<ul class="ref-list">
  <li><a href="/docs/reference/project-status">Project Status & Next Steps</a> – Where the project stands and prioritized next items.</li>
</ul>

<style>
  .ref-list {
    list-style: none;
    padding: 0;
  }
  .ref-list li {
    margin-bottom: 0.75rem;
  }
  .ref-list a {
    color: var(--primary-color);
    text-decoration: none;
  }
  .ref-list a:hover {
    text-decoration: underline;
  }
</style>
