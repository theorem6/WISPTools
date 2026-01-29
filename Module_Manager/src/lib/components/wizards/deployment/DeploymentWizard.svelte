<script lang="ts">
  /**
   * Deployment Wizard
   * 
   * Guides field technicians through deploying equipment (sectors, radios, CPE).
   */
  
  import BaseWizard from '../BaseWizard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  
  export let show = false;
  export let initialLocation: { latitude: number; longitude: number } | null = null;
  export let initialSiteId: string | null = null;
  
  let currentStep = 0;
  let isLoading = false;
  let error = '';
  let success = '';
  
  // Wizard steps
  const steps = [
    { id: 'welcome', title: 'Welcome', icon: '🚀' },
    { id: 'type', title: 'Deployment Type', icon: '📦' },
    { id: 'location', title: 'Location', icon: '📍' },
    { id: 'equipment', title: 'Equipment', icon: '🔧' },
    { id: 'configure', title: 'Configure', icon: '⚙️' },
    { id: 'checklist', title: 'Checklist', icon: '✅' },
    { id: 'complete', title: 'Complete', icon: '🎉' }
  ];
  
  // Deployment state
  let deploymentType: 'sector' | 'radio' | 'cpe' | null = null;
  let selectedLocation: { latitude: number; longitude: number } | null = initialLocation;
  let selectedLatitude = selectedLocation?.latitude ?? 0;
  let selectedLongitude = selectedLocation?.longitude ?? 0;
  let selectedSiteId: string | null = initialSiteId;
  let availableSites: Array<{ id: string; name: string; location: { latitude: number; longitude: number } }> = [];
  let selectedEquipment: Array<{ id: string; name: string; category: string }> = [];
  let availableEquipment: Array<{ id: string; name: string; category: string; status: string }> = [];
  let configuration: Record<string, any> = {};
  let photos: File[] = [];
  let checklistItems: Array<{ id: string; label: string; checked: boolean }> = [];
  let deploymentNotes = '';
  let linkToWorkOrder = false;
  let workOrderId = '';
  
  // Sector-specific
  let sectorName = '';
  let sectorAzimuth = 0;
  let sectorFrequency = 2100;
  let sectorBandwidth: 1.4 | 3 | 5 | 10 | 15 | 20 = 20;
  
  // CPE-specific
  let customerId = '';
  let customerName = '';
  let servicePlan = '';
  
  async function loadSites() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) return;
    
    try {
      const { coverageMapService } = await import('../../../../routes/modules/coverage-map/lib/coverageMapService.mongodb');
      const sites = await coverageMapService.getTowerSites(tenantId);
      availableSites = sites.map((site: any) => ({
        id: site.id || site._id,
        name: site.name,
        location: site.location || { latitude: 0, longitude: 0 }
      }));
    } catch (err) {
      console.error('Failed to load sites:', err);
    }
  }
  
  async function loadAvailableEquipment() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) return;
    
    try {
      const { inventoryService } = await import('$lib/services/inventoryService');
      const items = await inventoryService.getInventory({ status: 'available', limit: 100 });
      availableEquipment = items.items.map((item: any) => ({
        id: item.id || item._id,
        name: item.name || item.serialNumber || 'Unnamed Item',
        category: item.category || 'Unknown',
        status: item.status || 'available'
      }));
    } catch (err) {
      console.error('Failed to load equipment:', err);
    }
  }
  
  function initializeChecklist() {
    if (deploymentType === 'sector') {
      checklistItems = [
        { id: '1', label: 'Radio mounted securely', checked: false },
        { id: '2', label: 'Antenna aligned correctly', checked: false },
        { id: '3', label: 'Power connected and tested', checked: false },
        { id: '4', label: 'Network cable connected', checked: false },
        { id: '5', label: 'Configuration applied', checked: false },
        { id: '6', label: 'RF signal tested', checked: false },
        { id: '7', label: 'Photos taken', checked: false }
      ];
    } else if (deploymentType === 'radio') {
      checklistItems = [
        { id: '1', label: 'Radio mounted', checked: false },
        { id: '2', label: 'Power connected', checked: false },
        { id: '3', label: 'Network connected', checked: false },
        { id: '4', label: 'Configuration applied', checked: false },
        { id: '5', label: 'Signal tested', checked: false },
        { id: '6', label: 'Photos taken', checked: false }
      ];
    } else if (deploymentType === 'cpe') {
      checklistItems = [
        { id: '1', label: 'CPE mounted/installed', checked: false },
        { id: '2', label: 'Power connected', checked: false },
        { id: '3', label: 'Antenna aligned', checked: false },
        { id: '4', label: 'Configuration applied', checked: false },
        { id: '5', label: 'Signal strength verified', checked: false },
        { id: '6', label: 'Customer tested connection', checked: false },
        { id: '7', label: 'Photos taken', checked: false }
      ];
    }
  }
  
  function handleClose() {
    show = false;
    resetWizard();
  }
  
  function resetWizard() {
    currentStep = 0;
    deploymentType = null;
    selectedLocation = initialLocation;
    selectedSiteId = initialSiteId;
    selectedEquipment = [];
    configuration = {};
    photos = [];
    checklistItems = [];
    deploymentNotes = '';
    linkToWorkOrder = false;
    workOrderId = '';
    sectorName = '';
    sectorAzimuth = 0;
    sectorFrequency = 2100;
    sectorBandwidth = 20;
    customerId = '';
    customerName = '';
    servicePlan = '';
    error = '';
    success = '';
  }
  
  function handleStepChange(event: CustomEvent<number>) {
    currentStep = event.detail;
    if (currentStep === 2) {
      loadSites();
    } else if (currentStep === 3) {
      loadAvailableEquipment();
    } else if (currentStep === 5 && deploymentType) {
      initializeChecklist();
    }
  }
  
  function nextStep() {
    if (currentStep === 1 && !deploymentType) {
      error = 'Please select a deployment type';
      return;
    }
    if (currentStep === 2 && !selectedLocation && !selectedSiteId) {
      error = 'Please select a location or site';
      return;
    }
    if (currentStep === 3 && selectedEquipment.length === 0) {
      error = 'Please select at least one equipment item';
      return;
    }
    if (currentStep === 4 && deploymentType === 'sector' && !sectorName.trim()) {
      error = 'Sector name is required';
      return;
    }
    if (currentStep === 5 && checklistItems.some(item => !item.checked)) {
      error = 'Please complete all checklist items';
      return;
    }
    if (currentStep < steps.length - 1) {
      currentStep++;
      error = '';
      success = '';
    }
  }
  
  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
      error = '';
      success = '';
    }
  }
  
  function selectDeploymentType(type: 'sector' | 'radio' | 'cpe') {
    deploymentType = type;
    nextStep();
  }
  
  function selectSite(siteId: string) {
    selectedSiteId = siteId;
    const site = availableSites.find(s => s.id === siteId);
    if (site) {
      selectedLocation = site.location;
      selectedLatitude = site.location.latitude;
      selectedLongitude = site.location.longitude;
    }
  }
  
  function toggleEquipment(equipmentId: string) {
    const index = selectedEquipment.findIndex(e => e.id === equipmentId);
    if (index >= 0) {
      selectedEquipment = selectedEquipment.filter(e => e.id !== equipmentId);
    } else {
      const equipment = availableEquipment.find(e => e.id === equipmentId);
      if (equipment) {
        selectedEquipment = [...selectedEquipment, equipment];
      }
    }
  }
  
  function handlePhotoUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files) {
      photos = [...photos, ...Array.from(target.files)];
    }
  }
  
  function removePhoto(index: number) {
    photos = photos.filter((_, i) => i !== index);
  }
  
  async function completeDeployment() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) {
      error = 'No tenant selected';
      return;
    }
    
    isLoading = true;
    error = '';
    
    try {
      // Create deployment record
      const deploymentData: any = {
        type: deploymentType,
        location: selectedLocation,
        siteId: selectedSiteId,
        equipmentIds: selectedEquipment.map(e => e.id),
        configuration: configuration,
        notes: deploymentNotes,
        photos: photos.length,
        checklistCompleted: checklistItems.every(item => item.checked),
        tenantId: tenantId
      };
      
      if (deploymentType === 'sector') {
        deploymentData.sectorConfig = {
          name: sectorName,
          azimuth: sectorAzimuth,
          frequency: sectorFrequency,
          bandwidth: sectorBandwidth
        };
      } else if (deploymentType === 'cpe') {
        deploymentData.customerId = customerId;
        deploymentData.servicePlan = servicePlan;
      }
      
      if (linkToWorkOrder && workOrderId) {
        deploymentData.workOrderId = workOrderId;
      }
      
      // Upload photos if any
      if (photos.length > 0) {
        const formData = new FormData();
        photos.forEach((photo, index) => {
          formData.append(`photo_${index}`, photo);
        });
        formData.append('deploymentId', 'temp'); // Will be updated after deployment creation
        
        // Upload photos (would need backend endpoint)
        // await fetch('/api/deployments/photos', { method: 'POST', body: formData });
      }
      
      // Create deployment via API
      const response = await fetch('/api/deployments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify(deploymentData)
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create deployment');
      }
      
      // Update equipment status to 'deployed'
      for (const equipment of selectedEquipment) {
        await fetch(`/api/inventory/${equipment.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tenantId
          },
          body: JSON.stringify({ status: 'deployed', locationId: selectedSiteId })
        });
      }
      
      // If sector deployment, create sector
      if (deploymentType === 'sector' && selectedSiteId) {
        const { coverageMapService } = await import('../../../../routes/modules/coverage-map/lib/coverageMapService.mongodb');
        await coverageMapService.createSector(tenantId, {
          name: sectorName,
          towerId: selectedSiteId,
          azimuth: sectorAzimuth,
          frequency: sectorFrequency,
          bandwidth: sectorBandwidth,
          equipmentIds: selectedEquipment.map(e => e.id)
        });
      }
      
      success = 'Deployment completed successfully!';
      setTimeout(() => {
        nextStep();
      }, 1500);
    } catch (err: any) {
      error = err.message || 'Failed to complete deployment';
    } finally {
      isLoading = false;
    }
  }
  
  function complete() {
    handleClose();
  }
</script>

<BaseWizard
  {show}
  title="🚀 Deployment Wizard"
  {steps}
  {currentStep}
  {isLoading}
  {error}
  {success}
  on:close={handleClose}
  on:stepChange={handleStepChange}
>
  <div slot="content">
    {#if currentStep === 0}
      <!-- Welcome Step -->
      <div class="wizard-panel">
        <h3>Welcome to Deployment Wizard! 🚀</h3>
        <p>This wizard will guide you through deploying equipment in the field.</p>
        
        <div class="info-box">
          <h4>What You'll Do:</h4>
          <ul>
            <li>✅ Select deployment type (Sector, Radio, or CPE)</li>
            <li>✅ Choose location on map or select existing site</li>
            <li>✅ Select equipment from inventory</li>
            <li>✅ Configure equipment parameters</li>
            <li>✅ Complete deployment checklist</li>
            <li>✅ Upload photos</li>
          </ul>
        </div>
        
        <div class="info-box">
          <h4>Deployment Types:</h4>
          <ul>
            <li><strong>Sector:</strong> Deploy a complete sector (radio + antenna + configuration)</li>
            <li><strong>Radio:</strong> Deploy a radio unit</li>
            <li><strong>CPE:</strong> Deploy customer premise equipment</li>
          </ul>
        </div>
      </div>
      
    {:else if currentStep === 1}
      <!-- Deployment Type -->
      <div class="wizard-panel">
        <h3>Select Deployment Type</h3>
        <p>What type of equipment are you deploying?</p>
        
        <div class="type-grid">
          <button 
            class="type-card" 
            on:click={() => selectDeploymentType('sector')}
            disabled={isLoading}
          >
            <div class="type-icon">📡</div>
            <h4>Sector Deployment</h4>
            <p>Deploy a complete sector with radio, antenna, and configuration</p>
            <ul class="type-features">
              <li>Auto-create sector</li>
              <li>Link equipment</li>
              <li>Configure parameters</li>
            </ul>
          </button>
          
          <button 
            class="type-card" 
            on:click={() => selectDeploymentType('radio')}
            disabled={isLoading}
          >
            <div class="type-icon">📻</div>
            <h4>Radio Deployment</h4>
            <p>Deploy a radio unit to an existing site</p>
            <ul class="type-features">
              <li>Select site</li>
              <li>Link equipment</li>
              <li>Configure radio</li>
            </ul>
          </button>
          
          <button 
            class="type-card" 
            on:click={() => selectDeploymentType('cpe')}
            disabled={isLoading}
          >
            <div class="type-icon">📱</div>
            <h4>CPE Deployment</h4>
            <p>Deploy customer premise equipment</p>
            <ul class="type-features">
              <li>Link to customer</li>
              <li>Configure CPE</li>
              <li>Test connection</li>
            </ul>
          </button>
        </div>
      </div>
      
    {:else if currentStep === 2}
      <!-- Location -->
      <div class="wizard-panel">
        <h3>Select Location</h3>
        <p>Choose where you're deploying this equipment.</p>
        
        <div class="location-options">
          <div class="form-group">
            <label>Select Existing Site</label>
            <select 
              bind:value={selectedSiteId}
              on:change={(e) => selectSite(e.currentTarget.value)}
              disabled={isLoading}
            >
              <option value="">-- Select Site --</option>
              {#each availableSites as site}
                <option value={site.id}>{site.name}</option>
              {/each}
            </select>
          </div>
          
          <div class="or-divider">OR</div>
          
          <div class="form-group">
            <label>Enter GPS Coordinates</label>
            <div class="coords-input">
              <input 
                type="number" 
                step="0.000001"
                placeholder="Latitude"
                bind:value={selectedLatitude}
                disabled={isLoading}
                on:input={() => {
                  if (!selectedLocation) {
                    selectedLocation = { latitude: selectedLatitude, longitude: selectedLongitude };
                  } else {
                    selectedLocation.latitude = selectedLatitude;
                  }
                }}
              />
              <input 
                type="number" 
                step="0.000001"
                placeholder="Longitude"
                bind:value={selectedLongitude}
                disabled={isLoading}
                on:input={() => {
                  if (!selectedLocation) {
                    selectedLocation = { latitude: selectedLatitude, longitude: selectedLongitude };
                  } else {
                    selectedLocation.longitude = selectedLongitude;
                  }
                }}
              />
            </div>
            <small>Click on map to set location, or enter coordinates manually</small>
          </div>
        </div>
        
        {#if selectedLocation || selectedSiteId}
          <div class="info-box success">
            <p><strong>Selected Location:</strong> 
              {#if selectedSiteId}
                {availableSites.find(s => s.id === selectedSiteId)?.name || 'Unknown Site'}
              {:else}
                {selectedLocation?.latitude?.toFixed(6)}, {selectedLocation?.longitude?.toFixed(6)}
              {/if}
            </p>
          </div>
        {/if}
      </div>
      
    {:else if currentStep === 3}
      <!-- Equipment Selection -->
      <div class="wizard-panel">
        <h3>Select Equipment</h3>
        <p>Choose equipment from inventory to deploy.</p>
        
        {#if availableEquipment.length === 0}
          <div class="info-box warning">
            <p>⚠️ No available equipment found. Check inventory status.</p>
          </div>
        {:else}
          <div class="equipment-grid">
            {#each availableEquipment as equipment}
              <button
                class="equipment-card"
                class:selected={selectedEquipment.some(e => e.id === equipment.id)}
                on:click={() => toggleEquipment(equipment.id)}
                disabled={isLoading}
              >
                <h4>{equipment.name}</h4>
                <p class="category">{equipment.category}</p>
                <p class="status">{equipment.status}</p>
              </button>
            {/each}
          </div>
          
          {#if selectedEquipment.length > 0}
            <div class="selected-equipment">
              <h4>Selected Equipment ({selectedEquipment.length})</h4>
              <ul>
                {#each selectedEquipment as equipment}
                  <li>{equipment.name} - {equipment.category}</li>
                {/each}
              </ul>
            </div>
          {/if}
        {/if}
      </div>
      
    {:else if currentStep === 4}
      <!-- Configuration -->
      {#if deploymentType === 'sector'}
        <div class="wizard-panel">
          <h3>Sector Configuration</h3>
          
          <div class="form-group">
            <label>
              Sector Name <span class="required">*</span>
            </label>
            <input 
              type="text" 
              bind:value={sectorName}
              placeholder="e.g., Sector 1, North Sector"
              disabled={isLoading}
            />
          </div>
          
          <div class="form-group">
            <label>Azimuth (degrees)</label>
            <input 
              type="number" 
              bind:value={sectorAzimuth}
              min="0"
              max="360"
              disabled={isLoading}
            />
          </div>
          
          <div class="form-group">
            <label>Frequency (MHz)</label>
            <input 
              type="number" 
              bind:value={sectorFrequency}
              min="600"
              max="6000"
              disabled={isLoading}
            />
          </div>
          
          <div class="form-group">
            <label>Bandwidth (MHz)</label>
            <select bind:value={sectorBandwidth} disabled={isLoading}>
              <option value={1.4}>1.4 MHz</option>
              <option value={3}>3 MHz</option>
              <option value={5}>5 MHz</option>
              <option value={10}>10 MHz</option>
              <option value={15}>15 MHz</option>
              <option value={20}>20 MHz</option>
            </select>
          </div>
        </div>
      {:else if deploymentType === 'cpe'}
        <div class="wizard-panel">
          <h3>CPE Configuration</h3>
          
          <div class="form-group">
            <label>Customer</label>
            <input 
              type="text" 
              bind:value={customerName}
              placeholder="Search or enter customer name"
              disabled={isLoading}
            />
            <button class="btn-small" type="button">Search Customer</button>
          </div>
          
          <div class="form-group">
            <label>Service Plan</label>
            <select bind:value={servicePlan} disabled={isLoading}>
              <option value="">-- Select Plan --</option>
              <option value="basic">Basic Plan</option>
              <option value="standard">Standard Plan</option>
              <option value="premium">Premium Plan</option>
            </select>
          </div>
        </div>
      {:else}
        <div class="wizard-panel">
          <h3>Radio Configuration</h3>
          <p>Configure radio parameters as needed.</p>
          <div class="info-box">
            <p>Radio configuration will be applied during deployment.</p>
          </div>
        </div>
      {/if}
      
    {:else if currentStep === 5}
      <!-- Checklist -->
      <div class="wizard-panel">
        <h3>Deployment Checklist</h3>
        <p>Complete all items before finishing deployment.</p>
        
        <div class="checklist">
          {#each checklistItems as item}
            <label class="checklist-item">
              <input 
                type="checkbox" 
                bind:checked={item.checked}
                disabled={isLoading}
              />
              <span>{item.label}</span>
            </label>
          {/each}
        </div>
        
        <div class="form-group">
          <label>Deployment Notes</label>
          <textarea 
            bind:value={deploymentNotes}
            placeholder="Add any notes about this deployment..."
            rows="4"
            disabled={isLoading}
          ></textarea>
        </div>
        
        <div class="form-group">
          <label>Upload Photos</label>
          <input 
            type="file" 
            accept="image/*"
            multiple
            on:change={handlePhotoUpload}
            disabled={isLoading}
          />
          {#if photos.length > 0}
            <div class="photos-preview">
              {#each photos as photo, index}
                <div class="photo-item">
                  <span>{photo.name}</span>
                  <button 
                    class="btn-icon" 
                    on:click={() => removePhoto(index)}
                    disabled={isLoading}
                  >
                    ×
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
        
        <div class="form-group">
          <label>
            <input 
              type="checkbox" 
              bind:checked={linkToWorkOrder}
              disabled={isLoading}
            />
            Link to Work Order
          </label>
          {#if linkToWorkOrder}
            <input 
              type="text" 
              bind:value={workOrderId}
              placeholder="Work Order ID"
              disabled={isLoading}
            />
          {/if}
        </div>
      </div>
      
    {:else if currentStep === 6}
      <!-- Complete -->
      <div class="wizard-panel">
        <h3>🎉 Deployment Complete!</h3>
        <p>Your deployment has been recorded successfully.</p>
        
        <div class="deployment-summary">
          <h4>Deployment Summary</h4>
          <div class="summary-row">
            <span class="label">Type:</span>
            <span class="value">{deploymentType}</span>
          </div>
          <div class="summary-row">
            <span class="label">Location:</span>
            <span class="value">
              {selectedSiteId ? availableSites.find(s => s.id === selectedSiteId)?.name : 
               `${selectedLocation?.latitude?.toFixed(6)}, ${selectedLocation?.longitude?.toFixed(6)}`}
            </span>
          </div>
          <div class="summary-row">
            <span class="label">Equipment:</span>
            <span class="value">{selectedEquipment.length} item(s)</span>
          </div>
          {#if deploymentType === 'sector'}
            <div class="summary-row">
              <span class="label">Sector Name:</span>
              <span class="value">{sectorName}</span>
            </div>
          {/if}
        </div>
        
        <div class="next-steps">
          <h4>What's Next?</h4>
          <a href="/modules/deploy" class="next-step-item">
            <span class="icon">📊</span>
            <div>
              <strong>View Deployment</strong>
              <p>Check the Deploy module to see your deployment</p>
            </div>
          </a>
          <a href="/modules/inventory" class="next-step-item">
            <span class="icon">📋</span>
            <div>
              <strong>Update Inventory</strong>
              <p>Equipment status has been updated to 'Deployed'</p>
            </div>
          </a>
        </div>
      </div>
    {/if}
  </div>
  
  <div slot="footer" let:currentStep let:nextStep let:prevStep let:handleClose let:isLoading>
    {#if currentStep > 0}
      <button class="wizard-btn-secondary" on:click={prevStep} disabled={isLoading}>
        ← Previous
      </button>
    {:else}
      <button class="wizard-btn-secondary" on:click={handleClose} disabled={isLoading}>
        Cancel
      </button>
    {/if}
    
    <div class="footer-actions">
      {#if currentStep === 5}
        <button 
          class="wizard-btn-primary" 
          on:click={completeDeployment} 
          disabled={isLoading || !checklistItems.every(item => item.checked)}
        >
          {isLoading ? 'Deploying...' : '✅ Complete Deployment'}
        </button>
      {:else if currentStep < steps.length - 1}
        <button class="wizard-btn-primary" on:click={nextStep} disabled={isLoading}>
          Next →
        </button>
      {:else}
        <button class="wizard-btn-primary" on:click={complete} disabled={isLoading}>
          Finish →
        </button>
      {/if}
    </div>
  </div>
</BaseWizard>

<style>
  /* Use global theme variables - no hardcoded colors */
  .wizard-panel h3 {
    margin: 0 0 var(--spacing-md) 0;
    font-size: var(--font-size-2xl);
    color: var(--text-primary);
  }
  
  .wizard-panel p {
    color: var(--text-secondary);
    line-height: var(--line-height-normal);
    margin: var(--spacing-sm) 0;
  }
  
  .info-box {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
    margin: var(--spacing-md) 0;
    color: var(--text-primary);
  }
  
  .info-box.success {
    background: var(--success-light);
    border-color: var(--success-color);
    color: var(--text-primary);
  }
  
  .info-box.warning {
    background: var(--warning-light);
    border-color: var(--warning-color);
    color: var(--text-primary);
  }
  
  .info-box h4 {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: var(--font-size-base);
    color: var(--text-primary);
  }
  
  .info-box ul {
    margin: var(--spacing-sm) 0 0 var(--spacing-lg);
    padding: 0;
    color: var(--text-primary);
  }
  
  .type-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--spacing-md);
    margin: var(--spacing-lg) 0;
  }
  
  .type-card {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    cursor: pointer;
    transition: var(--transition);
    text-align: left;
    color: var(--text-primary);
  }
  
  .type-card:hover:not(:disabled) {
    border-color: var(--primary-color);
    transform: translateY(-2px);
    background: var(--hover-bg);
  }
  
  .type-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .type-icon {
    font-size: 3rem;
    margin-bottom: var(--spacing-sm);
  }
  
  .type-card h4 {
    margin: var(--spacing-sm) 0;
    font-size: var(--font-size-lg);
    color: var(--text-primary);
  }
  
  .type-card p {
    font-size: var(--font-size-sm);
    margin: var(--spacing-sm) 0;
    color: var(--text-secondary);
  }
  
  .type-features {
    list-style: none;
    margin: var(--spacing-md) 0 0 0;
    padding: 0;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
  }
  
  .type-features li {
    padding: var(--spacing-xs) 0;
    color: var(--text-primary);
  }
  
  .type-features li:before {
    content: '✓ ';
    color: var(--success-color);
  }
  
  .form-group {
    margin: var(--spacing-md) 0;
  }
  
  .form-group label {
    display: block;
    margin-bottom: var(--spacing-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
  }
  
  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    background: var(--input-bg);
    color: var(--text-primary);
  }
  
  .required {
    color: var(--danger-color);
  }
  
  .location-options {
    margin: var(--spacing-md) 0;
  }
  
  .or-divider {
    text-align: center;
    margin: var(--spacing-md) 0;
    font-weight: var(--font-weight-medium);
    color: var(--text-secondary);
  }
  
  .coords-input {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-sm);
  }
  
  .equipment-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--spacing-md);
    margin: var(--spacing-md) 0;
  }
  
  .equipment-card {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
    cursor: pointer;
    transition: var(--transition);
    text-align: left;
    color: var(--text-primary);
  }
  
  .equipment-card:hover:not(:disabled) {
    border-color: var(--primary-color);
    background: var(--hover-bg);
  }
  
  .equipment-card.selected {
    background: var(--primary-color);
    color: var(--text-inverse);
    border-color: var(--primary-color);
  }
  
  .equipment-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .equipment-card h4 {
    margin: 0 0 var(--spacing-xs) 0;
    font-size: var(--font-size-base);
    color: inherit;
  }
  
  .equipment-card .category {
    font-size: var(--font-size-sm);
    margin: var(--spacing-xs) 0;
    color: var(--text-secondary);
  }
  
  .equipment-card .status {
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    color: var(--text-secondary);
  }
  
  .selected-equipment {
    margin-top: var(--spacing-lg);
    padding: var(--spacing-md);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
  }
  
  .selected-equipment h4 {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--text-primary);
  }
  
  .selected-equipment ul {
    margin: 0;
    padding-left: var(--spacing-lg);
    color: var(--text-primary);
  }
  
  .checklist {
    margin: var(--spacing-md) 0;
  }
  
  .checklist-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    margin: var(--spacing-sm) 0;
    cursor: pointer;
    color: var(--text-primary);
  }
  
  .checklist-item:hover {
    background: var(--hover-bg);
  }
  
  .checklist-item input[type="checkbox"] {
    width: auto;
    margin: 0;
  }
  
  .photos-preview {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-sm);
  }
  
  .photo-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    color: var(--text-primary);
  }
  
  .btn-icon {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    padding: 0;
    color: var(--text-secondary);
  }
  
  .btn-icon:hover {
    color: var(--danger-color);
  }
  
  .btn-small {
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    border: none;
    font-size: var(--font-size-sm);
    cursor: pointer;
    background: var(--primary-color);
    color: var(--text-inverse);
    margin-top: var(--spacing-sm);
    transition: var(--transition);
  }
  
  .btn-small:hover:not(:disabled) {
    background: var(--primary-hover);
  }
  
  .deployment-summary {
    margin: var(--spacing-lg) 0;
  }
  
  .deployment-summary h4 {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-primary);
  }
  
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: var(--spacing-md) 0;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
  }
  
  .summary-row .label {
    font-weight: var(--font-weight-medium);
    color: var(--text-secondary);
  }
  
  .summary-row .value {
    color: var(--text-primary);
  }
  
  .next-steps {
    margin-top: var(--spacing-lg);
  }

  a.next-step-item {
    text-decoration: none;
    color: inherit;
  }

  a.next-step-item:hover {
    background: var(--bg-primary);
  }
  
  .next-step-item {
    display: flex;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    margin: var(--spacing-md) 0;
    border: 1px solid var(--border-color);
    color: var(--text-primary);
  }
  
  .next-step-item .icon {
    font-size: 2rem;
  }
  
  .next-step-item strong {
    display: block;
    margin-bottom: var(--spacing-xs);
    color: var(--text-primary);
  }
  
  .next-step-item p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
  
  .footer-actions {
    display: flex;
    gap: var(--spacing-sm);
  }
</style>
