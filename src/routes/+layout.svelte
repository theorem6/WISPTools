<main>
	<div class="app-container">
		<header class="app-header">
			<h1>LTE PCI Conflict Mapper</h1>
			<p>Advanced LTE Physical Cell Identity conflict detection and visualization</p>
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
		text-align: center;
		box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
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
	
	main {
		margin: 0;
		padding: 0;
	}
</style>
