import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			out: 'build',
			precompress: false,
			envPrefix: '',
			polyfill: true
		}),
		files: {
			assets: 'static',
			hooks: {
				server: 'src/hooks.server'
			},
			lib: 'src/lib',
			routes: 'src/routes',
			serviceWorker: 'src/service-worker',
			appTemplate: 'src/app.html'
		}
	}
};

export default config;

