/**
 * Robust HTTP Client for Firebase Functions
 * Uses Axios with retry logic for better reliability than native fetch
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import axiosRetry from 'axios-retry';

const BACKEND_HOST = process.env.BACKEND_HOST || 'http://136.112.111.167:3001';

/**
 * Create configured Axios instance with retry logic
 */
function createHttpClient(): AxiosInstance {
  const client = axios.create({
    baseURL: BACKEND_HOST,
    timeout: 30000, // 30 second timeout
    headers: {
      'Content-Type': 'application/json',
    },
    // Keep connections alive for better performance
    httpAgent: new (require('http').Agent)({ keepAlive: true }),
    httpsAgent: new (require('https').Agent)({ keepAlive: true }),
  });

  // Configure retry logic
  axiosRetry(client, {
    retries: 3, // Retry up to 3 times
    retryDelay: axiosRetry.exponentialDelay, // Exponential backoff
    retryCondition: (error: AxiosError) => {
      // Retry on network errors or 5xx server errors
      return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
             (error.response?.status ? error.response.status >= 500 : false) ||
             error.code === 'ECONNREFUSED' ||
             error.code === 'ETIMEDOUT' ||
             error.code === 'ENOTFOUND';
    },
    onRetry: (retryCount, error, requestConfig) => {
      console.log(`[HTTP Client] Retry attempt ${retryCount} for ${requestConfig.url}`, {
        errorCode: error.code,
        status: (error as AxiosError).response?.status
      });
    },
  });

  // Request interceptor for logging
  client.interceptors.request.use(
    (config) => {
      console.log('[HTTP Client] Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        timeout: config.timeout
      });
      return config;
    },
    (error) => {
      console.error('[HTTP Client] Request error:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor for error handling
  client.interceptors.response.use(
    (response) => {
      console.log('[HTTP Client] Response:', {
        status: response.status,
        statusText: response.statusText,
        url: response.config.url
      });
      return response;
    },
    (error: AxiosError) => {
      console.error('[HTTP Client] Response error:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url
      });
      return Promise.reject(error);
    }
  );

  return client;
}

// Export singleton instance
export const httpClient = createHttpClient();

/**
 * Make a request using the configured HTTP client
 */
export async function makeRequest<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  path: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<T> {
  try {
    const response = await httpClient.request<T>({
      method,
      url: path,
      data,
      ...config
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      throw new Error(
        `HTTP ${method} ${path} failed: ${axiosError.message} (${axiosError.response?.status || 'Network Error'})`
      );
    }
    throw error;
  }
}

