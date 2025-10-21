/**
 * Help & Documentation Screen
 * In-app documentation for field technicians
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet
} from 'react-native';

interface HelpTopic {
  id: string;
  title: string;
  icon: string;
}

const topics: HelpTopic[] = [
  { id: 'overview', title: 'Overview', icon: '📚' },
  { id: 'getting-started', title: 'Getting Started', icon: '🚀' },
  { id: 'work-orders', title: 'Work Orders', icon: '📋' },
  { id: 'scanner', title: 'QR Scanner', icon: '📷' },
  { id: 'inventory', title: 'Inventory', icon: '📦' },
  { id: 'deployment', title: 'Deployment', icon: '🔧' },
  { id: 'notifications', title: 'Notifications', icon: '🔔' },
  { id: 'troubleshooting', title: 'Troubleshooting', icon: '🔧' }
];

export default function HelpScreen({ navigation }: any) {
  const [selectedTopic, setSelectedTopic] = useState('overview');

  const renderContent = () => {
    switch (selectedTopic) {
      case 'overview':
        return (
          <View>
            <Text style={styles.sectionTitle}>📚 Welcome to WISP Multitool</Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>WISP Multitool</Text> is your complete field operations app for wireless ISP work.
            </Text>
            
            <Text style={styles.subheading}>What You Can Do:</Text>
            <Text style={styles.bullet}>• View and manage assigned work orders</Text>
            <Text style={styles.bullet}>• Scan equipment QR codes</Text>
            <Text style={styles.bullet}>• Deploy equipment at customer sites</Text>
            <Text style={styles.bullet}>• Checkout inventory from vehicle</Text>
            <Text style={styles.bullet}>• Navigate to nearby tower sites</Text>
            <Text style={styles.bullet}>• Receive push notifications for new assignments</Text>
            
            <Text style={styles.subheading}>Key Features:</Text>
            <Text style={styles.bullet}>🔔 Push Notifications - Get notified of new work orders</Text>
            <Text style={styles.bullet}>📷 QR Scanner - Quick equipment lookup</Text>
            <Text style={styles.bullet}>🗺️ GPS Navigation - Find towers and sites</Text>
            <Text style={styles.bullet}>📦 Inventory Tracking - Checkout and deploy equipment</Text>
            <Text style={styles.bullet}>📋 Work Order Management - Complete tickets in the field</Text>
          </View>
        );

      case 'getting-started':
        return (
          <View>
            <Text style={styles.sectionTitle}>🚀 Getting Started</Text>
            
            <Text style={styles.subheading}>1. First Login</Text>
            <Text style={styles.paragraph}>
              When you first open the app, you'll be asked to:
            </Text>
            <Text style={styles.bullet}>• Grant camera permission (for QR scanning)</Text>
            <Text style={styles.bullet}>• Grant location permission (for GPS navigation)</Text>
            <Text style={styles.bullet}>• Grant notification permission (for work order alerts)</Text>
            <Text style={styles.bullet}>• Sign in with your Google account</Text>
            <Text style={styles.bullet}>• Select your organization</Text>
            
            <Text style={styles.subheading}>2. Main Screen</Text>
            <Text style={styles.paragraph}>
              After login, you'll see the home screen with options:
            </Text>
            <Text style={styles.bullet}>📋 My Tickets - View assigned work orders</Text>
            <Text style={styles.bullet}>📷 Scan QR Code - Scan equipment</Text>
            <Text style={styles.bullet}>🗺️ Nearby Towers - Find nearest tower sites</Text>
            <Text style={styles.bullet}>📦 Vehicle Inventory - View checked out equipment</Text>
            
            <Text style={styles.subheading}>3. Checking Work Orders</Text>
            <Text style={styles.paragraph}>
              Tap "My Tickets" to see all work orders assigned to you.
            </Text>
            <Text style={styles.tip}>
              💡 Tip: Pull down to refresh the list and get latest assignments.
            </Text>
          </View>
        );

      case 'work-orders':
        return (
          <View>
            <Text style={styles.sectionTitle}>📋 Work Orders</Text>
            
            <Text style={styles.subheading}>Viewing Your Tickets</Text>
            <Text style={styles.paragraph}>
              The "My Tickets" screen shows all work orders assigned to you.
            </Text>
            <Text style={styles.bullet}>🔴 Critical - Red badge, handle immediately</Text>
            <Text style={styles.bullet}>🟠 High - Orange badge, prioritize</Text>
            <Text style={styles.bullet}>🟡 Medium - Yellow badge, normal priority</Text>
            <Text style={styles.bullet}>🟢 Low - Green badge, when available</Text>
            
            <Text style={styles.subheading}>Work Order Information</Text>
            <Text style={styles.paragraph}>Each ticket shows:</Text>
            <Text style={styles.bullet}>• Ticket number (e.g., TKT-2025-001)</Text>
            <Text style={styles.bullet}>• Title and description</Text>
            <Text style={styles.bullet}>• Priority level</Text>
            <Text style={styles.bullet}>• Type (Installation, Repair, etc.)</Text>
            <Text style={styles.bullet}>• Customer information (if provided)</Text>
            <Text style={styles.bullet}>• Site location (if provided)</Text>
            <Text style={styles.bullet}>• Time created</Text>
            
            <Text style={styles.subheading}>Completing Work Orders</Text>
            <Text style={styles.paragraph}>After completing work in the field:</Text>
            <Text style={styles.bullet}>1. Open the ticket in the app</Text>
            <Text style={styles.bullet}>2. Update status to "Resolved"</Text>
            <Text style={styles.bullet}>3. Add completion notes</Text>
            <Text style={styles.bullet}>4. Take photos (if needed)</Text>
            <Text style={styles.bullet}>5. Submit updates</Text>
            
            <Text style={styles.tip}>
              💡 Tip: You only see tickets assigned to you. If you need to see a different ticket, ask your dispatcher or help desk to assign it to you.
            </Text>
          </View>
        );

      case 'scanner':
        return (
          <View>
            <Text style={styles.sectionTitle}>📷 QR Scanner</Text>
            
            <Text style={styles.subheading}>Scanning Equipment</Text>
            <Text style={styles.paragraph}>
              Use the QR scanner to quickly lookup equipment information:
            </Text>
            <Text style={styles.bullet}>1. Tap "Scan QR Code" on home screen</Text>
            <Text style={styles.bullet}>2. Point camera at equipment QR code</Text>
            <Text style={styles.bullet}>3. Scanner automatically detects and processes</Text>
            <Text style={styles.bullet}>4. Equipment details appear</Text>
            
            <Text style={styles.subheading}>Manual Entry</Text>
            <Text style={styles.paragraph}>
              If QR code is damaged or unreadable:
            </Text>
            <Text style={styles.bullet}>1. Tap "Manual Entry" button</Text>
            <Text style={styles.bullet}>2. Type the serial number or asset tag</Text>
            <Text style={styles.bullet}>3. Tap "Search"</Text>
            
            <Text style={styles.subheading}>What You Can Do</Text>
            <Text style={styles.paragraph}>After scanning equipment:</Text>
            <Text style={styles.bullet}>• View equipment specifications</Text>
            <Text style={styles.bullet}>• Check current status and location</Text>
            <Text style={styles.bullet}>• Update equipment status (Deploy, RMA, etc.)</Text>
            <Text style={styles.bullet}>• View maintenance history</Text>
            
            <Text style={styles.warning}>
              ⚠️ Note: Camera permission is required. Grant it in app settings if prompted.
            </Text>
          </View>
        );

      case 'notifications':
        return (
          <View>
            <Text style={styles.sectionTitle}>🔔 Push Notifications</Text>
            
            <Text style={styles.subheading}>How Notifications Work</Text>
            <Text style={styles.paragraph}>
              When a new work order is assigned to you, you'll receive a push notification on your phone.
            </Text>
            
            <Text style={styles.subheading}>Types of Notifications</Text>
            <Text style={styles.bullet}>📋 New Assignment - You've been assigned a work order</Text>
            <Text style={styles.bullet}>📝 Status Update - Work order status changed</Text>
            <Text style={styles.bullet}>⚠️ Escalation - Ticket priority increased</Text>
            
            <Text style={styles.subheading}>Notification Actions</Text>
            <Text style={styles.paragraph}>When you receive a notification:</Text>
            <Text style={styles.bullet}>1. Tap the notification</Text>
            <Text style={styles.bullet}>2. App opens automatically</Text>
            <Text style={styles.bullet}>3. Navigate to "My Tickets"</Text>
            <Text style={styles.bullet}>4. View the new assignment</Text>
            
            <Text style={styles.subheading}>Managing Permissions</Text>
            <Text style={styles.paragraph}>
              If notifications aren't working:
            </Text>
            <Text style={styles.bullet}>1. Go to phone Settings → Apps → WISP Multitool</Text>
            <Text style={styles.bullet}>2. Tap "Notifications"</Text>
            <Text style={styles.bullet}>3. Ensure notifications are enabled</Text>
            <Text style={styles.bullet}>4. Restart the app</Text>
            
            <Text style={styles.tip}>
              💡 Tip: Keep notifications enabled to never miss an urgent work order!
            </Text>
          </View>
        );

      case 'troubleshooting':
        return (
          <View>
            <Text style={styles.sectionTitle}>🔧 Troubleshooting</Text>
            
            <Text style={styles.subheading}>❌ Can't see my work orders</Text>
            <Text style={styles.paragraph}><Text style={styles.bold}>Problem:</Text> Work orders list is empty</Text>
            <Text style={styles.paragraph}><Text style={styles.bold}>Solutions:</Text></Text>
            <Text style={styles.bullet}>• Pull down to refresh the list</Text>
            <Text style={styles.bullet}>• Check you're logged in with correct account</Text>
            <Text style={styles.bullet}>• Verify work orders are assigned to you (not someone else)</Text>
            <Text style={styles.bullet}>• Contact your dispatcher or help desk</Text>
            
            <Text style={styles.subheading}>❌ QR scanner not working</Text>
            <Text style={styles.paragraph}><Text style={styles.bold}>Problem:</Text> Camera doesn't open or scan fails</Text>
            <Text style={styles.paragraph}><Text style={styles.bold}>Solutions:</Text></Text>
            <Text style={styles.bullet}>• Grant camera permission in app settings</Text>
            <Text style={styles.bullet}>• Ensure QR code is well-lit and in focus</Text>
            <Text style={styles.bullet}>• Use manual entry as backup</Text>
            <Text style={styles.bullet}>• Restart the app</Text>
            
            <Text style={styles.subheading}>❌ Not receiving notifications</Text>
            <Text style={styles.paragraph}><Text style={styles.bold}>Problem:</Text> No push notifications for new tickets</Text>
            <Text style={styles.paragraph}><Text style={styles.bold}>Solutions:</Text></Text>
            <Text style={styles.bullet}>• Check notification permission granted</Text>
            <Text style={styles.bullet}>• Check phone notification settings</Text>
            <Text style={styles.bullet}>• Ensure internet connection active</Text>
            <Text style={styles.bullet}>• Logout and login again</Text>
            <Text style={styles.bullet}>• Reinstall app if issue persists</Text>
            
            <Text style={styles.subheading}>❌ Login fails</Text>
            <Text style={styles.paragraph}><Text style={styles.bold}>Problem:</Text> Can't login with Google account</Text>
            <Text style={styles.paragraph}><Text style={styles.bold}>Solutions:</Text></Text>
            <Text style={styles.bullet}>• Check internet connection</Text>
            <Text style={styles.bullet}>• Verify you're using correct Google account</Text>
            <Text style={styles.bullet}>• Check your account is invited to organization</Text>
            <Text style={styles.bullet}>• Contact your administrator</Text>
            
            <Text style={styles.subheading}>📞 Getting Help</Text>
            <Text style={styles.paragraph}>
              If issues persist, contact your organization's administrator or technical support.
            </Text>
          </View>
        );

      default:
        return (
          <View>
            <Text style={styles.sectionTitle}>Documentation Coming Soon</Text>
            <Text style={styles.paragraph}>
              Detailed documentation for this topic will be added soon.
            </Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📖 Help</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.sidebar}>
          <ScrollView>
            {topics.map((topic) => (
              <TouchableOpacity
                key={topic.id}
                style={[
                  styles.topicButton,
                  selectedTopic === topic.id && styles.topicButtonActive
                ]}
                onPress={() => setSelectedTopic(topic.id)}
              >
                <Text style={styles.topicIcon}>{topic.icon}</Text>
                <Text style={[
                  styles.topicTitle,
                  selectedTopic === topic.id && styles.topicTitleActive
                ]}>
                  {topic.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <ScrollView style={styles.mainContent}>
          <View style={styles.contentInner}>
            {renderContent()}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1f2937',
    padding: 16,
    paddingTop: 48
  },
  backButton: {
    padding: 8
  },
  backText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold'
  },
  placeholder: {
    width: 60
  },
  content: {
    flex: 1,
    flexDirection: 'row'
  },
  sidebar: {
    width: 120,
    backgroundColor: 'white',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb'
  },
  topicButton: {
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  topicButtonActive: {
    backgroundColor: '#8b5cf6'
  },
  topicIcon: {
    fontSize: 24,
    marginBottom: 4
  },
  topicTitle: {
    fontSize: 11,
    textAlign: 'center',
    color: '#6b7280'
  },
  topicTitleActive: {
    color: 'white',
    fontWeight: '600'
  },
  mainContent: {
    flex: 1,
    backgroundColor: 'white'
  },
  contentInner: {
    padding: 20
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16
  },
  subheading: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 20,
    marginBottom: 12
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: '#6b7280',
    marginBottom: 16
  },
  bullet: {
    fontSize: 15,
    lineHeight: 24,
    color: '#6b7280',
    marginLeft: 8,
    marginBottom: 8
  },
  bold: {
    fontWeight: '700',
    color: '#111827'
  },
  tip: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    marginVertical: 12,
    fontSize: 14,
    color: '#1e40af'
  },
  warning: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    marginVertical: 12,
    fontSize: 14,
    color: '#92400e'
  }
});

