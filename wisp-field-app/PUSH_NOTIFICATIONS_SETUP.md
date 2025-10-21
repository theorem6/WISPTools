# Push Notifications Setup Guide

**Feature:** Push notifications for work order assignments to field technicians

---

## 📋 What Was Added

### **Mobile App:**
1. `@react-native-firebase/messaging` package
2. `notificationService.ts` - FCM integration service
3. App.tsx updated with notification handlers
4. AndroidManifest.xml updated with POST_NOTIFICATIONS permission

### **Backend (Cloud Functions):**
1. `functions/src/notifications.ts` - Send push notifications on work order events
2. Triggers on work order assigned, status changed, escalated

---

## 🚀 Installation Steps

### **Step 1: Install Dependencies**

From Windows machine in `wisp-field-app` directory:

```powershell
cd C:\Users\david\Downloads\PCI_mapper\wisp-field-app
npm install
```

This will install `@react-native-firebase/messaging@18.9.0`

### **Step 2: Rebuild Android App**

```powershell
# Clean build
cd android
.\gradlew clean

# Build new APK
cd ..
.\build-production-apk.bat
```

New APK will be at:
```
android\app\build\outputs\apk\release\WISP-Field-App-v1.0.0-release.apk
```

### **Step 3: Deploy Cloud Functions**

From Windows machine in project root:

```powershell
cd C:\Users\david\Downloads\PCI_mapper
firebase deploy --only functions:onWorkOrderAssigned
```

This deploys the notification trigger function.

---

## 📱 How It Works

### **User Flow:**

1. **App Launch:**
   - App requests notification permission
   - User grants permission
   - FCM token generated
   - Token saved to Firestore `users/{uid}/fcmTokens`

2. **Help Desk Creates/Assigns Ticket:**
   - Help desk creates ticket
   - Assigns to field technician
   - Cloud Function triggers automatically

3. **Notification Sent:**
   - Cloud Function reads user's FCM tokens
   - Sends push notification to all user devices
   - Notification appears on phone

4. **User Taps Notification:**
   - App opens
   - Navigates to "My Tickets" screen
   - User can see new assignment

### **Notification States:**

**Foreground (App Open):**
- Shows in-app notification banner
- Auto-refreshes work orders list

**Background (App Minimized):**
- Shows system notification
- Tapping opens app to work orders

**Quit State (App Closed):**
- Shows system notification
- Tapping opens app and navigates to work orders

---

## 🔔 Notification Types

### **1. Work Order Assigned**
```
Title: New Work Order: TKT-2025-001
Body: CPE Installation - Priority: high
```

### **2. Status Changed**
```
Title: Work Order Updated: TKT-2025-001
Body: Status changed to in-progress
```

### **3. Priority Escalated**
```
Title: ⚠️ Escalated: TKT-2025-001
Body: Priority escalated to critical
```

---

## 🧪 Testing

### **Test Notifications:**

1. **Install updated APK** on test device
2. **Login** as a field technician
3. **From web app:**
   - Go to Help Desk or Work Orders
   - Create a ticket
   - Assign to your test user
4. **Check mobile device:**
   - Should receive push notification within seconds
   - Tap notification
   - Should open to work orders screen

### **Debug Logs:**

View FCM logs in app:
```bash
npx react-native log-android
```

Look for:
- "✅ Notification permission granted"
- "✅ FCM token registered: ..."
- "📬 Foreground notification: ..."

View Cloud Function logs:
```powershell
firebase functions:log --only onWorkOrderAssigned
```

Look for:
- "✅ Sent notification to X devices"
- "❌ Failed: 0"

---

## 🐛 Troubleshooting

### **No Permission Prompt:**
- Check Android 13+ requires POST_NOTIFICATIONS permission (already added)
- Uninstall and reinstall app
- Check app settings → permissions

### **No Token Generated:**
- Check google-services.json is present
- Check Firebase project has Cloud Messaging enabled
- Check logs: `npx react-native log-android`

### **Notification Not Received:**
- Check user has FCM token in Firestore
- Check Cloud Function deployed: `firebase functions:list`
- Check function logs for errors
- Verify work order has assignedTo field

### **App Doesn't Open on Tap:**
- Check navigation ref is passed to service
- Check data payload includes workOrderId
- Reinstall app

---

## ✅ Success Indicators

After setup:
- ✅ App requests notification permission on login
- ✅ FCM token appears in Firestore `users/{uid}/fcmTokens`
- ✅ Assigning work order triggers notification within 5 seconds
- ✅ Tapping notification opens app to work orders
- ✅ Cloud Function shows success in logs

---

## 📊 Next Steps

### **Enhancements (Optional):**

1. **Badge Count:**
   - Show unread count on app icon
   - Update on notification received

2. **Notification Settings:**
   - Let users disable work order notifications
   - Choose notification sound

3. **Rich Notifications:**
   - Show customer name in notification
   - Add action buttons (Accept, View)

4. **Offline Support:**
   - Queue notifications when offline
   - Deliver when online

---

## 🎯 Current Implementation

**✅ Implemented:**
- Push notification service
- FCM token registration
- Foreground/background/quit handlers
- Cloud Function trigger
- Deep linking to work orders
- Invalid token cleanup

**🔲 Future Enhancements:**
- Badge counts
- In-app notification banner
- Notification settings screen
- Action buttons
- Sound customization

---

**All code is ready! Just need to rebuild APK and deploy Cloud Functions.** 🚀

