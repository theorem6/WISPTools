import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		exclude: ['@firebase/app']
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
		chunkSizeWarningLimit: 1000,
		rollupOptions: {
			output: {
				manualChunks: undefined
			}
		}
	},
	ssr: {
		noExternal: ['@arcgis/core']
	}
});

