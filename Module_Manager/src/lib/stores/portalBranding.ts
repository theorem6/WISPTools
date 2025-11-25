import { writable } from 'svelte/store';
import type { TenantBranding } from '$lib/services/brandingService';

export const portalBranding = writable<TenantBranding | null>(null);

