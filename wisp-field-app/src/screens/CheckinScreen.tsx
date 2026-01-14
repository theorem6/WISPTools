/**
 * Equipment Checkin Screen
 * Scan items to return from field work
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { apiService } from '../services/apiService';
import { colors } from '../theme/colors';

interface CheckinItem {
  _id: string;
  assetTag: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  category: string;
}

export default function CheckinScreen() {
  const [cart, setCart] = useState<CheckinItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const navigation = useNavigation();
  const route = useRoute();
  
  // Handle scanned item from QRScanner
  useEffect(() => {
    const scannedItem = (route.params as any)?.scannedItem;
    if (scannedItem) {
      handleItemScanned(scannedItem);
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

  const handleScanItem = () => {
    navigation.navigate('QRScanner' as never, {
      mode: 'checkin'
    } as never);
  };
  
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Could check for scanned item here if we use a global state
    });
    return unsubscribe;
  }, [navigation]);

  const handleItemScanned = async (item: any) => {
    // Check if already in cart
    if (cart.find(i => i._id === item._id)) {
      Alert.alert('Already Added', 'This item is already in your checkin cart');
      return;
    }

    // Check if item is in-transit or deployed (can be checked in)
    if (item.status !== 'in-transit' && item.status !== 'deployed') {
      Alert.alert(
        'Cannot Checkin',
        `This item is currently: ${item.status}\nOnly in-transit or deployed items can be checked in.`
      );
      return;
    }

    // Add to cart
    setCart([...cart, item]);
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item._id !== id));
  };

  const handleCheckinAll = async () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please scan items to checkin');
      return;
    }

    Alert.alert(
      'Checkin Equipment',
      `Return ${cart.length} items to inventory?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Checkin',
          onPress: async () => {
            setIsProcessing(true);
            
            try {
              // Update each item to available status
              for (const item of cart) {
                await apiService.transferEquipment(item._id, {
                  newLocation: {
                    type: 'warehouse',
                    siteName: 'Main Warehouse'
                  },
                  reason: 'checkin',
                  notes: 'Returned from field work'
                });
                
                // Update status to available
                await apiService.updateInventoryStatus(item._id, 'available');
              }
              
              Alert.alert(
                'Success',
                `${cart.length} items checked in successfully`,
                [{ text: 'OK', onPress: () => {
                  setCart([]);
                  navigation.goBack();
                }}]
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Checkin failed');
            } finally {
              setIsProcessing(false);
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: CheckinItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.manufacturer} {item.model}</Text>
        <Text style={styles.itemSerial}>SN: {item.serialNumber}</Text>
        <Text style={styles.itemTag}>Tag: {item.assetTag || 'N/A'}</Text>
      </View>
      
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removeFromCart(item._id)}
      >
        <Text style={styles.removeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Equipment Checkin</Text>
        <Text style={styles.subtitle}>
          Scan items to return to inventory
        </Text>
      </View>

      <View style={styles.scanSection}>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={handleScanItem}
        >
          <Text style={styles.scanIcon}>📷</Text>
          <Text style={styles.scanText}>Scan Item</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cartSection}>
        <Text style={styles.cartTitle}>
          Items to Checkin ({cart.length})
        </Text>

        {cart.length === 0 ? (
          <View style={styles.emptyCart}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>
              No items scanned yet
            </Text>
            <Text style={styles.emptySubtext}>
              Scan equipment to add to checkin
            </Text>
          </View>
        ) : (
          <FlatList
            data={cart}
            renderItem={renderItem}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.cartList}
          />
        )}
      </View>

      {cart.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.checkinButton}
            onPress={handleCheckinAll}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <>
                <Text style={styles.checkinText}>
                  ✅ Checkin {cart.length} Items
                </Text>
                <Text style={styles.checkinSubtext}>
                  Return to inventory
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
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
    padding: 20,
    alignItems: 'center'
  },
  scanButton: {
    backgroundColor: colors.primary,
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    maxWidth: 300
  },
  scanIcon: {
    fontSize: 48,
    marginBottom: 8
  },
  scanText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold'
  },
  cartSection: {
    flex: 1,
    padding: 15
  },
  cartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 15
  },
  cartList: {
    gap: 10
  },
  cartItem: {
    backgroundColor: colors.backgroundSecondary,
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  itemInfo: {
    flex: 1
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4
  },
  itemSerial: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 2
  },
  itemTag: {
    fontSize: 12,
    color: colors.textTertiary
  },
  removeButton: {
    backgroundColor: colors.danger,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center'
  },
  removeText: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold'
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 15
  },
  emptyText: {
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 8
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  footer: {
    padding: 15,
    backgroundColor: colors.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  checkinButton: {
    backgroundColor: colors.success,
    padding: 18,
    borderRadius: 8,
    alignItems: 'center'
  },
  checkinText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4
  },
  checkinSubtext: {
    color: colors.successLight,
    fontSize: 14
  }
});





