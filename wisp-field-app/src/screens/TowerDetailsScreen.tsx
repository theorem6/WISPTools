/**
 * Tower Details Screen
 * View tower information, sectors, and equipment
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { apiService } from '../services/apiService';

export default function TowerDetailsScreen() {
  const route = useRoute();
  const { tower } = route.params as any;
  
  const [equipment, setEquipment] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTowerData();
  }, []);

  const loadTowerData = async () => {
    setIsLoading(true);
    
    try {
      const [equip, secs] = await Promise.all([
        apiService.getEquipmentAtSite(tower._id || tower.id),
        apiService.getSectors(tower._id || tower.id)
      ]);
      
      setEquipment(equip);
      setSectors(secs);
    } catch (error) {
      console.error('Failed to load tower data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallContact = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleOpenMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${tower.location.latitude},${tower.location.longitude}`;
    Linking.openURL(url);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.towerIcon}>📡</Text>
        <Text style={styles.towerName}>{tower.name}</Text>
        <Text style={styles.towerType}>{tower.type}</Text>
        
        {tower.height && (
          <Text style={styles.height}>Height: {tower.height} ft</Text>
        )}
      </View>

      {tower.location && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📍 Location</Text>
          {tower.location.address && (
            <Text style={styles.address}>{tower.location.address}</Text>
          )}
          {tower.location.city && tower.location.state && (
            <Text style={styles.address}>
              {tower.location.city}, {tower.location.state} {tower.location.zipCode}
            </Text>
          )}
          <Text style={styles.coordinates}>
            {tower.location.latitude.toFixed(6)}, {tower.location.longitude.toFixed(6)}
          </Text>
          
          <TouchableOpacity style={styles.mapButton} onPress={handleOpenMaps}>
            <Text style={styles.mapButtonText}>🗺️ Open in Maps</Text>
          </TouchableOpacity>
        </View>
      )}

      {tower.gateCode && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🔐 Access</Text>
          <View style={styles.gateCodeBox}>
            <Text style={styles.gateLabel}>Gate Code:</Text>
            <Text style={styles.gateCode}>{tower.gateCode}</Text>
          </View>
          {tower.accessInstructions && (
            <Text style={styles.instructions}>{tower.accessInstructions}</Text>
          )}
        </View>
      )}

      {tower.siteContact && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>👤 Site Contact</Text>
          <Text style={styles.contactName}>{tower.siteContact.name}</Text>
          {tower.siteContact.phone && (
            <TouchableOpacity
              style={styles.phoneButton}
              onPress={() => handleCallContact(tower.siteContact.phone)}
            >
              <Text style={styles.phoneText}>📞 {tower.siteContact.phone}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {sectors.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📶 Sectors ({sectors.length})</Text>
          {sectors.map((sector: any, index: number) => (
            <View key={index} style={styles.sectorRow}>
              <Text style={styles.sectorName}>{sector.name}</Text>
              <Text style={styles.sectorDetails}>
                {sector.technology} • {sector.azimuth}° • {sector.band}
              </Text>
            </View>
          ))}
        </View>
      )}

      {equipment.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🔧 Equipment ({equipment.length})</Text>
          {equipment.map((item: any, index: number) => (
            <View key={index} style={styles.equipmentRow}>
              <Text style={styles.equipmentName}>
                {item.manufacturer} {item.model}
              </Text>
              <Text style={styles.equipmentSerial}>SN: {item.serialNumber}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827'
  },
  headerCard: {
    backgroundColor: '#1f2937',
    padding: 30,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#374151'
  },
  towerIcon: {
    fontSize: 64,
    marginBottom: 15
  },
  towerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center'
  },
  towerType: {
    fontSize: 16,
    color: '#9ca3af',
    textTransform: 'capitalize',
    marginBottom: 8
  },
  height: {
    fontSize: 14,
    color: '#d1d5db'
  },
  card: {
    backgroundColor: '#1f2937',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15
  },
  address: {
    fontSize: 14,
    color: '#d1d5db',
    marginBottom: 4
  },
  coordinates: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'monospace',
    marginTop: 8
  },
  mapButton: {
    backgroundColor: '#7c3aed',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold'
  },
  gateCodeBox: {
    backgroundColor: '#374151',
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  gateLabel: {
    fontSize: 14,
    color: '#9ca3af'
  },
  gateCode: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'monospace'
  },
  instructions: {
    fontSize: 14,
    color: '#d1d5db',
    marginTop: 12,
    lineHeight: 20
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10
  },
  phoneButton: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  phoneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  sectorRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#374151'
  },
  sectorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4
  },
  sectorDetails: {
    fontSize: 13,
    color: '#9ca3af'
  },
  equipmentRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#374151'
  },
  equipmentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4
  },
  equipmentSerial: {
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: 'monospace'
  }
});

