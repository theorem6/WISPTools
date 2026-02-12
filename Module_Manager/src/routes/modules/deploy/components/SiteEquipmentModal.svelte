<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { coverageMapService } from '../../coverage-map/lib/coverageMapService.mongodb';
  import { auth } from '$lib/firebase';
  import { authService } from '$lib/services/authService';
  import { API_CONFIG } from '$lib/config/api';
  import type { TowerSite } from '../../coverage-map/lib/models';

  export let show = false;
  export let site: TowerSite | null = null;
  export let tenantId: string = '';

  const dispatch = createEventDispatcher();

  let hardwareDeployments: any[] = [];
  let equipment: any[] = [];
  let sectors: any[] = [];
  let isLoading = false;
  let error = '';
  let lastLoadedSiteId: string | null = null;

  // Watch for modal opening and load equipment (only once per site when modal opens)
  $: if (show && site && tenantId) {
    const siteId = site.id || site._id;
    const siteIdStr = String(siteId);
    
    // Only load if this is a different site than last time
    if (siteIdStr !== lastLoadedSiteId) {
      console.log('[SiteEquipmentModal] ✅✅✅ Reactive trigger - show:', show, 'site:', site?.name, 'tenantId:', tenantId, 'siteId:', siteIdStr);
      console.log('[SiteEquipmentModal] ✅ Site data:', JSON.stringify(site, null, 2));
      
      // Reset arrays when switching sites
      hardwareDeployments = [];
      equipment = [];
      sectors = [];
      
      // Update tracking before loading
      const previousSiteId = lastLoadedSiteId;
      lastLoadedSiteId = siteIdStr;
      
      // Use setTimeout to ensure reactive statement completes before calling loadEquipment
      setTimeout(() => {
        loadEquipment();
      }, 0);
    }
  }
  
  // Reset tracking when modal closes
  $: if (!show) {
    lastLoadedSiteId = null;
  }
  
  // Watch for show state changes for logging/debugging only
  $: if (show) {
    console.log('[SiteEquipmentModal] Modal show state changed:', show, 'site:', site?.name, 'hasSite:', !!site, 'tenantId:', tenantId);
    if (show && !site) {
      console.warn('[SiteEquipmentModal] ⚠️ Modal is shown but site is null/undefined!');
    }
    if (show && site && !tenantId) {
      console.warn('[SiteEquipmentModal] ⚠️ Modal is shown but tenantId is missing!');
    }
  }

  async function loadEquipment() {
    if (!site || !tenantId) {
      console.warn('[SiteEquipmentModal] loadEquipment called but missing data:', { hasSite: !!site, hasTenantId: !!tenantId, siteName: site?.name, tenantId });
      return;
    }

    // Prevent multiple simultaneous loads
    if (isLoading) {
      console.log('[SiteEquipmentModal] ⏸️ loadEquipment already in progress, skipping');
      return;
    }

    console.log('[SiteEquipmentModal] 🔵🔵🔵 loadEquipment called', { siteName: site.name, siteId: site.id || site._id, tenantId });
    isLoading = true;
    error = '';

    try {
      const siteId = site.id || site._id;
      console.log('[SiteEquipmentModal] Loading equipment for site:', {
        siteName: site.name,
        siteId: siteId,
        siteObject: site
      });

      // Load sectors FIRST - before other equipment
      try {
        console.log('[SiteEquipmentModal] 🔵 Fetching sectors for site:', { siteId, tenantId, siteName: site.name });
        const allSectors = await coverageMapService.getSectorsBySite(tenantId, siteId);
        console.log('[SiteEquipmentModal] ✅ Loaded sectors from API:', {
          count: allSectors?.length || 0,
          targetSiteId: siteId,
          siteIdType: typeof siteId,
          rawSectors: allSectors || []
        });
        
        // Normalize siteId matching - sectors may have siteId as string or ObjectId
        const normalizedSiteId = String(siteId);
        sectors = (allSectors || []).filter((s: any) => {
          const sectorSiteId = s.siteId?._id || s.siteId?.id || s.siteId;
          const sectorSiteIdStr = sectorSiteId ? String(sectorSiteId) : '';
          const normalizedSectorSiteId = sectorSiteIdStr.replace(/^ObjectId\(/, '').replace(/\)$/, '');
          
          const matches = normalizedSectorSiteId && normalizedSiteId && (
            normalizedSectorSiteId === normalizedSiteId ||
            normalizedSectorSiteId.toString() === normalizedSiteId.toString()
          );
          
          if (!matches && sectorSiteId) {
            console.log('[SiteEquipmentModal] Sector does not match site:', {
              sectorName: s.name,
              sectorSiteId: sectorSiteId,
              normalizedSectorSiteId: normalizedSectorSiteId,
              targetSiteId: siteId,
              normalizedSiteId: normalizedSiteId
            });
          }
          
          return matches;
        });
        
        console.log('[SiteEquipmentModal] ✅ Filtered sectors for site:', {
          total: allSectors?.length || 0,
          filtered: sectors.length,
          siteId: siteId
        });
      } catch (sectorError: any) {
        console.error('[SiteEquipmentModal] ❌ Error loading sectors:', sectorError);
        console.error('[SiteEquipmentModal] Error details:', {
          message: sectorError.message,
          stack: sectorError.stack,
          siteId: siteId,
          tenantId: tenantId
        });
        sectors = [];
      }

      // Load all deployed hardware at this site
      const allDeployments = await coverageMapService.getAllHardwareDeployments(tenantId);
      console.log('[SiteEquipmentModal] Loaded all deployments:', {
        count: allDeployments?.length || 0,
        deployments: allDeployments?.map((d: any) => ({
          id: d._id || d.id,
          name: d.name,
          siteId: d.siteId,
          siteIdType: typeof d.siteId,
          siteId_id: d.siteId?._id,
          siteId_id_type: typeof d.siteId?._id,
          siteIdString: d.siteId ? String(d.siteId) : null
        }))
      });

      // Also load EPC devices from RemoteEPC collection
      let epcDevices: any[] = [];
      let allEPCs: any[] = []; // Store for location-based fallback
      const user = auth().currentUser;
      if (user) {
        try {
          const token = await authService.getAuthTokenForApi();
          const response = await fetch(`${API_CONFIG.PATHS.HSS}/epc/remote/list`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Tenant-ID': tenantId
            }
          });
          if (response.ok) {
            const data = await response.json();
            allEPCs = data.epcs || [];
            console.log('[SiteEquipmentModal] All EPC devices from API:', {
              count: allEPCs.length,
              targetSiteId: siteId,
              targetSiteIdType: typeof siteId,
              targetSiteName: site.name,
              devices: allEPCs.map((e: any) => ({
                name: e.site_name || e.name,
                epc_id: e.epcId || e.epc_id,
                site_id: e.site_id,
                site_id_type: typeof e.site_id,
                siteId: e.siteId,
                siteId_type: typeof e.siteId,
                site_name: e.site_name
              }))
            });
            
            epcDevices = allEPCs.filter((epc: any) => {
              // EPC devices can have site_id as a string (MongoDB ObjectId as string) or ObjectId
              // Also match by site name as fallback
              const epcSiteId = epc.site_id || epc.siteId?._id || epc.siteId?.id || epc.siteId;
              const siteIdStr = String(siteId);
              const epcSiteIdStr = epcSiteId ? String(epcSiteId) : '';
              
              // Normalize both IDs for comparison (remove ObjectId wrapper if present)
              const normalizedSiteId = siteIdStr.replace(/^ObjectId\(/, '').replace(/\)$/, '');
              const normalizedEpcSiteId = epcSiteIdStr.replace(/^ObjectId\(/, '').replace(/\)$/, '');
              
              const matchesById = normalizedEpcSiteId && normalizedSiteId && (
                normalizedEpcSiteId === normalizedSiteId ||
                normalizedEpcSiteId.toString() === normalizedSiteId.toString()
              );
              
              // For name matching, check if site_name contains the site name or vice versa
              const matchesByName = epc.site_name && site.name && (
                epc.site_name.toLowerCase() === site.name.toLowerCase() ||
                epc.site_name.toLowerCase().startsWith(site.name.toLowerCase()) ||
                site.name.toLowerCase().startsWith(epc.site_name.toLowerCase())
              );
              
              if (epcSiteId || epc.site_name) {
                console.log('[SiteEquipmentModal] EPC filtering check:', {
                  epcName: epc.site_name,
                  epcSiteId: epcSiteId,
                  epcSiteIdStr: epcSiteIdStr,
                  normalizedEpcSiteId: normalizedEpcSiteId,
                  targetSiteId: siteId,
                  targetSiteIdStr: siteIdStr,
                  normalizedSiteId: normalizedSiteId,
                  matchesById: matchesById,
                  matchesByName: matchesByName,
                  siteName: site.name
                });
              }
              
              return matchesById || matchesByName;
            });
            console.log('[SiteEquipmentModal] Loaded EPC devices:', {
              count: allEPCs.length,
              filteredCount: epcDevices.length,
              siteId: siteId,
              siteName: site.name,
              epcDevices: epcDevices.map((e: any) => ({
                name: e.site_name || e.name,
                epc_id: e.epcId || e.epc_id,
                site_id: e.site_id,
                siteId: e.siteId
              }))
            });
          }
        } catch (err) {
          console.error('[SiteEquipmentModal] Error loading EPC devices:', err);
        }
      }

      // Filter hardware deployments by site
      const filteredDeployments = (allDeployments || []).filter((d: any) => {
        // siteId can be:
        // 1. An object with _id (populated from backend)
        // 2. An object with id
        // 3. A string/ObjectId
        const deploymentSiteId = d.siteId?._id || d.siteId?.id || d.siteId;
        const siteIdStr = String(siteId);
        const deploymentSiteIdStr = deploymentSiteId ? String(deploymentSiteId) : '';
        
        // Normalize both IDs for comparison
        const normalizedSiteId = siteIdStr.replace(/^ObjectId\(/, '').replace(/\)$/, '');
        const normalizedDeploymentSiteId = deploymentSiteIdStr.replace(/^ObjectId\(/, '').replace(/\)$/, '');
        
        const matches = normalizedDeploymentSiteId && normalizedSiteId && (
          normalizedDeploymentSiteId === normalizedSiteId ||
          normalizedDeploymentSiteId.toString() === normalizedSiteId.toString()
        );
        
        if (deploymentSiteId && !matches) {
          console.log('[SiteEquipmentModal] Deployment does not match:', {
            deploymentName: d.name,
            deploymentSiteId: deploymentSiteId,
            deploymentSiteIdStr: deploymentSiteIdStr,
            normalizedDeploymentSiteId: normalizedDeploymentSiteId,
            targetSiteId: siteId,
            targetSiteIdStr: siteIdStr,
            normalizedSiteId: normalizedSiteId,
            siteIdObject: d.siteId
          });
        }
        
        return matches;
      });

      // Initial combination of hardware deployments with EPC devices (will be updated if location matching finds more)
      hardwareDeployments = [
        ...filteredDeployments,
        ...epcDevices.map((epc: any) => ({
          _id: epc.epcId || epc.id || epc._id,
          id: epc.epcId || epc.id || epc._id,
          name: epc.site_name || epc.name || 'EPC Device',
          hardware_type: 'epc',
          status: epc.status || 'deployed',
          siteId: epc.site_id || epc.siteId,
          config: {
            ipAddress: epc.ipAddress || epc.ip_address,
            macAddress: epc.macAddress || epc.mac_address,
            device_code: epc.device_code
          },
          deployedAt: epc.createdAt || epc.created_at || epc.deployedAt,
          isEPC: true
        }))
      ];

      console.log('[SiteEquipmentModal] Initial filtered hardware deployments:', {
        count: hardwareDeployments.length,
        deployments: hardwareDeployments.map((d: any) => ({
          name: d.name,
          siteId: d.siteId?._id || d.siteId?.id || d.siteId
        }))
      });

      // Sectors already loaded above (moved earlier for better error visibility)
      
      // Load equipment at this site
      const allEquipment = await coverageMapService.getEquipment(tenantId);
      console.log('[SiteEquipmentModal] Loaded all equipment:', {
        count: allEquipment?.length || 0,
        targetSiteId: siteId,
        targetSiteIdType: typeof siteId,
        equipment: (allEquipment || []).slice(0, 3).map((eq: any) => ({
          name: eq.name,
          siteId: eq.siteId,
          siteIdType: typeof eq.siteId,
          siteId_id: eq.siteId?._id,
          siteId_id_type: typeof eq.siteId?._id,
          siteIdString: eq.siteId ? String(eq.siteId) : null
        }))
      });
      
      equipment = (allEquipment || []).filter((eq: any) => {
        const eqSiteId = eq.siteId?._id || eq.siteId?.id || eq.siteId;
        const siteIdStr = String(siteId);
        const eqSiteIdStr = eqSiteId ? String(eqSiteId) : '';
        
        // Normalize both IDs for comparison
        const normalizedSiteId = siteIdStr.replace(/^ObjectId\(/, '').replace(/\)$/, '');
        const normalizedEqSiteId = eqSiteIdStr.replace(/^ObjectId\(/, '').replace(/\)$/, '');
        
        const matchesById = normalizedEqSiteId && normalizedSiteId && (
          normalizedEqSiteId === normalizedSiteId ||
          normalizedEqSiteId.toString() === normalizedSiteId.toString()
        );
        
        // Also try location-based matching if siteId doesn't match but locationType is 'tower' and location is close
        let matchesByLocation = false;
        if (!matchesById && eq.locationType === 'tower' && site.location?.latitude && site.location?.longitude && eq.location?.latitude && eq.location?.longitude) {
          const siteLat = site.location.latitude;
          const siteLon = site.location.longitude;
          const eqLat = eq.location.latitude;
          const eqLon = eq.location.longitude;
          
          // Calculate distance in kilometers
          const R = 6371;
          const dLat = (eqLat - siteLat) * Math.PI / 180;
          const dLon = (eqLon - siteLon) * Math.PI / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(siteLat * Math.PI / 180) * Math.cos(eqLat * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;
          
          // Match if within 100 meters (0.1 km)
          matchesByLocation = distance < 0.1;
        }
        
        const matches = matchesById || matchesByLocation;
        
        if (eqSiteId && !matchesById && !matchesByLocation) {
          console.log('[SiteEquipmentModal] Equipment does not match:', {
            equipmentName: eq.name,
            eqSiteId: eqSiteId,
            eqSiteIdStr: eqSiteIdStr,
            normalizedEqSiteId: normalizedEqSiteId,
            targetSiteId: siteId,
            targetSiteIdStr: siteIdStr,
            normalizedSiteId: normalizedSiteId,
            siteIdObject: eq.siteId,
            locationType: eq.locationType,
            hasLocation: !!(eq.location?.latitude && eq.location?.longitude)
          });
        }
        
        return matches;
      });

      // If no equipment found by siteId, try location-based matching as fallback
      if (equipment.length === 0 && site.location?.latitude && site.location?.longitude) {
        console.log('[SiteEquipmentModal] No equipment found by siteId, trying location-based matching');
        const siteLat = site.location.latitude;
        const siteLon = site.location.longitude;
        
        equipment = (allEquipment || []).filter((eq: any) => {
          const eqLat = eq.location?.latitude || eq.location?.coordinates?.latitude;
          const eqLon = eq.location?.longitude || eq.location?.coordinates?.longitude;
          
          if (!eqLat || !eqLon) return false;
          
          // Calculate distance in kilometers
          const R = 6371; // Earth's radius in km
          const dLat = (eqLat - siteLat) * Math.PI / 180;
          const dLon = (eqLon - siteLon) * Math.PI / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(siteLat * Math.PI / 180) * Math.cos(eqLat * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c; // Distance in km
          
          // Match if within 100 meters (0.1 km)
          return distance < 0.1;
        });
        
        console.log('[SiteEquipmentModal] Location-based equipment matching:', {
          found: equipment.length,
          siteLocation: { lat: siteLat, lon: siteLon }
        });
      }
      
      // If no EPC devices found by siteId/name, try location-based matching as fallback
      if (epcDevices.length === 0 && allEPCs.length > 0 && site.location?.latitude && site.location?.longitude) {
        console.log('[SiteEquipmentModal] No EPC devices found by siteId/name, trying location-based matching');
        const siteLat = site.location.latitude;
        const siteLon = site.location.longitude;
        
        epcDevices = allEPCs.filter((epc: any) => {
          const epcLat = epc.location?.coordinates?.latitude || epc.location?.latitude;
          const epcLon = epc.location?.coordinates?.longitude || epc.location?.longitude;
          
          if (!epcLat || !epcLon) return false;
          
          // Calculate distance in kilometers
          const R = 6371;
          const dLat = (epcLat - siteLat) * Math.PI / 180;
          const dLon = (epcLon - siteLon) * Math.PI / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(siteLat * Math.PI / 180) * Math.cos(epcLat * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;
          
          // Match if within 100 meters (0.1 km)
          return distance < 0.1;
        });
        
        if (epcDevices.length > 0) {
          // Update hardwareDeployments to include location-matched EPCs
          hardwareDeployments = [
            ...filteredDeployments,
            ...epcDevices.map((epc: any) => ({
              _id: epc.epcId || epc.id || epc._id,
              id: epc.epcId || epc.id || epc._id,
              name: epc.site_name || epc.name || 'EPC Device',
              hardware_type: 'epc',
              status: epc.status || 'deployed',
              siteId: epc.site_id || epc.siteId,
              config: {
                ipAddress: epc.ipAddress || epc.ip_address,
                macAddress: epc.macAddress || epc.mac_address,
                device_code: epc.device_code
              },
              deployedAt: epc.createdAt || epc.created_at || epc.deployedAt,
              isEPC: true
            }))
          ];
          
          console.log('[SiteEquipmentModal] Location-based EPC matching:', {
            found: epcDevices.length,
            siteLocation: { lat: siteLat, lon: siteLon }
          });
        }
      }
      
      console.log('[SiteEquipmentModal] Final results:', {
        hardwareDeployments: hardwareDeployments.length,
        epcDevices: epcDevices.length,
        equipment: equipment.length,
        sectors: sectors.length,
        allEquipmentCount: allEquipment?.length || 0,
        siteId: siteId,
        siteIdType: typeof siteId
      });
      
      // Log first few equipment items for debugging
      if (allEquipment && allEquipment.length > 0) {
        console.log('[SiteEquipmentModal] Sample equipment siteIds:', allEquipment.slice(0, 3).map((eq: any) => ({
          name: eq.name,
          siteId: eq.siteId,
          siteIdType: typeof eq.siteId,
          siteId_id: eq.siteId?._id,
          siteId_id_type: typeof eq.siteId?._id,
          siteIdString: eq.siteId ? String(eq.siteId) : null
        })));
      }
    } catch (err: any) {
      console.error('[SiteEquipmentModal] Error loading equipment:', err);
      error = err.message || 'Failed to load equipment';
    } finally {
      isLoading = false;
    }
  }

  function closeModal() {
    show = false;
    dispatch('close');
  }
  
  function handleAddEquipment() {
    // Dispatch event to parent to open AddInventoryModal
    dispatch('add-equipment', { site });
  }
</script>

{#if show && site}
  <div class="modal-overlay" onclick={closeModal}>
    <div class="modal-content large" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>📦 Equipment at {site.name}</h2>
        <div class="header-actions">
          <button class="btn-add" onclick={handleAddEquipment} title="Add Equipment">
            ➕ Add Equipment
          </button>
          <button class="close-btn" onclick={closeModal}>✕</button>
        </div>
      </div>
      
      {#if error}
        <div class="error-banner">{error}</div>
      {/if}
      
      <div class="modal-body">
        {#if isLoading}
          <div class="loading">Loading equipment...</div>
        {:else}
          <!-- Hardware Deployments -->
          <div class="section">
            <h3>🔧 Hardware Deployments ({hardwareDeployments.length})</h3>
            {#if hardwareDeployments.length === 0}
              <div class="empty-state">
                <p>No hardware deployments found at this site</p>
              </div>
            {:else}
              <div class="items-list">
                {#each hardwareDeployments as deployment}
                  <div class="item-card">
                    <div class="item-header">
                      <h4>{deployment.name || 'Unnamed Deployment'}</h4>
                      <span class="status-badge {deployment.status || 'deployed'}">{deployment.status || 'deployed'}</span>
                    </div>
                    <div class="item-details">
                      <div class="detail-row">
                        <span class="label">Type:</span>
                        <span class="value">{deployment.hardware_type || 'Unknown'}</span>
                      </div>
                      {#if deployment.config?.ipAddress || deployment.config?.ip_address}
                        <div class="detail-row">
                          <span class="label">IP Address:</span>
                          <span class="value mono">{deployment.config.ipAddress || deployment.config.ip_address}</span>
                        </div>
                      {/if}
                      {#if deployment.config?.macAddress || deployment.config?.mac_address}
                        <div class="detail-row">
                          <span class="label">MAC Address:</span>
                          <span class="value mono">{deployment.config.macAddress || deployment.config.mac_address}</span>
                        </div>
                      {/if}
                      {#if deployment.deployedAt}
                        <div class="detail-row">
                          <span class="label">Deployed:</span>
                          <span class="value">{new Date(deployment.deployedAt).toLocaleDateString()}</span>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Sectors -->
          <div class="section">
            <h3>📶 Sectors ({sectors.length})</h3>
            {#if sectors.length === 0}
              <div class="empty-state">
                <p>No sectors found at this site</p>
              </div>
            {:else}
              <div class="items-list">
                {#each sectors as sector}
                  <div class="item-card">
                    <div class="item-header">
                      <h4>{sector.name || 'Unnamed Sector'}</h4>
                      <span class="status-badge {sector.status || 'active'}">{sector.status || 'active'}</span>
                    </div>
                    <div class="item-details">
                      <div class="detail-row">
                        <span class="label">Technology:</span>
                        <span class="value">{sector.technology || 'Unknown'}</span>
                      </div>
                      {#if sector.band}
                        <div class="detail-row">
                          <span class="label">Band:</span>
                          <span class="value">{sector.band}</span>
                        </div>
                      {/if}
                      {#if sector.frequency}
                        <div class="detail-row">
                          <span class="label">Frequency:</span>
                          <span class="value">{sector.frequency} MHz</span>
                        </div>
                      {/if}
                      {#if sector.azimuth !== undefined && sector.azimuth !== null}
                        <div class="detail-row">
                          <span class="label">Azimuth:</span>
                          <span class="value">{sector.azimuth}°</span>
                        </div>
                      {/if}
                      {#if sector.beamwidth}
                        <div class="detail-row">
                          <span class="label">Beamwidth:</span>
                          <span class="value">{sector.beamwidth}°</span>
                        </div>
                      {/if}
                      {#if sector.power}
                        <div class="detail-row">
                          <span class="label">Power:</span>
                          <span class="value">{sector.power} dBm</span>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Network Equipment -->
          <div class="section">
            <div class="section-header">
              <h3>📡 Network Equipment ({equipment.length})</h3>
              <button class="btn-add-small" onclick={handleAddEquipment} title="Add Equipment">
                ➕ Add
              </button>
            </div>
            {#if equipment.length === 0}
              <div class="empty-state">
                <p>No network equipment found at this site</p>
                <button class="btn-add" onclick={handleAddEquipment}>➕ Add Equipment</button>
              </div>
            {:else}
              <div class="items-list">
                {#each equipment as eq}
                  <div class="item-card">
                    <div class="item-header">
                      <h4>{eq.name || 'Unnamed Equipment'}</h4>
                      <span class="status-badge {eq.status || 'active'}">{eq.status || 'active'}</span>
                    </div>
                    <div class="item-details">
                      <div class="detail-row">
                        <span class="label">Type:</span>
                        <span class="value">{eq.type || 'Unknown'}</span>
                      </div>
                      {#if eq.manufacturer || eq.model}
                        <div class="detail-row">
                          <span class="label">Model:</span>
                          <span class="value">{[eq.manufacturer, eq.model].filter(Boolean).join(' ')}</span>
                        </div>
                      {/if}
                      {#if eq.ipAddress || eq.networkConfig?.management_ip}
                        <div class="detail-row">
                          <span class="label">IP Address:</span>
                          <span class="value mono">{eq.ipAddress || eq.networkConfig?.management_ip}</span>
                        </div>
                      {/if}
                      {#if eq.macAddress}
                        <div class="detail-row">
                          <span class="label">MAC Address:</span>
                          <span class="value mono">{eq.macAddress}</span>
                        </div>
                      {/if}
                      {#if eq.serialNumber}
                        <div class="detail-row">
                          <span class="label">Serial:</span>
                          <span class="value mono">{eq.serialNumber}</span>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000; /* Increased to ensure it's above all other elements */
  }

  .modal-content {
    background: var(--card-bg, #ffffff);
    border-radius: 8px;
    padding: 0;
    max-width: 800px;
    width: 90%;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-content.large {
    max-width: 1000px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: var(--bg-secondary, #f3f4f6);
  }

  .error-banner {
    background: #fee2e2;
    color: #991b1b;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid #fecaca;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary, #6b7280);
  }

  .section {
    margin-bottom: 2rem;
  }

  .section:last-child {
    margin-bottom: 0;
  }

  .section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: var(--text-primary, #111827);
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary, #6b7280);
  }

  .items-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .item-card {
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 8px;
    padding: 1rem;
    background: var(--card-bg, #ffffff);
  }

  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .item-header h4 {
    margin: 0;
    font-size: 1rem;
  }

  .item-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .detail-row {
    display: flex;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .detail-row .label {
    font-weight: 500;
    min-width: 120px;
    color: var(--text-secondary, #6b7280);
  }

  .detail-row .value {
    color: var(--text-primary, #111827);
  }

  .detail-row .value.mono {
    font-family: monospace;
  }

  .status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .status-badge.active,
  .status-badge.deployed {
    background: #d1fae5;
    color: #065f46;
  }
</style>