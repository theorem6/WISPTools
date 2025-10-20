/**
 * QR Code Scanner Screen
 * Scan asset tags and equipment QR codes using Vision Camera
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Vibration
} from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { useNavigation } from '@react-navigation/native';
import { apiService } from '../services/apiService';

export default function QRScannerScreen() {
  const [isScanning, setIsScanning] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const navigation = useNavigation();
  const device = useCameraDevice('back');

  useEffect(() => {
    checkCameraPermission();
  }, []);

  const checkCameraPermission = async () => {
    const permission = await Camera.requestCameraPermission();
    setHasPermission(permission === 'granted');
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13', 'code-128'],
    onCodeScanned: (codes) => {
      if (!isScanning || isLoading || codes.length === 0) return;
      
      const scannedData = codes[0].value;
      if (scannedData) {
        handleScan(scannedData);
      }
    },
  });

  const handleScan = async (scannedData: string) => {
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
            [{ text: 'Scan Again', onPress: () => { setIsScanning(true); setIsLoading(false); } }]
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

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionIcon}>📷</Text>
          <Text style={styles.permissionText}>Camera Permission Required</Text>
          <Text style={styles.permissionSubtext}>
            Please grant camera access to scan QR codes
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={checkCameraPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No camera device found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={styles.loadingText}>Looking up equipment...</Text>
        </View>
      ) : (
        <>
          <View style={styles.topContent}>
            <Text style={styles.title}>Scan QR Code</Text>
            <Text style={styles.subtitle}>
              Point camera at equipment QR code or asset tag
            </Text>
          </View>

          <Camera
            style={styles.camera}
            device={device}
            isActive={isScanning && !isLoading}
            codeScanner={codeScanner}
          />

          <View style={styles.overlay}>
            <View style={styles.scanFrame} />
          </View>

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
                      handleScan(text);
                    }
                  }
                );
              }}
            >
              <Text style={styles.manualText}>⌨️ Manual Entry</Text>
            </TouchableOpacity>
          </View>
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
    flex: 1
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#1f2937'
  },
  permissionIcon: {
    fontSize: 80,
    marginBottom: 20
  },
  permissionText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center'
  },
  permissionSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 30,
    textAlign: 'center'
  },
  permissionButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 8
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100
  },
  overlay: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    bottom: 200,
    justifyContent: 'center',
    alignItems: 'center'
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#7c3aed',
    borderRadius: 20,
    backgroundColor: 'transparent'
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

