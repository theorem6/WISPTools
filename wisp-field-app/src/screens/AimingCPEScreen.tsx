/**
 * CPE Aiming Screen
 * Aim and configure CPE devices
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
  ScrollView
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { apiService } from '../services/apiService';
import { colors } from '../theme/colors';

export default function AimingCPEScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [selectedCPE, setSelectedCPE] = useState<any>(null);
  
  // Handle scanned item from QRScanner
  useEffect(() => {
    const scannedItem = (route.params as any)?.scannedItem;
    if (scannedItem) {
      handleCPEScanned(scannedItem);
      // Clear the param to avoid re-processing (safe check)
      try {
        if (navigation.setParams) {
          navigation.setParams({ scannedItem: undefined });
        }
      } catch (e) {
        // Ignore if setParams not available
      }
    }
  }, [(route.params as any)?.scannedItem]);
  const [isLoading, setIsLoading] = useState(false);
  const [azimuth, setAzimuth] = useState('');
  const [elevation, setElevation] = useState('');
  const [signalStrength, setSignalStrength] = useState('');
  const [notes, setNotes] = useState('');

  const handleScanCPE = () => {
    navigation.navigate('QRScanner' as never, {
      mode: 'aiming'
    } as never);
  };

  const handleCPEScanned = async (item: any) => {
    // Check if item is a CPE device
    if (item.type !== 'cpe' && item.category !== 'cpe') {
      Alert.alert('Invalid Device', 'Please scan a CPE device');
      return;
    }

    setSelectedCPE(item);
    // Load existing aiming data if available
    if (item.aiming) {
      setAzimuth(item.aiming.azimuth?.toString() || '');
      setElevation(item.aiming.elevation?.toString() || '');
      setSignalStrength(item.aiming.signalStrength?.toString() || '');
      setNotes(item.aiming.notes || '');
    }
  };

  const handleSaveAiming = async () => {
    if (!selectedCPE) {
      Alert.alert('Error', 'Please scan a CPE device first');
      return;
    }

    if (!azimuth || !elevation) {
      Alert.alert('Error', 'Please enter azimuth and elevation');
      return;
    }

    setIsLoading(true);

    try {
      // Update CPE aiming data
      const updateData = {
        aiming: {
          azimuth: parseFloat(azimuth),
          elevation: parseFloat(elevation),
          signalStrength: signalStrength ? parseFloat(signalStrength) : null,
          notes: notes,
          aimedAt: new Date().toISOString(),
          aimedBy: 'field-technician' // Could get from auth
        }
      };

      // Update via network API
      await apiService.updateCPEAiming(selectedCPE._id || selectedCPE.id, updateData);

      Alert.alert(
        'Success',
        'CPE aiming data saved successfully',
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setSelectedCPE(null);
              setAzimuth('');
              setElevation('');
              setSignalStrength('');
              setNotes('');
            }
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save aiming data');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>CPE Aiming</Text>
        <Text style={styles.subtitle}>
          Aim and configure CPE devices
        </Text>
      </View>

      {!selectedCPE ? (
        <View style={styles.scanSection}>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={handleScanCPE}
          >
            <Text style={styles.scanIcon}>📷</Text>
            <Text style={styles.scanText}>Scan CPE Device</Text>
            <Text style={styles.scanSubtext}>
              Scan QR code on CPE to begin aiming
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.formSection}>
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceName}>
              {selectedCPE.manufacturer} {selectedCPE.model}
            </Text>
            <Text style={styles.deviceSerial}>
              SN: {selectedCPE.serialNumber}
            </Text>
            {selectedCPE.siteName && (
              <Text style={styles.deviceLocation}>
                📍 {selectedCPE.siteName}
              </Text>
            )}
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Azimuth (degrees)</Text>
              <TextInput
                style={styles.input}
                value={azimuth}
                onChangeText={setAzimuth}
                placeholder="0-360"
                placeholderTextColor="#6b7280"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Elevation (degrees)</Text>
              <TextInput
                style={styles.input}
                value={elevation}
                onChangeText={setElevation}
                placeholder="-90 to 90"
                placeholderTextColor="#6b7280"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Signal Strength (dBm)</Text>
              <TextInput
                style={styles.input}
                value={signalStrength}
                onChangeText={setSignalStrength}
                placeholder="e.g., -65"
                placeholderTextColor="#6b7280"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Additional notes about aiming..."
                placeholderTextColor="#6b7280"
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setSelectedCPE(null);
                  setAzimuth('');
                  setElevation('');
                  setSignalStrength('');
                  setNotes('');
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveAiming}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.textPrimary} />
                ) : (
                  <Text style={styles.saveText}>💾 Save Aiming Data</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary
  },
  header: {
    padding: 20,
    backgroundColor: colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary
  },
  scanSection: {
    padding: 40,
    alignItems: 'center'
  },
  scanButton: {
    backgroundColor: colors.primary,
    paddingVertical: 30,
    paddingHorizontal: 40,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400
  },
  scanIcon: {
    fontSize: 64,
    marginBottom: 15
  },
  scanText: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8
  },
  scanSubtext: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center'
  },
  formSection: {
    padding: 20
  },
  deviceInfo: {
    backgroundColor: colors.backgroundSecondary,
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border
  },
  deviceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4
  },
  deviceSerial: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4
  },
  deviceLocation: {
    fontSize: 14,
    color: colors.textSecondary
  },
  form: {
    gap: 20
  },
  inputGroup: {
    gap: 8
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary
  },
  input: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: colors.textPrimary
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top'
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 10
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.backgroundTertiary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center'
  },
  cancelText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600'
  },
  saveButton: {
    flex: 2,
    backgroundColor: colors.success,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center'
  },
  saveText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold'
  }
});





