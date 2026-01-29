/**
 * Plan Details Screen - Mobile App
 * Shows detailed plan information based on user role.
 * For tower-crew/installer: deployment stage, notes, installation photo URLs; §5 in-app capture/upload.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { apiService } from '../services/apiService';

interface PlanDetailsScreenProps {
  route: {
    params: {
      plan: any;
      role: string;
    };
  };
}

const STAGES: { value: string; label: string }[] = [
  { value: 'preparation', label: 'Preparation' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'testing', label: 'Testing' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' }
];

const PlanDetailsScreen: React.FC<PlanDetailsScreenProps> = ({ route }) => {
  const { plan: initialPlan, role } = route.params;
  const [plan, setPlan] = useState(initialPlan);
  const [saving, setSaving] = useState(false);
  const [notesDraft, setNotesDraft] = useState(
    plan.deployment?.notes ?? plan.deployment?.documentation?.notes ?? ''
  );
  const [photoUrlsDraft, setPhotoUrlsDraft] = useState(
    (plan.deployment?.documentation?.installationPhotos ?? []).join('\n')
  );
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const userId = auth().currentUser?.uid ?? '';

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

  const handleUpdateStage = async (stage: string) => {
    if (!userId || saving) return;
    setSaving(true);
    try {
      const res = await apiService.updatePlanDeployment(userId, plan.id, { deploymentStage: stage });
      setPlan((p: any) => ({ ...p, deployment: { ...p.deployment, deploymentStage: stage } }));
      if (res?.plan?.deployment) {
        setPlan((p: any) => ({ ...p, deployment: { ...p.deployment, ...res.plan.deployment } }));
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update progress');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!userId || saving) return;
    setSaving(true);
    try {
      await apiService.updatePlanDeployment(userId, plan.id, { notes: notesDraft });
      setPlan((p: any) => ({ ...p, deployment: { ...p.deployment, notes: notesDraft } }));
      Alert.alert('Saved', 'Field notes updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save notes');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePhotoUrls = async () => {
    if (!userId || saving) return;
    const urls = photoUrlsDraft
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      await apiService.updatePlanDeployment(userId, plan.id, {
        documentation: { installationPhotos: urls }
      });
      setPlan((p: any) => ({
        ...p,
        deployment: {
          ...p.deployment,
          documentation: { ...p.deployment?.documentation, installationPhotos: urls }
        }
      }));
      Alert.alert('Saved', 'Installation photo URLs updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save photo URLs');
    } finally {
      setSaving(false);
    }
  };

  const uploadPhotoAndAppendUrl = async (uri: string, filename?: string, mimeType?: string) => {
    if (!plan?.id || !userId || uploadingPhoto) return;
    setUploadingPhoto(true);
    try {
      const { url } = await apiService.uploadPlanDeploymentPhoto(
        userId,
        plan.id,
        uri,
        filename || `photo-${Date.now()}.jpg`,
        mimeType || 'image/jpeg'
      );
      setPhotoUrlsDraft((prev) => (prev ? `${prev}\n${url}` : url));
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Could not upload photo. Paste a URL above instead.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleTakePhoto = () => {
    launchCamera({ mediaType: 'photo', quality: 0.8 }, (res) => {
      if (res.didCancel || res.errorMessage) return;
      const asset = res.assets?.[0];
      if (asset?.uri) uploadPhotoAndAppendUrl(asset.uri, asset.fileName, asset.type);
    });
  };

  const handleChoosePhoto = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (res) => {
      if (res.didCancel || res.errorMessage) return;
      const asset = res.assets?.[0];
      if (asset?.uri) uploadPhotoAndAppendUrl(asset.uri, asset.fileName, asset.type);
    });
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

          {(role === 'tower-crew' || role === 'installer') && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📊 Progress & Notes</Text>
              <View style={styles.stageRow}>
                <Text style={styles.stageLabel}>Stage:</Text>
                <Text style={styles.stageValue}>
                  {(plan.deployment?.deploymentStage || 'planning').replace(/_/g, ' ')}
                </Text>
              </View>
              <View style={styles.stageButtons}>
                {STAGES.map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    style={[
                      styles.stageBtn,
                      plan.deployment?.deploymentStage === s.value && styles.stageBtnActive
                    ]}
                    onPress={() => handleUpdateStage(s.value)}
                    disabled={saving}
                  >
                    <Text
                      style={[
                        styles.stageBtnText,
                        plan.deployment?.deploymentStage === s.value && styles.stageBtnTextActive
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.notesLabel}>Field notes</Text>
              <TextInput
                style={styles.notesInput}
                value={notesDraft}
                onChangeText={setNotesDraft}
                placeholder="Add site notes, issues, completion details…"
                placeholderTextColor="#6b7280"
                multiline
                numberOfLines={4}
                editable={!saving}
              />
              <TouchableOpacity
                style={[styles.saveNotesBtn, saving && styles.saveNotesBtnDisabled]}
                onPress={handleSaveNotes}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveNotesBtnText}>Save notes</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.notesLabel}>Installation photos</Text>
              <View style={styles.photoButtonRow}>
                <TouchableOpacity
                  style={[styles.photoBtn, uploadingPhoto && styles.photoBtnDisabled]}
                  onPress={handleTakePhoto}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.photoBtnText}>📷 Take photo</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.photoBtn, uploadingPhoto && styles.photoBtnDisabled]}
                  onPress={handleChoosePhoto}
                  disabled={uploadingPhoto}
                >
                  <Text style={styles.photoBtnText}>🖼 Choose from library</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.notesLabel}>Photo URLs (one per line, or add via buttons above)</Text>
              <TextInput
                style={styles.notesInput}
                value={photoUrlsDraft}
                onChangeText={setPhotoUrlsDraft}
                placeholder="Paste URLs or use Take photo / Choose from library"
                placeholderTextColor="#6b7280"
                multiline
                numberOfLines={3}
                editable={!saving}
              />
              <TouchableOpacity
                style={[styles.saveNotesBtn, saving && styles.saveNotesBtnDisabled]}
                onPress={handleSavePhotoUrls}
                disabled={saving}
              >
                <Text style={styles.saveNotesBtnText}>Save photo URLs</Text>
              </TouchableOpacity>
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
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stageLabel: {
    fontSize: 14,
    color: '#a0a0b8',
    marginRight: 8,
  },
  stageValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'capitalize',
  },
  stageButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  stageBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  stageBtnActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  stageBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a0a0b8',
  },
  stageBtnTextActive: {
    color: '#ffffff',
  },
  notesLabel: {
    fontSize: 12,
    color: '#8b5cf6',
    marginBottom: 8,
  },
  photoButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  photoBtn: {
    flex: 1,
    backgroundColor: '#8b5cf6',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  photoBtnDisabled: { opacity: 0.6 },
  photoBtnText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  notesInput: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2d2d44',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#ffffff',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  saveNotesBtn: {
    backgroundColor: '#8b5cf6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveNotesBtnDisabled: {
    opacity: 0.6,
  },
  saveNotesBtnText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    color: '#a0a0b8',
    marginBottom: 12,
  },
});

export default PlanDetailsScreen;

