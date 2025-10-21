/**
 * Push Notification Service
 * Handles Firebase Cloud Messaging for work order notifications
 */

import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

class NotificationService {
  
  /**
   * Request notification permissions (iOS requires explicit request)
   */
  async requestPermission(): Promise<boolean> {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('✅ Notification permission granted');
        await this.registerDevice();
      } else {
        console.log('❌ Notification permission denied');
      }

      return enabled;
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  }

  /**
   * Register device FCM token with user profile
   */
  async registerDevice() {
    try {
      const user = auth().currentUser;
      if (!user) {
        console.log('No user logged in, skipping FCM registration');
        return;
      }

      // Get FCM token
      const fcmToken = await messaging().getToken();
      if (!fcmToken) {
        console.log('No FCM token available');
        return;
      }

      // Generate unique device ID
      const deviceId = await this.getDeviceId();

      // Save to Firestore
      await firestore()
        .collection('users')
        .doc(user.uid)
        .set({
          fcmTokens: {
            [deviceId]: {
              token: fcmToken,
              platform: Platform.OS,
              lastUpdated: firestore.FieldValue.serverTimestamp()
            }
          }
        }, { merge: true });

      console.log('✅ FCM token registered:', fcmToken.substring(0, 20) + '...');
      
      // Store locally for reference
      await AsyncStorage.setItem('fcmToken', fcmToken);
    } catch (error) {
      console.error('FCM registration error:', error);
    }
  }

  /**
   * Get or generate device ID
   */
  async getDeviceId(): Promise<string> {
    let deviceId = await AsyncStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await AsyncStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  /**
   * Handle foreground notifications
   */
  setupForegroundHandler() {
    messaging().onMessage(async (remoteMessage) => {
      console.log('📬 Foreground notification:', remoteMessage);
      
      // Show local notification or update UI
      if (remoteMessage.notification) {
        console.log('Notification:', remoteMessage.notification.title);
        console.log('Body:', remoteMessage.notification.body);
        
        // Could use react-native-push-notification for local alerts
        // For now, just log it
      }
      
      // Handle data payload
      if (remoteMessage.data) {
        this.handleNotificationData(remoteMessage.data);
      }
    });
  }

  /**
   * Handle background/quit state notifications
   */
  setupBackgroundHandler() {
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('📬 Background notification:', remoteMessage);
      
      if (remoteMessage.data) {
        this.handleNotificationData(remoteMessage.data);
      }
    });
  }

  /**
   * Handle notification tap (app opened from notification)
   */
  setupNotificationOpenedListener(navigation: any) {
    // App opened from QUIT state
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('App opened from quit state by notification:', remoteMessage);
          this.navigateToWorkOrder(navigation, remoteMessage.data);
        }
      });

    // App opened from BACKGROUND state
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('App opened from background by notification:', remoteMessage);
      this.navigateToWorkOrder(navigation, remoteMessage.data);
    });
  }

  /**
   * Navigate to work order from notification
   */
  private navigateToWorkOrder(navigation: any, data: any) {
    if (data?.workOrderId) {
      // Navigate to work orders screen
      navigation.navigate('MyTickets');
      
      // Could add detail navigation if we have a detail screen
      // navigation.navigate('WorkOrderDetails', {
      //   workOrderId: data.workOrderId,
      //   ticketNumber: data.ticketNumber
      // });
    }
  }

  /**
   * Handle notification data (update local state, refresh lists, etc.)
   */
  private handleNotificationData(data: any) {
    console.log('Handling notification data:', data);
    
    // Could emit event to refresh work orders list
    // For now, just log it
    if (data.type === 'work_order_assigned' || data.type === 'work_order_updated') {
      console.log('Work order notification:', data.ticketNumber);
    }
  }

  /**
   * Unregister device on logout
   */
  async unregisterDevice() {
    try {
      const user = auth().currentUser;
      if (!user) return;

      const deviceId = await this.getDeviceId();

      await firestore()
        .collection('users')
        .doc(user.uid)
        .update({
          [`fcmTokens.${deviceId}`]: firestore.FieldValue.delete()
        });

      console.log('✅ FCM token unregistered');
    } catch (error) {
      console.error('FCM unregister error:', error);
    }
  }
}

export default new NotificationService();

