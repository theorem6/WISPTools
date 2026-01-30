<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { customerAuthService } from '$lib/services/customerAuthService';
  import { getApiUrl } from '$lib/config/api';

  type Article = { _id: string; title: string; content: string; category?: string };
  let article: Article | null = null;
  let loading = true;
  let error = '';

  $: articleId = $page.params.id;

  onMount(async () => {
    const customer = await customerAuthService.getCurrentCustomer();
    if (!customer) {
      goto('/modules/customers/portal/login');
      return;
    }
    if (!articleId) {
      error = 'Invalid article';
      loading = false;
      return;
    }
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/portal-content/${customer.tenantId}/knowledge-base/${articleId}`);
      if (!res.ok) {
        error = 'Article not found';
        return;
      }
      article = await res.json();
    } catch (_) {
      error = 'Failed to load article';
    } finally {
      loading = false;
    }
  });
</script>

{#if loading}
  <div class="loading">Loading article...</div>
{:else if error || !article}
  <div class="error">{error || 'Article not found'}</div>
  <a href="/modules/customers/portal/knowledge" class="back-link">← Back to Knowledge Base</a>
{:else}
  <article class="article-page">
    <a href="/modules/customers/portal/knowledge" class="back-link">← Back to Knowledge Base</a>
    <header>
      <h1>{article.title}</h1>
      {#if article.category}<span class="category">{article.category}</span>{/if}
    </header>
    <div class="content">{article.content || ''}</div>
  </article>
{/if}

<style>
  .article-page {
    max-width: 800px;
    margin: 0 auto;
  }
  .back-link {
    display: inline-block;
    margin-bottom: 1rem;
    color: var(--brand-primary, #3b82f6);
    text-decoration: none;
  }
  .back-link:hover {
    text-decoration: underline;
  }
  header {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e5e7eb;
  }
  h1 {
    font-size: 1.75rem;
    color: var(--brand-text, #111827);
    margin: 0 0 0.5rem 0;
  }
  .category {
    font-size: 0.875rem;
    color: var(--brand-primary, #3b82f6);
    font-weight: 600;
  }
  .content {
    color: var(--brand-text-secondary, #374151);
    line-height: 1.7;
    white-space: pre-wrap;
  }
  .content :global(p) {
    margin-bottom: 1rem;
  }
  .loading, .error {
    text-align: center;
    padding: 2rem;
    color: var(--brand-text-secondary, #6b7280);
  }
  .error {
    color: #dc2626;
  }
</style>
