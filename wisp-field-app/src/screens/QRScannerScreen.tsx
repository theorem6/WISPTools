/**
 * QR Code Scanner Screen
 * Scan asset tags and equipment QR codes using React Native Camera
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Vibration,
  TextInput,
  Modal
} from 'react-native';
import { RNCamera } from 'react-native-camera';
import { useNavigation } from '@react-navigation/native';
import { apiService } from '../services/apiService';

export default function QRScannerScreen() {
  const [isScanning, setIsScanning] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const navigation = useNavigation();

  const onBarCodeRead = (scanResult: any) => {
    if (!isScanning || isLoading) return;
    
    const scannedData = scanResult.data;
    if (scannedData) {
      handleScan(scannedData);
    }
  };

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

          <RNCamera
            style={styles.camera}
            type={RNCamera.Constants.Type.back}
            onBarCodeRead={onBarCodeRead}
            barCodeTypes={[
              RNCamera.Constants.BarCodeType.qr,
              RNCamera.Constants.BarCodeType.code128,
              RNCamera.Constants.BarCodeType.ean13
            ]}
            captureAudio={false}
          >
            <View style={styles.overlay}>
              <View style={styles.scanFrame} />
            </View>
          </RNCamera>

          <View style={styles.bottomContent}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.manualButton}
              onPress={() => setShowManualEntry(true)}
            >
              <Text style={styles.manualText}>⌨️ Manual Entry</Text>
            </TouchableOpacity>
          </View>

          <Modal
            visible={showManualEntry}
            transparent
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
                  autoFocus
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => {
                      setShowManualEntry(false);
                      setManualInput('');
                    }}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalSubmitButton}
                    onPress={() => {
                      if (manualInput.trim()) {
                        handleScan(manualInput.trim());
                        setShowManualEntry(false);
                        setManualInput('');
                      }
                    }}
                  >
                    <Text style={styles.modalSubmitText}>Search</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 20
  },
  input: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#fff',
    marginBottom: 20
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#374151',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center'
  },
  modalCancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: '#7c3aed',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center'
  },
  modalSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});

