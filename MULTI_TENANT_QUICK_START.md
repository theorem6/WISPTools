# Multi-Tenant GenieACS - Quick Start Guide

## 🚀 Quick Setup (5 Minutes)

### 1. Install Backend

```bash
chmod +x install-genieacs-multitenant.sh
sudo ./install-genieacs-multitenant.sh
```

**Required Information:**
- MongoDB URI: `mongodb+srv://...`
- External Domain: `your-domain.com`
- Base Port: `7547` (default)

### 2. Deploy Functions

```bash
firebase deploy --only functions
```

### 3. Deploy Frontend

```bash
cd Module_Manager
npm run build
cd ..
firebase deploy --only apphosting
```

## 👤 Create First Tenant

### For Admin (First Time Setup)

1. Go to your app URL
2. Sign up with email/password
3. Fill in tenant setup form:
   - Organization Name: "Your Company"
   - Display Name: "Your Company ISP"
   - Contact Email: your@email.com
4. Submit → Tenant created!

### CWMP URL

Your unique device connection URL:
```
http://your-domain.com/cwmp/{your-subdomain}
```

Example:
```
http://acs.example.com/cwmp/yourcompany-abc123
```

## 📱 Connect First Device

### On Your TR-069 Device

1. Find ACS/TR-069 settings
2. Set **ACS URL**: (copy from Tenant Admin → Connection)
3. Set **Username**: (optional)
4. Set **Password**: (optional)
5. **Save and Reboot**

Device appears in dashboard within 5 minutes!

## 🎯 What You Get

### Per Tenant (Customer)

✅ **Unique CWMP URL** - Each customer has their own connection endpoint  
✅ **Isolated Data** - Customer A cannot see Customer B's devices  
✅ **Separate Storage** - Files and firmware per customer  
✅ **Custom Settings** - Inform interval, monitoring options  
✅ **User Management** - Add operators, viewers to each tenant  
✅ **Role-Based Access** - Owner, Admin, Operator, Viewer roles

### Security

🔒 **Firebase Authentication** - Secure user login  
🔒 **JWT Tokens** - API requests verified  
🔒 **Tenant Context** - Every request validated  
🔒 **MongoDB Filtering** - Data queries auto-filtered  
🔒 **Access Control** - Permissions enforced

## 📊 Features

### For Customers

- Device management
- PCI conflict detection
- Performance monitoring
- Network planning
- Reporting and analytics
- Data export

### For You (Platform Owner)

- Multi-customer management
- Tenant isolation
- Usage tracking
- Limits and quotas
- Billing ready
- Scalable architecture

## 🔧 Common Tasks

### Add More Tenants

1. Create new Firebase user
2. Login
3. Go through tenant setup
4. Done!

### Add User to Existing Tenant

Coming soon - currently in development

### Change Tenant Settings

1. Login to tenant
2. Go to Settings (⚙️ icon)
3. Modify settings
4. Save

### View Logs

```bash
# GenieACS logs
tail -f /opt/genieacs/logs/genieacs-cwmp.log

# Nginx logs
tail -f /var/log/nginx/access.log

# Filter by tenant
tail -f /opt/genieacs/logs/genieacs-cwmp.log | grep "tenant-123"
```

### Restart Services

```bash
# Restart all GenieACS services
sudo systemctl restart genieacs-*

# Restart Nginx
sudo systemctl restart nginx

# Check status
systemctl status genieacs-cwmp
systemctl status nginx
```

## 🐛 Troubleshooting

### Device Not Connecting?

1. ✓ Check CWMP URL is correct
2. ✓ Ping the server: `ping your-domain.com`
3. ✓ Check service: `systemctl status genieacs-cwmp`
4. ✓ Check logs: `tail -f /opt/genieacs/logs/genieacs-cwmp.log`
5. ✓ Verify device can reach server (firewall, NAT)

### Can't Login?

1. ✓ Firebase Auth enabled? (Console → Authentication)
2. ✓ Email/Password provider enabled?
3. ✓ Check browser console for errors
4. ✓ Try incognito mode

### No Devices Showing?

1. ✓ Device connected? (check device logs)
2. ✓ Correct tenant selected? (top-right corner)
3. ✓ Wait 5 minutes (first inform)
4. ✓ Check MongoDB: devices have `_tenantId`?

## 📚 Learn More

- **Full Guide**: See `MULTI_TENANT_SETUP_GUIDE.md`
- **Architecture**: See `README.md`
- **GenieACS Docs**: https://docs.genieacs.com/
- **TR-069 Protocol**: https://en.wikipedia.org/wiki/TR-069

## 🎉 Success Checklist

After setup, you should have:

- ✅ GenieACS services running
- ✅ Nginx routing CWMP requests
- ✅ Firebase Functions deployed
- ✅ Frontend deployed and accessible
- ✅ First tenant created
- ✅ CWMP URL for tenant
- ✅ Ready to connect devices!

## 💡 Tips

### Best Practices

1. **One tenant per customer organization**
2. **Use descriptive organization names**
3. **Set inform interval based on need** (default: 300s)
4. **Enable PCI monitoring** for LTE devices
5. **Regular backups** of MongoDB

### Scaling

- **10 tenants**: Single server OK
- **50 tenants**: Consider load balancer
- **100+ tenants**: Cluster GenieACS, MongoDB
- **1000+ tenants**: Separate CWMP servers per region

### Monitoring

```bash
# Device count per tenant
mongo your-connection-string --eval 'db.devices.aggregate([
  {$group: {_id: "$_tenantId", count: {$sum: 1}}}
])'

# Active connections
netstat -an | grep :7547 | wc -l
```

## 🆘 Need Help?

1. Check logs first
2. Review `MULTI_TENANT_SETUP_GUIDE.md`
3. Check GenieACS documentation
4. Review Firebase Console for errors
5. Check MongoDB connectivity

---

**You're Ready!** 🎉

Your multi-tenant GenieACS system is ready to manage devices for multiple customers with complete data isolation.

Connect your first device and watch it appear in the dashboard!

