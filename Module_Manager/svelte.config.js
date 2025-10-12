import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
		// If your environment is not supported or you settled on a specific environment, switch out the adapter.
		// See https://kit.svelte.dev/docs/adapters for more information about adapters.
		adapter: adapter()
	},

	// Suppress non-critical accessibility warnings
	onwarn: (warning, handler) => {
		// Suppress accessibility warnings for modals (these are intentional)
		if (warning.code === 'a11y_click_events_have_key_events') return;
		if (warning.code === 'a11y_no_static_element_interactions') return;
		if (warning.code === 'a11y_interactive_supports_focus') return;
		if (warning.code === 'a11y_no_noninteractive_element_interactions') return;
		
		// Suppress label association warnings (forms work correctly)
		if (warning.code === 'a11y_label_has_associated_control') return;
		
		// Suppress unused CSS warnings (keeping styles for consistency)
		if (warning.code === 'css_unused_selector') return;
		
		// Handle all other warnings normally
		handler(warning);
	}
};

export default config;
