/**
 * ArcGIS OAuth 2.0 Service
 * Handles OAuth 2.0 client credentials flow for accessing ArcGIS Online resources
 * This is used for accessing private items like web maps and feature services
 */

const axios = require('axios');
const appConfig = require('../config/app');

const ARCGIS_OAUTH_CLIENT_ID = process.env.ARCGIS_OAUTH_CLIENT_ID || '';
const ARCGIS_OAUTH_CLIENT_SECRET = process.env.ARCGIS_OAUTH_CLIENT_SECRET || '';
const ARCGIS_TOKEN_ENDPOINT = 'https://www.arcgis.com/sharing/rest/oauth2/token';

// HTTP client
const httpClient = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'LTE-PCI-Mapper/1.0 (admin@wisptools.io)'
  }
});

// Token cache
let cachedToken = null;
let tokenExpiry = 0;

/**
 * Get OAuth 2.0 access token using client credentials flow
 * This token can be used to access private ArcGIS items and services
 */
async function getAccessToken() {
  try {
    // Check if we have valid cached token
    if (cachedToken && Date.now() < tokenExpiry) {
      console.log('[ArcGISOAuth] Using cached access token');
      return cachedToken;
    }

    if (!ARCGIS_OAUTH_CLIENT_ID || !ARCGIS_OAUTH_CLIENT_SECRET) {
      console.warn('[ArcGISOAuth] OAuth credentials not configured');
      return null;
    }

    console.log('[ArcGISOAuth] Requesting new OAuth access token');

    // Client credentials flow - no user interaction needed
    const params = new URLSearchParams({
      client_id: ARCGIS_OAUTH_CLIENT_ID,
      client_secret: ARCGIS_OAUTH_CLIENT_SECRET,
      grant_type: 'client_credentials',
      expiration: '1440' // 24 hours
    });

    const response = await httpClient.post(ARCGIS_TOKEN_ENDPOINT, params.toString());

    if (response.data && response.data.error) {
      console.error('[ArcGISOAuth] Token request failed:', response.data.error);
      return null;
    }

    const tokenData = response.data;
    if (!tokenData.access_token) {
      console.error('[ArcGISOAuth] No access token in response:', tokenData);
      return null;
    }

    // Cache the token
    cachedToken = tokenData.access_token;
    // Set expiry to 5 minutes before actual expiry to be safe
    const expiresIn = (tokenData.expires_in || 7200) * 1000; // Convert to milliseconds
    tokenExpiry = Date.now() + expiresIn - (5 * 60 * 1000); // 5 minutes buffer

    console.log('[ArcGISOAuth] Successfully obtained access token', {
      expiresIn: `${Math.round(expiresIn / 1000)}s`,
      expiresAt: new Date(tokenExpiry).toISOString()
    });

    return cachedToken;
  } catch (error) {
    console.error('[ArcGISOAuth] Error obtaining access token:', {
      error: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null
    });
    return null;
  }
}

/**
 * Get a valid access token (cached or new)
 */
async function getValidToken() {
  return await getAccessToken();
}

/**
 * Clear cached token (useful for testing or when credentials change)
 */
function clearTokenCache() {
  cachedToken = null;
  tokenExpiry = 0;
  console.log('[ArcGISOAuth] Token cache cleared');
}

module.exports = {
  getAccessToken,
  getValidToken,
  clearTokenCache
};

