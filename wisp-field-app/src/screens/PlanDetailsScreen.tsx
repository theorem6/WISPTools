/**
 * Plan Details Screen - Mobile App
 * Shows detailed plan information based on user role
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert
} from 'react-native';
import { useRoute } from '@react-navigation/native';

interface PlanDetailsScreenProps {
  route: {
    params: {
      plan: any;
      role: string;
    };
  };
}

const PlanDetailsScreen: React.FC<PlanDetailsScreenProps> = ({ route }) => {
  const { plan, role } = route.params;

  const handleOpenMaps = (location: any) => {
    if (location?.latitude && location?.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Could not open maps app');
      });
    }
  };

  const handleCall = (phone: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() => {
        Alert.alert('Error', 'Could not make phone call');
      });
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{plan.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: '#22c55e20' }]}>
          <Text style={[styles.statusText, { color: '#22c55e' }]}>
            {plan.status?.toUpperCase() || 'APPROVED'}
          </Text>
        </View>
      </View>

      {plan.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.descriptionText}>{plan.description}</Text>
        </View>
      )}

      {/* Role-specific content */}
      {role === 'tower-crew' || role === 'installer' ? (
        <>
          {plan.installationSites && plan.installationSites.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                🏗️ Installation Sites ({plan.installationSites.length})
              </Text>
              {plan.installationSites.map((site: any, index: number) => (
                <View key={index} style={styles.siteCard}>
                  <Text style={styles.siteName}>{site.name}</Text>
                  
                  {site.address && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>📍 Address:</Text>
                      <Text style={styles.infoValue}>{site.address}</Text>
                    </View>
                  )}

                  {site.location && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleOpenMaps(site.location)}
                    >
                      <Text style={styles.actionButtonText}>🗺️ Navigate to Site</Text>
                    </TouchableOpacity>
                  )}

                  {site.contact && (
                    <View style={styles.contactSection}>
                      <Text style={styles.contactLabel}>📞 Contact:</Text>
                      {site.contact.name && (
                        <Text style={styles.contactValue}>{site.contact.name}</Text>
                      )}
                      {site.contact.phone && (
                        <TouchableOpacity onPress={() => handleCall(site.contact.phone)}>
                          <Text style={styles.phoneLink}>{site.contact.phone}</Text>
                        </TouchableOpacity>
                      )}
                      {site.contact.email && (
                        <Text style={styles.contactValue}>{site.contact.email}</Text>
                      )}
                    </View>
                  )}

                  {site.gateCode && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>🔑 Gate Code:</Text>
                      <Text style={styles.gateCode}>{site.gateCode}</Text>
                    </View>
                  )}

                  {site.accessInstructions && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>📋 Access:</Text>
                      <Text style={styles.infoValue}>{site.accessInstructions}</Text>
                    </View>
                  )}

                  {site.accessHours && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>🕐 Hours:</Text>
                      <Text style={styles.infoValue}>{site.accessHours}</Text>
                    </View>
                  )}

                  {site.safetyNotes && (
                    <View style={styles.warningBox}>
                      <Text style={styles.warningTitle}>⚠️ Safety Notes</Text>
                      <Text style={styles.warningText}>{site.safetyNotes}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {plan.sectors && plan.sectors.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                📶 Sectors ({plan.sectors.length})
              </Text>
              {plan.sectors.map((sector: any, index: number) => (
                <View key={index} style={styles.sectorCard}>
                  <Text style={styles.sectorName}>{sector.name}</Text>
                  <View style={styles.sectorDetails}>
                    <Text style={styles.sectorDetail}>
                      Azimuth: {sector.azimuth}°
                    </Text>
                    <Text style={styles.sectorDetail}>
                      Beamwidth: {sector.beamwidth}°
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {plan.equipment && plan.equipment.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                🔧 Equipment ({plan.equipment.length})
              </Text>
              {plan.equipment.map((eq: any, index: number) => (
                <View key={index} style={styles.equipmentCard}>
                  <Text style={styles.equipmentName}>
                    {eq.manufacturer} {eq.model}
                  </Text>
                  {eq.serialNumber && (
                    <Text style={styles.equipmentDetail}>
                      Serial: {eq.serialNumber}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {plan.deployment?.estimatedStartDate && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📅 Timeline</Text>
              <Text style={styles.timelineText}>
                Start: {formatDate(plan.deployment.estimatedStartDate)}
              </Text>
              {plan.deployment.estimatedEndDate && (
                <Text style={styles.timelineText}>
                  End: {formatDate(plan.deployment.estimatedEndDate)}
                </Text>
              )}
            </View>
          )}
        </>
      ) : (
        /* Engineer/Manager view */
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plan Information</Text>
          {plan.fullDetails && (
            <>
              {plan.fullDetails.scope && (
                <Text style={styles.infoText}>
                  Scope: {plan.fullDetails.scope.towers?.length || 0} towers,{' '}
                  {plan.fullDetails.scope.sectors?.length || 0} sectors
                </Text>
              )}
              {plan.fullDetails.purchasePlan?.totalEstimatedCost && (
                <Text style={styles.infoText}>
                  Estimated Cost: ${plan.fullDetails.purchasePlan.totalEstimatedCost.toLocaleString()}
                </Text>
              )}
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 14,
    color: '#a0a0b8',
    lineHeight: 20,
  },
  siteCard: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  siteName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#8b5cf6',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#a0a0b8',
  },
  gateCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22c55e',
  },
  contactSection: {
    marginTop: 12,
    marginBottom: 12,
  },
  contactLabel: {
    fontSize: 12,
    color: '#8b5cf6',
    marginBottom: 8,
  },
  contactValue: {
    fontSize: 14,
    color: '#a0a0b8',
    marginBottom: 4,
  },
  phoneLink: {
    fontSize: 14,
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },
  actionButton: {
    backgroundColor: '#8b5cf6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  warningBox: {
    backgroundColor: '#ef444420',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#ef444440',
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#fca5a5',
  },
  sectorCard: {
    backgroundColor: '#1a1a2e',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  sectorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  sectorDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  sectorDetail: {
    fontSize: 12,
    color: '#a0a0b8',
  },
  equipmentCard: {
    backgroundColor: '#1a1a2e',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  equipmentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  equipmentDetail: {
    fontSize: 12,
    color: '#a0a0b8',
  },
  timelineText: {
    fontSize: 14,
    color: '#a0a0b8',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#a0a0b8',
    marginBottom: 12,
  },
});

export default PlanDetailsScreen;

