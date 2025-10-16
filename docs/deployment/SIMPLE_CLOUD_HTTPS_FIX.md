# Simple Cloud-to-Cloud HTTPS Solution

Since both frontend and backend are in Google Cloud, here's the simplest approach:

---

## ✅ **Option 1: Use Firebase Functions as HTTPS Proxy (Simplest)**

Deploy a simple Firebase Function that proxies requests to your backend with HTTPS.

### **Step 1: Create Proxy Function**

Add this to `functions/src/index.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as cors from 'cors';
const corsHandler = cors({origin: true});

// HSS API Proxy
export const hssProxy = functions.https.onRequest((request, response) => {
  corsHandler(request, response, async () => {
    const fetch = (await import('node-fetch')).default;
    const backendUrl = 'http://34.36.231.142:3000';
    const path = request.path;
    const url = `${backendUrl}${path}`;
    
    try {
      const apiResponse = await fetch(url, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          ...request.headers
        },
        body: request.method !== 'GET' ? JSON.stringify(request.body) : undefined
      });
      
      const data = await apiResponse.json();
      response.status(apiResponse.status).json(data);
    } catch (error) {
      response.status(500).json({ error: 'Proxy error' });
    }
  });
});
```

### **Step 2: Deploy**

```bash
cd functions
npm install node-fetch
firebase deploy --only functions:hssProxy
```

### **Step 3: Update Frontend**

Update `apphosting.yaml`:

```yaml
- variable: VITE_HSS_API_URL
  value: "https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy"
```

**Benefits:**
- ✅ No domain needed
- ✅ Automatic HTTPS
- ✅ Same Google Cloud project
- ✅ No SSL certificate management
- ✅ Works immediately

---

## ✅ **Option 2: Use Cloud Run (Better Performance)**

Deploy a simple proxy on Cloud Run.

### **Step 1: Create Proxy**

Create `hss-proxy/Dockerfile`:

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package.json .
RUN npm install
COPY server.js .
CMD ["node", "server.js"]
```

Create `hss-proxy/package.json`:

```json
{
  "name": "hss-proxy",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "node-fetch": "^3.3.2"
  }
}
```

Create `hss-proxy/server.js`:

```javascript
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Proxy all requests to backend
app.all('*', async (req, res) => {
  const fetch = (await import('node-fetch')).default;
  const backendUrl = 'http://34.36.231.142:3000';
  const url = `${backendUrl}${req.path}`;
  
  try {
    const response = await fetch(url, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
```

### **Step 2: Deploy to Cloud Run**

```bash
gcloud run deploy hss-proxy \
  --source ./hss-proxy \
  --platform managed \
  --region us-east4 \
  --allow-unauthenticated \
  --project lte-pci-mapper-65450042-bbf71
```

### **Step 3: Update Frontend**

Use the Cloud Run URL (something like):
```yaml
- variable: VITE_HSS_API_URL
  value: "https://hss-proxy-xxx-ue.a.run.app"
```

**Benefits:**
- ✅ Automatic HTTPS
- ✅ Better performance than Functions
- ✅ Auto-scaling
- ✅ No domain needed
- ✅ Free tier available

---

## ✅ **Option 3: Keep Load Balancer (Best for Production)**

If you want a custom domain (`hss.4gengineer.com`), keep the load balancer approach but run the setup from **Cloud Shell** instead of local machine.

### **Step 1: Open Cloud Shell**

Go to: https://console.cloud.google.com/  
Click the **>_** icon (top right) to open Cloud Shell

### **Step 2: Clone Repo and Run Script**

```bash
git clone https://github.com/theorem6/lte-pci-mapper.git
cd lte-pci-mapper
bash setup-gcp-load-balancer.sh
```

---

## 🎯 **Recommendation**

**Use Option 1 (Firebase Functions Proxy)** - It's the fastest to implement and works immediately without any infrastructure setup.

Then later, you can migrate to Option 3 (Load Balancer) for production with your custom domain.

