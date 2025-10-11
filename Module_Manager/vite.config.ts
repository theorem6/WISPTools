import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5173,
		strictPort: false,
	},
	// Externalize Node.js modules that shouldn't be bundled
	ssr: {
		noExternal: []
	},
	build: {
		rollupOptions: {
			external: [
				'mongodb',
				'@google-cloud/firestore'
			]
		}
	}
});
