// Coverage Map Service - Manages all network assets
import { db } from '$lib/firebase';
import { collection, doc, setDoc, getDoc, getDocs, query, where, deleteDoc, updateDoc, addDoc } from 'firebase/firestore';
import type { TowerSite, Sector, CPEDevice, NetworkEquipment } from './models';

export class CoverageMapService {
  private getFirestore() {
    return db();
  }
  
  // ========== Tower Sites ==========
  
  async createTowerSite(tenantId: string, site: Omit<TowerSite, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<TowerSite> {
    const sitesRef = collection(this.getFirestore(), 'tenants', tenantId, 'towerSites');
    const newSite: Omit<TowerSite, 'id'> = {
      ...site,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await addDoc(sitesRef, newSite);
    return { ...newSite, id: docRef.id };
  }
  
  async getTowerSites(tenantId: string): Promise<TowerSite[]> {
    const sitesRef = collection(this.getFirestore(), 'tenants', tenantId, 'towerSites');
    const snapshot = await getDocs(sitesRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TowerSite));
  }
  
  async getTowerSite(tenantId: string, siteId: string): Promise<TowerSite | null> {
    const siteRef = doc(this.getFirestore(), 'tenants', tenantId, 'towerSites', siteId);
    const snapshot = await getDoc(siteRef);
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as TowerSite : null;
  }
  
  async updateTowerSite(tenantId: string, siteId: string, updates: Partial<TowerSite>): Promise<void> {
    const siteRef = doc(this.getFirestore(), 'tenants', tenantId, 'towerSites', siteId);
    await updateDoc(siteRef, {
      ...updates,
      updatedAt: new Date()
    });
  }
  
  async deleteTowerSite(tenantId: string, siteId: string): Promise<void> {
    const siteRef = doc(this.getFirestore(), 'tenants', tenantId, 'towerSites', siteId);
    await deleteDoc(siteRef);
  }
  
  // ========== Sectors ==========
  
  async createSector(tenantId: string, sector: Omit<Sector, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Sector> {
    const sectorsRef = collection(this.getFirestore(), 'tenants', tenantId, 'sectors');
    const newSector: Omit<Sector, 'id'> = {
      ...sector,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await addDoc(sectorsRef, newSector);
    return { ...newSector, id: docRef.id };
  }
  
  async getSectors(tenantId: string): Promise<Sector[]> {
    const sectorsRef = collection(this.getFirestore(), 'tenants', tenantId, 'sectors');
    const snapshot = await getDocs(sectorsRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sector));
  }
  
  async getSectorsBySite(tenantId: string, siteId: string): Promise<Sector[]> {
    const sectorsRef = collection(this.getFirestore(), 'tenants', tenantId, 'sectors');
    const q = query(sectorsRef, where('siteId', '==', siteId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sector));
  }
  
  async getSectorsByBand(tenantId: string, band: string): Promise<Sector[]> {
    const sectorsRef = collection(this.getFirestore(), 'tenants', tenantId, 'sectors');
    const q = query(sectorsRef, where('band', '==', band));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sector));
  }
  
  async updateSector(tenantId: string, sectorId: string, updates: Partial<Sector>): Promise<void> {
    const sectorRef = doc(this.getFirestore(), 'tenants', tenantId, 'sectors', sectorId);
    await updateDoc(sectorRef, {
      ...updates,
      updatedAt: new Date()
    });
  }
  
  async deleteSector(tenantId: string, sectorId: string): Promise<void> {
    const sectorRef = doc(this.getFirestore(), 'tenants', tenantId, 'sectors', sectorId);
    await deleteDoc(sectorRef);
  }
  
  // ========== CPE Devices ==========
  
  async createCPE(tenantId: string, cpe: Omit<CPEDevice, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<CPEDevice> {
    const cpeRef = collection(this.getFirestore(), 'tenants', tenantId, 'cpeDevices');
    const newCPE: Omit<CPEDevice, 'id'> = {
      ...cpe,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await addDoc(cpeRef, newCPE);
    return { ...newCPE, id: docRef.id };
  }
  
  async getCPEDevices(tenantId: string): Promise<CPEDevice[]> {
    const cpeRef = collection(this.getFirestore(), 'tenants', tenantId, 'cpeDevices');
    const snapshot = await getDocs(cpeRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CPEDevice));
  }
  
  async updateCPE(tenantId: string, cpeId: string, updates: Partial<CPEDevice>): Promise<void> {
    const cpeRef = doc(this.getFirestore(), 'tenants', tenantId, 'cpeDevices', cpeId);
    await updateDoc(cpeRef, {
      ...updates,
      updatedAt: new Date()
    });
  }
  
  async deleteCPE(tenantId: string, cpeId: string): Promise<void> {
    const cpeRef = doc(this.getFirestore(), 'tenants', tenantId, 'cpeDevices', cpeId);
    await deleteDoc(cpeRef);
  }
  
  // ========== Network Equipment ==========
  
  async createEquipment(tenantId: string, equipment: Omit<NetworkEquipment, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<NetworkEquipment> {
    const equipmentRef = collection(this.getFirestore(), 'tenants', tenantId, 'networkEquipment');
    const newEquipment: Omit<NetworkEquipment, 'id'> = {
      ...equipment,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await addDoc(equipmentRef, newEquipment);
    return { ...newEquipment, id: docRef.id };
  }
  
  async getEquipment(tenantId: string): Promise<NetworkEquipment[]> {
    const equipmentRef = collection(this.getFirestore(), 'tenants', tenantId, 'networkEquipment');
    const snapshot = await getDocs(equipmentRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NetworkEquipment));
  }
  
  async getEquipmentByLocation(tenantId: string, locationType: string): Promise<NetworkEquipment[]> {
    const equipmentRef = collection(this.getFirestore(), 'tenants', tenantId, 'networkEquipment');
    const q = query(equipmentRef, where('locationType', '==', locationType));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NetworkEquipment));
  }
  
  async updateEquipment(tenantId: string, equipmentId: string, updates: Partial<NetworkEquipment>): Promise<void> {
    const equipmentRef = doc(this.getFirestore(), 'tenants', tenantId, 'networkEquipment', equipmentId);
    await updateDoc(equipmentRef, {
      ...updates,
      updatedAt: new Date()
    });
  }
  
  async deleteEquipment(tenantId: string, equipmentId: string): Promise<void> {
    const equipmentRef = doc(this.getFirestore(), 'tenants', tenantId, 'networkEquipment', equipmentId);
    await deleteDoc(equipmentRef);
  }
  
  // ========== Geocoding ==========
  
  async geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
    try {
      // Use ArcGIS geocoding service
      const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates`;
      const params = new URLSearchParams({
        f: 'json',
        singleLine: address,
        outFields: 'Match_addr,Addr_type'
      });
      
      const response = await fetch(`${url}?${params.toString()}`);
      const data = await response.json();
      
      if (data.candidates && data.candidates.length > 0) {
        const best = data.candidates[0];
        return {
          latitude: best.location.y,
          longitude: best.location.x
        };
      }
      
      return null;
    } catch (error) {
      console.error('Geocoding failed:', error);
      return null;
    }
  }
  
  async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    try {
      // Use ArcGIS reverse geocoding
      const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode`;
      const params = new URLSearchParams({
        f: 'json',
        location: `${longitude},${latitude}`,
        outSR: '4326'
      });
      
      const response = await fetch(`${url}?${params.toString()}`);
      const data = await response.json();
      
      if (data.address) {
        const addr = data.address;
        return `${addr.Address}, ${addr.City}, ${addr.Region} ${addr.Postal}`;
      }
      
      return null;
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      return null;
    }
  }
  
  // ========== Data Import from Other Modules ==========
  
  /**
   * Import CBRS devices and convert to sectors
   */
  async importFromCBRS(tenantId: string): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;
    
    try {
      // This would integrate with CBRS module data
      // For now, placeholder for future implementation
      console.log('CBRS import will be implemented to fetch from cbrsDevices collection');
    } catch (error) {
      errors.push(`CBRS import failed: ${error}`);
    }
    
    return { imported, errors };
  }
  
  /**
   * Import ACS CPE devices
   */
  async importFromACS(tenantId: string): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;
    
    try {
      // This would integrate with ACS module data
      // For now, placeholder for future implementation
      console.log('ACS import will be implemented to fetch from GenieACS data');
    } catch (error) {
      errors.push(`ACS import failed: ${error}`);
    }
    
    return { imported, errors };
  }
}

export const coverageMapService = new CoverageMapService();

