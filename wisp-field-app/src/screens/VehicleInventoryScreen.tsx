/**
 * Vehicle Inventory Screen
 * Show equipment currently in service vehicle
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/apiService';

export default function VehicleInventoryScreen() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [vehicleName, setVehicleName] = useState('Service Vehicle');

  useEffect(() => {
    loadVehicleInventory();
  }, []);

  const loadVehicleInventory = async () => {
    setIsLoading(true);
    
    try {
      // Get vehicle ID from storage (set during login or in settings)
      const vehicleId = await AsyncStorage.getItem('vehicleId') || 'default';
      const vName = await AsyncStorage.getItem('vehicleName');
      if (vName) setVehicleName(vName);

      // Load inventory items in this vehicle
      const items = await apiService.getVehicleInventory(vehicleId);
      setInventory(items || []);
    } catch (error: any) {
      console.error('Failed to load vehicle inventory:', error);
      // Gracefully handle 404 - just show empty state
      setInventory([]);
      if (error.response?.status !== 404) {
        console.log('Vehicle inventory not available - showing empty state');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      available: '#10b981',
      deployed: '#3b82f6',
      'in-transit': '#f59e0b',
      maintenance: '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  const renderItem = ({ item }: any) => (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{item.manufacturer} {item.model}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.itemDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Serial #:</Text>
          <Text style={styles.detailValue}>{item.serialNumber}</Text>
        </View>
        
        {item.assetTag && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Asset Tag:</Text>
            <Text style={styles.detailValue}>{item.assetTag}</Text>
          </View>
        )}
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Category:</Text>
          <Text style={styles.detailValue}>{item.category}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.deployButton}
        onPress={() => {
          Alert.alert(
            'Deploy Equipment',
            `Deploy ${item.manufacturer} ${item.model} to a tower site?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Select Tower', onPress: () => {
                Alert.alert('Coming Soon', 'Tower selection will be available in next update');
              }}
            ]
          );
        }}
      >
        <Text style={styles.deployText}>🚀 Deploy to Site</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={styles.loadingText}>Loading inventory...</Text>
        </View>
      ) : (
        <FlatList
          data={inventory}
          renderItem={renderItem}
          keyExtractor={(item) => item._id || item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.headerIcon}>🚚</Text>
              <Text style={styles.headerTitle}>{vehicleName}</Text>
              <Text style={styles.headerSubtitle}>
                {inventory.length} items in vehicle
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyText}>No equipment in vehicle</Text>
              <Text style={styles.emptySubtext}>
                Load equipment from warehouse or RMA to start
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 15,
    color: '#9ca3af',
    fontSize: 16
  },
  list: {
    padding: 15
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 20
  },
  headerIcon: {
    fontSize: 64,
    marginBottom: 10
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9ca3af'
  },
  itemCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#374151'
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  itemDetails: {
    marginBottom: 12
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#374151'
  },
  detailLabel: {
    fontSize: 14,
    color: '#9ca3af'
  },
  detailValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500'
  },
  deployButton: {
    backgroundColor: '#7c3aed',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  deployText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold'
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 15
  },
  emptyText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 8
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 40
  }
});

