/**
 * Asset Details Screen
 * Display full equipment information after scanning
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { apiService } from '../services/apiService';
import TowerSelector from '../components/TowerSelector';

interface Tower {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

export default function AssetDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { item } = route.params as any;
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [showTowerSelector, setShowTowerSelector] = useState(false);

  const handleDeploy = async () => {
    Alert.alert(
      'Deploy Equipment',
      'Deploy this equipment to a tower site?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Select Tower',
          onPress: () => {
            setShowTowerSelector(true);
          }
        }
      ]
    );
  };

  const handleTowerSelect = async (tower: Tower) => {
    try {
      setIsUpdating(true);
      
      // Update asset location with selected tower
      await apiService.put(`/api/inventory/${item._id}`, {
        location: {
          ...item.location,
          towerId: tower.id,
          towerName: tower.name,
          latitude: tower.location.latitude,
          longitude: tower.location.longitude,
          address: tower.location.address
        },
        status: 'deployed'
      });
      
      Alert.alert('Success', `Equipment deployed to ${tower.name}`);
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to deploy equipment');
    } finally {
      setIsUpdating(false);
      setShowTowerSelector(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      await apiService.updateInventoryStatus(item._id, newStatus);
      Alert.alert('Success', `Status updated to: ${newStatus}`);
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      available: '#10b981',
      deployed: '#3b82f6',
      maintenance: '#f59e0b',
      rma: '#ef4444',
      reserved: '#8b5cf6'
    };
    return colors[status] || '#6b7280';
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Equipment Details</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.assetTag}>{item.assetTag || 'No Asset Tag'}</Text>
        
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status?.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>📋 Equipment Info</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Serial Number:</Text>
          <Text style={styles.value}>{item.serialNumber}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Manufacturer:</Text>
          <Text style={styles.value}>{item.manufacturer || 'N/A'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Model:</Text>
          <Text style={styles.value}>{item.model || 'N/A'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Category:</Text>
          <Text style={styles.value}>{item.category}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Type:</Text>
          <Text style={styles.value}>{item.equipmentType}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Condition:</Text>
          <Text style={styles.value}>{item.condition || 'N/A'}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>📍 Location</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Type:</Text>
          <Text style={styles.value}>{item.currentLocation?.type || 'Unknown'}</Text>
        </View>
        
        {item.currentLocation?.siteName && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Site:</Text>
            <Text style={styles.value}>{item.currentLocation.siteName}</Text>
          </View>
        )}
      </View>

      {item.modules?.acs && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🔗 ACS Integration</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Managed by ACS:</Text>
            <Text style={styles.value}>Yes ✅</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Device ID:</Text>
            <Text style={styles.value}>{item.modules.acs.deviceId}</Text>
          </View>
        </View>
      )}

      {item.notes && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📝 Notes</Text>
          <Text style={styles.notesText}>{item.notes}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.deployButton]}
          onPress={handleDeploy}
          disabled={isUpdating}
        >
          <Text style={styles.actionText}>🚀 Deploy to Site</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.maintenanceButton]}
          onPress={() => handleUpdateStatus('maintenance')}
          disabled={isUpdating}
        >
          <Text style={styles.actionText}>🔧 Mark Maintenance</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.rmaButton]}
          onPress={() => handleUpdateStatus('rma')}
          disabled={isUpdating}
        >
          <Text style={styles.actionText}>📦 Send to RMA</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    
    <TowerSelector
      visible={showTowerSelector}
      onClose={() => setShowTowerSelector(false)}
      onSelect={handleTowerSelect}
      selectedTowerId={item.location?.towerId}
    />
  </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827'
  },
  header: {
    padding: 20,
    backgroundColor: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151'
  },
  backButton: {
    marginBottom: 10
  },
  backText: {
    color: '#9ca3af',
    fontSize: 16
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff'
  },
  card: {
    backgroundColor: '#1f2937',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151'
  },
  assetTag: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#7c3aed',
    textAlign: 'center',
    marginBottom: 15,
    fontFamily: 'monospace'
  },
  statusBadge: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center'
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151'
  },
  label: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '600'
  },
  value: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500'
  },
  notesText: {
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 20
  },
  actions: {
    padding: 15,
    gap: 10
  },
  actionButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10
  },
  deployButton: {
    backgroundColor: '#7c3aed'
  },
  maintenanceButton: {
    backgroundColor: '#f59e0b'
  },
  rmaButton: {
    backgroundColor: '#ef4444'
  },
  actionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  }
});

