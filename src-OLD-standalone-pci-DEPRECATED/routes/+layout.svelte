<script lang="ts">
	import { onMount } from 'svelte';
	import { themeManager } from '$lib/stores/themeStore';
	
	// Import centralized theme CSS (includes html/body global styles)
	import '../styles/theme.css';

	onMount(() => {
		// Theme manager is auto-initialized
		themeManager;
	});
</script>

<slot />
