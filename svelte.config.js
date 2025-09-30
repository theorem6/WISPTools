import adapter from '@sveltejs/adapter-firebase';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      firebaseProject: 'mapping-772cf',
      functions: {
        source: 'functions'
      }
    }),
    alias: {
      $lib: 'src/lib',
      $app: 'src/app'
    }
  }
};

export default config;
