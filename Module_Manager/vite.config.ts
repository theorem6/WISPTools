import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		{
			name: 'build-progress',
			buildStart() {
				console.log('🏗️  Vite build starting...');
				console.log('💾 Memory limit:', process.env.NODE_OPTIONS);
			},
			buildEnd() {
				console.log('✅ Vite build completed!');
			}
		}
	],
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
		host: true, // Listen on all addresses (needed for Firebase Web IDE preview)
		fs: {
			allow: ['..']
		},
		hmr: {
			clientPort: 5173 // Ensure HMR works in Firebase Web IDE
		}
	},
	build: {
		target: 'esnext',
		minify: 'esbuild',
		sourcemap: false,
		chunkSizeWarningLimit: 5000,
		// Reduce memory usage during build
		rollupOptions: {
			output: {
				// Simplified chunking to reduce memory usage
				manualChunks(id) {
					// ArcGIS - keep as single chunk (less memory for splitting)
					if (id.includes('@arcgis/core')) {
						return 'arcgis';
					}
					// Firebase
					if (id.includes('firebase')) {
						return 'firebase';
					}
					// All other vendor code
					if (id.includes('node_modules')) {
						return 'vendor';
					}
				}
			},
			// Reduce parallelization to save memory
			maxParallelFileOps: 2
		}
	},
	ssr: {
		// Don't bundle ArcGIS in SSR - it's client-side only and dynamically imported
		noExternal: []
	}
});

