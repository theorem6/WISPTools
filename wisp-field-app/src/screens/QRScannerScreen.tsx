/**
 * QR Code Scanner Screen
 * Simple barcode/QR scanning with react-native-camera-kit
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  PermissionsAndroid,
  Platform
} from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';
import { useNavigation, useRoute } from '@react-navigation/native';
import { apiService } from '../services/apiService';

export default function QRScannerScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [hasScanned, setHasScanned] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const navigation = useNavigation();
  const route = useRoute();
  
  const scanMode = (route.params as any)?.mode || 'default';
  const onScanCallback = (route.params as any)?.onScan;

  useEffect(() => {
    checkCameraPermission();
  }, []);

  const checkCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.CAMERA
        );
        setHasPermission(hasPermission);
        
        if (!hasPermission) {
          // Offer to request permission if not granted at startup
          Alert.alert(
            'Camera Permission Needed',
            'Camera access is required to scan barcodes. Grant permission or use manual entry.',
            [
              { text: 'Manual Entry', onPress: () => setShowManualEntry(true) },
              { text: 'Grant Permission', onPress: requestCameraPermission }
            ]
          );
        }
      } catch (err) {
        console.warn(err);
        setHasPermission(false);
      }
    } else {
      setHasPermission(true);
    }
  };

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'WISP Field needs camera access to scan equipment barcodes and QR codes',
            buttonPositive: 'Allow',
          }
        );
        setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
      } catch (err) {
        console.warn(err);
        setHasPermission(false);
      }
    }
  };

  const handleBarCodeRead = async (event: any) => {
    if (hasScanned || isLoading) return;
    
    setHasScanned(true);
    const scannedData = event.nativeEvent.codeStringValue;
    
    console.log('Scanned:', scannedData);
    await processScannedData(scannedData);
    
    // Reset after 3 seconds to allow scanning again
    setTimeout(() => setHasScanned(false), 3000);
  };

  const processScannedData = async (data: string) => {
    setIsLoading(true);

    try {
      // Parse input data
      let parsedData;
      try {
        parsedData = JSON.parse(data);
      } catch {
        // Not JSON - treat as plain serial number or asset tag
        parsedData = { value: data.trim() };
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
        const searchTerm = parsedData.value || data.trim();
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
      console.error('Scan processing error:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to lookup equipment'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSearch = async () => {
    if (!manualInput.trim()) {
      Alert.alert('Error', 'Please enter an asset tag or serial number');
      return;
    }

    setShowManualEntry(false);
    await processScannedData(manualInput);
    setManualInput('');
  };

  return (
    <View style={styles.container}>
      {/* Camera View */}
      {hasPermission ? (
        <Camera
          style={styles.camera}
          cameraType={CameraType.Back}
          scanBarcode={true}
          onReadCode={handleBarCodeRead}
          showFrame={true}
          laserColor="rgba(124, 58, 237, 0.5)"
          frameColor="rgba(124, 58, 237, 0.8)"
        />
      ) : (
        <View style={styles.noPermissionView}>
          <Text style={styles.noPermissionIcon}>📷</Text>
          <Text style={styles.noPermissionText}>Camera Permission Required</Text>
          <Text style={styles.noPermissionSubtext}>
            Grant camera access to scan barcodes
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestCameraPermission}
          >
            <Text style={styles.permissionButtonText}>Request Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.manualEntryButton}
            onPress={() => setShowManualEntry(true)}
          >
            <Text style={styles.manualEntryButtonText}>Use Manual Entry Instead</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Overlay UI */}
      <View style={styles.overlay}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {scanMode === 'checkin' ? 'Scan to Checkin' :
             scanMode === 'checkout' ? 'Scan to Checkout' :
             scanMode === 'aiming' ? 'Scan CPE Device' :
             'Scan Equipment'}
          </Text>
          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => setShowManualEntry(true)}
          >
            <Text style={styles.manualButtonText}>✏️ Manual</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            📷 Point camera at barcode or QR code
          </Text>
          <Text style={styles.instructionSubtext}>
            Supports barcodes, QR codes, and asset tags
          </Text>
        </View>

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#7c3aed" />
              <Text style={styles.loadingText}>Looking up equipment...</Text>
            </View>
          </View>
        )}
      </View>

      {/* Manual Entry Modal */}
      <Modal
        visible={showManualEntry}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowManualEntry(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Manual Entry</Text>
            <Text style={styles.modalSubtitle}>
              Enter asset tag or serial number
            </Text>

            <TextInput
              style={styles.input}
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="Asset tag or serial number"
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus={true}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowManualEntry(false);
                  setManualInput('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.searchButton}
                onPress={handleManualSearch}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.searchButtonText}>🔍 Search</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  noPermissionView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 20
  },
  noPermissionIcon: {
    fontSize: 80,
    marginBottom: 20
  },
  noPermissionText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center'
  },
  noPermissionSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 30,
    textAlign: 'center'
  },
  permissionButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 12
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  manualEntryButton: {
    backgroundColor: '#374151',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8
  },
  manualEntryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.6)'
  },
  backButton: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff'
  },
  manualButton: {
    padding: 10,
    backgroundColor: 'rgba(124, 58, 237, 0.8)',
    borderRadius: 8
  },
  manualButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  instructions: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    margin: 20
  },
  instructionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center'
  },
  instructionSubtext: {
    fontSize: 14,
    color: '#d1d5db',
    textAlign: 'center'
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingBox: {
    backgroundColor: '#1f2937',
    padding: 30,
    borderRadius: 16,
    alignItems: 'center'
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center'
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 20,
    textAlign: 'center'
  },
  input: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#4b5563'
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  searchButton: {
    flex: 1,
    backgroundColor: '#7c3aed',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 56
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  }
});
