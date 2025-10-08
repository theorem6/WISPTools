// CPE Location Service
// Handles GPS location processing and validation for TR-069 CPE devices

import type { CPEDevice, CPELocation } from '../models/cpeDevice';
import { CPEDeviceUtils } from '../models/cpeDevice';
import type { TR069Parameter } from '../models/cpeDevice';

export interface LocationValidationResult {
  isValid: boolean;
  error?: string;
  accuracy?: number;
}

export interface LocationCluster {
  centerLatitude: number;
  centerLongitude: number;
  radius: number; // in meters
  devices: CPEDevice[];
  density: number; // devices per km²
}

export interface LocationAnalytics {
  totalDevices: number;
  devicesWithGPS: number;
  coverageArea: number; // in km²
  averageAccuracy: number; // in meters
  clusters: LocationCluster[];
  densityMap: Array<{
    latitude: number;
    longitude: number;
    density: number;
  }>;
}

export class LocationService {
  private static readonly GPS_ACCURACY_THRESHOLD = 100; // meters
  private static readonly CLUSTER_RADIUS = 500; // meters
  private static readonly MIN_CLUSTER_SIZE = 2;

  /**
   * Validate GPS coordinates
   */
  static validateGPSLocation(latitude: number, longitude: number, accuracy?: number): LocationValidationResult {
    // Basic coordinate validation
    if (!CPEDeviceUtils.validateGPS(latitude, longitude)) {
      return {
        isValid: false,
        error: 'Invalid GPS coordinates'
      };
    }

    // Check if coordinates are not default/zero values
    if (latitude === 0 && longitude === 0) {
      return {
        isValid: false,
        error: 'GPS coordinates are default values (0, 0)'
      };
    }

    // Check accuracy if provided
    if (accuracy !== undefined && accuracy > this.GPS_ACCURACY_THRESHOLD) {
      return {
        isValid: false,
        error: `GPS accuracy too low: ${accuracy}m (threshold: ${this.GPS_ACCURACY_THRESHOLD}m)`,
        accuracy
      };
    }

    return {
      isValid: true,
      accuracy: accuracy || 0
    };
  }

  /**
   * Process GPS data from TR-069 parameters
   */
  static processGPSData(parameters: TR069Parameter[]): CPELocation | null {
    const latitudeParam = parameters.find(p => p.name === 'Device.GPS.Latitude');
    const longitudeParam = parameters.find(p => p.name === 'Device.GPS.Longitude');
    const accuracyParam = parameters.find(p => p.name === 'Device.GPS.Accuracy');
    const lastUpdateParam = parameters.find(p => p.name === 'Device.GPS.LastUpdate');

    if (!latitudeParam || !longitudeParam) {
      return null;
    }

    const latitude = Number(latitudeParam.value);
    const longitude = Number(longitudeParam.value);
    const accuracy = accuracyParam ? Number(accuracyParam.value) : undefined;

    // Validate the location
    const validation = this.validateGPSLocation(latitude, longitude, accuracy);
    if (!validation.isValid) {
      console.warn(`LocationService: Invalid GPS data - ${validation.error}`);
      return null;
    }

    const lastUpdate = lastUpdateParam 
      ? new Date(Number(lastUpdateParam.value))
      : new Date();

    return {
      latitude,
      longitude,
      accuracy,
      lastUpdate,
      source: 'gps'
    };
  }

  /**
   * Calculate distance between two locations
   */
  static calculateDistance(location1: CPELocation, location2: CPELocation): number {
    return CPEDeviceUtils.calculateDistanceBetweenPoints(
      location1.latitude,
      location1.longitude,
      location2.latitude,
      location2.longitude
    );
  }

  /**
   * Find nearby devices within radius
   */
  static findNearbyDevices(
    devices: CPEDevice[],
    centerLatitude: number,
    centerLongitude: number,
    radiusMeters: number
  ): CPEDevice[] {
    return devices.filter(device => {
      if (!CPEDeviceUtils.validateGPS(device.location.latitude, device.location.longitude)) {
        return false;
      }

      const distance = CPEDeviceUtils.calculateDistanceBetweenPoints(
        centerLatitude,
        centerLongitude,
        device.location.latitude,
        device.location.longitude
      );

      return distance <= radiusMeters;
    });
  }

  /**
   * Cluster devices by location
   */
  static clusterDevices(devices: CPEDevice[]): LocationCluster[] {
    const validDevices = devices.filter(device => 
      CPEDeviceUtils.validateGPS(device.location.latitude, device.location.longitude) &&
      device.location.latitude !== 0 && device.location.longitude !== 0
    );

    if (validDevices.length === 0) {
      return [];
    }

    const clusters: LocationCluster[] = [];
    const processedDevices = new Set<string>();

    for (const device of validDevices) {
      if (processedDevices.has(device.id)) {
        continue;
      }

      // Find nearby devices
      const nearbyDevices = this.findNearbyDevices(
        validDevices,
        device.location.latitude,
        device.location.longitude,
        this.CLUSTER_RADIUS
      );

      if (nearbyDevices.length >= this.MIN_CLUSTER_SIZE) {
        // Calculate cluster center
        const centerLatitude = nearbyDevices.reduce((sum, d) => sum + d.location.latitude, 0) / nearbyDevices.length;
        const centerLongitude = nearbyDevices.reduce((sum, d) => sum + d.location.longitude, 0) / nearbyDevices.length;

        // Calculate cluster radius (distance to farthest device)
        const radius = Math.max(...nearbyDevices.map(d => 
          this.calculateDistance(
            { latitude: centerLatitude, longitude: centerLongitude, lastUpdate: new Date(), source: 'gps' },
            d.location
          )
        ));

        // Calculate density (devices per km²)
        const areaKm2 = Math.PI * Math.pow(radius / 1000, 2);
        const density = areaKm2 > 0 ? nearbyDevices.length / areaKm2 : 0;

        clusters.push({
          centerLatitude,
          centerLongitude,
          radius,
          devices: nearbyDevices,
          density
        });

        // Mark devices as processed
        nearbyDevices.forEach(d => processedDevices.add(d.id));
      }
    }

    return clusters;
  }

  /**
   * Generate location analytics
   */
  static generateLocationAnalytics(devices: CPEDevice[]): LocationAnalytics {
    const devicesWithGPS = devices.filter(device => 
      CPEDeviceUtils.validateGPS(device.location.latitude, device.location.longitude) &&
      device.location.latitude !== 0 && device.location.longitude !== 0
    );

    if (devicesWithGPS.length === 0) {
      return {
        totalDevices: devices.length,
        devicesWithGPS: 0,
        coverageArea: 0,
        averageAccuracy: 0,
        clusters: [],
        densityMap: []
      };
    }

    // Calculate coverage area using convex hull
    const coverageArea = this.calculateCoverageArea(devicesWithGPS);

    // Calculate average accuracy
    const accuracySum = devicesWithGPS.reduce((sum, device) => 
      sum + (device.location.accuracy || 0), 0
    );
    const averageAccuracy = accuracySum / devicesWithGPS.length;

    // Generate clusters
    const clusters = this.clusterDevices(devicesWithGPS);

    // Generate density map
    const densityMap = this.generateDensityMap(devicesWithGPS);

    return {
      totalDevices: devices.length,
      devicesWithGPS: devicesWithGPS.length,
      coverageArea,
      averageAccuracy,
      clusters,
      densityMap
    };
  }

  /**
   * Calculate coverage area using bounding box approximation
   */
  private static calculateCoverageArea(devices: CPEDevice[]): number {
    if (devices.length < 2) return 0;

    const latitudes = devices.map(d => d.location.latitude);
    const longitudes = devices.map(d => d.location.longitude);

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);

    // Convert to approximate area in km²
    const latDiff = this.toRadians(maxLat - minLat);
    const lonDiff = this.toRadians(maxLon - minLon);
    
    // Approximate calculation (not exact for large areas)
    const avgLat = this.toRadians((minLat + maxLat) / 2);
    const latKm = 111.32; // km per degree latitude
    const lonKm = 111.32 * Math.cos(avgLat); // km per degree longitude at this latitude

    return latDiff * latKm * lonDiff * lonKm;
  }

  /**
   * Generate density map for visualization
   */
  private static generateDensityMap(devices: CPEDevice[]): Array<{
    latitude: number;
    longitude: number;
    density: number;
  }> {
    const gridSize = 0.01; // ~1km grid cells
    const densityMap: Map<string, number> = new Map();

    for (const device of devices) {
      const gridLat = Math.round(device.location.latitude / gridSize) * gridSize;
      const gridLon = Math.round(device.location.longitude / gridSize) * gridSize;
      const key = `${gridLat},${gridLon}`;

      densityMap.set(key, (densityMap.get(key) || 0) + 1);
    }

    return Array.from(densityMap.entries()).map(([key, count]) => {
      const [lat, lon] = key.split(',').map(Number);
      return {
        latitude: lat,
        longitude: lon,
        density: count
      };
    });
  }

  /**
   * Convert degrees to radians
   */
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get location quality score (0-100)
   */
  static getLocationQuality(location: CPELocation): number {
    let score = 100;

    // Reduce score based on accuracy
    if (location.accuracy !== undefined) {
      if (location.accuracy > 100) score -= 40;
      else if (location.accuracy > 50) score -= 20;
      else if (location.accuracy > 20) score -= 10;
    }

    // Reduce score based on age
    const ageHours = (Date.now() - location.lastUpdate.getTime()) / (1000 * 60 * 60);
    if (ageHours > 24) score -= 30;
    else if (ageHours > 6) score -= 15;
    else if (ageHours > 1) score -= 5;

    // Reduce score based on source
    if (location.source === 'manual') score -= 10;
    else if (location.source === 'network') score -= 20;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get location status text
   */
  static getLocationStatus(location: CPELocation): string {
    const quality = this.getLocationQuality(location);
    
    if (quality >= 90) return 'Excellent';
    if (quality >= 75) return 'Good';
    if (quality >= 60) return 'Fair';
    if (quality >= 40) return 'Poor';
    return 'Very Poor';
  }

  /**
   * Estimate location from network information (fallback)
   */
  static estimateLocationFromNetwork(networkInfo: any): CPELocation | null {
    // This is a placeholder for network-based location estimation
    // In a real implementation, you might use:
    // - IP geolocation services
    // - WiFi network database lookups
    // - Cellular tower triangulation
    
    return null;
  }

  /**
   * Validate and clean location data
   */
  static cleanLocationData(location: CPELocation): CPELocation {
    // Round coordinates to reasonable precision
    const precision = 6; // ~0.1m precision
    
    return {
      ...location,
      latitude: Math.round(location.latitude * Math.pow(10, precision)) / Math.pow(10, precision),
      longitude: Math.round(location.longitude * Math.pow(10, precision)) / Math.pow(10, precision),
      accuracy: location.accuracy ? Math.round(location.accuracy) : undefined
    };
  }

  /**
   * Check if two locations are the same (within tolerance)
   */
  static isSameLocation(location1: CPELocation, location2: CPELocation, toleranceMeters: number = 10): boolean {
    const distance = this.calculateDistance(location1, location2);
    return distance <= toleranceMeters;
  }

  /**
   * Get bounding box for a set of devices
   */
  static getBoundingBox(devices: CPEDevice[]): {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  } | null {
    const validDevices = devices.filter(device => 
      CPEDeviceUtils.validateGPS(device.location.latitude, device.location.longitude) &&
      device.location.latitude !== 0 && device.location.longitude !== 0
    );

    if (validDevices.length === 0) return null;

    const latitudes = validDevices.map(d => d.location.latitude);
    const longitudes = validDevices.map(d => d.location.longitude);

    return {
      minLat: Math.min(...latitudes),
      maxLat: Math.max(...latitudes),
      minLon: Math.min(...longitudes),
      maxLon: Math.max(...longitudes)
    };
  }
}
