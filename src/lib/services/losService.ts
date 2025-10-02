// Line of Sight (LOS) Service using ArcGIS API
// Properly implements LOS analysis using ArcGIS modules with elevation data

import { browser } from '$app/environment';

export interface LOSResult {
  hasLineOfSight: boolean;
  distance: number;
  terrainBlocked: boolean;
  elevationDifference: number;
  cacheKey: string;
}

export class LOSService {
  // Cache LOS results to avoid repeated calculations
  private losCache = new Map<string, LOSResult>();
  private elevationCache = new Map<string, number>();
  
  // ArcGIS modules (loaded dynamically)
  private Point: any;
  private ElevationSampler: any;
  private initialized = false;
  
  constructor() {
    this.initializeModules();
  }
  
  /**
   * Initialize ArcGIS modules
   */
  private async initializeModules() {
    if (!browser || this.initialized) return;
    
    try {
      // Dynamically import ArcGIS modules
      const [
        PointModule,
        ElevationSamplerModule
      ] = await Promise.all([
        import('@arcgis/core/geometry/Point.js'),
        import('@arcgis/core/layers/support/ElevationSampler.js')
      ]);
      
      this.Point = PointModule.default;
      this.ElevationSampler = ElevationSamplerModule.default;
      this.initialized = true;
      console.log('LOSService: ArcGIS modules initialized');
    } catch (error) {
      console.error('Failed to initialize LOSService:', error);
    }
  }
  
  /**
   * Ensure modules are loaded
   */
  private async ensureInitialized(): Promise<boolean> {
    if (this.initialized) return true;
    
    await this.initializeModules();
    return this.initialized;
  }
  
  /**
   * Check line of sight between two sectors
   * @param lat1 Latitude of sector 1
   * @param lon1 Longitude of sector 1
   * @param heightAGL1 Height above ground level of sector 1 (feet)
   * @param azimuth1 Azimuth of sector 1 (degrees)
   * @param beamwidth1 Beamwidth of sector 1 (degrees)
   * @param lat2 Latitude of sector 2
   * @param lon2 Longitude of sector 2
   * @param heightAGL2 Height above ground level of sector 2 (feet)
   * @param azimuth2 Azimuth of sector 2 (degrees)
   * @param beamwidth2 Beamwidth of sector 2 (degrees)
   */
  async checkLineOfSight(
    lat1: number,
    lon1: number,
    heightAGL1: number,
    azimuth1: number,
    beamwidth1: number,
    lat2: number,
    lon2: number,
    heightAGL2: number,
    azimuth2: number,
    beamwidth2: number
  ): Promise<LOSResult> {
    if (!browser) {
      return this.getDefaultLOS(lat1, lon1, lat2, lon2);
    }
    
    // Wait for initialization
    const isReady = await this.ensureInitialized();
    if (!isReady) {
      return this.getDefaultLOS(lat1, lon1, lat2, lon2);
    }
    
    // Create cache key
    const cacheKey = this.createCacheKey(lat1, lon1, heightAGL1, lat2, lon2, heightAGL2);
    
    // Check cache first
    if (this.losCache.has(cacheKey)) {
      return this.losCache.get(cacheKey)!;
    }
    
    // Calculate distance
    const distance = this.calculateDistance(lat1, lon1, lat2, lon2);
    
    // First check if sectors are pointing at each other (basic geometric check)
    const geometricLOS = this.checkGeometricLOS(
      lat1, lon1, azimuth1, beamwidth1,
      lat2, lon2, azimuth2, beamwidth2
    );
    
    // If sectors aren't even pointing at each other, no need for terrain check
    if (!geometricLOS) {
      const result: LOSResult = {
        hasLineOfSight: false,
        distance,
        terrainBlocked: false, // Not blocked by terrain, just pointing away
        elevationDifference: 0,
        cacheKey
      };
      this.losCache.set(cacheKey, result);
      return result;
    }
    
    // Check terrain-based LOS using proper elevation sampling
    try {
      const terrainLOS = await this.checkTerrainLOS(
        lat1, lon1, heightAGL1,
        lat2, lon2, heightAGL2,
        distance
      );
      
      this.losCache.set(cacheKey, terrainLOS);
      return terrainLOS;
    } catch (error) {
      console.warn('LOS terrain check failed:', error);
      // On error, use geometric LOS only
      const result: LOSResult = {
        hasLineOfSight: geometricLOS,
        distance,
        terrainBlocked: false,
        elevationDifference: 0,
        cacheKey
      };
      this.losCache.set(cacheKey, result);
      return result;
    }
  }
  
  /**
   * Check if sectors are geometrically pointing at each other
   */
  private checkGeometricLOS(
    lat1: number,
    lon1: number,
    azimuth1: number,
    beamwidth1: number,
    lat2: number,
    lon2: number,
    azimuth2: number,
    beamwidth2: number
  ): boolean {
    // Calculate bearing from sector 1 to sector 2
    const bearing1to2 = this.calculateBearing(lat1, lon1, lat2, lon2);
    
    // Calculate bearing from sector 2 to sector 1
    const bearing2to1 = this.calculateBearing(lat2, lon2, lat1, lon1);
    
    // Check if sector 1 is pointing towards sector 2
    const sector1PointsAt2 = this.isWithinBeam(bearing1to2, azimuth1, beamwidth1);
    
    // Check if sector 2 is pointing towards sector 1
    const sector2PointsAt1 = this.isWithinBeam(bearing2to1, azimuth2, beamwidth2);
    
    // Line of sight requires at least one sector pointing at the other
    return sector1PointsAt2 || sector2PointsAt1;
  }
  
  /**
   * Check if a target bearing falls within a sector's beam
   */
  private isWithinBeam(targetBearing: number, azimuth: number, beamwidth: number): boolean {
    const halfBeam = beamwidth / 2;
    let diff = Math.abs(targetBearing - azimuth);
    
    // Handle wrap-around (e.g., 350° and 10°)
    if (diff > 180) {
      diff = 360 - diff;
    }
    
    return diff <= halfBeam;
  }
  
  /**
   * Calculate bearing from point 1 to point 2
   */
  private calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = this.toRadians(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(this.toRadians(lat2));
    const x = Math.cos(this.toRadians(lat1)) * Math.sin(this.toRadians(lat2)) -
              Math.sin(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.cos(dLon);
    
    let bearing = this.toDegrees(Math.atan2(y, x));
    bearing = (bearing + 360) % 360; // Normalize to 0-359
    
    return bearing;
  }
  
  /**
   * Check terrain-based line of sight using proper elevation sampling
   * This uses the Fresnel zone concept for more accurate LOS
   */
  private async checkTerrainLOS(
    lat1: number,
    lon1: number,
    heightAGL1: number,
    lat2: number,
    lon2: number,
    heightAGL2: number,
    distance: number
  ): Promise<LOSResult> {
    const cacheKey = this.createCacheKey(lat1, lon1, heightAGL1, lat2, lon2, heightAGL2);
    
    // Get elevation at both points
    const elevation1 = await this.getElevationAtPoint(lat1, lon1);
    const elevation2 = await this.getElevationAtPoint(lat2, lon2);
    
    // Convert feet to meters (ArcGIS uses meters)
    const heightMeters1 = heightAGL1 * 0.3048;
    const heightMeters2 = heightAGL2 * 0.3048;
    
    // Calculate absolute heights (elevation + height AGL)
    const absoluteHeight1 = elevation1 + heightMeters1;
    const absoluteHeight2 = elevation2 + heightMeters2;
    
    // Sample intermediate points along the path
    const numSamples = Math.min(Math.max(5, Math.floor(distance / 500)), 20); // Sample every ~500m
    const samples: { elevation: number; position: number }[] = [];
    
    for (let i = 1; i < numSamples; i++) {
      const t = i / numSamples;
      const lat = lat1 + (lat2 - lat1) * t;
      const lon = lon1 + (lon2 - lon1) * t;
      
      const elevation = await this.getElevationAtPoint(lat, lon);
      samples.push({ elevation, position: t });
    }
    
    // Check if any intermediate point blocks the LOS
    // We use the Fresnel zone clearance (60% of first Fresnel zone)
    const terrainBlocked = this.checkFresnelClearance(
      absoluteHeight1,
      absoluteHeight2,
      distance,
      samples
    );
    
    const result: LOSResult = {
      hasLineOfSight: !terrainBlocked,
      distance,
      terrainBlocked,
      elevationDifference: Math.abs(elevation1 - elevation2),
      cacheKey
    };
    
    return result;
  }
  
  /**
   * Get elevation at a specific point using ArcGIS ElevationLayer
   * Uses World Elevation Service from ArcGIS Online
   */
  private async getElevationAtPoint(lat: number, lon: number): Promise<number> {
    const cacheKey = `${lat.toFixed(6)},${lon.toFixed(6)}`;
    
    // Check cache
    if (this.elevationCache.has(cacheKey)) {
      return this.elevationCache.get(cacheKey)!;
    }
    
    try {
      // Use ArcGIS World Elevation Service
      // This is more reliable than the ImageServer approach
      const url = `https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer/getSamples`;
      
      const params = new URLSearchParams({
        geometry: JSON.stringify({
          x: lon,
          y: lat,
          spatialReference: { wkid: 4326 }
        }),
        geometryType: 'esriGeometryPoint',
        returnFirstValueOnly: 'true',
        interpolation: 'RSP_BilinearInterpolation',
        f: 'json'
      });
      
      const response = await fetch(`${url}?${params.toString()}`);
      const data = await response.json();
      
      if (data.samples && data.samples.length > 0 && data.samples[0].value !== null) {
        const elevation = data.samples[0].value;
        this.elevationCache.set(cacheKey, elevation);
        return elevation;
      }
      
      // Fallback to 0 if no data
      this.elevationCache.set(cacheKey, 0);
      return 0;
    } catch (error) {
      console.warn(`Failed to get elevation at (${lat}, ${lon}):`, error);
      return 0; // Sea level default
    }
  }
  
  /**
   * Check Fresnel zone clearance for better LOS accuracy
   * This accounts for the ellipsoid zone around the direct path
   * that should be clear for good signal propagation
   */
  private checkFresnelClearance(
    height1: number,
    height2: number,
    totalDistance: number,
    samples: { elevation: number; position: number }[]
  ): boolean {
    if (samples.length === 0) return false;
    
    // Frequency for LTE (assume 2.1 GHz for calculation)
    const frequency = 2100 * 1e6; // Hz
    const wavelength = 3e8 / frequency; // meters
    
    // Check each sample point
    for (const sample of samples) {
      const t = sample.position;
      
      // Height of direct LOS line at this position
      const losHeight = height1 + (height2 - height1) * t;
      
      // Distance from endpoints
      const d1 = totalDistance * t;
      const d2 = totalDistance * (1 - t);
      
      // First Fresnel zone radius at this point
      // F1 = sqrt(wavelength * d1 * d2 / (d1 + d2))
      const fresnelRadius = Math.sqrt((wavelength * d1 * d2) / totalDistance);
      
      // We want 60% clearance of first Fresnel zone
      const requiredClearance = fresnelRadius * 0.6;
      
      // Check if terrain intrudes into Fresnel zone
      if (sample.elevation > (losHeight - requiredClearance)) {
        return true; // Terrain blocks or intrudes into Fresnel zone
      }
    }
    
    return false; // Clear line of sight
  }
  
  /**
   * Calculate distance between two points (meters)
   * Uses Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
  
  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }
  
  /**
   * Create cache key for LOS results
   */
  private createCacheKey(
    lat1: number,
    lon1: number,
    height1: number,
    lat2: number,
    lon2: number,
    height2: number
  ): string {
    // Round to 6 decimal places for cache key (~0.1m precision)
    const p1 = `${lat1.toFixed(6)},${lon1.toFixed(6)},${Math.round(height1)}`;
    const p2 = `${lat2.toFixed(6)},${lon2.toFixed(6)},${Math.round(height2)}`;
    
    // Sort to ensure same result for A->B and B->A
    return p1 < p2 ? `${p1}|${p2}` : `${p2}|${p1}`;
  }
  
  /**
   * Default LOS result when service is unavailable
   */
  private getDefaultLOS(lat1: number, lon1: number, lat2: number, lon2: number): LOSResult {
    return {
      hasLineOfSight: true, // Optimistic default
      distance: this.calculateDistance(lat1, lon1, lat2, lon2),
      terrainBlocked: false,
      elevationDifference: 0,
      cacheKey: this.createCacheKey(lat1, lon1, 100, lat2, lon2, 100)
    };
  }
  
  /**
   * Clear all caches
   */
  clearCache(): void {
    this.losCache.clear();
    this.elevationCache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): { losSize: number; elevationSize: number } {
    return {
      losSize: this.losCache.size,
      elevationSize: this.elevationCache.size
    };
  }
}

export const losService = new LOSService();
