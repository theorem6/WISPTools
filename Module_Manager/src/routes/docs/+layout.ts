import { redirect } from '@sveltejs/kit';

/** Redirect /docs and all /docs/* to /help. The docs page is removed; use Help instead. */
export function load() {
  redirect(302, '/help');
}
