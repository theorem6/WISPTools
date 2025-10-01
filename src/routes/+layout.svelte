<script lang="ts">
	import { onMount } from 'svelte';
	import { themeManager } from '$lib/stores/themeStore';
	
	// Import centralized theme CSS
	import '../styles/theme.css';

	onMount(() => {
		// Theme manager is auto-initialized
		themeManager;
	});
</script>

<slot />

<style>
	:global(html) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
		background: var(--bg-primary);
		min-height: 100vh;
		margin: 0;
		padding: 0;
	}
	
	:global(body) {
		margin: 0;
		padding: 0;
		overflow-x: hidden;
	}
</style>
