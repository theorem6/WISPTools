// Custom server entry point with debugging
import { handler } from './build/handler.js';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 8080;

// Log directory structure on startup
console.log('🔍 Server starting...');
console.log('📁 Current directory:', process.cwd());
console.log('📁 __dirname:', __dirname);

const buildClientPath = join(__dirname, 'build', 'client');
const buildPath = join(__dirname, 'build');

console.log('📂 Checking paths:');
console.log('  - build/:', existsSync(buildPath) ? '✅ EXISTS' : '❌ MISSING');
console.log('  - build/client/:', existsSync(buildClientPath) ? '✅ EXISTS' : '❌ MISSING');
console.log('  - build/index.js:', existsSync(join(buildPath, 'index.js')) ? '✅ EXISTS' : '❌ MISSING');
console.log('  - build/handler.js:', existsSync(join(buildPath, 'handler.js')) ? '✅ EXISTS' : '❌ MISSING');

// Serve static files from build/client explicitly
app.use(express.static(buildClientPath, {
	etag: true,
	lastModified: true,
	maxAge: '1y',
	immutable: true,
	setHeaders: (res, path) => {
		console.log('📄 Serving static file:', path);
		if (path.includes('/_app/immutable/')) {
			res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
		}
	}
}));

// SvelteKit handler
app.use(handler);

app.listen(port, () => {
	console.log(`🚀 Server listening on http://0.0.0.0:${port}`);
	console.log(`📦 Serving static files from: ${buildClientPath}`);
});

