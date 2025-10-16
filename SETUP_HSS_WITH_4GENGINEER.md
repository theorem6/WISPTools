# HSS API Setup with 4gengineer.com Domain

## 🎯 Goal
Set up HSS API with proper HTTPS using `hss.4gengineer.com`

---

## 📋 **Step 1: Add Health Check Endpoint (On Server)**

SSH to `136.112.111.167` and run:

```bash
# Add health check endpoint
sed -i '/app.listen(PORT/i \
// Health check endpoint for load balancer\
app.get("/health", (req, res) => {\
  res.json({ status: "ok", timestamp: new Date().toISOString() });\
});\
' /opt/hss-api/server.js

# Restart service
systemctl restart hss-api.service

# Test
curl http://localhost:3000/health
```

---

## 📋 **Step 2: Setup Google Cloud Load Balancer (From Local Machine)**

Run this script from your local machine with `gcloud` CLI:

```bash
bash setup-gcp-load-balancer.sh
```

This will:
1. ✅ Create static IP address
2. ✅ Create health checks
3. ✅ Create backend service
4. ✅ Create Google-managed SSL certificate for `hss.4gengineer.com`
5. ✅ Create HTTPS load balancer

---

## 📋 **Step 3: Configure DNS**

The script will output a static IP address. You need to create an A record:

**DNS Settings for 4gengineer.com:**
- **Type:** A
- **Name:** `hss` (or `@` if you want to use `4gengineer.com` directly)
- **Value:** `[STATIC_IP from script output]`
- **TTL:** 300 (5 minutes)

Example:
```
hss.4gengineer.com  →  A  →  34.120.XXX.XXX
```

---

## 📋 **Step 4: Wait for SSL Provisioning (15-60 minutes)**

Google needs to verify domain ownership and provision the SSL certificate.

**Check SSL status:**
```bash
gcloud compute ssl-certificates describe hss-api-cert --global
```

Look for:
```
status: ACTIVE
```

---

## 📋 **Step 5: Update Frontend Configuration**

Once SSL is ACTIVE, update `apphosting.yaml`:

```yaml
- variable: VITE_HSS_API_URL
  value: "https://hss.4gengineer.com"
  availability:
    - BUILD
    - RUNTIME
```

And update the fallback in `Module_Manager/src/routes/modules/hss-management/+page.svelte`:

```javascript
const HSS_API = import.meta.env.VITE_HSS_API_URL || 'https://hss.4gengineer.com';
```

Then commit and push:
```bash
git add -A
git commit -m "feat: Configure HSS API with hss.4gengineer.com domain"
git push origin main
```

---

## 📋 **Step 6: Test the Setup**

Once SSL is active and frontend is deployed:

```bash
# Test API directly
curl https://hss.4gengineer.com/health
curl https://hss.4gengineer.com/bandwidth-plans

# Visit frontend
https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app/modules/hss-management
```

---

## 🔍 **Troubleshooting**

### SSL Certificate Not Provisioning
```bash
# Check certificate status
gcloud compute ssl-certificates describe hss-api-cert --global

# Common issues:
# - DNS not propagated yet (wait 5-60 minutes)
# - Wrong DNS record (must be A record, not CNAME for root)
# - Domain not verified (check Google Search Console)
```

### Health Check Failing
```bash
# On server, check if health endpoint works
curl http://localhost:3000/health

# Check firewall allows health check traffic
gcloud compute firewall-rules describe allow-health-check

# Check backend health
gcloud compute backend-services get-health hss-api-backend --global
```

### API Still Not Working
```bash
# Check load balancer status
gcloud compute forwarding-rules describe hss-api-https-rule --global

# Check backend service
gcloud compute backend-services describe hss-api-backend --global

# Test from different location
curl -v https://hss.4gengineer.com/health
```

---

## 📊 **Architecture**

```
Frontend (Firebase App Hosting)
    ↓ HTTPS
Google Cloud Load Balancer (hss.4gengineer.com)
    ↓ HTTP (internal)
Backend Instance (136.112.111.167:3000)
    ↓
MongoDB Atlas
```

---

## ✅ **Benefits of This Setup**

1. ✅ **Proper SSL** - Google-managed certificate (free, auto-renews)
2. ✅ **No browser warnings** - Trusted CA certificate
3. ✅ **Scalable** - Can add more backend instances
4. ✅ **Health checks** - Automatic failover
5. ✅ **DDoS protection** - Cloud Armor integration
6. ✅ **Global CDN** - Can enable for better performance

---

## 💰 **Cost Estimate**

- Load Balancer: ~$18/month
- Static IP: ~$3/month if not in use
- Egress traffic: Variable

**Total: ~$21/month** for production-grade HTTPS setup

