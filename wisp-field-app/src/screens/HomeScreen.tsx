/**
 * Home Screen - Main menu for field app
 * Shows only tasks the user has permission to perform
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/apiService';
import { colors } from '../theme/colors';

interface Task {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const [userEmail, setUserEmail] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);

  useEffect(() => {
    loadUserInfo();
    loadTasks();
  }, []);

  const loadUserInfo = async () => {
    const user = auth().currentUser;
    if (user) {
      setUserEmail(user.email || '');
    }
    
    const tenant = await AsyncStorage.getItem('tenantName');
    setTenantName(tenant || 'No Tenant');
  };

  const loadTasks = async () => {
    try {
      setIsLoadingTasks(true);
      const userTasks = await apiService.getMyTasks();
      setTasks(userTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      // On error, show no tasks (fail closed)
      setTasks([]);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const handleLogout = async () => {
    await auth().signOut();
    navigation.navigate('Login' as never);
  };

  // Map task IDs to navigation routes
  const getTaskRoute = (taskId: string): string => {
    const routeMap: Record<string, string> = {
      'inventory-checkin': 'Checkin',
      'inventory-checkout': 'Checkout',
      'deploy-network': 'DeploymentWizard',
      'deploy-tower': 'DeploymentWizard',
      'receive-trouble-tickets': 'WorkOrders',
      'resolve-trouble-tickets': 'WorkOrders',
      'log-trouble-tickets': 'WorkOrders',
      'aiming-cpe': 'AimingCPE'
    };
    return routeMap[taskId] || 'Home';
  };

  const handleTaskPress = (task: Task) => {
    const route = getTaskRoute(task.id);
    if (route === 'DeploymentWizard') {
      // For deploy tasks, pass the task type
      navigation.navigate(route as never, { taskType: task.id } as never);
    } else {
      navigation.navigate(route as never);
    }
  };

  // Check if user has a specific task
  const hasTask = (taskId: string): boolean => {
    return tasks.some(t => t.id === taskId);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1f2937" />
      
      <View style={styles.header}>
        <Text style={styles.title}>WISP Multitool</Text>
        <Text style={styles.subtitle}>📡 {tenantName}</Text>
        <Text style={styles.userEmail}>{userEmail}</Text>
      </View>

      <View style={styles.menu}>
        {/* QR Scanner - Always available (it's a tool, not a task) */}
        <TouchableOpacity
          style={[styles.menuButton, styles.primaryButton]}
          onPress={() => navigation.navigate('QRScanner' as never)}
        >
          <Text style={styles.menuIcon}>📷</Text>
          <Text style={styles.menuText}>Scan QR Code</Text>
          <Text style={styles.menuSubtext}>Scan equipment tags</Text>
        </TouchableOpacity>

        {isLoadingTasks ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading your tasks...</Text>
          </View>
        ) : tasks.length === 0 ? (
          <View style={styles.noTasksContainer}>
            <Text style={styles.noTasksIcon}>🔒</Text>
            <Text style={styles.noTasksText}>No tasks assigned</Text>
            <Text style={styles.noTasksSubtext}>
              Contact your administrator to get task permissions
            </Text>
          </View>
        ) : (
          <>
            {/* Inventory Tasks */}
            {(hasTask('inventory-checkout') || hasTask('inventory-checkin')) && (
              <View style={styles.menuRow}>
                {hasTask('inventory-checkout') && (
                  <TouchableOpacity
                    style={[styles.menuButton, styles.halfWidth]}
                    onPress={() => navigation.navigate('Checkout' as never)}
                  >
                    <Text style={styles.menuIcon}>📤</Text>
                    <Text style={styles.menuTextSmall}>Checkout</Text>
                    <Text style={styles.menuSubtextSmall}>Load vehicle</Text>
                  </TouchableOpacity>
                )}
                {hasTask('inventory-checkin') && (
                  <TouchableOpacity
                    style={[styles.menuButton, styles.halfWidth]}
                    onPress={() => navigation.navigate('Checkin' as never)}
                  >
                    <Text style={styles.menuIcon}>📥</Text>
                    <Text style={styles.menuTextSmall}>Checkin</Text>
                    <Text style={styles.menuSubtextSmall}>Return equipment</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Deployment Tasks */}
            {(hasTask('deploy-network') || hasTask('deploy-tower')) && (
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => navigation.navigate('DeploymentWizard' as never)}
              >
                <Text style={styles.menuIcon}>🚀</Text>
                <Text style={styles.menuText}>Deploy Equipment</Text>
                <Text style={styles.menuSubtext}>
                  {hasTask('deploy-network') && hasTask('deploy-tower')
                    ? 'Network & Tower deployment'
                    : hasTask('deploy-network')
                    ? 'Network deployment'
                    : 'Tower deployment'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Work Orders / Tickets */}
            {(hasTask('receive-trouble-tickets') || 
              hasTask('resolve-trouble-tickets') || 
              hasTask('log-trouble-tickets')) && (
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => navigation.navigate('WorkOrders' as never)}
              >
                <Text style={styles.menuIcon}>📋</Text>
                <Text style={styles.menuText}>Work Orders</Text>
                <Text style={styles.menuSubtext}>
                  {hasTask('log-trouble-tickets') && 'Log, receive & resolve tickets'}
                  {!hasTask('log-trouble-tickets') && hasTask('receive-trouble-tickets') && 'Receive & resolve tickets'}
                  {!hasTask('log-trouble-tickets') && !hasTask('receive-trouble-tickets') && 'Resolve tickets'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Aiming CPE */}
            {hasTask('aiming-cpe') && (
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => navigation.navigate('AimingCPE' as never)}
              >
                <Text style={styles.menuIcon}>🎯</Text>
                <Text style={styles.menuText}>Aiming CPE</Text>
                <Text style={styles.menuSubtext}>Aim and configure CPE devices</Text>
              </TouchableOpacity>
            )}

            {/* Always show these utility screens */}
            <View style={styles.menuRow}>
              <TouchableOpacity
                style={[styles.menuButton, styles.halfWidth]}
                onPress={() => navigation.navigate('NearbyTowers' as never)}
              >
                <Text style={styles.menuIcon}>📡</Text>
                <Text style={styles.menuTextSmall}>Towers</Text>
                <Text style={styles.menuSubtextSmall}>Near you</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuButton, styles.halfWidth]}
                onPress={() => navigation.navigate('VehicleInventory' as never)}
              >
                <Text style={styles.menuIcon}>🚚</Text>
                <Text style={styles.menuTextSmall}>Vehicle</Text>
                <Text style={styles.menuSubtextSmall}>My inventory</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.helpButton}
              onPress={() => navigation.navigate('Help' as never)}
            >
              <Text style={styles.menuIcon}>📖</Text>
              <Text style={styles.menuText}>Help & Documentation</Text>
              <Text style={styles.menuSubtext}>Guides and troubleshooting</Text>
            </TouchableOpacity>
          </>
        )}
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
    backgroundColor: colors.backgroundPrimary
  },
  header: {
    padding: 30,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 4
  },
  userEmail: {
    fontSize: 14,
    color: colors.textTertiary
  },
  menu: {
    padding: 15,
    gap: 15
  },
  menuButton: {
    backgroundColor: colors.backgroundSecondary,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center'
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  menuIcon: {
    fontSize: 48,
    marginBottom: 10
  },
  menuText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4
  },
  menuSubtext: {
    fontSize: 14,
    color: colors.textSecondary
  },
  menuRow: {
    flexDirection: 'row',
    gap: 15
  },
  halfWidth: {
    flex: 1
  },
  menuTextSmall: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4
  },
  menuSubtextSmall: {
    fontSize: 12,
    color: colors.textSecondary
  },
  helpButton: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 20,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary
  },
  logoutButton: {
    margin: 15,
    padding: 15,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    alignItems: 'center'
  },
  logoutText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600'
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 15,
    color: colors.textSecondary,
    fontSize: 16
  },
  noTasksContainer: {
    padding: 40,
    alignItems: 'center'
  },
  noTasksIcon: {
    fontSize: 64,
    marginBottom: 15
  },
  noTasksText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8
  },
  noTasksSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center'
  }
});

