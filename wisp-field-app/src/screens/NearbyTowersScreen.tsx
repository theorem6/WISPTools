/**
 * Nearby Towers Screen
 * Show towers near current location
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
import Geolocation from '@react-native-community/geolocation';
import { useNavigation } from '@react-navigation/native';
import { apiService } from '../services/apiService';

export default function NearbyTowersScreen() {
  const [towers, setTowers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const navigation = useNavigation();

  useEffect(() => {
    loadTowers();
  }, []);

  const loadTowers = async () => {
    setIsLoading(true);
    
    try {
      // Get current location
      Geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.log('Location error:', error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );

      // Load all towers
      const sites = await apiService.getSites();
      
      // Calculate distances if we have current location
      const towersWithDistance = sites.map((site: any) => {
        if (currentLocation && site.location) {
          const distance = calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            site.location.latitude,
            site.location.longitude
          );
          return { ...site, distance };
        }
        return site;
      });

      // Sort by distance
      towersWithDistance.sort((a, b) => (a.distance || 999) - (b.distance || 999));

      setTowers(towersWithDistance);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load towers');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const renderTower = ({ item }: any) => (
    <TouchableOpacity
      style={styles.towerCard}
      onPress={() => navigation.navigate('TowerDetails' as never, { tower: item } as never)}
    >
      <View style={styles.towerHeader}>
        <Text style={styles.towerIcon}>📡</Text>
        <View style={styles.towerInfo}>
          <Text style={styles.towerName}>{item.name}</Text>
          <Text style={styles.towerType}>{item.type}</Text>
        </View>
        {item.distance && (
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceText}>
              {item.distance.toFixed(1)} km
            </Text>
          </View>
        )}
      </View>

      {item.location?.address && (
        <Text style={styles.address}>{item.location.address}</Text>
      )}

      {item.gateCode && (
        <View style={styles.gateCodeRow}>
          <Text style={styles.gateLabel}>🔐 Gate Code:</Text>
          <Text style={styles.gateCode}>{item.gateCode}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={styles.loadingText}>Loading towers...</Text>
        </View>
      ) : (
        <FlatList
          data={towers}
          renderItem={renderTower}
          keyExtractor={(item) => item._id || item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {currentLocation ? '📍 Towers Near You' : '📡 All Towers'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {towers.length} sites found
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📡</Text>
              <Text style={styles.emptyText}>No towers found</Text>
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
    marginBottom: 15
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9ca3af'
  },
  towerCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#374151'
  },
  towerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  towerIcon: {
    fontSize: 32,
    marginRight: 12
  },
  towerInfo: {
    flex: 1
  },
  towerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4
  },
  towerType: {
    fontSize: 14,
    color: '#9ca3af',
    textTransform: 'capitalize'
  },
  distanceBadge: {
    backgroundColor: '#7c3aed',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12
  },
  distanceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  address: {
    fontSize: 14,
    color: '#d1d5db',
    marginBottom: 8
  },
  gateCodeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#374151',
    padding: 10,
    borderRadius: 6,
    marginTop: 8
  },
  gateLabel: {
    fontSize: 14,
    color: '#9ca3af'
  },
  gateCode: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
    fontFamily: 'monospace'
  },
  emptyState: {
    alignItems: 'center',
    padding: 40
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 15
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af'
  }
});

