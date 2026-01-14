/**
 * WISP Field App - Mobile Equipment Scanner
 * React Native app for field technicians
 * ARM64 Compatible Version
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import auth from '@react-native-firebase/auth';

// Simple navigation state management
type ScreenType = 'login' | 'home' | 'scanner' | 'inventory' | 'towers' | 'workorders';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('login');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((user) => {
      setUser(user);
      setCurrentScreen(user ? 'home' : 'login');
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleLogin = async (email: string, password: string) => {
    try {
      await auth().signInWithEmailAndPassword(email, password);
    } catch (error: any) {
      Alert.alert('Login Error', error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await auth().signOut();
    } catch (error: any) {
      Alert.alert('Logout Error', error.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading WISP Field App...</Text>
      </View>
    );
  }

  if (currentScreen === 'login') {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>WISPTools.io Field App</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.navBar}>
        <TouchableOpacity
          style={[styles.navButton, currentScreen === 'home' && styles.activeNavButton]}
          onPress={() => setCurrentScreen('home')}
        >
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navButton, currentScreen === 'scanner' && styles.activeNavButton]}
          onPress={() => setCurrentScreen('scanner')}
        >
          <Text style={styles.navText}>Scanner</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navButton, currentScreen === 'inventory' && styles.activeNavButton]}
          onPress={() => setCurrentScreen('inventory')}
        >
          <Text style={styles.navText}>Inventory</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navButton, currentScreen === 'towers' && styles.activeNavButton]}
          onPress={() => setCurrentScreen('towers')}
        >
          <Text style={styles.navText}>Towers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navButton, currentScreen === 'workorders' && styles.activeNavButton]}
          onPress={() => setCurrentScreen('workorders')}
        >
          <Text style={styles.navText}>Work Orders</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {currentScreen === 'home' && <HomeScreen />}
        {currentScreen === 'scanner' && <ScannerScreen />}
        {currentScreen === 'inventory' && <InventoryScreen />}
        {currentScreen === 'towers' && <TowersScreen />}
        {currentScreen === 'workorders' && <WorkOrdersScreen />}
      </ScrollView>
    </View>
  );
};

// Login Screen Component
const LoginScreen: React.FC<{ onLogin: (email: string, password: string) => void }> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <View style={styles.loginContainer}>
      <Text style={styles.loginTitle}>WISPTools.io</Text>
      <Text style={styles.loginSubtitle}>Field Operations Platform</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Email</Text>
        <View style={styles.input}>
          <Text style={styles.inputText}>{email || 'demo@wispfieldapp.com'}</Text>
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Password</Text>
        <View style={styles.input}>
          <Text style={styles.inputText}>{password || '••••••••'}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.loginButton}
        onPress={() => onLogin('demo@wispfieldapp.com', 'password')}
      >
        <Text style={styles.loginButtonText}>Login</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>ARM64 Compatible Build v1.0.0</Text>
    </View>
  );
};

// Home Screen Component
const HomeScreen: React.FC = () => (
  <View style={styles.screen}>
    <Text style={styles.screenTitle}>Dashboard</Text>
    <View style={styles.statsGrid}>
      <View style={styles.statCard}>
        <Text style={styles.statNumber}>24</Text>
        <Text style={styles.statLabel}>Active Work Orders</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statNumber}>156</Text>
        <Text style={styles.statLabel}>Equipment Items</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statNumber}>12</Text>
        <Text style={styles.statLabel}>Nearby Towers</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statNumber}>98%</Text>
        <Text style={styles.statLabel}>System Health</Text>
      </View>
    </View>
  </View>
);

// Scanner Screen Component
const ScannerScreen: React.FC = () => (
  <View style={styles.screen}>
    <Text style={styles.screenTitle}>QR Scanner</Text>
    <View style={styles.scannerPlaceholder}>
      <Text style={styles.placeholderText}>Camera functionality</Text>
      <Text style={styles.placeholderSubtext}>ARM64 compatibility in progress</Text>
    </View>
    <TouchableOpacity style={styles.scanButton}>
      <Text style={styles.scanButtonText}>Scan Equipment QR Code</Text>
    </TouchableOpacity>
  </View>
);

// Inventory Screen Component
const InventoryScreen: React.FC = () => (
  <View style={styles.screen}>
    <Text style={styles.screenTitle}>Vehicle Inventory</Text>
    <View style={styles.inventoryList}>
      <View style={styles.inventoryItem}>
        <Text style={styles.itemName}>Cable Tester - Fluke DTX-1800</Text>
        <Text style={styles.itemStatus}>Available</Text>
      </View>
      <View style={styles.inventoryItem}>
        <Text style={styles.itemName}>Spectrum Analyzer - Anritsu S332E</Text>
        <Text style={styles.itemStatus}>In Use</Text>
      </View>
      <View style={styles.inventoryItem}>
        <Text style={styles.itemName}>Ladder - 32ft Extension</Text>
        <Text style={styles.itemStatus}>Available</Text>
      </View>
    </View>
  </View>
);

// Towers Screen Component
const TowersScreen: React.FC = () => (
  <View style={styles.screen}>
    <Text style={styles.screenTitle}>Nearby Towers</Text>
    <View style={styles.towersList}>
      <View style={styles.towerItem}>
        <Text style={styles.towerName}>Tower WISP-001</Text>
        <Text style={styles.towerDistance}>2.3 miles away</Text>
        <Text style={styles.towerStatus}>Online</Text>
      </View>
      <View style={styles.towerItem}>
        <Text style={styles.towerName}>Tower WISP-002</Text>
        <Text style={styles.towerDistance}>4.1 miles away</Text>
        <Text style={styles.towerStatus}>Maintenance</Text>
      </View>
    </View>
  </View>
);

// Work Orders Screen Component
const WorkOrdersScreen: React.FC = () => (
  <View style={styles.screen}>
    <Text style={styles.screenTitle}>Work Orders</Text>
    <View style={styles.workOrdersList}>
      <View style={styles.workOrderItem}>
        <Text style={styles.workOrderTitle}>Install Sector Antenna</Text>
        <Text style={styles.workOrderLocation}>Tower WISP-001</Text>
        <Text style={styles.workOrderPriority}>High Priority</Text>
      </View>
      <View style={styles.workOrderItem}>
        <Text style={styles.workOrderTitle}>Cable Testing</Text>
        <Text style={styles.workOrderLocation}>Tower WISP-003</Text>
        <Text style={styles.workOrderPriority}>Medium Priority</Text>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007bff',
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  header: {
    backgroundColor: '#007bff',
    padding: 16,
    paddingTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 4,
  },
  logoutText: {
    color: 'white',
    fontSize: 14,
  },
  navBar: {
    backgroundColor: 'white',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  navButton: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  activeNavButton: {
    backgroundColor: '#e8f4ff',
    borderBottomWidth: 2,
    borderBottomColor: '#007bff',
  },
  navText: {
    fontSize: 12,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  screen: {
    padding: 16,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#007bff',
  },
  loginTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 40,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    color: 'white',
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: 12,
  },
  inputText: {
    color: 'white',
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  loginButtonText: {
    color: '#007bff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  versionText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 40,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    width: '48%',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007bff',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  scannerPlaceholder: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 40,
    alignItems: 'center',
    marginBottom: 20,
  },
  placeholderText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#999',
  },
  scanButton: {
    backgroundColor: '#28a745',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  scanButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inventoryList: {
    backgroundColor: 'white',
    borderRadius: 8,
  },
  inventoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  itemName: {
    fontSize: 16,
    flex: 1,
  },
  itemStatus: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: 'bold',
  },
  towersList: {
    backgroundColor: 'white',
    borderRadius: 8,
  },
  towerItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  towerName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  towerDistance: {
    fontSize: 14,
    color: '#666',
  },
  towerStatus: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: 'bold',
  },
  workOrdersList: {
    backgroundColor: 'white',
    borderRadius: 8,
  },
  workOrderItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  workOrderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  workOrderLocation: {
    fontSize: 14,
    color: '#666',
  },
  workOrderPriority: {
    fontSize: 14,
    color: '#dc3545',
    fontWeight: 'bold',
  },
});

export default App;