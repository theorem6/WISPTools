/**
 * Equipment Checkout Screen
 * Scan items to load into vehicle for field work
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiService } from '../services/apiService';

interface CheckoutItem {
  _id: string;
  assetTag: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  category: string;
}

export default function CheckoutScreen() {
  const [cart, setCart] = useState<CheckoutItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const navigation = useNavigation();

  const handleScanItem = () => {
    navigation.navigate('QRScanner' as never, {
      mode: 'checkout',
      onScan: handleItemScanned
    } as never);
  };

  const handleItemScanned = async (item: any) => {
    // Check if already in cart
    if (cart.find(i => i._id === item._id)) {
      Alert.alert('Already Added', 'This item is already in your checkout cart');
      return;
    }

    // Check if item is available
    if (item.status !== 'available') {
      Alert.alert(
        'Not Available',
        `This item is currently: ${item.status}\nCannot checkout at this time.`
      );
      return;
    }

    // Add to cart
    setCart([...cart, item]);
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item._id !== id));
  };

  const handleCheckoutAll = async () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please scan items to checkout');
      return;
    }

    Alert.alert(
      'Checkout Equipment',
      `Load ${cart.length} items into vehicle?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Checkout',
          onPress: async () => {
            setIsProcessing(true);
            
            try {
              // Update each item to in-transit status
              for (const item of cart) {
                await apiService.transferEquipment(item._id, {
                  newLocation: {
                    type: 'vehicle',
                    siteName: 'Service Vehicle'
                  },
                  reason: 'checkout',
                  notes: 'Loaded into service vehicle for field deployment'
                });
              }
              
              Alert.alert(
                'Success',
                `${cart.length} items checked out successfully`,
                [{ text: 'OK', onPress: () => {
                  setCart([]);
                  navigation.goBack();
                }}]
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Checkout failed');
            } finally {
              setIsProcessing(false);
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: CheckoutItem }) => (
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
        <Text style={styles.title}>Equipment Checkout</Text>
        <Text style={styles.subtitle}>
          Scan items to load into vehicle
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
          Items in Cart ({cart.length})
        </Text>

        {cart.length === 0 ? (
          <View style={styles.emptyCart}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>
              No items scanned yet
            </Text>
            <Text style={styles.emptySubtext}>
              Scan equipment to add to checkout
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
            style={styles.checkoutButton}
            onPress={handleCheckoutAll}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.checkoutText}>
                  ✅ Checkout {cart.length} Items
                </Text>
                <Text style={styles.checkoutSubtext}>
                  Load into vehicle
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
    color: '#9ca3af'
  },
  scanSection: {
    padding: 20,
    alignItems: 'center'
  },
  scanButton: {
    backgroundColor: '#7c3aed',
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
    color: '#fff',
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
    color: '#fff',
    marginBottom: 15
  },
  cartList: {
    gap: 10
  },
  cartItem: {
    backgroundColor: '#1f2937',
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151'
  },
  itemInfo: {
    flex: 1
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4
  },
  itemSerial: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 2
  },
  itemTag: {
    fontSize: 12,
    color: '#6b7280'
  },
  removeButton: {
    backgroundColor: '#ef4444',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center'
  },
  removeText: {
    color: '#fff',
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
    color: '#fff',
    marginBottom: 8
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center'
  },
  footer: {
    padding: 15,
    backgroundColor: '#1f2937',
    borderTopWidth: 1,
    borderTopColor: '#374151'
  },
  checkoutButton: {
    backgroundColor: '#10b981',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center'
  },
  checkoutText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4
  },
  checkoutSubtext: {
    color: '#d1fae5',
    fontSize: 14
  }
});

