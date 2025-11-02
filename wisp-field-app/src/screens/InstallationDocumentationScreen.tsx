/**
 * Installation Documentation Screen
 * Capture photos and documentation for installations
 * Requires management approval before completion
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  TextInput
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import {launchCamera, launchImageLibrary, ImagePickerResponse, Asset} from 'react-native-image-picker';
import { apiService } from '../services/apiService';
import Geolocation from '@react-native-community/geolocation';

interface Photo {
  uri: string;
  type?: string;
  filename?: string;
  description?: string;
  category?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export default function InstallationDocumentationScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { workOrder, siteId, siteName, installationType } = route.params as any;
  
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [currentLocation, setCurrentLocation] = useState<{latitude: number; longitude: number} | null>(null);

  useEffect(() => {
    // Get current location for photo metadata
    Geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        console.warn('Location error:', error);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }, []);

  const capturePhoto = () => {
    const options = {
      mediaType: 'photo' as const,
      quality: 0.8,
      saveToPhotos: true,
      cameraType: 'back' as const
    };

    launchCamera(options, (response: ImagePickerResponse) => {
      if (response.didCancel) {
        return;
      } else if (response.errorMessage) {
        Alert.alert('Error', response.errorMessage);
      } else if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        const newPhoto: Photo = {
          uri: asset.uri || '',
          type: asset.type,
          filename: asset.fileName || `photo-${Date.now()}.jpg`,
          location: currentLocation || undefined
        };
        setPhotos([...photos, newPhoto]);
      }
    });
  };

  const selectPhoto = () => {
    const options = {
      mediaType: 'photo' as const,
      quality: 0.8,
      selectionLimit: 5
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel) {
        return;
      } else if (response.errorMessage) {
        Alert.alert('Error', response.errorMessage);
      } else if (response.assets) {
        const newPhotos: Photo[] = response.assets.map(asset => ({
          uri: asset.uri || '',
          type: asset.type,
          filename: asset.fileName || `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`,
          location: currentLocation || undefined
        }));
        setPhotos([...photos, ...newPhotos]);
      }
    });
  };

  const removePhoto = (index: number) => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const newPhotos = photos.filter((_, i) => i !== index);
            setPhotos(newPhotos);
          }
        }
      ]
    );
  };

  const setPhotoCategory = (index: number, category: string) => {
    const updatedPhotos = [...photos];
    updatedPhotos[index].category = category;
    setPhotos(updatedPhotos);
  };

  const createDocumentation = async () => {
    if (!workOrder && !siteId) {
      Alert.alert('Error', 'Work order or site ID is required');
      return;
    }

    try {
      setUploading(true);

      // Create documentation entry
      const doc = await apiService.createInstallationDocumentation({
        workOrderId: workOrder?._id,
        installationType: installationType || 'equipment',
        siteId: siteId || workOrder?.affectedSites?.[0]?.siteId,
        siteName: siteName || workOrder?.affectedSites?.[0]?.siteName,
        location: workOrder?.location || {},
        isSubcontractor: false // TODO: Check if user is subcontractor
      });

      setDocId(doc._id);

      // Upload photos
      if (photos.length > 0) {
        const photoData = photos.map(p => ({
          description: p.description,
          category: p.category || 'other',
          location: p.location
        }));

        await apiService.uploadInstallationPhotos(doc._id, photos, photoData);
      }

      // Update documentation with equipment list and notes
      await apiService.updateInstallationDocumentation(doc._id, {
        documentation: {
          equipmentList: equipmentList,
          notes: notes
        }
      });

      Alert.alert('Success', 'Documentation created. Add equipment details and submit for approval.');
    } catch (error: any) {
      console.error('Error creating documentation:', error);
      Alert.alert('Error', error.message || 'Failed to create documentation');
    } finally {
      setUploading(false);
    }
  };

  const submitForApproval = async () => {
    if (!docId) {
      Alert.alert('Error', 'Please create documentation first');
      return;
    }

    if (photos.length < 3) {
      Alert.alert('Warning', 'At least 3 photos are recommended for documentation');
    }

    if (equipmentList.length === 0) {
      Alert.alert('Error', 'Please add at least one equipment item');
      return;
    }

    Alert.alert(
      'Submit for Approval',
      'This will submit the documentation for management approval. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            try {
              setUploading(true);
              await apiService.submitInstallationDocumentation(docId);
              Alert.alert(
                'Success',
                'Documentation submitted for approval. Management will review and approve before completion.',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.goBack()
                  }
                ]
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to submit documentation');
            } finally {
              setUploading(false);
            }
          }
        }
      ]
    );
  };

  const addEquipment = () => {
    Alert.prompt(
      'Add Equipment',
      'Enter equipment details (format: Serial Number, Model)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: (text) => {
            if (text) {
              const parts = text.split(',').map(s => s.trim());
              setEquipmentList([
                ...equipmentList,
                {
                  serialNumber: parts[0] || '',
                  model: parts[1] || '',
                  manufacturer: parts[2] || ''
                }
              ]);
            }
          }
        }
      ],
      'plain-text'
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Installation Documentation</Text>
        {workOrder && (
          <Text style={styles.subtitle}>Work Order: {workOrder.ticketNumber}</Text>
        )}
        {siteName && (
          <Text style={styles.subtitle}>Site: {siteName}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📸 Photos (Required: Minimum 3)</Text>
        <Text style={styles.helpText}>
          Take photos before, during, and after installation. Required for management approval.
        </Text>
        
        <View style={styles.photoButtons}>
          <TouchableOpacity style={styles.captureButton} onPress={capturePhoto}>
            <Text style={styles.buttonText}>📷 Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.selectButton} onPress={selectPhoto}>
            <Text style={styles.buttonText}>🖼️ Select from Library</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.photosGrid}>
          {photos.map((photo, index) => (
            <View key={index} style={styles.photoItem}>
              <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removePhoto(index)}
              >
                <Text style={styles.removeButtonText}>×</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.photoDescription}
                placeholder="Photo description"
                value={photo.description}
                onChangeText={(text) => {
                  const updated = [...photos];
                  updated[index].description = text;
                  setPhotos(updated);
                }}
              />
              <View style={styles.categoryButtons}>
                {['before', 'during', 'after', 'equipment'].map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryButton,
                      photo.category === cat && styles.categoryButtonActive
                    ]}
                    onPress={() => setPhotoCategory(index, cat)}
                  >
                    <Text style={[
                      styles.categoryButtonText,
                      photo.category === cat && styles.categoryButtonTextActive
                    ]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>

        {photos.length < 3 && (
          <Text style={styles.warningText}>
            ⚠️ Add at least {3 - photos.length} more photo(s)
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔧 Equipment Installed</Text>
        <TouchableOpacity style={styles.addButton} onPress={addEquipment}>
          <Text style={styles.addButtonText}>+ Add Equipment</Text>
        </TouchableOpacity>
        
        {equipmentList.map((eq, index) => (
          <View key={index} style={styles.equipmentItem}>
            <Text style={styles.equipmentText}>
              {eq.serialNumber} - {eq.model} {eq.manufacturer ? `(${eq.manufacturer})` : ''}
            </Text>
            <TouchableOpacity
              onPress={() => {
                const newList = equipmentList.filter((_, i) => i !== index);
                setEquipmentList(newList);
              }}
            >
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📝 Notes</Text>
        <TextInput
          style={styles.notesInput}
          multiline
          numberOfLines={4}
          placeholder="Installation notes, issues encountered, etc."
          value={notes}
          onChangeText={setNotes}
        />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
          onPress={docId ? submitForApproval : createDocumentation}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {docId ? '✅ Submit for Management Approval' : '📋 Create Documentation'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>⚠️ Approval Required</Text>
        <Text style={styles.infoText}>
          All installations require management approval before completion.
          Documentation will be reviewed and approved by management before
          the work order can be closed.
        </Text>
        {workOrder?.type === 'installation' && (
          <Text style={styles.infoText}>
            Subcontractor installations also require payment approval after
            documentation approval.
          </Text>
        )}
      </View>
    </ScrollView>
  );
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8
  },
  helpText: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 12
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  captureButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  selectButton: {
    flex: 1,
    backgroundColor: '#6b7280',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600'
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  photoItem: {
    width: '48%',
    marginBottom: 12
  },
  photoThumbnail: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: '#374151'
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ef4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  photoDescription: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#374151',
    borderRadius: 4,
    color: '#fff',
    fontSize: 12
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4
  },
  categoryButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#4b5563',
    borderRadius: 4
  },
  categoryButtonActive: {
    backgroundColor: '#3b82f6'
  },
  categoryButtonText: {
    color: '#9ca3af',
    fontSize: 10
  },
  categoryButtonTextActive: {
    color: '#fff'
  },
  warningText: {
    color: '#f59e0b',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic'
  },
  addButton: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600'
  },
  equipmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#374151',
    borderRadius: 8,
    marginBottom: 8
  },
  equipmentText: {
    color: '#fff',
    flex: 1
  },
  removeText: {
    color: '#ef4444',
    fontSize: 12
  },
  notesInput: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    minHeight: 100,
    textAlignVertical: 'top'
  },
  actions: {
    padding: 20
  },
  submitButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center'
  },
  submitButtonDisabled: {
    backgroundColor: '#6b7280'
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  infoBox: {
    margin: 20,
    padding: 16,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b'
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8
  },
  infoText: {
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 18,
    marginBottom: 8
  }
});
