/**
 * Tenant app settings (ACS, company info) – load/save via backend API.
 * Falls back to localStorage when no tenant or API fails.
 */

import { browser } from '$app/environment';
import { authService } from '$lib/services/authService';
import { API_CONFIG } from '$lib/config/api';

export interface ACSSettings {
  username: string;
  password: string;
  url: string;
}

export interface CompanyInfo {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
}

export interface TenantAppSettings {
  acsSettings: ACSSettings;
  companyInfo: CompanyInfo;
}

const DEFAULT_ACS: ACSSettings = { username: '', password: '', url: '' };
const DEFAULT_COMPANY: CompanyInfo = {
  name: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  phone: '',
  email: ''
};

async function getAuthHeaders(tenantId: string): Promise<HeadersInit> {
  const token = await authService.getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  return headers;
}

/**
 * Load app settings from backend for the given tenant.
 * Returns defaults and leaves localStorage unchanged on error or no tenant.
 */
export async function getTenantAppSettings(tenantId: string | undefined): Promise<TenantAppSettings> {
  if (!browser || !tenantId) {
    return loadFromLocalStorage();
  }
  try {
    const res = await fetch(`${API_CONFIG.PATHS.API}/tenant-settings`, {
      method: 'GET',
      headers: await getAuthHeaders(tenantId)
    });
    if (!res.ok) return loadFromLocalStorage();
    const data = await res.json();
    return {
      acsSettings: { ...DEFAULT_ACS, ...data.acsSettings },
      companyInfo: { ...DEFAULT_COMPANY, ...data.companyInfo }
    };
  } catch {
    return loadFromLocalStorage();
  }
}

/**
 * Save app settings to backend for the given tenant.
 * Also writes to localStorage as cache. Returns true on success.
 */
export async function saveTenantAppSettings(
  tenantId: string | undefined,
  payload: { acsSettings?: ACSSettings; companyInfo?: CompanyInfo }
): Promise<boolean> {
  if (!browser) return false;
  if (tenantId) {
    try {
      const res = await fetch(`${API_CONFIG.PATHS.API}/tenant-settings`, {
        method: 'PUT',
        headers: await getAuthHeaders(tenantId),
        body: JSON.stringify(payload)
      });
      if (!res.ok) return false;
    } catch {
      return false;
    }
  }
  if (payload.acsSettings) localStorage.setItem('acs_settings', JSON.stringify(payload.acsSettings));
  if (payload.companyInfo) localStorage.setItem('company_info', JSON.stringify(payload.companyInfo));
  return true;
}

function loadFromLocalStorage(): TenantAppSettings {
  if (!browser) return { acsSettings: DEFAULT_ACS, companyInfo: DEFAULT_COMPANY };
  let acsSettings = DEFAULT_ACS;
  let companyInfo = DEFAULT_COMPANY;
  try {
    const acs = localStorage.getItem('acs_settings');
    if (acs) acsSettings = { ...DEFAULT_ACS, ...JSON.parse(acs) };
  } catch {
    // ignore
  }
  try {
    const company = localStorage.getItem('company_info');
    if (company) companyInfo = { ...DEFAULT_COMPANY, ...JSON.parse(company) };
  } catch {
    // ignore
  }
  return { acsSettings, companyInfo };
}
