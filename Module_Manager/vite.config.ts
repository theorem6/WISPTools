import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5173,
		strictPort: false,
	},
	// Ensure echarts is included in SSR bundle
	ssr: {
		noExternal: ['echarts']
	},
	build: {
		rollupOptions: {
			// Only externalize actual backend modules
			external: [
				'mongodb',
				'@google-cloud/firestore'
			]
		}
	},
	optimizeDeps: {
		include: ['echarts']
	}
});
