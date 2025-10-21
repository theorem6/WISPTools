/**
 * WISP Field App - Mobile Equipment Scanner
 * React Native app for field technicians
 */

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import auth from '@react-native-firebase/auth';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import QRScannerScreen from './src/screens/QRScannerScreen';
import AssetDetailsScreen from './src/screens/AssetDetailsScreen';
import NearbyTowersScreen from './src/screens/NearbyTowersScreen';
import VehicleInventoryScreen from './src/screens/VehicleInventoryScreen';
import TowerDetailsScreen from './src/screens/TowerDetailsScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import DeploymentWizardScreen from './src/screens/DeploymentWizardScreen';
import WorkOrdersScreen from './src/screens/WorkOrdersScreen';

const Stack = createStackNavigator();

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle user state changes
  useEffect(() => {
    try {
      const subscriber = auth().onAuthStateChanged((user) => {
        console.log('Auth state changed:', user?.email || 'No user');
        setUser(user);
        if (initializing) setInitializing(false);
      });
      
      // Timeout fallback - if Firebase doesn't respond in 3 seconds, continue anyway
      const timeout = setTimeout(() => {
        if (initializing) {
          console.log('Firebase auth timeout - continuing without auth');
          setInitializing(false);
        }
      }, 3000);
      
      return () => {
        subscriber(); // Unsubscribe on unmount
        clearTimeout(timeout);
      };
    } catch (err: any) {
      console.error('Firebase initialization error:', err);
      setError(err.message);
      setInitializing(false);
    }
  }, []);

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>⚠️ Initialization Error</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <Text style={styles.errorHint}>Check Firebase configuration</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={user ? 'Home' : 'Login'}
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1f2937'
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold'
          }
        }}
      >
        {!user ? (
          // Auth Stack
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : (
          // App Stack
          <>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="QRScanner"
              component={QRScannerScreen}
              options={{ 
                title: 'Scan QR Code',
                headerShown: false 
              }}
            />
            <Stack.Screen
              name="AssetDetails"
              component={AssetDetailsScreen}
              options={{ title: 'Equipment Details' }}
            />
            <Stack.Screen
              name="NearbyTowers"
              component={NearbyTowersScreen}
              options={{ title: 'Nearby Towers' }}
            />
            <Stack.Screen
              name="VehicleInventory"
              component={VehicleInventoryScreen}
              options={{ title: 'Vehicle Inventory' }}
            />
            <Stack.Screen
              name="TowerDetails"
              component={TowerDetailsScreen}
              options={{ title: 'Tower Details' }}
            />
            <Stack.Screen
              name="Checkout"
              component={CheckoutScreen}
              options={{ title: 'Checkout Equipment' }}
            />
            <Stack.Screen
              name="DeploymentWizard"
              component={DeploymentWizardScreen}
              options={{ title: 'Deploy Equipment' }}
            />
            <Stack.Screen
              name="WorkOrders"
              component={WorkOrdersScreen}
              options={{ title: 'Work Orders' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9ca3af'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 20
  },
  errorText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ef4444',
    marginBottom: 16
  },
  errorMessage: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 8
  },
  errorHint: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center'
  }
});
