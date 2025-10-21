/**
 * Splash Screen
 * Handles app initialization, permissions, and Firebase auth
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert
} from 'react-native';
import { requestAllPermissions, PermissionStatus } from '../utils/PermissionManager';

interface SplashScreenProps {
  onReady: () => void;
}

export default function SplashScreen({ onReady }: SplashScreenProps) {
  const [status, setStatus] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Step 1: Check Firebase (already initialized by React Native Firebase)
      setStatus('Connecting to Firebase...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 2: Request permissions
      setStatus('Requesting permissions...');
      const permissions = await requestAllPermissions();
      
      // Log permission status
      console.log('Permissions granted:', permissions);
      
      // Step 3: Wait a moment for smooth transition
      setStatus('Loading app...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 4: Show warning if critical permissions denied
      if (!permissions.allGranted) {
        const deniedPerms = [];
        if (!permissions.camera) deniedPerms.push('Camera');
        if (!permissions.location) deniedPerms.push('Location');
        if (!permissions.storage) deniedPerms.push('Storage');
        
        Alert.alert(
          'Permissions Needed',
          `Some features require: ${deniedPerms.join(', ')}. You can enable them later in Settings.`,
          [{ text: 'Continue', onPress: onReady }]
        );
      } else {
        onReady();
      }
      
    } catch (err: any) {
      console.error('Splash initialization error:', err);
      setError(err.message || 'Failed to initialize app');
      
      // Continue anyway after 2 seconds
      setTimeout(() => {
        Alert.alert(
          'Initialization Warning',
          'The app encountered an issue during startup but will continue. Some features may not work properly.',
          [{ text: 'Continue', onPress: onReady }]
        );
      }, 2000);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* App Icon/Logo */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📡</Text>
        </View>
        
        {/* App Name */}
        <Text style={styles.title}>WISP Field</Text>
        <Text style={styles.subtitle}>Equipment Management</Text>
        
        {/* Status */}
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7c3aed" />
            <Text style={styles.statusText}>{status}</Text>
          </View>
        )}
        
        {/* Footer */}
        <Text style={styles.version}>v1.0.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center'
  },
  content: {
    alignItems: 'center',
    padding: 40
  },
  iconContainer: {
    marginBottom: 30
  },
  icon: {
    fontSize: 100
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 18,
    color: '#9ca3af',
    marginBottom: 60
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 16
  },
  statusText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 16
  },
  errorContainer: {
    alignItems: 'center',
    gap: 12
  },
  errorIcon: {
    fontSize: 48
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    maxWidth: 280
  },
  version: {
    position: 'absolute',
    bottom: 20,
    fontSize: 12,
    color: '#6b7280'
  }
});

