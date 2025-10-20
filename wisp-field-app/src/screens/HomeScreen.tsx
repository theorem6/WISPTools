/**
 * Home Screen - Main menu for field app
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeScreen() {
  const navigation = useNavigation();
  const [userEmail, setUserEmail] = useState('');
  const [tenantName, setTenantName] = useState('');

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    const user = auth().currentUser;
    if (user) {
      setUserEmail(user.email || '');
    }
    
    const tenant = await AsyncStorage.getItem('tenantName');
    setTenantName(tenant || 'No Tenant');
  };

  const handleLogout = async () => {
    await auth().signOut();
    navigation.navigate('Login' as never);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1f2937" />
      
      <View style={styles.header}>
        <Text style={styles.title}>WISP Field App</Text>
        <Text style={styles.subtitle}>📡 {tenantName}</Text>
        <Text style={styles.userEmail}>{userEmail}</Text>
      </View>

      <View style={styles.menu}>
        <TouchableOpacity
          style={[styles.menuButton, styles.primaryButton]}
          onPress={() => navigation.navigate('QRScanner' as never)}
        >
          <Text style={styles.menuIcon}>📷</Text>
          <Text style={styles.menuText}>Scan QR Code</Text>
          <Text style={styles.menuSubtext}>Scan equipment tags</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.navigate('NearbyTowers' as never)}
        >
          <Text style={styles.menuIcon}>📡</Text>
          <Text style={styles.menuText}>Nearby Towers</Text>
          <Text style={styles.menuSubtext}>Find sites near you</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.navigate('VehicleInventory' as never)}
        >
          <Text style={styles.menuIcon}>🚚</Text>
          <Text style={styles.menuText}>Vehicle Inventory</Text>
          <Text style={styles.menuSubtext}>Equipment in truck</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.navigate('WorkOrders' as never)}
        >
          <Text style={styles.menuIcon}>📋</Text>
          <Text style={styles.menuText}>Work Orders</Text>
          <Text style={styles.menuSubtext}>Today's tasks</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 Logout</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827'
  },
  header: {
    padding: 30,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#374151'
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 4
  },
  userEmail: {
    fontSize: 14,
    color: '#6b7280'
  },
  menu: {
    padding: 15,
    gap: 15
  },
  menuButton: {
    backgroundColor: '#1f2937',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center'
  },
  primaryButton: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed'
  },
  menuIcon: {
    fontSize: 48,
    marginBottom: 10
  },
  menuText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4
  },
  menuSubtext: {
    fontSize: 14,
    color: '#9ca3af'
  },
  logoutButton: {
    margin: 15,
    padding: 15,
    backgroundColor: '#374151',
    borderRadius: 8,
    alignItems: 'center'
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});

