# Mobile App Integration Plan for Maintain Module

**Date:** January 21, 2026  
**Status:** Implementation Plan

## Overview

This document outlines the integration between the WISPTools.io web Maintain module and the WISP Field mobile app (`wisp-field-app`). The goal is to create seamless bidirectional communication between field technicians using the mobile app and help desk operators using the web interface.

---

## Current State

### ✅ What's Already Working

1. **Mobile App:**
   - ✅ Work Orders screen (`WorkOrdersScreen.tsx`)
   - ✅ View assigned tickets
   - ✅ Accept tickets
   - ✅ Update ticket status
   - ✅ API service integration (`apiService.ts`)
   - ✅ Push notification infrastructure (`notificationService.ts`)

2. **Backend:**
   - ✅ Work orders API (`/api/work-orders`)
   - ✅ Push notification Cloud Functions (`functions/src/notifications.ts`)
   - ✅ FCM token storage in Firestore (`users/{uid}/fcmTokens`)

3. **Web Platform:**
   - ✅ Maintain module with ticket management
   - ✅ Ticket creation and assignment
   - ✅ Ticket details modal

### ⚠️ What's Missing

1. **Mobile User Visibility:**
   - No way to see which users have mobile app installed
   - No mobile app status indicators
   - No last active time display

2. **Assignment Workflow:**
   - No mobile user selector when assigning tickets
   - No indication if user is currently active on mobile app
   - No push notification trigger on assignment

3. **Real-time Sync:**
   - No live status updates when mobile app updates tickets
   - No activity feed showing mobile app actions
   - No location tracking integration

4. **Deep Linking:**
   - No "Open in Mobile App" functionality
   - No QR codes for quick mobile access
   - No direct navigation to tickets in mobile app

---

## Implementation Plan

### Phase 1: Mobile User Status & Assignment (Week 1)

#### 1.1 Backend API Enhancements

**New Endpoint: `GET /api/users/:tenantId/mobile-status`**
```javascript
// Returns users with mobile app status
{
  users: [
    {
      userId: "uid123",
      email: "tech@example.com",
      name: "John Doe",
      role: "technician",
      mobileApp: {
        installed: true,
        lastActive: "2026-01-21T10:30:00Z",
        fcmTokens: ["token1", "token2"],
        status: "online" | "away" | "offline"
      }
    }
  ]
}
```

**Enhancement: `PUT /api/work-orders/:id`**
- Trigger push notification when ticket assigned
- Log assignment action
- Update ticket with assignment timestamp

**New Endpoint: `GET /api/work-orders/:id/mobile-activity`**
```javascript
// Returns mobile app activity for a ticket
{
  activities: [
    {
      action: "accepted" | "status_updated" | "photo_uploaded" | "location_updated",
      userId: "uid123",
      userName: "John Doe",
      timestamp: "2026-01-21T10:30:00Z",
      details: { ... }
    }
  ]
}
```

#### 1.2 Frontend Enhancements

**Mobile User Selector Component:**
- Create `MobileUserSelector.svelte` component
- Show users with mobile app installed
- Display online/offline status
- Show last active time
- Filter by role (technician, installer, etc.)

**Ticket Assignment Enhancement:**
- Add mobile user selector to `CreateTicketModal.svelte`
- Show mobile app status badge
- Add "Send Push Notification" checkbox
- Display estimated response time based on user status

**Mobile Status Indicators:**
- Add mobile app badge to ticket cards
- Show "📱 Mobile" indicator if assigned user has app
- Display last mobile update timestamp

#### 1.3 Mobile App Enhancements

**Activity Logging:**
- Log all ticket actions to backend
- Send activity events when:
  - Ticket accepted
  - Status updated
  - Photo uploaded
  - Location updated
  - Work log added

**Status Updates:**
- Send periodic "heartbeat" to backend
- Update last active timestamp
- Report online/offline status

---

### Phase 2: Real-time Updates & Activity Feed (Week 2)

#### 2.1 WebSocket Integration

**Backend:**
- Set up WebSocket server (Socket.io or native WebSocket)
- Broadcast ticket updates to connected clients
- Send mobile app activity events to web clients

**Frontend:**
- Connect to WebSocket on Maintain module load
- Listen for ticket updates
- Update UI in real-time when mobile app makes changes
- Show "Live" indicator when receiving real-time updates

#### 2.2 Activity Feed Component

**Create `MobileActivityFeed.svelte`:**
- Display mobile app actions in ticket details
- Show timeline of activities
- Filter by action type
- Show user avatars and timestamps

**Integration:**
- Add to `TicketDetailsModal.svelte`
- Show in ticket list as expandable section
- Display in dashboard recent activity

---

### Phase 3: Location Tracking & Deep Linking (Week 3)

#### 3.1 Location Tracking (Optional, User Consent)

**Mobile App:**
- Request location permission
- Send location updates when ticket is active
- Update location every 5 minutes when working on ticket

**Backend:**
- Store location updates in ticket
- Calculate distance to ticket location
- Estimate ETA based on current location

**Frontend:**
- Show tech location on map (if enabled)
- Display distance to ticket location
- Show ETA estimate
- Add "Navigate" button (opens Google Maps)

#### 3.2 Deep Linking

**Mobile App:**
- Handle deep links: `wisptools://ticket/:id`
- Navigate directly to ticket details
- Handle notification taps

**Frontend:**
- Add "Open in Mobile App" button
- Generate QR code for ticket
- Add deep link URL to ticket details
- Send deep link in push notifications

---

### Phase 4: Advanced Features (Week 4)

#### 4.1 Push Notification Management

**Frontend:**
- Notification preferences per user
- Test notification button
- Notification history/log

**Backend:**
- Notification delivery tracking
- Retry failed notifications
- Notification analytics

#### 4.2 Mobile App Analytics

**Dashboard:**
- Mobile app adoption rate
- Average response time (mobile vs web)
- Mobile app usage statistics
- Most active mobile users

#### 4.3 Offline Support

**Mobile App:**
- Cache ticket data locally
- Queue updates when offline
- Sync when connection restored

---

## Technical Implementation Details

### Backend API Routes

```javascript
// New routes to add to backend-services/routes/users/index.js

// Get mobile app status for tenant users
router.get('/:tenantId/mobile-status', async (req, res) => {
  // Check Firestore for FCM tokens
  // Calculate last active time
  // Return user list with mobile status
});

// Get mobile activity for ticket
router.get('/work-orders/:id/mobile-activity', async (req, res) => {
  // Query mobile activity log
  // Return activity timeline
});
```

### Frontend Components

```svelte
<!-- MobileUserSelector.svelte -->
<script lang="ts">
  // Fetch users with mobile status
  // Display user list with status indicators
  // Handle user selection
</script>

<!-- MobileActivityFeed.svelte -->
<script lang="ts">
  // Fetch mobile activity for ticket
  // Display activity timeline
  // Real-time updates via WebSocket
</script>
```

### Mobile App Services

```typescript
// activityService.ts
class ActivityService {
  logTicketAction(ticketId: string, action: string, details: any) {
    // Send activity to backend
  }
  
  sendHeartbeat() {
    // Update last active time
  }
}
```

---

## Database Schema Changes

### Firestore Collections

```javascript
// users/{uid}
{
  fcmTokens: {
    deviceId: {
      token: "fcm_token",
      platform: "android" | "ios",
      lastActive: Timestamp
    }
  },
  mobileApp: {
    installed: true,
    lastActive: Timestamp,
    version: "1.0.0"
  }
}

// mobile_activity/{activityId}
{
  ticketId: "ticket123",
  userId: "uid123",
  action: "accepted" | "status_updated" | ...,
  timestamp: Timestamp,
  details: { ... }
}
```

### MongoDB Collections

```javascript
// work_orders collection - add fields:
{
  mobileActivity: [
    {
      action: "accepted",
      userId: "uid123",
      timestamp: Date,
      details: { ... }
    }
  ],
  assignedUserMobileStatus: {
    hasApp: true,
    lastActive: Date,
    status: "online"
  }
}
```

---

## Testing Plan

### Unit Tests
- [ ] Mobile user status API endpoint
- [ ] Activity logging service
- [ ] Push notification trigger
- [ ] Deep link handling

### Integration Tests
- [ ] Ticket assignment with mobile user
- [ ] Push notification delivery
- [ ] Activity feed updates
- [ ] Real-time sync

### End-to-End Tests
- [ ] Complete workflow: Assign → Mobile Accept → Status Update → Web View
- [ ] Deep link navigation
- [ ] Offline sync

---

## Deployment Checklist

### Backend
- [ ] Deploy new API endpoints
- [ ] Deploy WebSocket server (if using)
- [ ] Update Cloud Functions for push notifications
- [ ] Run database migrations

### Frontend
- [ ] Build and deploy Maintain module updates
- [ ] Test mobile user selector
- [ ] Verify push notifications
- [ ] Test deep linking

### Mobile App
- [ ] Update app with activity logging
- [ ] Add deep link handling
- [ ] Test push notifications
- [ ] Release new app version

---

## Success Metrics

1. **Adoption Rate:**
   - % of technicians using mobile app
   - % of tickets assigned to mobile users

2. **Response Time:**
   - Average time to accept ticket (mobile vs web)
   - Average time to update status

3. **Engagement:**
   - Mobile app actions per ticket
   - Push notification open rate

4. **Efficiency:**
   - Reduction in ticket resolution time
   - Increase in first-time fix rate

---

## Future Enhancements

1. **Voice Notes:** Record and attach voice notes from mobile app
2. **Video Calls:** Initiate video calls between help desk and field tech
3. **AR Support:** Augmented reality for equipment identification
4. **Offline Maps:** Download maps for offline navigation
5. **Team Chat:** In-app messaging between team members
6. **Time Tracking:** Automatic time tracking for ticket work
7. **Expense Reporting:** Submit expenses directly from mobile app

---

## Resources

- Mobile App Repo: `wisp-field-app/`
- Backend API: `backend-services/routes/work-orders.js`
- Push Notifications: `functions/src/notifications.ts`
- Maintain Module: `Module_Manager/src/routes/modules/maintain/`

---

**Next Steps:**
1. Review and approve this plan
2. Set up development environment
3. Begin Phase 1 implementation
4. Schedule weekly progress reviews
