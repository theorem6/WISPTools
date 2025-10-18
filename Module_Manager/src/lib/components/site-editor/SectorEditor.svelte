<script lang="ts">
  import type { Sector } from '$lib/models/cellSite';
  import { createEventDispatcher } from 'svelte';
  
  export let sector: Sector | null = null;
  export let sectorIndex: number | null = null;
  
  const dispatch = createEventDispatcher();
  
  function handleChange() {
    if (sector) {
      dispatch('change', { sector, index: sectorIndex });
    }
  }
  
  // Bandwidth options (MHz)
  const bandwidthOptions = [1.4, 3, 5, 10, 15, 20];
</script>

{#if sector && sectorIndex !== null}
  <div class="sector-editor">
    <div class="editor-header">
      <h4>Sector {sectorIndex + 1} Configuration</h4>
    </div>
    
    <div class="form-grid">
      <div class="form-group">
        <label for="pci">PCI *</label>
        <input
          id="pci"
          type="number"
          bind:value={sector.pci}
          on:input={handleChange}
          min="0"
          max="503"
          required
        />
        <span class="hint">Physical Cell ID (0-503)</span>
      </div>
      
      <div class="form-group">
        <label for="azimuth">Azimuth *</label>
        <input
          id="azimuth"
          type="number"
          bind:value={sector.azimuth}
          on:input={handleChange}
          min="0"
          max="359"
          required
        />
        <span class="hint">Degrees (0-359)</span>
      </div>
      
      <div class="form-group">
        <label for="beamwidth">Beamwidth *</label>
        <input
          id="beamwidth"
          type="number"
          bind:value={sector.antennaBeamwidth}
          on:input={handleChange}
          min="1"
          max="180"
          required
        />
        <span class="hint">Degrees (typical: 65°)</span>
      </div>
      
      <div class="form-group">
        <label for="earfcn">EARFCN *</label>
        <input
          id="earfcn"
          type="number"
          bind:value={sector.earfcn}
          on:input={handleChange}
          min="0"
          max="65535"
          required
        />
        <span class="hint">E-UTRA Absolute Radio Frequency Channel Number</span>
      </div>
      
      <div class="form-group">
        <label for="bandwidth">Bandwidth *</label>
        <select
          id="bandwidth"
          bind:value={sector.bandwidth}
          on:change={handleChange}
          required
        >
          {#each bandwidthOptions as bw}
            <option value={bw}>{bw} MHz</option>
          {/each}
        </select>
      </div>
      
      <div class="form-group">
        <label for="power">TX Power *</label>
        <input
          id="power"
          type="number"
          bind:value={sector.transmitPower}
          on:input={handleChange}
          min="0"
          max="60"
          required
        />
        <span class="hint">dBm (typical: 46)</span>
      </div>
      
      <div class="form-group">
        <label for="tac">TAC</label>
        <input
          id="tac"
          type="number"
          bind:value={sector.tac}
          on:input={handleChange}
          min="1"
          max="65535"
        />
        <span class="hint">Tracking Area Code</span>
      </div>
      
      <div class="form-group">
        <label for="localId">Local ID</label>
        <input
          id="localId"
          type="number"
          bind:value={sector.eNodeBLocalID}
          on:input={handleChange}
          min="0"
          max="255"
        />
        <span class="hint">Sector ID within eNodeB</span>
      </div>
    </div>
  </div>
{:else}
  <div class="no-selection">
    <p>Select a sector to edit its configuration</p>
  </div>
{/if}

<style>
  .sector-editor {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-md);
  }
  
  .editor-header {
    margin-bottom: var(--spacing-md);
    padding-bottom: var(--spacing-sm);
    border-bottom: 1px solid var(--border-color);
  }
  
  .editor-header h4 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1rem;
    font-weight: 600;
  }
  
  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-md);
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
  }
  
  label {
    margin-bottom: var(--spacing-sm);
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 0.875rem;
  }
  
  input, select {
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.875rem;
    transition: var(--transition);
  }
  
  input:focus, select:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light);
  }
  
  .hint {
    margin-top: var(--spacing-xs);
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  
  .no-selection {
    background: var(--bg-secondary);
    border: 1px dashed var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-xl);
    text-align: center;
    color: var(--text-muted);
  }
  
  @media (max-width: 768px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

