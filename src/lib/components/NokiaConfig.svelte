<script lang="ts">
  import { onMount } from 'svelte';
  import { nokiaService, type NokiaBaseStation, type NokiaSector, type NokiaCarrier } from '$lib/services/nokiaService';
  import { pciService } from '$lib/services/pciService';
  import { networkStore } from '$lib/stores/networkStore';
  import { cellsStore } from '$lib/stores/appState';
  import { convertLegacyToCellSite, type CellSite } from '$lib/models/cellSite';

  export let visible = false;

  let config: NokiaBaseStation = {
    btsId: '10001',
    btsName: 'BBU-SITE-001',
    lnBtsId: '10001',
    sectors: [],
    ipConfig: {
      managementIP: '192.168.1.10',
      managementGateway: '192.168.1.1',
      managementSubnet: 24,
      transportIP: '10.0.1.10',
      transportGateway: '10.0.1.1',
      transportSubnet: 24
    },
    tac: 1,
    mcc: '310',
    mnc: '410',
    mncLength: 3
  };

  let validationErrors: string[] = [];
  let selectedSiteId: string = '';
  let sites: CellSite[] = [];
  let importing = false;
  let importSuccess = false;

  // Convert cells from cellsStore to CellSite format
  $: {
    const cells = $cellsStore.items;
    sites = convertLegacyToCellSite(cells);
    console.log('NokiaConfig: Available sites:', sites.length, sites.map(s => `${s.name} (eNodeB ${s.eNodeB})`));
  }

  function addSector() {
    const newSector: NokiaSector = {
      id: config.sectors.length + 1,
      azimuth: 0,
      rmodId: (config.sectors.length % 3) + 1,
      carriers: []
    };
    config.sectors = [...config.sectors, newSector];
  }

  function removeSector(index: number) {
    config.sectors = config.sectors.filter((_, i) => i !== index);
    // Renumber sectors
    config.sectors.forEach((sector, idx) => {
      sector.id = idx + 1;
    });
  }

  function addCarrier(sectorIndex: number) {
    const sector = config.sectors[sectorIndex];
    const newCarrier: NokiaCarrier = {
      id: sector.carriers.length + 1,
      earfcnDL: 55640, // Band 48 center frequency
      bandwidth: '20MHz',
      pci: 0,
      sectorId: sector.id
    };
    sector.carriers = [...sector.carriers, newCarrier];
    config.sectors = [...config.sectors];
  }

  function removeCarrier(sectorIndex: number, carrierIndex: number) {
    const sector = config.sectors[sectorIndex];
    sector.carriers = sector.carriers.filter((_, i) => i !== carrierIndex);
    // Renumber carriers
    sector.carriers.forEach((carrier, idx) => {
      carrier.id = idx + 1;
    });
    config.sectors = [...config.sectors];
  }

  function autofillPCIs() {
    let pci = 0;
    config.sectors.forEach(sector => {
      sector.carriers.forEach(carrier => {
        carrier.pci = pci;
        pci = (pci + 3) % 504; // Increment by 3, wrap at 504
      });
    });
    config.sectors = [...config.sectors];
  }

  function checkPCIConflicts() {
    const pcis = config.sectors.flatMap(s => s.carriers.map(c => c.pci));
    const unique = new Set(pcis);
    if (unique.size !== pcis.length) {
      alert('Warning: Duplicate PCIs detected! Each cell must have a unique PCI.');
    } else {
      alert('No PCI conflicts detected.');
    }
  }

  function importFromSite() {
    if (!selectedSiteId) {
      alert('Please select a site to import from');
      return;
    }

    importing = true;
    const site = sites.find(s => s.id === selectedSiteId);
    
    console.log('NokiaConfig: Importing from site:', site);
    
    if (!site) {
      alert('Site not found');
      importing = false;
      return;
    }

    // Populate base station info
    config.btsId = site.eNodeB.toString();
    config.lnBtsId = site.eNodeB.toString();
    config.btsName = site.name.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    console.log('NokiaConfig: BTS ID:', config.btsId, 'Name:', config.btsName);
    console.log('NokiaConfig: Site has', site.sectors.length, 'sectors');
    console.log('NokiaConfig: Full site object:', JSON.stringify(site, null, 2));
    
    // Clear existing sectors
    config.sectors = [];

    // Import sectors and their channels (carriers)
    site.sectors.forEach((sector, sectorIdx) => {
      console.log(`NokiaConfig: Processing sector ${sectorIdx + 1}/${site.sectors.length}:`, sector);
      const nokiaSector: NokiaSector = {
        id: sectorIdx + 1,
        azimuth: sector.azimuth,
        rmodId: sector.rmodId || ((sectorIdx % 3) + 1),
        carriers: []
      };

      // Import carriers from channels
      if (!sector.channels || sector.channels.length === 0) {
        console.warn(`NokiaConfig: Sector ${sectorIdx + 1} has no channels, skipping`);
        return; // Skip sectors with no channels
      }
      
      console.log(`NokiaConfig: Sector ${sectorIdx + 1} has ${sector.channels.length} channels`);
      
      sector.channels.forEach((channel, channelIdx) => {
        console.log(`NokiaConfig: Processing channel ${channelIdx + 1}:`, channel);
        const carrier: NokiaCarrier = {
          id: channelIdx + 1,
          earfcnDL: channel.dlEarfcn,
          earfcnUL: channel.ulEarfcn,
          bandwidth: channel.channelBandwidth === 20 ? '20MHz' : 
                     channel.channelBandwidth === 15 ? '15MHz' : '10MHz',
          pci: channel.pci,
          sectorId: nokiaSector.id,
          cellName: channel.name || `${site.name}-S${sector.sectorNumber}-C${channelIdx + 1}`
        };
        nokiaSector.carriers.push(carrier);
      });

      config.sectors.push(nokiaSector);
    });

    console.log('NokiaConfig: Imported', config.sectors.length, 'sectors');
    const totalCarriers = config.sectors.reduce((sum, s) => sum + s.carriers.length, 0);
    console.log('NokiaConfig: Total carriers:', totalCarriers);

    config.sectors = [...config.sectors];
    importing = false;
    
    if (config.sectors.length === 0) {
      alert(`⚠️ Import failed!\n\nThe selected site has no sectors with carriers.\n\nPlease make sure your towers have:\n• At least 1 sector\n• At least 1 carrier per sector`);
      return;
    }
    
    importSuccess = true;
    alert(`✅ Import successful!\n\nImported ${config.sectors.length} sector(s) with ${totalCarriers} carrier(s) from ${site.name}`);
    
    setTimeout(() => { importSuccess = false; }, 3000);
  }

  function validate() {
    const result = nokiaService.validateConfig(config);
    validationErrors = result.errors;
    return result.valid;
  }

  function generateAndDownload() {
    if (!validate()) {
      alert('Please fix validation errors before generating configuration');
      return;
    }

    try {
      nokiaService.downloadConfig(config);
      alert('Nokia configuration file generated successfully!');
    } catch (error) {
      console.error('Error generating config:', error);
      alert(`Error generating configuration: ${error}`);
    }
  }

  function close() {
    visible = false;
  }

  onMount(() => {
    validate();
  });
</script>

<div class="nokia-config-modal" class:visible>
  <div class="modal-content">
    <div class="modal-header">
      <h2>Nokia LTE Configuration Export</h2>
      <button class="close-btn" on:click={close}>×</button>
    </div>

    <div class="modal-body">
      <!-- Import from existing site -->
      <section class="config-section">
        <h3>Import from Site</h3>
        <div class="import-section">
          <select bind:value={selectedSiteId} class="site-select">
            <option value="">-- Select a site --</option>
            {#each sites as site}
              <option value={site.id}>{site.name}</option>
            {/each}
          </select>
          <button 
            class="btn btn-secondary" 
            on:click={importFromSite}
            disabled={!selectedSiteId || importing}
          >
            {importing ? 'Importing...' : 'Import Site Data'}
          </button>
          {#if importSuccess}
            <span class="success-msg">✓ Site data imported successfully!</span>
          {/if}
        </div>
      </section>

      <!-- Base Station Configuration -->
      <section class="config-section">
        <h3>Base Station Configuration</h3>
        <div class="form-grid">
          <div class="form-group">
            <label for="btsId">BTS ID</label>
            <input type="text" id="btsId" bind:value={config.btsId} placeholder="10001" />
          </div>
          <div class="form-group">
            <label for="btsName">BTS Name</label>
            <input type="text" id="btsName" bind:value={config.btsName} placeholder="BBU-SITE-001" />
          </div>
          <div class="form-group">
            <label for="lnBtsId">LNBTS ID</label>
            <input type="text" id="lnBtsId" bind:value={config.lnBtsId} placeholder="10001" />
          </div>
          <div class="form-group">
            <label for="tac">TAC</label>
            <input type="number" id="tac" bind:value={config.tac} placeholder="1" />
          </div>
          <div class="form-group">
            <label for="mcc">MCC</label>
            <input type="text" id="mcc" bind:value={config.mcc} placeholder="310" maxlength="3" />
          </div>
          <div class="form-group">
            <label for="mnc">MNC</label>
            <input type="text" id="mnc" bind:value={config.mnc} placeholder="410" maxlength="3" />
          </div>
        </div>
      </section>

      <!-- IP Configuration -->
      <section class="config-section">
        <h3>IP Configuration</h3>
        <div class="form-grid">
          <div class="form-group">
            <label for="mgmtIP">Management IP</label>
            <input type="text" id="mgmtIP" bind:value={config.ipConfig.managementIP} placeholder="192.168.1.10" />
          </div>
          <div class="form-group">
            <label for="mgmtGW">Management Gateway</label>
            <input type="text" id="mgmtGW" bind:value={config.ipConfig.managementGateway} placeholder="192.168.1.1" />
          </div>
          <div class="form-group">
            <label for="mgmtSubnet">Management Subnet</label>
            <input type="number" id="mgmtSubnet" bind:value={config.ipConfig.managementSubnet} min="8" max="32" />
          </div>
          <div class="form-group">
            <label for="transIP">Transport IP</label>
            <input type="text" id="transIP" bind:value={config.ipConfig.transportIP} placeholder="10.0.1.10" />
          </div>
          <div class="form-group">
            <label for="transGW">Transport Gateway</label>
            <input type="text" id="transGW" bind:value={config.ipConfig.transportGateway} placeholder="10.0.1.1" />
          </div>
          <div class="form-group">
            <label for="transSubnet">Transport Subnet</label>
            <input type="number" id="transSubnet" bind:value={config.ipConfig.transportSubnet} min="8" max="32" />
          </div>
        </div>
      </section>

      <!-- Sectors and Carriers -->
      <section class="config-section">
        <div class="section-header">
          <h3>Sectors & Carriers</h3>
          <div class="action-buttons">
            <button class="btn btn-secondary" on:click={autofillPCIs}>Auto-fill PCIs</button>
            <button class="btn btn-secondary" on:click={checkPCIConflicts}>Check PCI Conflicts</button>
            <button class="btn btn-primary" on:click={addSector}>+ Add Sector</button>
          </div>
        </div>

        {#each config.sectors as sector, sectorIdx}
          <div class="sector-card">
            <div class="sector-header">
              <h4>Sector {sector.id}</h4>
              <button class="btn-icon-delete" on:click={() => removeSector(sectorIdx)} title="Remove Sector">×</button>
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label for="azimuth-{sectorIdx}">Azimuth (°)</label>
                <input type="number" id="azimuth-{sectorIdx}" bind:value={sector.azimuth} min="0" max="359" />
              </div>
              <div class="form-group">
                <label for="rmod-{sectorIdx}">Radio Module (RMOD)</label>
                <select id="rmod-{sectorIdx}" bind:value={sector.rmodId}>
                  <option value={1}>RMOD-1</option>
                  <option value={2}>RMOD-2</option>
                  <option value={3}>RMOD-3</option>
                </select>
              </div>
            </div>

            <div class="carriers-section">
              <div class="carriers-header">
                <h5>Carriers</h5>
                <button class="btn btn-sm" on:click={() => addCarrier(sectorIdx)}>+ Add Carrier</button>
              </div>

              {#each sector.carriers as carrier, carrierIdx}
                <div class="carrier-row">
                  <div class="carrier-fields">
                    <input 
                      type="text" 
                      bind:value={carrier.cellName} 
                      placeholder="Cell Name (optional)"
                      class="carrier-name"
                    />
                    <input 
                      type="number" 
                      bind:value={carrier.earfcnDL} 
                      placeholder="EARFCN DL"
                      min="55240"
                      max="56739"
                      title="Band 48: 55240-56739"
                    />
                    <select bind:value={carrier.bandwidth}>
                      <option value="10MHz">10 MHz</option>
                      <option value="15MHz">15 MHz</option>
                      <option value="20MHz">20 MHz</option>
                    </select>
                    <input 
                      type="number" 
                      bind:value={carrier.pci} 
                      placeholder="PCI"
                      min="0"
                      max="503"
                      class="pci-input"
                    />
                  </div>
                  <button 
                    class="btn-icon-delete" 
                    on:click={() => removeCarrier(sectorIdx, carrierIdx)}
                    title="Remove Carrier"
                  >
                    ×
                  </button>
                </div>
              {/each}

              {#if sector.carriers.length === 0}
                <p class="empty-message">No carriers defined. Click "Add Carrier" to add one.</p>
              {/if}
            </div>
          </div>
        {/each}

        {#if config.sectors.length === 0}
          <p class="empty-message">No sectors defined. Click "Add Sector" to get started.</p>
        {/if}
      </section>

      <!-- Validation Errors -->
      {#if validationErrors.length > 0}
        <section class="validation-errors">
          <h4>⚠ Validation Errors</h4>
          <ul>
            {#each validationErrors as error}
              <li>{error}</li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="btn btn-secondary" on:click={close}>Cancel</button>
      <button class="btn btn-primary" on:click={generateAndDownload}>Generate & Download XML</button>
    </div>
  </div>
</div>

<style>
  .nokia-config-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 100001;
    overflow-y: auto;
    backdrop-filter: blur(8px);
  }

  .nokia-config-modal.visible {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 2rem 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 8px;
    width: 100%;
    max-width: 1000px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    margin: auto;
    position: relative;
    z-index: 100002;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #333;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    color: #666;
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
    background: #f0f0f0;
    color: #333;
  }

  .modal-body {
    padding: 1.5rem;
    max-height: calc(90vh - 200px);
    overflow-y: auto;
  }

  .config-section {
    margin-bottom: 2rem;
  }

  .config-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
    color: #333;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .section-header h3 {
    margin: 0;
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
  }

  .form-group label {
    margin-bottom: 0.25rem;
    font-weight: 500;
    color: #555;
    font-size: 0.875rem;
  }

  .form-group input,
  .form-group select {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: #4CAF50;
  }

  .import-section {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .site-select {
    flex: 1;
    min-width: 200px;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  .success-msg {
    color: #4CAF50;
    font-weight: 500;
  }

  .sector-card {
    background: #f9f9f9;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .sector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .sector-header h4 {
    margin: 0;
    color: #333;
  }

  .carriers-section {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e0e0e0;
  }

  .carriers-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .carriers-header h5 {
    margin: 0;
    font-size: 1rem;
    color: #555;
  }

  .carrier-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .carrier-fields {
    display: flex;
    gap: 0.5rem;
    flex: 1;
    flex-wrap: wrap;
  }

  .carrier-fields input,
  .carrier-fields select {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .carrier-name {
    flex: 1;
    min-width: 150px;
  }

  .pci-input {
    width: 80px;
  }

  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .btn-primary {
    background: #4CAF50;
    color: white;
  }

  .btn-primary:hover {
    background: #45a049;
  }

  .btn-secondary {
    background: #757575;
    color: white;
  }

  .btn-secondary:hover {
    background: #616161;
  }

  .btn-sm {
    padding: 0.25rem 0.75rem;
    font-size: 0.8125rem;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-icon-delete {
    background: #f44336;
    color: white;
    border: none;
    border-radius: 4px;
    width: 32px;
    height: 32px;
    font-size: 1.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .btn-icon-delete:hover {
    background: #d32f2f;
  }

  .empty-message {
    color: #999;
    font-style: italic;
    text-align: center;
    padding: 1rem;
  }

  .validation-errors {
    background: #ffebee;
    border: 1px solid #ef5350;
    border-radius: 6px;
    padding: 1rem;
    margin-top: 1rem;
  }

  .validation-errors h4 {
    margin: 0 0 0.5rem 0;
    color: #c62828;
  }

  .validation-errors ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .validation-errors li {
    color: #d32f2f;
    margin-bottom: 0.25rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid #e0e0e0;
  }

  :global(.dark-mode) .modal-content {
    background: #2d2d2d;
    color: #e0e0e0;
  }

  :global(.dark-mode) .modal-header,
  :global(.dark-mode) .modal-footer {
    border-color: #444;
  }

  :global(.dark-mode) .modal-header h2 {
    color: #e0e0e0;
  }

  :global(.dark-mode) .sector-card {
    background: #3a3a3a;
    border-color: #555;
  }

  :global(.dark-mode) .form-group input,
  :global(.dark-mode) .form-group select,
  :global(.dark-mode) .site-select,
  :global(.dark-mode) .carrier-fields input,
  :global(.dark-mode) .carrier-fields select {
    background: #2d2d2d;
    border-color: #555;
    color: #e0e0e0;
  }

  :global(.dark-mode) .close-btn:hover {
    background: #444;
    color: #fff;
  }

  :global(.dark-mode) .validation-errors {
    background: #3e2723;
    border-color: #d32f2f;
  }
</style>

