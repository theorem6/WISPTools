# Quick Verification Before Firebase Rollout

## 30-Second Check ⚡

```powershell
# 1. MongoDB password configured?
Select-String -Path "apphosting.yaml" -Pattern "<db_password>"
# Should return: NOTHING (if password is set)

# 2. Functions built?
Test-Path "functions/lib"
# Should return: True

# 3. Firebase project selected?
firebase use
# Should show: Your project ID
```

**All good?** → Safe to deploy! ✅  
**Something failed?** → Fix it first! ❌

## Critical: MongoDB Password

**Check this RIGHT NOW:**

```bash
grep "MONGODB_URI" apphosting.yaml
```

**❌ BAD (Will fail):**
```yaml
MONGODB_URI: "mongodb+srv://user:<db_password>@cluster..."
```

**✅ GOOD (Will work):**
```yaml
MONGODB_URI: "mongodb+srv://user:MyRealPassword123@cluster..."
```

## Deploy Order

```
1️⃣ firebase deploy --only functions  (FIRST!)
2️⃣ cd Module_Manager && firebase apphosting:backends:deploy  (SECOND!)
```

**Wrong order = Won't work!**

## Test After Deploy

```
Visit: /modules/acs-cpe-management/admin/database
See: Purple "Initialize" banner
Click: "Yes, Initialize Now"
Result: ✅ Success message
```

## If It Doesn't Work

**Check MongoDB URI:**
```bash
# Should NOT contain <db_password>
grep "db_password" apphosting.yaml
```

**Check Functions deployed:**
```bash
firebase functions:list | grep initializeMongoDatabase
```

**Check health:**
```bash
curl https://us-central1-YOUR-PROJECT.cloudfunctions.net/checkMongoHealth
```

---

**Yes, it will work!** (if MongoDB password is set) ✅

