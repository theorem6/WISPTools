# HSS API HTTPS Setup Options

The frontend is loaded over HTTPS but trying to call HTTP backend, which browsers block (Mixed Content error).

## 🚀 **Option 1: Use Google Cloud Load Balancer (Recommended)**

This gives you automatic HTTPS with Google-managed SSL certificates.

### Steps:

1. **Create a Google Cloud Load Balancer:**
```bash
# From your local machine with gcloud CLI
gcloud compute addresses create hss-api-ip --global

# Get the IP address
gcloud compute addresses describe hss-api-ip --global --format="get(address)"
```

2. **Create a backend service:**
```bash
# Create instance group
gcloud compute instance-groups unmanaged create hss-api-group \
    --zone=us-central1-a

# Add your VM to the group
gcloud compute instance-groups unmanaged add-instances hss-api-group \
    --zone=us-central1-a \
    --instances=acs-hss-server

# Create health check
gcloud compute health-checks create http hss-api-health \
    --port=3000 \
    --request-path=/health

# Create backend service
gcloud compute backend-services create hss-api-backend \
    --protocol=HTTP \
    --health-checks=hss-api-health \
    --global

# Add instance group to backend
gcloud compute backend-services add-backend hss-api-backend \
    --instance-group=hss-api-group \
    --instance-group-zone=us-central1-a \
    --global

# Create URL map
gcloud compute url-maps create hss-api-lb \
    --default-service=hss-api-backend

# Create SSL certificate (managed by Google)
gcloud compute ssl-certificates create hss-api-cert \
    --domains=hss-api.yourdomain.com

# Create HTTPS proxy
gcloud compute target-https-proxies create hss-api-https-proxy \
    --url-map=hss-api-lb \
    --ssl-certificates=hss-api-cert

# Create forwarding rule
gcloud compute forwarding-rules create hss-api-https-rule \
    --address=hss-api-ip \
    --target-https-proxy=hss-api-https-proxy \
    --global \
    --ports=443
```

3. **Point your domain to the load balancer IP**

4. **Update apphosting.yaml:**
```yaml
- variable: VITE_HSS_API_URL
  value: "https://hss-api.yourdomain.com"
```

---

## 🔐 **Option 2: nginx Reverse Proxy with Let's Encrypt (If you have a domain)**

**Requirements:** A domain name pointing to 136.112.111.167

**Run on server:**
```bash
bash setup-hss-api-https.sh
```

Then update `apphosting.yaml`:
```yaml
- variable: VITE_HSS_API_URL
  value: "https://your-domain.com"
```

---

## ⚡ **Option 3: Quick Fix - Use Google Cloud Identity-Aware Proxy**

This is the fastest option if you don't have a domain yet.

1. **Enable IAP on your VM:**
```bash
# From local machine
gcloud compute backend-services update hss-api-backend \
    --iap=enabled \
    --global
```

2. **Use the IAP endpoint in your frontend**

---

## 🔧 **Option 4: Temporary Dev Workaround (NOT for production)**

**Allow mixed content in browser (Chrome):**
1. Click the 🔒 (lock icon) in the address bar
2. Click "Site settings"
3. Find "Insecure content" and change to "Allow"
4. Reload the page

**OR add this to your server:**

Add a health check endpoint to server.js:
```javascript
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
```

---

## 🎯 **Recommended Quick Solution: Cloud IAP**

Since you're already on Google Cloud, the easiest is:

```bash
# 1. Create a simple nginx proxy on the VM
apt-get install -y nginx

cat > /etc/nginx/sites-available/hss-api << 'EOF'
server {
    listen 443 ssl http2;
    server_name _;
    
    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

ln -s /etc/nginx/sites-available/hss-api /etc/nginx/sites-enabled/
systemctl restart nginx
ufw allow 443/tcp

# 2. Access via https://136.112.111.167 (will show certificate warning but will work)
```

Then update apphosting.yaml:
```yaml
- variable: VITE_HSS_API_URL
  value: "https://136.112.111.167:443"
```

---

## 🏁 Which Option Should You Choose?

- **Have a domain?** → Option 2 (Let's Encrypt)
- **Don't have a domain but production?** → Option 1 (Cloud Load Balancer)
- **Quick test/dev?** → Option 4 (Self-signed cert)
- **Production without domain?** → Get a domain, then Option 1 or 2

