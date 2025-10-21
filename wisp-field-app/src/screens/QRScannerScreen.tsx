/**
 * QR Code Scanner Screen
 * Simple manual entry for asset tags and serial numbers
 * Camera view for visual reference
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiService } from '../services/apiService';

export default function QRScannerScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const navigation = useNavigation();

  const handleSearch = async () => {
    if (!searchInput.trim()) {
      Alert.alert('Error', 'Please enter an asset tag or serial number');
      return;
    }

    console.log('Searching for:', searchInput);
    setIsLoading(true);

    try {
      // Parse input data
      let parsedData;
      try {
        parsedData = JSON.parse(searchInput);
      } catch {
        // Not JSON - treat as plain serial number or asset tag
        parsedData = { value: searchInput.trim() };
      }

      console.log('Parsed data:', parsedData);

      // Handle different data types
      if (parsedData.type === 'inventory' && parsedData.assetTag) {
        // Asset tag - lookup in inventory
        const items = await apiService.getInventoryItems(parsedData.assetTag);
        
        if (items.length > 0) {
          // Navigate to asset details
          navigation.navigate('AssetDetails' as never, { item: items[0] } as never);
        } else {
          Alert.alert(
            'Not Found',
            `Asset tag ${parsedData.assetTag} not found in inventory`
          );
        }
      } else if (parsedData.serialNumber) {
        // Serial number - lookup in inventory
        const items = await apiService.getInventoryItems(parsedData.serialNumber);
        
        if (items.length > 0) {
          navigation.navigate('AssetDetails' as never, { item: items[0] } as never);
        } else {
          Alert.alert(
            'Not Found',
            `Serial number ${parsedData.serialNumber} not found`
          );
        }
      } else {
        // Generic search
        const searchTerm = parsedData.value || searchInput.trim();
        const items = await apiService.getInventoryItems(searchTerm);
        
        if (items.length > 0) {
          navigation.navigate('AssetDetails' as never, { item: items[0] } as never);
        } else {
          Alert.alert(
            'Not Found',
            `No equipment found matching: ${searchTerm}`
          );
        }
      }
    } catch (error: any) {
      console.error('Search error:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to lookup equipment'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.icon}>📷</Text>
        <Text style={styles.title}>Equipment Lookup</Text>
        <Text style={styles.subtitle}>
          Enter asset tag, serial number, or scan QR code
        </Text>
      </View>

      <View style={styles.searchSection}>
        <Text style={styles.label}>Asset Tag / Serial Number</Text>
        <TextInput
          style={styles.input}
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Enter asset tag or serial number"
          placeholderTextColor="#9ca3af"
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearch}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.searchButtonText}>🔍 Search Equipment</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>💡 Quick Tips</Text>
        
        <View style={styles.tipItem}>
          <Text style={styles.tipIcon}>📦</Text>
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>Asset Tags</Text>
            <Text style={styles.tipText}>
              Enter the barcode number from equipment labels
            </Text>
          </View>
        </View>

        <View style={styles.tipItem}>
          <Text style={styles.tipIcon}>🔢</Text>
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>Serial Numbers</Text>
            <Text style={styles.tipText}>
              Search by manufacturer serial numbers
            </Text>
          </View>
        </View>

        <View style={styles.tipItem}>
          <Text style={styles.tipIcon}>📋</Text>
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>QR Codes</Text>
            <Text style={styles.tipText}>
              Paste QR code data for instant lookup
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelText}>← Back to Home</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827'
  },
  contentContainer: {
    padding: 20
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 20
  },
  icon: {
    fontSize: 60,
    marginBottom: 16
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
    textAlign: 'center',
    paddingHorizontal: 20
  },
  searchSection: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d1d5db',
    marginBottom: 8
  },
  input: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#4b5563'
  },
  searchButton: {
    backgroundColor: '#7c3aed',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 56
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  infoSection: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start'
  },
  tipIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2
  },
  tipContent: {
    flex: 1
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4
  },
  tipText: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20
  },
  actions: {
    marginTop: 'auto',
    paddingBottom: 20
  },
  cancelButton: {
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});
