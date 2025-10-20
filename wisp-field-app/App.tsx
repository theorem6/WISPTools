/**
 * WISP Field App - Mobile Equipment Scanner
 * React Native app for field technicians
 */

import React, { useEffect, useState } from 'react';
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

  // Handle user state changes
  useEffect(() => {
    const subscriber = auth().onAuthStateChanged((user) => {
      setUser(user);
      if (initializing) setInitializing(false);
    });
    
    return subscriber; // Unsubscribe on unmount
  }, []);

  if (initializing) {
    return null; // Or a splash screen
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

