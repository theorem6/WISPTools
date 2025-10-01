<script lang="ts">
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
	import { onMount } from 'svelte';
	import { themeManager } from '$lib/stores/themeStore';
	
	// Import centralized theme CSS
	import '../../styles/theme.css';

	onMount(() => {
		// Theme manager is auto-initialized
		themeManager;
	});
</script>

<main>
	<div class="app-container">
		<header class="app-header">
			<div class="header-content">
				<div class="header-text">
					<h1>LTE PCI Conflict Mapper</h1>
					<p>Advanced LTE Physical Cell Identity conflict detection and visualization</p>
				</div>
				<div class="header-controls">
					<ThemeSwitcher />
				</div>
			</div>
		</header>
		
		<slot />
	</div>
</main>

<style>
	:global(html) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
		background: var(--bg-primary);
		min-height: 100vh;
		margin: 0;
		padding: 0;
	}
	
	.app-container {
		min-height: 100vh;
		width: 100%;
		background: var(--bg-primary);
	}
	
	.app-header {
		background: var(--card-bg);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid var(--border-color);
		padding: var(--spacing-lg) var(--spacing-xl);
		color: var(--text-primary);
		box-shadow: var(--shadow-md);
		transition: var(--transition);
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		max-width: 1200px;
		margin: 0 auto;
	}

	.header-text {
		text-align: left;
	}

	.header-controls {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	
	.app-header h1 {
		margin: 0;
		font-size: 2rem;
		font-weight: 600;
		color: var(--text-primary);
	}
	
	.app-header p {
		margin: var(--spacing-sm) 0 0 0;
		font-size: 1rem;
		color: var(--text-secondary);
		font-weight: 400;
	}

	@media (max-width: 768px) {
		.header-content {
			flex-direction: column;
			gap: 1rem;
		}

		.header-text {
			text-align: center;
		}

		.app-header h1 {
			font-size: 2rem;
		}

		.app-header p {
			font-size: 1rem;
		}
	}
	
	main {
		margin: 0;
		padding: 0;
	}
</style>
