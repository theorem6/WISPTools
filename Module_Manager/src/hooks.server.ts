import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';

// Handle static file serving for adapter-node on Cloud Run
const handleStaticFiles: Handle = async ({ event, resolve }) => {
	// SvelteKit will handle static files automatically via adapter-node
	// This hook ensures proper headers and caching
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html
	});

	// Add cache headers for immutable assets
	if (event.url.pathname.includes('/_app/immutable/')) {
		response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
	}

	return response;
};

// Validate environment variables on server startup
const handleStartup: Handle = async ({ event, resolve }) => {
	return resolve(event);
};

export const handle = sequence(handleStaticFiles, handleStartup);

