<script lang="ts">
	import DarkModeToggle from '$lib/components/DarkModeToggle.svelte';
	import { onMount } from 'svelte';
	import { darkModeManager } from '$lib/darkMode';

	onMount(() => {
		// Initialize dark mode manager
		darkModeManager;
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
					<DarkModeToggle />
				</div>
			</div>
		</header>
		
		<slot />
	</div>
</main>

<style>
	:global(html) {
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		min-height: 100vh;
		margin: 0;
		padding: 0;
	}
	
	.app-container {
		min-height: 100vh;
		width: 100%;
	}
	
	.app-header {
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.2);
		padding: 1rem 2rem;
		color: white;
		box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
		transition: all 0.3s ease;
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
		font-size: 2.5rem;
		font-weight: 700;
		text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
	}
	
	.app-header p {
		margin: 0.5rem 0 0 0;
		font-size: 1.1rem;
		opacity: 0.9;
		font-weight: 300;
	}

	/* Dark mode header styles */
	[data-theme="dark"] .app-header {
		background: rgba(0, 0, 0, 0.3);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	[data-theme="dark"] .app-header h1 {
		text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
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
