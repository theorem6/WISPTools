/**
 * Root stack navigator - wires Plans, Notifications, PlanDetails and all HomeScreen routes.
 * Auth: show Login when !user, else Main stack with Home as initial.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import PlansScreen from '../screens/PlansScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import PlanDetailsScreen from '../screens/PlanDetailsScreen';
import QRScannerScreen from '../screens/QRScannerScreen';
import CheckinScreen from '../screens/CheckinScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import DeploymentWizardScreen from '../screens/DeploymentWizardScreen';
import WorkOrdersScreen from '../screens/WorkOrdersScreen';
import AimingCPEScreen from '../screens/AimingCPEScreen';
import NearbyTowersScreen from '../screens/NearbyTowersScreen';
import VehicleInventoryScreen from '../screens/VehicleInventoryScreen';
import HelpScreen from '../screens/HelpScreen';
import AssetDetailsScreen from '../screens/AssetDetailsScreen';
import TowerDetailsScreen from '../screens/TowerDetailsScreen';
import InstallationDocumentationScreen from '../screens/InstallationDocumentationScreen';

const Stack = createStackNavigator();

function PlaceholderScreen({ route, navigation }: { route: { params?: { name?: string }; name: string }; navigation: any }) {
  const name = route.params?.name ?? route.name;
  return (
    <View style={placeholderStyles.container}>
      <Text style={placeholderStyles.title}>Coming soon</Text>
      <Text style={placeholderStyles.subtitle}>{name}</Text>
      <TouchableOpacity style={placeholderStyles.button} onPress={() => navigation.goBack()}>
        <Text style={placeholderStyles.buttonText}>Go back</Text>
      </TouchableOpacity>
    </View>
  );
}

const placeholderStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 24 },
  button: { backgroundColor: '#007bff', padding: 12, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16 },
});

type AppNavigatorProps = {
  initialRouteName?: 'Login' | 'Home';
};

export default function AppNavigator({ initialRouteName = 'Login' }: AppNavigatorProps) {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Plans" component={PlansScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="PlanDetails" component={PlanDetailsScreen} />
        <Stack.Screen name="QRScanner" component={QRScannerScreen} />
        <Stack.Screen name="Checkin" component={CheckinScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="DeploymentWizard" component={DeploymentWizardScreen} />
        <Stack.Screen name="WorkOrders" component={WorkOrdersScreen} />
        <Stack.Screen name="AimingCPE" component={AimingCPEScreen} />
        <Stack.Screen name="NearbyTowers" component={NearbyTowersScreen} />
        <Stack.Screen name="VehicleInventory" component={VehicleInventoryScreen} />
        <Stack.Screen name="Help" component={HelpScreen} />
        <Stack.Screen name="AssetDetails" component={AssetDetailsScreen} />
        <Stack.Screen name="TowerDetails" component={TowerDetailsScreen} />
        <Stack.Screen name="InstallationDocumentation" component={InstallationDocumentationScreen} />
        <Stack.Screen name="TicketDetails" component={PlaceholderScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
