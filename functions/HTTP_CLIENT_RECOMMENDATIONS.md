# HTTP Client Library Recommendations for Firebase Functions

## Current Issue
The native `fetch` API in Firebase Functions is fragile:
- Limited error handling and retry logic
- Connection issues cause failures
- No automatic timeout handling
- No connection pooling

## Top Recommendations

### 1. **Axios** ⭐ RECOMMENDED FOR PRODUCTION
**Why**: Most mature, battle-tested, excellent error handling

**Features:**
- Built-in retry support (via axios-retry package)
- Request/response interceptors (great for logging)
- Automatic JSON parsing
- Connection pooling
- Timeout handling
- Request cancellation
- Automatic request/response transformation

**Install:**
```bash
npm install axios axios-retry
```

**Usage Example:**
```typescript
import axios from 'axios';
import axiosRetry from 'axios-retry';

const httpClient = axios.create({
  baseURL: 'http://136.112.111.167:3001',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Configure retry logic
axiosRetry(httpClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
           error.response?.status >= 500;
  }
});

// Use it
const response = await httpClient.get('/api/user-tenants/123');
```

### 2. **Got** (Lightweight & Modern)
**Why**: Built specifically for Node.js, lightweight, HTTP/2 support

**Features:**
- Built-in retry mechanism (no extra package needed)
- Request hooks
- HTTP/2 support
- Stream support
- Automatic JSON parsing

**Install:**
```bash
npm install got
```

**Usage Example:**
```typescript
import got from 'got';

const response = await got('http://136.112.111.167:3001/api/user-tenants/123', {
  retry: {
    limit: 3,
    methods: ['GET', 'POST'],
    statusCodes: [408, 413, 429, 500, 502, 503, 504]
  },
  timeout: {
    request: 30000
  }
}).json();
```

### 3. **Ky** (Fetch-like with Enhancements)
**Why**: Modern, fetch-compatible API but with retries built-in

**Features:**
- Fetch-compatible API (easy migration)
- Automatic retries
- Timeout handling
- Hooks for requests/responses

**Install:**
```bash
npm install ky
```

**Usage Example:**
```typescript
import ky from 'ky';

const httpClient = ky.create({
  prefixUrl: 'http://136.112.111.167:3001',
  timeout: 30000,
  retry: {
    limit: 3,
    methods: ['get', 'post'],
    statusCodes: [408, 413, 429, 500, 502, 503, 504]
  }
});

const response = await httpClient.get('api/user-tenants/123').json();
```

## My Recommendation: **Axios with axios-retry**

For your production system, I recommend Axios because:

1. ✅ **Most mature and battle-tested** - Used by millions of projects
2. ✅ **Excellent error handling** - Detailed error objects
3. ✅ **Easy retry configuration** - Just add axios-retry
4. ✅ **Great community support** - Lots of StackOverflow answers
5. ✅ **Request/response interceptors** - Perfect for logging all requests
6. ✅ **Connection pooling** - Better performance
7. ✅ **Automatic JSON handling** - No need to manually parse

## Implementation Plan

1. Install Axios and axios-retry in Firebase Functions
2. Create a reusable HTTP client with retry logic
3. Replace fetch() calls with axios in apiProxy
4. Add request/response interceptors for logging
5. Configure proper timeouts and error handling
