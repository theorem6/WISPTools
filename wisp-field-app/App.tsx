/**
 * WISP Field App - Mobile Equipment Scanner
 * React Native app for field technicians
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, StatusBar, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import auth from '@react-native-firebase/auth';
import notificationService from './src/services/notificationService';

// Screens
import SplashScreen from './src/screens/SplashScreen';
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

// Ignore specific warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'Require cycle:',
]);

const Stack = createStackNavigator();

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const navigationRef = useRef<any>(null);

  // Handle user state changes
  useEffect(() => {
    if (!isReady) return;

    let subscriber: (() => void) | undefined;
    
    try {
      subscriber = auth().onAuthStateChanged((authUser) => {
        console.log('Auth state:', authUser?.email || 'No user');
        setUser(authUser);
        setAuthChecking(false);
      });
    } catch (err) {
      console.error('Auth listener error:', err);
      setAuthChecking(false);
    }
    
    // Timeout fallback
    const timeout = setTimeout(() => {
      if (authChecking) {
        console.log('Auth check timeout - continuing without auth');
        setAuthChecking(false);
      }
    }, 3000);
    
    return () => {
      if (subscriber) subscriber();
      clearTimeout(timeout);
    };
  }, [isReady]);

  // Setup push notifications
  useEffect(() => {
    if (!isReady || !user) return;

    // Request notification permissions
    notificationService.requestPermission();
    
    // Setup handlers
    notificationService.setupForegroundHandler();
    notificationService.setupBackgroundHandler();
    
    // Setup navigation listener for notification taps
    if (navigationRef.current) {
      notificationService.setupNotificationOpenedListener(navigationRef.current);
    }
    
    // Cleanup on logout
    return () => {
      if (!auth().currentUser) {
        notificationService.unregisterDevice();
      }
    };
  }, [isReady, user]);

  // Show splash screen during initialization
  if (!isReady) {
    return <SplashScreen onReady={() => setIsReady(true)} />;
  }

  // Show loading while checking auth
  if (authChecking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#111827' }}>
        <StatusBar barStyle="light-content" backgroundColor="#111827" />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1f2937" />
      <NavigationContainer ref={navigationRef}>
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
    </>
  );
}
