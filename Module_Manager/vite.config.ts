import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		exclude: ['@firebase/app', '@arcgis/core']
	},
	define: {
		global: 'globalThis',
	},
	resolve: {
		alias: {
			process: 'process/browser',
		},
	},
	server: {
		port: 5173,
		fs: {
			allow: ['..']
		}
	},
	build: {
		target: 'esnext',
		minify: 'esbuild',
		sourcemap: false,
		chunkSizeWarningLimit: 2000,
		rollupOptions: {
			output: {
				// Split large dependencies into separate chunks to reduce memory usage
				manualChunks(id) {
					// Keep ArcGIS as external chunks loaded on demand
					if (id.includes('@arcgis/core')) {
						// Split ArcGIS into smaller sub-chunks by feature area
						if (id.includes('/views/')) return 'arcgis-views';
						if (id.includes('/layers/')) return 'arcgis-layers';
						if (id.includes('/widgets/')) return 'arcgis-widgets';
						if (id.includes('/geometry/')) return 'arcgis-geometry';
						return 'arcgis-core';
					}
					// Split Firebase into its own chunk
					if (id.includes('firebase')) {
						return 'firebase';
					}
					// Split Svelte framework into its own chunk
					if (id.includes('node_modules') && (id.includes('svelte') || id.includes('@sveltejs'))) {
						return 'svelte-framework';
					}
					// All other node_modules
					if (id.includes('node_modules')) {
						return 'vendor';
					}
				},
				// Increase max chunk size for large libraries
				experimentalMinChunkSize: 5000
			}
		}
	},
	ssr: {
		// Don't bundle ArcGIS in SSR - it's client-side only and dynamically imported
		noExternal: []
	}
});

