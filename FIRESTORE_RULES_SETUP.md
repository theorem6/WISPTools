# 🔒 Firestore Security Rules Setup

## ❌ Current Error

```
FirebaseError: Missing or insufficient permissions.
```

This error occurs because **Firestore Security Rules** are not configured to allow authenticated users to read/write data.

---

## ✅ Solution: Deploy Security Rules

### Option 1: Firebase Console (Recommended for Web IDE)

1. **Open Firebase Console**
   - Go to: https://console.firebase.google.com/project/petersonmappingapp/firestore/rules

2. **Copy the Rules**
   - Open the `firestore.rules` file in your project
   - Copy all contents

3. **Paste and Publish**
   - Paste the rules into the Firebase Console editor
   - Click **"Publish"** button

4. **Done!** Rules are now active

---

### Option 2: Firebase CLI (If Node.js is installed)

```bash
# Install Firebase CLI (one-time)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy the rules
firebase deploy --only firestore:rules
```

---

## 📋 What These Rules Do

### ✅ Allow Authenticated Users To:

1. **Read their own networks** (where `ownerId` matches their user ID)
2. **Create new networks** (must set themselves as owner)
3. **Update their networks** (cannot change ownership)
4. **Delete their networks**
5. **Manage cells** within their networks

### ❌ Deny:

- Unauthenticated access
- Reading other users' networks
- Modifying ownership after creation
- All other database access not explicitly allowed

---

## 🔍 Security Rules Explained

```javascript
// Networks collection
match /networks/{networkId} {
  // ✅ Users can read their own networks
  allow read: if isOwner(resource.data.ownerId);
  
  // ✅ Users can create networks (must set themselves as owner)
  allow create: if isAuthenticated() 
                && request.resource.data.ownerId == request.auth.uid;
  
  // ✅ Users can update their networks (but not change owner)
  allow update: if isOwner(resource.data.ownerId)
                && request.resource.data.ownerId == resource.data.ownerId;
  
  // ✅ Users can delete their networks
  allow delete: if isOwner(resource.data.ownerId);
}
```

---

## 🧪 Testing After Deployment

1. **Sign in** to your app
2. **Create a network** - should work without errors
3. **View networks list** - should show your networks
4. **Sign out and back in** - networks should persist

---

## 📁 Project Files

- `firestore.rules` - Security rules definition
- `firestore.indexes.json` - Database indexes
- `.firebaserc` - Project configuration (links to `petersonmappingapp`)
- `firebase.json` - Firebase services configuration

---

## ⚠️ Important Notes

- **Rules are project-wide** - they apply to all users
- **Changes take effect immediately** after publishing
- **Test mode rules expire** - If you previously set "Test Mode", those rules expire after 30 days
- **Production rules** - The rules we created are production-ready and secure

---

## 🆘 Troubleshooting

### Still getting permission errors?

1. **Check user is authenticated** - Look for user icon in topbar
2. **Check Firebase Console** - Verify rules were published
3. **Clear browser cache** - Sometimes cached permissions cause issues
4. **Check browser console** - Look for auth state errors

### Rules not deploying?

1. **Syntax errors** - Check Firebase Console for validation errors
2. **Project mismatch** - Verify `.firebaserc` has correct project ID
3. **Authentication** - Run `firebase login` if using CLI

---

## 📚 Learn More

- [Firestore Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Security Rules Best Practices](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Testing Security Rules](https://firebase.google.com/docs/firestore/security/test-rules-emulator)

