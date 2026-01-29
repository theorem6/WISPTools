/**
 * Workspace root – delegates to the Svelte app in Module_Manager.
 * The app root is Module_Manager; build and dev must run from there:
 *   cd Module_Manager && npm run build
 *   cd Module_Manager && npm run dev
 * This file re-exports Module_Manager's config so tooling that starts from
 * repo root can resolve vite config without needing @sveltejs/kit at root.
 */
// @ts-expect-error – resolved from Module_Manager when this file is used
export { default } from './Module_Manager/vite.config';
