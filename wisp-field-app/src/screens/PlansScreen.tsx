/**
 * Plans Screen - Mobile App
 * Displays deployment plans based on user role
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/apiService';

interface Plan {
  id: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  scope?: any;
  deployment?: any;
  sites?: any[];
  sectors?: any[];
  installationSites?: any[];
}

interface PlansScreenProps {
  navigation: any;
}

const PlansScreen: React.FC<PlansScreenProps> = ({ navigation }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState<string>('tower-crew'); // Default to tower crew
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUserInfo();
    loadPlans();
  }, []);

  const loadUserInfo = async () => {
    try {
      const user = auth().currentUser;
      if (user) {
        setUserId(user.uid);
        // Get user role from storage or Firestore (default to tower-crew)
        const storedRole = await AsyncStorage.getItem('userRole');
        if (storedRole) {
          setUserRole(storedRole);
        }
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  const loadPlans = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const plansData = await apiService.getPlans(userId, userRole);
      setPlans(plansData);
    } catch (error) {
      console.error('Error loading plans:', error);
      Alert.alert('Error', 'Failed to load plans. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPlans();
    setRefreshing(false);
  };

  const handlePlanPress = async (plan: Plan) => {
    if (!userId) return;
    
    try {
      const planDetails = await apiService.getPlanDetails(userId, plan.id, userRole);
      if (planDetails) {
        navigation.navigate('PlanDetails', { plan: planDetails, role: userRole });
      } else {
        Alert.alert('Error', 'Failed to load plan details');
      }
    } catch (error) {
      console.error('Error loading plan details:', error);
      Alert.alert('Error', 'Failed to load plan details');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#22c55e'; // green
      case 'ready':
        return '#3b82f6'; // blue
      case 'rejected':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading && plans.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>Loading plans...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📋 Deployment Plans</Text>
        <Text style={styles.headerSubtitle}>
          {userRole === 'tower-crew' || userRole === 'installer' 
            ? 'Installation tasks assigned to you'
            : userRole === 'engineer'
            ? 'Technical deployment plans'
            : 'Plan overview'}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {plans.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>No Plans Available</Text>
            <Text style={styles.emptyText}>
              There are no deployment plans available for your role at this time.
            </Text>
          </View>
        ) : (
          plans.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={styles.planCard}
              onPress={() => handlePlanPress(plan)}
              activeOpacity={0.7}
            >
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan.name}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(plan.status) + '20' }
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: getStatusColor(plan.status) }
                    ]}
                  >
                    {getStatusLabel(plan.status)}
                  </Text>
                </View>
              </View>

              {plan.description && (
                <Text style={styles.planDescription} numberOfLines={2}>
                  {plan.description}
                </Text>
              )}

              <View style={styles.planFooter}>
                <View style={styles.planMeta}>
                  {plan.scope && (
                    <>
                      {typeof plan.scope.towers === 'number' && (
                        <Text style={styles.metaText}>
                          📡 {plan.scope.towers} towers
                        </Text>
                      )}
                      {typeof plan.scope.sectors === 'number' && (
                        <Text style={styles.metaText}>
                          📶 {plan.scope.sectors} sectors
                        </Text>
                      )}
                      {userRole === 'tower-crew' || userRole === 'installer' ? (
                        plan.installationSites && (
                          <Text style={styles.metaText}>
                            🏗️ {plan.installationSites.length} sites
                          </Text>
                        )
                      ) : null}
                    </>
                  )}
                </View>
                <Text style={styles.planDate}>
                  {formatDate(plan.updatedAt)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f23',
  },
  loadingText: {
    color: '#a0a0b8',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#a0a0b8',
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 100,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#a0a0b8',
    textAlign: 'center',
  },
  planCard: {
    backgroundColor: '#1a1a2e',
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  planDescription: {
    fontSize: 14,
    color: '#a0a0b8',
    marginBottom: 12,
    lineHeight: 20,
  },
  planFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  planMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaText: {
    fontSize: 12,
    color: '#8b5cf6',
  },
  planDate: {
    fontSize: 12,
    color: '#6b7280',
  },
});

export default PlansScreen;

