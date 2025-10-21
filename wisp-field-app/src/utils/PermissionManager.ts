/**
 * Permission Manager
 * Centralized permission handling for Android
 */

import { Platform, PermissionsAndroid, Alert } from 'react-native';

export interface PermissionStatus {
  camera: boolean;
  location: boolean;
  storage: boolean;
  allGranted: boolean;
}

/**
 * Request all app permissions on startup
 */
export async function requestAllPermissions(): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') {
    // iOS handles permissions differently (per-feature)
    return {
      camera: true,
      location: true,
      storage: true,
      allGranted: true
    };
  }

  const status: PermissionStatus = {
    camera: false,
    location: false,
    storage: false,
    allGranted: false
  };

  try {
    // Request multiple permissions at once
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
    ]);

    status.camera = results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
    status.location = results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
    status.storage = results[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED;
    
    status.allGranted = status.camera && status.location && status.storage;

    // Log results
    console.log('Permission Results:', status);

    return status;
  } catch (err) {
    console.error('Permission request error:', err);
    return status;
  }
}

/**
 * Request camera permission specifically
 */
export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera Permission',
        message: 'WISP Field needs camera access to scan equipment barcodes and QR codes',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Deny',
        buttonPositive: 'Allow',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.error('Camera permission error:', err);
    return false;
  }
}

/**
 * Request location permission specifically
 */
export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'WISP Field needs location access to show nearby towers and track field work',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Deny',
        buttonPositive: 'Allow',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.error('Location permission error:', err);
    return false;
  }
}

/**
 * Check if permission is granted
 */
export async function checkPermission(permission: string): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const result = await PermissionsAndroid.check(permission);
    return result;
  } catch (err) {
    console.error('Permission check error:', err);
    return false;
  }
}

/**
 * Show permission explanation dialog
 */
export function showPermissionRationale(
  title: string,
  message: string,
  onRetry: () => void
) {
  Alert.alert(
    title,
    message,
    [
      {
        text: 'Not Now',
        style: 'cancel'
      },
      {
        text: 'Grant Permission',
        onPress: onRetry
      }
    ]
  );
}

