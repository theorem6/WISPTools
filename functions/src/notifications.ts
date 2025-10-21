/**
 * Push Notification Cloud Functions
 * 
 * Sends push notifications to mobile app users when:
 * - Work order is assigned to them
 * - Work order status changes
 * - Work order is escalated
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Cloud Function: Send notification when work order is assigned
 */
export const onWorkOrderAssigned = functions.firestore
  .document('work_orders/{workOrderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Check if assignedTo changed (new assignment)
    if (before.assignedTo !== after.assignedTo && after.assignedTo) {
      await sendWorkOrderNotification(
        after.assignedTo,
        after.tenantId,
        context.params.workOrderId,
        after.ticketNumber || context.params.workOrderId,
        after.title || after.type,
        after.priority,
        'assigned'
      );
    }
    
    // Check if status changed
    if (before.status !== after.status && after.assignedTo) {
      await sendWorkOrderNotification(
        after.assignedTo,
        after.tenantId,
        context.params.workOrderId,
        after.ticketNumber || context.params.workOrderId,
        after.title || after.type,
        after.priority,
        'status_changed',
        `Status changed to ${after.status}`
      );
    }
    
    // Check if priority escalated
    if (before.priority !== after.priority && after.assignedTo) {
      const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
      if (priorityOrder[after.priority] > priorityOrder[before.priority]) {
        await sendWorkOrderNotification(
          after.assignedTo,
          after.tenantId,
          context.params.workOrderId,
          after.ticketNumber || context.params.workOrderId,
          after.title || after.type,
          after.priority,
          'escalated',
          `Priority escalated to ${after.priority}`
        );
      }
    }
  });

/**
 * Send work order notification to user
 */
async function sendWorkOrderNotification(
  userId: string,
  tenantId: string,
  workOrderId: string,
  ticketNumber: string,
  workOrderTitle: string,
  priority: string,
  notificationType: string,
  customMessage?: string
) {
  try {
    // Get user's FCM tokens
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .get();
    
    if (!userDoc.exists) {
      console.log(`User ${userId} not found`);
      return;
    }
    
    const userData = userDoc.data();
    const fcmTokens = userData?.fcmTokens || {};
    
    // Check if notifications enabled
    if (userData?.notifications?.workOrders === false) {
      console.log(`User ${userId} has work order notifications disabled`);
      return;
    }
    
    // Extract tokens
    const tokens = Object.values(fcmTokens)
      .map((device: any) => device.token)
      .filter(Boolean) as string[];
    
    if (tokens.length === 0) {
      console.log(`No FCM tokens for user ${userId}`);
      return;
    }
    
    // Build notification message
    let title = '';
    let body = '';
    
    switch (notificationType) {
      case 'assigned':
        title = `New Work Order: ${ticketNumber}`;
        body = `${workOrderTitle} - Priority: ${priority}`;
        break;
      case 'status_changed':
        title = `Work Order Updated: ${ticketNumber}`;
        body = customMessage || workOrderTitle;
        break;
      case 'escalated':
        title = `⚠️ Escalated: ${ticketNumber}`;
        body = customMessage || workOrderTitle;
        break;
      default:
        title = `Work Order: ${ticketNumber}`;
        body = workOrderTitle;
    }
    
    const message = {
      notification: {
        title,
        body,
        sound: 'default'
      },
      data: {
        type: `work_order_${notificationType}`,
        workOrderId,
        ticketNumber,
        tenantId,
        priority
      },
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'work_orders',
          priority: 'high' as const,
          sound: 'default'
        }
      },
      tokens
    };
    
    // Send to all user devices
    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`✅ Sent notification to ${response.successCount} devices`);
    console.log(`❌ Failed: ${response.failureCount}`);
    
    // Remove invalid tokens
    if (response.failureCount > 0) {
      await cleanupInvalidTokens(userId, fcmTokens, response.responses);
    }
    
    // Log notification
    await admin.firestore()
      .collection('work_order_notifications')
      .add({
        notificationId: `${workOrderId}_${Date.now()}`,
        tenantId,
        workOrderId,
        ticketNumber,
        recipientUserId: userId,
        type: notificationType,
        title,
        body,
        priority,
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });
    
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

/**
 * Cleanup invalid FCM tokens
 */
async function cleanupInvalidTokens(
  userId: string,
  fcmTokens: any,
  responses: admin.messaging.SendResponse[]
) {
  const tokensToRemove: string[] = [];
  const tokenEntries = Object.entries(fcmTokens);
  
  responses.forEach((resp, idx) => {
    if (!resp.success && tokenEntries[idx]) {
      const error = resp.error;
      if (
        error?.code === 'messaging/invalid-registration-token' ||
        error?.code === 'messaging/registration-token-not-registered'
      ) {
        tokensToRemove.push(tokenEntries[idx][0]); // device ID
      }
    }
  });
  
  if (tokensToRemove.length > 0) {
    const updates: any = {};
    tokensToRemove.forEach((deviceId) => {
      updates[`fcmTokens.${deviceId}`] = admin.firestore.FieldValue.delete();
    });
    
    await admin.firestore()
      .collection('users')
      .doc(userId)
      .update(updates);
    
    console.log(`🗑️ Removed ${tokensToRemove.length} invalid tokens`);
  }
}

