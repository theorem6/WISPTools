/**
 * Deployment Wizard Screen
 * Step-by-step equipment deployment process
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiService } from '../services/apiService';

type DeploymentType = 'sector' | 'backhaul' | 'cpe';

export default function DeploymentWizardScreen() {
  const [step, setStep] = useState(1);
  const [deploymentType, setDeploymentType] = useState<DeploymentType | null>(null);
  const [scannedEquipment, setScannedEquipment] = useState<any>(null);
  const [selectedSite, setSelectedSite] = useState<any>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [deploymentData, setDeploymentData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    try {
      const allSites = await apiService.getSites();
      setSites(allSites.filter((s: any) => 
        s.type === 'tower' || s.type === 'rooftop' || s.type === 'monopole'
      ));
    } catch (error) {
      console.error('Failed to load sites:', error);
    }
  };

  const handleSelectType = (type: DeploymentType) => {
    setDeploymentType(type);
    setStep(2);
  };

  const handleScanEquipment = () => {
    navigation.navigate('QRScanner' as never, {
      mode: 'deployment',
      onScan: (item: any) => {
        setScannedEquipment(item);
        setStep(3);
      }
    } as never);
  };

  const handleSelectSite = (site: any) => {
    setSelectedSite(site);
    setStep(4);
  };

  const handleDeploy = async () => {
    if (!scannedEquipment || !selectedSite) {
      Alert.alert('Error', 'Please complete all steps');
      return;
    }

    setIsLoading(true);

    try {
      // Deploy equipment to site
      await apiService.deployEquipment(scannedEquipment._id, {
        siteId: selectedSite._id,
        siteName: selectedSite.name,
        deploymentType,
        ...deploymentData,
        deployedDate: new Date()
      });

      Alert.alert(
        'Success!',
        `${scannedEquipment.manufacturer} ${scannedEquipment.model} deployed to ${selectedSite.name}`,
        [{
          text: 'Done',
          onPress: () => {
            // Reset wizard
            setStep(1);
            setDeploymentType(null);
            setScannedEquipment(null);
            setSelectedSite(null);
            setDeploymentData({});
            navigation.goBack();
          }
        }]
      );
    } catch (error: any) {
      Alert.alert('Deployment Failed', error.message || 'Could not deploy equipment');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Select deployment type
  if (step === 1) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Deploy Equipment</Text>
          <Text style={styles.subtitle}>Select deployment type</Text>
        </View>

        <View style={styles.typeSelection}>
          <TouchableOpacity
            style={styles.typeButton}
            onPress={() => handleSelectType('sector')}
          >
            <Text style={styles.typeIcon}>📶</Text>
            <Text style={styles.typeText}>LTE Sector</Text>
            <Text style={styles.typeSubtext}>Deploy radio & antenna</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.typeButton}
            onPress={() => handleSelectType('backhaul')}
          >
            <Text style={styles.typeIcon}>🔗</Text>
            <Text style={styles.typeText}>Backhaul Link</Text>
            <Text style={styles.typeSubtext}>Fiber or wireless</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.typeButton}
            onPress={() => handleSelectType('cpe')}
          >
            <Text style={styles.typeIcon}>📱</Text>
            <Text style={styles.typeText}>Customer CPE</Text>
            <Text style={styles.typeSubtext}>Install at customer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Step 2: Scan equipment
  if (step === 2) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep(1)}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Scan Equipment</Text>
          <Text style={styles.subtitle}>Step 2 of 4</Text>
        </View>

        <View style={styles.scanPrompt}>
          <Text style={styles.promptIcon}>📷</Text>
          <Text style={styles.promptText}>
            Scan the equipment QR code
          </Text>
          
          <TouchableOpacity
            style={styles.scanBigButton}
            onPress={handleScanEquipment}
          >
            <Text style={styles.scanBigText}>📷 Open Scanner</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Step 3: Select site
  if (step === 3 && scannedEquipment) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep(2)}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Select Site</Text>
          <Text style={styles.subtitle}>Step 3 of 4</Text>
        </View>

        <View style={styles.equipmentSummary}>
          <Text style={styles.summaryTitle}>Equipment:</Text>
          <Text style={styles.summaryText}>
            {scannedEquipment.manufacturer} {scannedEquipment.model}
          </Text>
          <Text style={styles.summarySerial}>
            SN: {scannedEquipment.serialNumber}
          </Text>
        </View>

        <ScrollView style={styles.siteList}>
          {sites.map((site) => (
            <TouchableOpacity
              key={site._id}
              style={styles.siteCard}
              onPress={() => handleSelectSite(site)}
            >
              <Text style={styles.siteIcon}>📡</Text>
              <View style={styles.siteInfo}>
                <Text style={styles.siteName}>{site.name}</Text>
                <Text style={styles.siteType}>{site.type}</Text>
                {site.location?.address && (
                  <Text style={styles.siteAddress}>{site.location.address}</Text>
                )}
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // Step 4: Enter deployment details
  if (step === 4 && scannedEquipment && selectedSite) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep(3)}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Deployment Details</Text>
          <Text style={styles.subtitle}>Step 4 of 4</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              📦 {scannedEquipment.manufacturer} {scannedEquipment.model}
            </Text>
            <Text style={styles.summaryText}>
              📡 {selectedSite.name}
            </Text>
          </View>

          {deploymentType === 'sector' && (
            <>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Azimuth (degrees)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0-360"
                  placeholderTextColor="#6b7280"
                  keyboardType="numeric"
                  value={deploymentData.azimuth}
                  onChangeText={(text) => setDeploymentData({...deploymentData, azimuth: text})}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Antenna Height (feet)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="150"
                  placeholderTextColor="#6b7280"
                  keyboardType="numeric"
                  value={deploymentData.height}
                  onChangeText={(text) => setDeploymentData({...deploymentData, height: text})}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Band</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Band 71 (600MHz)"
                  placeholderTextColor="#6b7280"
                  value={deploymentData.band}
                  onChangeText={(text) => setDeploymentData({...deploymentData, band: text})}
                />
              </View>
            </>
          )}

          {deploymentType === 'cpe' && (
            <>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Customer Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Smith"
                  placeholderTextColor="#6b7280"
                  value={deploymentData.customerName}
                  onChangeText={(text) => setDeploymentData({...deploymentData, customerName: text})}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Antenna Azimuth (toward tower)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="270"
                  placeholderTextColor="#6b7280"
                  keyboardType="numeric"
                  value={deploymentData.azimuth}
                  onChangeText={(text) => setDeploymentData({...deploymentData, azimuth: text})}
                />
              </View>
            </>
          )}

          <View style={styles.formGroup}>
            <Text style={styles.label}>Installation Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Installation details, cable routes, etc."
              placeholderTextColor="#6b7280"
              multiline
              numberOfLines={4}
              value={deploymentData.notes}
              onChangeText={(text) => setDeploymentData({...deploymentData, notes: text})}
            />
          </View>

          <TouchableOpacity
            style={styles.deployButton}
            onPress={handleDeploy}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.deployText}>🚀 Complete Deployment</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return null;
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
  backText: {
    color: '#9ca3af',
    fontSize: 16,
    marginBottom: 10
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af'
  },
  typeSelection: {
    padding: 20,
    gap: 15
  },
  typeButton: {
    backgroundColor: '#1f2937',
    padding: 25,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151'
  },
  typeIcon: {
    fontSize: 48,
    marginBottom: 10
  },
  typeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4
  },
  typeSubtext: {
    fontSize: 14,
    color: '#9ca3af'
  },
  scanPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  promptIcon: {
    fontSize: 80,
    marginBottom: 20
  },
  promptText: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 30
  },
  scanBigButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 20,
    paddingHorizontal: 50,
    borderRadius: 12
  },
  scanBigText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold'
  },
  equipmentSummary: {
    backgroundColor: '#1f2937',
    padding: 20,
    margin: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10b981'
  },
  summaryTitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 8
  },
  summaryText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4
  },
  summarySerial: {
    fontSize: 14,
    color: '#9ca3af'
  },
  siteList: {
    flex: 1,
    padding: 15
  },
  siteCard: {
    backgroundColor: '#1f2937',
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#374151'
  },
  siteIcon: {
    fontSize: 32,
    marginRight: 12
  },
  siteInfo: {
    flex: 1
  },
  siteName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2
  },
  siteType: {
    fontSize: 13,
    color: '#9ca3af',
    textTransform: 'capitalize',
    marginBottom: 2
  },
  siteAddress: {
    fontSize: 12,
    color: '#6b7280'
  },
  arrow: {
    fontSize: 20,
    color: '#7c3aed'
  },
  form: {
    padding: 20
  },
  summary: {
    backgroundColor: '#1f2937',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8
  },
  formGroup: {
    marginBottom: 20
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8
  },
  input: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff'
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top'
  },
  deployButton: {
    backgroundColor: '#10b981',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20
  },
  deployText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold'
  }
});

