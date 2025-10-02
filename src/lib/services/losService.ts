// Line of Sight (LOS) Service using ArcGIS Elevation Profile
// Determines if two sectors have direct line of sight to each other
// considering terrain elevation and sector height AGL

import { browser } from '$app/environment';

export interface LOSResult {
  hasLineOfSight: boolean;
  distance: number;
  terrainBlocked: boolean;
  elevationDifference: number;
  cacheKey: string;
}

export class LOSService {
  // ArcGIS World Elevation Service
  private readonly ELEVATION_SERVICE = 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer';
  private readonly PROFILE_SERVICE = 'https://utility.arcgisonline.com/arcgis/rest/services/Elevation/GMTED/GPServer/Profile';
  
  // Cache LOS results to avoid repeated API calls
  private losCache = new Map<string, LOSResult>();
  
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
    
    // If sectors aren't even pointing at each other, no LOS needed
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
    
    // Check terrain-based LOS using elevation profile
    try {
      const terrainLOS = await this.checkTerrainLOS(
        lat1, lon1, heightAGL1,
        lat2, lon2, heightAGL2
      );
      
      this.losCache.set(cacheKey, terrainLOS);
      return terrainLOS;
    } catch (error) {
      console.warn('LOS check failed, assuming line of sight exists:', error);
      return this.getDefaultLOS(lat1, lon1, lat2, lon2);
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
   * Check terrain-based line of sight using ArcGIS elevation profile
   */
  private async checkTerrainLOS(
    lat1: number,
    lon1: number,
    heightAGL1: number,
    lat2: number,
    lon2: number,
    heightAGL2: number
  ): Promise<LOSResult> {
    const distance = this.calculateDistance(lat1, lon1, lat2, lon2);
    const cacheKey = this.createCacheKey(lat1, lon1, heightAGL1, lat2, lon2, heightAGL2);
    
    // Get elevation at both points
    const elevation1 = await this.getElevation(lat1, lon1);
    const elevation2 = await this.getElevation(lat2, lon2);
    
    // Convert feet to meters (ArcGIS uses meters)
    const heightMeters1 = heightAGL1 * 0.3048;
    const heightMeters2 = heightAGL2 * 0.3048;
    
    // Calculate absolute heights (elevation + height AGL)
    const absoluteHeight1 = elevation1 + heightMeters1;
    const absoluteHeight2 = elevation2 + heightMeters2;
    
    // Get elevation profile between points
    const profile = await this.getElevationProfile(lat1, lon1, lat2, lon2);
    
    // Check if any point in the profile blocks the LOS
    const terrainBlocked = this.checkProfileBlocking(
      absoluteHeight1,
      absoluteHeight2,
      profile
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
   * Get elevation at a specific point using ArcGIS Elevation Service
   */
  private async getElevation(lat: number, lon: number): Promise<number> {
    try {
      const response = await fetch(
        `${this.ELEVATION_SERVICE}/getSamples?` +
        `geometryType=esriGeometryPoint&` +
        `geometry=${JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } })}&` +
        `returnFirstValueOnly=false&` +
        `f=json`
      );
      
      const data = await response.json();
      
      if (data.samples && data.samples.length > 0) {
        return data.samples[0].value || 0;
      }
      
      return 0; // Sea level default
    } catch (error) {
      console.warn('Elevation fetch failed:', error);
      return 0;
    }
  }
  
  /**
   * Get elevation profile between two points
   */
  private async getElevationProfile(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): Promise<number[]> {
    try {
      // Sample points along the line (every ~100 meters)
      const numSamples = Math.min(Math.max(10, Math.floor(this.calculateDistance(lat1, lon1, lat2, lon2) / 100)), 50);
      const samples: number[] = [];
      
      for (let i = 0; i <= numSamples; i++) {
        const t = i / numSamples;
        const lat = lat1 + (lat2 - lat1) * t;
        const lon = lon1 + (lon2 - lon1) * t;
        
        const elevation = await this.getElevation(lat, lon);
        samples.push(elevation);
      }
      
      return samples;
    } catch (error) {
      console.warn('Elevation profile fetch failed:', error);
      return [];
    }
  }
  
  /**
   * Check if terrain profile blocks line of sight
   */
  private checkProfileBlocking(
    height1: number,
    height2: number,
    profile: number[]
  ): boolean {
    if (profile.length < 3) return false; // Not enough data
    
    // Check each intermediate point
    for (let i = 1; i < profile.length - 1; i++) {
      const t = i / (profile.length - 1);
      
      // Linear interpolation of LOS line
      const losHeight = height1 + (height2 - height1) * t;
      
      // Check if terrain is above the LOS line
      if (profile[i] > losHeight) {
        return true; // Terrain blocks LOS
      }
    }
    
    return false; // No blocking
  }
  
  /**
   * Calculate distance between two points (meters)
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
    // Round to 6 decimal places for cache key
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
      hasLineOfSight: true, // Assume LOS exists if we can't check
      distance: this.calculateDistance(lat1, lon1, lat2, lon2),
      terrainBlocked: false,
      elevationDifference: 0,
      cacheKey: this.createCacheKey(lat1, lon1, 100, lat2, lon2, 100)
    };
  }
  
  /**
   * Clear LOS cache
   */
  clearCache(): void {
    this.losCache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.losCache.size,
      keys: Array.from(this.losCache.keys())
    };
  }
}

export const losService = new LOSService();

