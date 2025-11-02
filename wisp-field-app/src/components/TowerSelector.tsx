import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  SafeAreaView
} from 'react-native';
import apiService from '../services/apiService';

interface Tower {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

interface TowerSelectorProps {
  onSelect: (tower: Tower) => void;
  selectedTowerId?: string;
  visible: boolean;
  onClose: () => void;
}

export default function TowerSelector({ onSelect, selectedTowerId, visible, onClose }: TowerSelectorProps) {
  const [towers, setTowers] = useState<Tower[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadTowers();
    }
  }, [visible]);

  const loadTowers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to fetch towers from network sites API
      // Fallback to empty array if endpoint doesn't exist
      try {
        const response = await apiService.get('/api/network/sites?type=tower');
        setTowers(response.data || []);
      } catch (apiError: any) {
        // If endpoint doesn't exist, try coverage map towers
        try {
          const coverageResponse = await apiService.get('/api/coverage-map/towers');
          setTowers(coverageResponse.data || []);
        } catch (coverageError) {
          console.warn('Tower API not available, using empty list');
          setTowers([]);
        }
      }
    } catch (error: any) {
      console.error('Error loading towers:', error);
      setError(error.message || 'Failed to load towers');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Tower</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading towers...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadTowers} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : towers.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No towers available</Text>
          </View>
        ) : (
          <FlatList
            data={towers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.towerItem,
                  selectedTowerId === item.id && styles.selected
                ]}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <Text style={styles.towerName}>{item.name}</Text>
                {item.location.address && (
                  <Text style={styles.towerAddress}>{item.location.address}</Text>
                )}
                <Text style={styles.towerCoordinates}>
                  {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333'
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center'
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  },
  emptyText: {
    color: '#999',
    fontSize: 16
  },
  listContainer: {
    padding: 16
  },
  towerItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0'
  },
  selected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF'
  },
  towerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4
  },
  towerAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4
  },
  towerCoordinates: {
    fontSize: 12,
    color: '#999'
  }
});
