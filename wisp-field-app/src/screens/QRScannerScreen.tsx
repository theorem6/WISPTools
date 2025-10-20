/**
 * QR Code Scanner Screen
 * Scan asset tags and equipment QR codes
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Vibration
} from 'react-native';
import QRCodeScanner from 'react-native-qrcode-scanner';
import { RNCamera } from 'react-native-camera';
import { useNavigation } from '@react-navigation/native';
import { apiService } from '../services/apiService';

export default function QRScannerScreen() {
  const [isScanning, setIsScanning] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation();

  const handleScan = async (event: any) => {
    if (!isScanning || isLoading) return;

    const scannedData = event.data;
    console.log('Scanned:', scannedData);

    // Vibrate on successful scan
    Vibration.vibrate(100);

    setIsScanning(false);
    setIsLoading(true);

    try {
      // Parse QR code data
      let parsedData;
      try {
        parsedData = JSON.parse(scannedData);
      } catch {
        // Not JSON - treat as plain serial number or asset tag
        parsedData = { value: scannedData };
      }

      console.log('Parsed data:', parsedData);

      // Handle different QR code types
      if (parsedData.type === 'inventory' && parsedData.assetTag) {
        // Asset tag - lookup in inventory
        const items = await apiService.getInventoryItems(parsedData.assetTag);
        
        if (items.length > 0) {
          // Navigate to asset details
          navigation.navigate('AssetDetails' as never, { item: items[0] } as never);
        } else {
          Alert.alert(
            'Not Found',
            `Asset tag ${parsedData.assetTag} not found in inventory`,
            [{ text: 'Scan Again', onPress: () => setIsScanning(true) }]
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
            `Serial number ${parsedData.serialNumber} not found`,
            [{ text: 'Scan Again', onPress: () => setIsScanning(true) }]
          );
        }
      } else {
        // Generic search
        const items = await apiService.getInventoryItems(scannedData);
        
        if (items.length > 0) {
          navigation.navigate('AssetDetails' as never, { item: items[0] } as never);
        } else {
          Alert.alert(
            'Not Found',
            `No equipment found matching: ${scannedData}`,
            [{ text: 'Scan Again', onPress: () => setIsScanning(true) }]
          );
        }
      }
    } catch (error: any) {
      console.error('Scan error:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to lookup equipment',
        [{ text: 'Try Again', onPress: () => setIsScanning(true) }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={styles.loadingText}>Looking up equipment...</Text>
        </View>
      ) : (
        <>
          <QRCodeScanner
            onRead={handleScan}
            reactivate={isScanning}
            reactivateTimeout={2000}
            showMarker={true}
            markerStyle={styles.marker}
            cameraStyle={styles.camera}
            topContent={
              <View style={styles.topContent}>
                <Text style={styles.title}>Scan QR Code</Text>
                <Text style={styles.subtitle}>
                  Point camera at equipment QR code or asset tag
                </Text>
              </View>
            }
            bottomContent={
              <View style={styles.bottomContent}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.manualButton}
                  onPress={() => {
                    Alert.prompt(
                      'Manual Entry',
                      'Enter asset tag or serial number',
                      async (text) => {
                        if (text) {
                          handleScan({ data: text });
                        }
                      }
                    );
                  }}
                >
                  <Text style={styles.manualText}>⌨️ Manual Entry</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000'
  },
  camera: {
    height: '100%',
    overflow: 'hidden'
  },
  marker: {
    borderColor: '#7c3aed',
    borderWidth: 3,
    borderRadius: 10
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1f2937'
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#fff',
    fontWeight: '600'
  },
  topContent: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#1f2937'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center'
  },
  bottomContent: {
    padding: 20,
    backgroundColor: '#1f2937',
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 15
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#374151',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center'
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  manualButton: {
    flex: 1,
    backgroundColor: '#7c3aed',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center'
  },
  manualText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});

