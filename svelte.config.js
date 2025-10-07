import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      // Output directory for the built app
      out: 'build',
      // Precompress files using gzip and brotli
      precompress: false,
      // Environment variable prefix
      envPrefix: '',
      // Polyfill node:* modules
      polyfill: true
    }),
    alias: {
      $lib: 'src/lib',
      $app: 'src/app'
    }
  }
};

export default config;
