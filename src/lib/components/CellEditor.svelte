<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Cell } from '$lib/pciMapper';
  
  export let cell: Cell | null = null;
  export let isOpen = false;
  export let isNewCell = false;
  export let initialLatitude: number | undefined = undefined;
  export let initialLongitude: number | undefined = undefined;
  
  const dispatch = createEventDispatcher();
  
  // Create a working copy of the cell data
  let editedCell: Cell;
  let additionalEarfcns: number[] = [];
  let newEarfcn = '';
  
  // Initialize cell data
  $: if (isOpen) {
    if (isNewCell) {
      // Create new cell with default values
      const nextCellNumber = Date.now().toString().slice(-6);
      editedCell = {
        id: `CELL${nextCellNumber}`,
        eNodeB: 1000,
        sector: 1,
        pci: 0,
        latitude: initialLatitude || 40.7128,
        longitude: initialLongitude || -74.0060,
        frequency: 2100,
        rsPower: -75,
        azimuth: 0,
        towerType: '3-sector',
        technology: 'LTE',
        earfcn: 1950,
        centerFreq: 2100,
        channelBandwidth: 20,
        dlEarfcn: 1950,
        ulEarfcn: 1850
      };
    } else if (cell) {
      editedCell = { ...cell };
    }
    additionalEarfcns = [];
    newEarfcn = '';
  }
  
  function handleClose() {
    dispatch('close');
  }
  
  function handleSave() {
    dispatch('save', editedCell);
    handleClose();
  }
  
  function addEarfcn() {
    const earfcn = parseInt(newEarfcn);
    if (!isNaN(earfcn) && earfcn > 0 && earfcn < 70000) {
      additionalEarfcns = [...additionalEarfcns, earfcn];
      newEarfcn = '';
    }
  }
  
  function removeEarfcn(index: number) {
    additionalEarfcns = additionalEarfcns.filter((_, i) => i !== index);
  }
  
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }
  
  // EARFCN to Frequency conversion
  function earfcnToFrequency(earfcn: number): { centerFreq: number, isTDD: boolean, band: string } {
    // FDD Bands
    if (earfcn >= 0 && earfcn <= 599) return { centerFreq: 2110 + 0.1 * earfcn, isTDD: false, band: 'Band 1 (2100 MHz)' };
    if (earfcn >= 600 && earfcn <= 1199) return { centerFreq: 1930 + 0.1 * (earfcn - 600), isTDD: false, band: 'Band 2 (1900 MHz)' };
    if (earfcn >= 1200 && earfcn <= 1949) return { centerFreq: 1805 + 0.1 * (earfcn - 1200), isTDD: false, band: 'Band 3 (1800 MHz)' };
    if (earfcn >= 1950 && earfcn <= 2399) return { centerFreq: 2110 + 0.1 * (earfcn - 1950), isTDD: false, band: 'Band 4 (AWS)' };
    if (earfcn >= 2400 && earfcn <= 2649) return { centerFreq: 869 + 0.1 * (earfcn - 2400), isTDD: false, band: 'Band 5 (850 MHz)' };
    if (earfcn >= 2650 && earfcn <= 2749) return { centerFreq: 875 + 0.1 * (earfcn - 2650), isTDD: false, band: 'Band 6 (800 MHz)' };
    if (earfcn >= 2750 && earfcn <= 3449) return { centerFreq: 2620 + 0.1 * (earfcn - 2750), isTDD: false, band: 'Band 7 (2600 MHz)' };
    if (earfcn >= 3450 && earfcn <= 3799) return { centerFreq: 925 + 0.1 * (earfcn - 3450), isTDD: false, band: 'Band 8 (900 MHz)' };
    if (earfcn >= 9210 && earfcn <= 9659) return { centerFreq: 729 + 0.1 * (earfcn - 9210), isTDD: false, band: 'Band 12 (700 MHz)' };
    if (earfcn >= 9870 && earfcn <= 9919) return { centerFreq: 746 + 0.1 * (earfcn - 9870), isTDD: false, band: 'Band 13 (700 MHz)' };
    if (earfcn >= 5180 && earfcn <= 5279) return { centerFreq: 734 + 0.1 * (earfcn - 5180), isTDD: false, band: 'Band 17 (700 MHz)' };
    if (earfcn >= 5730 && earfcn <= 5849) return { centerFreq: 1930 + 0.1 * (earfcn - 5730), isTDD: false, band: 'Band 25 (1900 MHz)' };
    if (earfcn >= 5850 && earfcn <= 6449) return { centerFreq: 859 + 0.1 * (earfcn - 5850), isTDD: false, band: 'Band 26 (850 MHz)' };
    if (earfcn >= 66436 && earfcn <= 67335) return { centerFreq: 2110 + 0.1 * (earfcn - 66436), isTDD: false, band: 'Band 66 (AWS-3)' };
    if (earfcn >= 68586 && earfcn <= 68935) return { centerFreq: 617 + 0.1 * (earfcn - 68586), isTDD: false, band: 'Band 71 (600 MHz)' };
    
    // TDD Bands
    if (earfcn >= 36000 && earfcn <= 36199) return { centerFreq: 1900 + 0.1 * (earfcn - 36000), isTDD: true, band: 'Band 33 (TDD 1900)' };
    if (earfcn >= 36200 && earfcn <= 36349) return { centerFreq: 2010 + 0.1 * (earfcn - 36200), isTDD: true, band: 'Band 34 (TDD 2000)' };
    if (earfcn >= 38650 && earfcn <= 39649) return { centerFreq: 2496 + 0.1 * (earfcn - 38650), isTDD: true, band: 'Band 41 (TDD 2500)' };
    if (earfcn >= 39650 && earfcn <= 41589) return { centerFreq: 3400 + 0.1 * (earfcn - 39650), isTDD: true, band: 'Band 42 (TDD 3500)' };
    if (earfcn >= 41590 && earfcn <= 43589) return { centerFreq: 3600 + 0.1 * (earfcn - 41590), isTDD: true, band: 'Band 43 (TDD 3700)' };
    if (earfcn >= 55240 && earfcn <= 56739) return { centerFreq: 3550 + 0.1 * (earfcn - 55240), isTDD: true, band: 'Band 48 (CBRS 3550)' };
    
    return { centerFreq: 0, isTDD: false, band: 'Unknown Band' };
  }
  
  // Frequency to EARFCN conversion (approximation for common bands)
  function frequencyToEarfcn(freq: number): number {
    // Common FDD bands
    if (freq >= 2110 && freq <= 2170) return Math.round((freq - 2110) / 0.1); // Band 1
    if (freq >= 1930 && freq <= 1990) return Math.round((freq - 1930) / 0.1) + 600; // Band 2
    if (freq >= 1805 && freq <= 1880) return Math.round((freq - 1805) / 0.1) + 1200; // Band 3
    if (freq >= 869 && freq <= 894) return Math.round((freq - 869) / 0.1) + 2400; // Band 5
    if (freq >= 729 && freq <= 746) return Math.round((freq - 729) / 0.1) + 9210; // Band 12
    if (freq >= 617 && freq <= 652) return Math.round((freq - 617) / 0.1) + 68586; // Band 71
    
    // Common TDD bands
    if (freq >= 2496 && freq <= 2690) return Math.round((freq - 2496) / 0.1) + 38650; // Band 41
    if (freq >= 3400 && freq <= 3600) return Math.round((freq - 3400) / 0.1) + 39650; // Band 42
    if (freq >= 3550 && freq <= 3700) return Math.round((freq - 3550) / 0.1) + 55240; // Band 48 (CBRS)
    
    // Default to Band 4 (AWS) for 2100 MHz range
    return 1950;
  }
  
  // Frequency band helper
  function getFrequencyBand(earfcn: number): string {
    return earfcnToFrequency(earfcn).band;
  }
  
  // Calculate UL EARFCN from DL EARFCN (FDD only)
  function calculateUlEarfcn(dlEarfcn: number): number {
    const info = earfcnToFrequency(dlEarfcn);
    if (info.isTDD) return dlEarfcn; // TDD uses same EARFCN for UL/DL
    
    // FDD: UL offset varies by band
    if (dlEarfcn >= 0 && dlEarfcn <= 599) return dlEarfcn + 18000; // Band 1
    if (dlEarfcn >= 600 && dlEarfcn <= 1199) return dlEarfcn + 18000; // Band 2
    if (dlEarfcn >= 1200 && dlEarfcn <= 1949) return dlEarfcn + 18000; // Band 3
    if (dlEarfcn >= 1950 && dlEarfcn <= 2399) return dlEarfcn + 18000; // Band 4
    if (dlEarfcn >= 2400 && dlEarfcn <= 2649) return dlEarfcn + 18000; // Band 5
    if (dlEarfcn >= 9210 && dlEarfcn <= 9659) return dlEarfcn + 18000; // Band 12
    if (dlEarfcn >= 5180 && dlEarfcn <= 5279) return dlEarfcn + 18000; // Band 17
    if (dlEarfcn >= 68586 && dlEarfcn <= 68935) return dlEarfcn + 18000; // Band 71
    
    return dlEarfcn + 18000; // Default offset
  }
  
  // Update all frequency-related fields when DL EARFCN changes
  function handleDlEarfcnChange() {
    if (!editedCell.dlEarfcn) return;
    
    const info = earfcnToFrequency(editedCell.dlEarfcn);
    editedCell.centerFreq = info.centerFreq;
    editedCell.frequency = info.centerFreq; // Legacy field
    editedCell.ulEarfcn = calculateUlEarfcn(editedCell.dlEarfcn);
    editedCell.earfcn = editedCell.dlEarfcn; // Legacy field
    
    // Set technology based on TDD/FDD and frequency
    if (info.isTDD && info.centerFreq >= 3550 && info.centerFreq <= 3700) {
      editedCell.technology = 'CBRS';
    } else if (info.isTDD) {
      editedCell.technology = 'LTE';
    } else {
      editedCell.technology = 'LTE';
    }
  }
  
  // Update EARFCN when center frequency changes
  function handleCenterFreqChange() {
    if (!editedCell.centerFreq) return;
    
    const dlEarfcn = frequencyToEarfcn(editedCell.centerFreq);
    editedCell.dlEarfcn = dlEarfcn;
    editedCell.earfcn = dlEarfcn; // Legacy field
    editedCell.frequency = editedCell.centerFreq; // Legacy field
    editedCell.ulEarfcn = calculateUlEarfcn(dlEarfcn);
  }
  
  // Smart detection: determine if input is frequency or EARFCN
  function detectAndConvert(value: number) {
    // Heuristic: frequencies are typically 600-4000 MHz, EARFCNs are 0-70000
    // If value is between 600-4000, treat as frequency
    // If value is between 0-599 or 4000-70000, treat as EARFCN
    
    if (value >= 600 && value <= 4000) {
      // Likely a frequency in MHz
      console.log('Detected frequency:', value, 'MHz');
      editedCell.centerFreq = value;
      handleCenterFreqChange();
    } else if (value >= 0 && value < 70001) {
      // Likely an EARFCN
      console.log('Detected EARFCN:', value);
      editedCell.dlEarfcn = value;
      handleDlEarfcnChange();
    }
  }
  
  // Handle smart input field
  let smartInputValue = '';
  let selectedBand = 'auto'; // Band selection for accurate conversion
  
  // Band definitions with their frequency ranges and EARFCN ranges
  const bandOptions = [
    { value: 'auto', label: 'Auto-Detect' },
    { value: '1', label: 'Band 1 (2100 MHz FDD)', freqRange: [2110, 2170], earfcnRange: [0, 599] },
    { value: '2', label: 'Band 2 (1900 MHz FDD)', freqRange: [1930, 1990], earfcnRange: [600, 1199] },
    { value: '3', label: 'Band 3 (1800 MHz FDD)', freqRange: [1805, 1880], earfcnRange: [1200, 1949] },
    { value: '4', label: 'Band 4 (AWS 2100 FDD)', freqRange: [2110, 2155], earfcnRange: [1950, 2399] },
    { value: '5', label: 'Band 5 (850 MHz FDD)', freqRange: [869, 894], earfcnRange: [2400, 2649] },
    { value: '7', label: 'Band 7 (2600 MHz FDD)', freqRange: [2620, 2690], earfcnRange: [2750, 3449] },
    { value: '12', label: 'Band 12 (700 MHz FDD)', freqRange: [729, 746], earfcnRange: [9210, 9659] },
    { value: '13', label: 'Band 13 (700 MHz FDD)', freqRange: [746, 756], earfcnRange: [9870, 9919] },
    { value: '17', label: 'Band 17 (700 MHz FDD)', freqRange: [734, 746], earfcnRange: [5180, 5279] },
    { value: '25', label: 'Band 25 (1900 MHz FDD)', freqRange: [1930, 1995], earfcnRange: [5730, 5849] },
    { value: '26', label: 'Band 26 (850 MHz FDD)', freqRange: [859, 894], earfcnRange: [5850, 6449] },
    { value: '66', label: 'Band 66 (AWS-3 FDD)', freqRange: [2110, 2200], earfcnRange: [66436, 67335] },
    { value: '71', label: 'Band 71 (600 MHz FDD)', freqRange: [617, 652], earfcnRange: [68586, 68935] },
    { value: '33', label: 'Band 33 (1900 MHz TDD)', freqRange: [1900, 1920], earfcnRange: [36000, 36199] },
    { value: '34', label: 'Band 34 (2000 MHz TDD)', freqRange: [2010, 2025], earfcnRange: [36200, 36349] },
    { value: '41', label: 'Band 41 (2500 MHz TDD)', freqRange: [2496, 2690], earfcnRange: [38650, 39649] },
    { value: '42', label: 'Band 42 (3500 MHz TDD)', freqRange: [3400, 3600], earfcnRange: [39650, 41589] },
    { value: '43', label: 'Band 43 (3700 MHz TDD)', freqRange: [3600, 3800], earfcnRange: [41590, 43589] },
    { value: '48', label: 'Band 48 (CBRS 3550 TDD)', freqRange: [3550, 3700], earfcnRange: [55240, 56739] },
  ];
  
  function handleSmartInput() {
    const value = parseFloat(smartInputValue);
    if (!isNaN(value) && value >= 0) {
      if (selectedBand === 'auto') {
        detectAndConvert(value);
      } else {
        // Use selected band for conversion
        const band = bandOptions.find(b => b.value === selectedBand);
        if (band && band.freqRange && band.earfcnRange) {
          if (value >= 600 && value <= 4000) {
            // It's a frequency - convert to EARFCN using selected band
            const [minFreq, maxFreq] = band.freqRange;
            const [minEarfcn, maxEarfcn] = band.earfcnRange;
            if (value >= minFreq && value <= maxFreq) {
              const earfcn = Math.round(minEarfcn + ((value - minFreq) / 0.1));
              editedCell.dlEarfcn = earfcn;
              handleDlEarfcnChange();
            } else {
              console.warn('Frequency out of range for selected band');
              detectAndConvert(value);
            }
          } else {
            // It's an EARFCN
            editedCell.dlEarfcn = value;
            handleDlEarfcnChange();
          }
        }
      }
      smartInputValue = ''; // Clear after processing
    }
  }
</script>

{#if isOpen}
  <div class="modal-backdrop" on:click={handleBackdropClick}>
    <div class="cell-editor">
      <div class="editor-header">
        <h2>
          {#if isNewCell}
            ➕ Create New Cell
          {:else}
            📡 Edit Cell: {cell?.id || 'Unknown'}
          {/if}
        </h2>
        <button class="close-btn" on:click={handleClose}>×</button>
      </div>
      
      <div class="editor-content">
        <!-- Basic Info Section -->
        <section class="editor-section">
          <h3>Basic Information</h3>
          <div class="form-grid">
            <div class="form-group">
              <label for="cellId">Cell ID</label>
              <input 
                type="text" 
                id="cellId"
                bind:value={editedCell.id} 
                disabled={!isNewCell}
                placeholder="CELL001"
              />
            </div>
            
            <div class="form-group">
              <label for="eNodeB">eNodeB</label>
              <input 
                type="number" 
                id="eNodeB"
                bind:value={editedCell.eNodeB}
              />
            </div>
            
            <div class="form-group">
              <label for="sector">Sector</label>
              <input 
                type="number" 
                id="sector"
                bind:value={editedCell.sector}
                min="1"
                max="12"
              />
            </div>
            
            <div class="form-group">
              <label for="pci">PCI</label>
              <input 
                type="number" 
                id="pci"
                bind:value={editedCell.pci}
                min="0"
                max="503"
              />
            </div>
          </div>
        </section>
        
        <!-- Location Section -->
        <section class="editor-section">
          <h3>Location</h3>
          <div class="form-grid">
            <div class="form-group">
              <label for="latitude">Latitude</label>
              <input 
                type="number" 
                id="latitude"
                bind:value={editedCell.latitude}
                step="0.000001"
              />
            </div>
            
            <div class="form-group">
              <label for="longitude">Longitude</label>
              <input 
                type="number" 
                id="longitude"
                bind:value={editedCell.longitude}
                step="0.000001"
              />
            </div>
            
            <div class="form-group">
              <label for="azimuth">Azimuth (degrees)</label>
              <input 
                type="number" 
                id="azimuth"
                bind:value={editedCell.azimuth}
                min="0"
                max="359"
                placeholder="0-359"
              />
            </div>
            
            <div class="form-group">
              <label for="towerType">Tower Type</label>
              <select id="towerType" bind:value={editedCell.towerType}>
                <option value="3-sector">3-Sector</option>
                <option value="4-sector">4-Sector</option>
              </select>
            </div>
          </div>
        </section>
        
        <!-- RF Parameters Section -->
        <section class="editor-section">
          <h3>RF Parameters</h3>
          
          <!-- Smart Frequency/EARFCN Input -->
          <div class="smart-input-section">
            <label for="smartInput">🎯 Quick Entry: Frequency or EARFCN</label>
            <p class="smart-help">Enter a frequency (e.g., 2100, 3550) or EARFCN (e.g., 1950, 55240)</p>
            
            <!-- Band Selector -->
            <div class="band-selector-group">
              <label for="bandSelect" class="band-label">LTE Band:</label>
              <select id="bandSelect" bind:value={selectedBand} class="band-select">
                {#each bandOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </div>
            
            <!-- Frequency/EARFCN Input -->
            <div class="smart-input-group">
              <input 
                type="number" 
                id="smartInput"
                bind:value={smartInputValue}
                placeholder="2100 or 1950 or 55240..."
                on:keydown={(e) => e.key === 'Enter' && handleSmartInput()}
                class="smart-input"
              />
              <button 
                type="button"
                class="smart-btn" 
                on:click={handleSmartInput}
                disabled={!smartInputValue}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 11 12 14 22 4"></polyline>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
                Convert
              </button>
            </div>
            
            {#if selectedBand !== 'auto'}
              <p class="band-hint">
                ℹ️ {bandOptions.find(b => b.value === selectedBand)?.label || ''} - 
                Enter frequency between {bandOptions.find(b => b.value === selectedBand)?.freqRange?.[0]}-{bandOptions.find(b => b.value === selectedBand)?.freqRange?.[1]} MHz
              </p>
            {/if}
          </div>
          
          <div class="divider"></div>
          
          <div class="form-grid">
            <div class="form-group">
              <label for="dlEarfcn">DL EARFCN</label>
              <input 
                type="number" 
                id="dlEarfcn"
                bind:value={editedCell.dlEarfcn}
                on:input={handleDlEarfcnChange}
                min="0"
                max="70000"
              />
              <span class="helper-text">
                {getFrequencyBand(editedCell.dlEarfcn || 0)}
                {#if editedCell.dlEarfcn}
                  • {earfcnToFrequency(editedCell.dlEarfcn).isTDD ? 'TDD' : 'FDD'}
                {/if}
              </span>
            </div>
            
            <div class="form-group">
              <label for="ulEarfcn">UL EARFCN {earfcnToFrequency(editedCell.dlEarfcn || 0).isTDD ? '(Same as DL for TDD)' : ''}</label>
              <input 
                type="number" 
                id="ulEarfcn"
                bind:value={editedCell.ulEarfcn}
                min="0"
                max="70000"
                disabled={earfcnToFrequency(editedCell.dlEarfcn || 0).isTDD}
              />
            </div>
            
            <div class="form-group">
              <label for="centerFreq">Center Frequency (MHz)</label>
              <input 
                type="number" 
                id="centerFreq"
                bind:value={editedCell.centerFreq}
                on:input={handleCenterFreqChange}
                step="0.1"
              />
            </div>
            
            <div class="form-group">
              <label for="channelBandwidth">Channel Bandwidth (MHz)</label>
              <select id="channelBandwidth" bind:value={editedCell.channelBandwidth}>
                <option value={1.4}>1.4 MHz</option>
                <option value={3}>3 MHz</option>
                <option value={5}>5 MHz</option>
                <option value={10}>10 MHz</option>
                <option value={15}>15 MHz</option>
                <option value={20}>20 MHz</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="rsPower">RS Power (dBm)</label>
              <input 
                type="number" 
                id="rsPower"
                bind:value={editedCell.rsPower}
                step="0.1"
              />
            </div>
            
            <div class="form-group">
              <label for="technology">Technology</label>
              <select id="technology" bind:value={editedCell.technology}>
                <option value="LTE">LTE</option>
                <option value="CBRS">CBRS</option>
                <option value="5G">5G</option>
              </select>
            </div>
          </div>
        </section>
        
        <!-- Additional EARFCNs Section -->
        <section class="editor-section">
          <h3>Additional EARFCNs</h3>
          <p class="section-description">Add carrier aggregation or additional frequency channels</p>
          
          <div class="earfcn-list">
            {#each additionalEarfcns as earfcn, index}
              <div class="earfcn-item">
                <span class="earfcn-value">{earfcn}</span>
                <span class="earfcn-band">{getFrequencyBand(earfcn)}</span>
                <button 
                  type="button"
                  class="remove-earfcn-btn" 
                  on:click={() => removeEarfcn(index)}
                >
                  ×
                </button>
              </div>
            {/each}
          </div>
          
          <div class="add-earfcn-group">
            <input 
              type="number" 
              bind:value={newEarfcn}
              placeholder="Enter EARFCN (e.g., 1950)"
              on:keydown={(e) => e.key === 'Enter' && addEarfcn()}
            />
            <button 
              type="button"
              class="add-earfcn-btn" 
              on:click={addEarfcn}
              disabled={!newEarfcn}
            >
              + Add EARFCN
            </button>
          </div>
        </section>
      </div>
      
      <div class="editor-footer">
        <button class="cancel-btn" on:click={handleClose}>Cancel</button>
        <button class="save-btn" on:click={handleSave}>
          {#if isNewCell}
            ➕ Create Cell
          {:else}
            💾 Save Changes
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 2rem;
  }

  .cell-editor {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-width: 800px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-color);
  }

  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .editor-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    transition: all var(--transition);
  }

  .close-btn:hover {
    background: var(--danger-light);
    color: var(--danger-color);
  }

  .editor-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .editor-section {
    margin-bottom: 2rem;
  }

  .editor-section:last-child {
    margin-bottom: 0;
  }

  .editor-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    border-bottom: 2px solid var(--primary-color);
    padding-bottom: 0.5rem;
  }

  .section-description {
    margin: -0.5rem 0 1rem 0;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .form-group input,
  .form-group select {
    padding: 0.625rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.95rem;
    transition: all var(--transition);
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--focus-ring);
  }

  .form-group input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: var(--bg-secondary);
  }

  .helper-text {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-style: italic;
  }

  .earfcn-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .earfcn-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--surface-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
  }

  .earfcn-value {
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 600;
    color: var(--primary-color);
    min-width: 80px;
  }

  .earfcn-band {
    flex: 1;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .remove-earfcn-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 50%;
    background: var(--danger-light);
    color: var(--danger-color);
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    transition: all var(--transition);
  }

  .remove-earfcn-btn:hover {
    background: var(--danger-color);
    color: white;
  }

  .add-earfcn-group {
    display: flex;
    gap: 0.5rem;
  }

  .add-earfcn-group input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.95rem;
  }

  .add-earfcn-group input:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--focus-ring);
  }

  .add-earfcn-btn {
    padding: 0.75rem 1.25rem;
    border: none;
    border-radius: var(--border-radius);
    background: var(--primary-color);
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition);
    white-space: nowrap;
  }

  .add-earfcn-btn:hover:not(:disabled) {
    background: var(--button-primary-hover);
    box-shadow: var(--shadow-sm);
  }

  .add-earfcn-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .editor-footer {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
  }

  .cancel-btn,
  .save-btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: var(--border-radius);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition);
  }

  .cancel-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .cancel-btn:hover {
    background: var(--hover-bg);
  }

  .save-btn {
    background: var(--primary-color);
    color: white;
  }

  .save-btn:hover {
    background: var(--button-primary-hover);
    box-shadow: var(--shadow-sm);
  }

  /* Smart Input Section */
  .smart-input-section {
    margin-bottom: 1.5rem;
    padding: 1.25rem;
    background: var(--surface-secondary);
    border: 1px solid var(--primary-color);
    border-radius: var(--border-radius-lg);
  }

  .smart-input-section label {
    display: block;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .smart-help {
    margin: 0 0 1rem 0;
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-style: italic;
  }

  .band-selector-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .band-label {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
  }

  .band-select {
    flex: 1;
    padding: 0.625rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all var(--transition);
  }

  .band-select:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--focus-ring);
  }

  .band-hint {
    margin: 0.75rem 0 0 0;
    padding: 0.5rem;
    background: var(--info-light);
    border-left: 3px solid var(--primary-color);
    font-size: 0.8rem;
    color: var(--text-secondary);
    border-radius: var(--border-radius);
  }

  .smart-input-group {
    display: flex;
    gap: 0.75rem;
  }

  .smart-input {
    flex: 1;
    padding: 0.875rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 1.1rem;
    font-weight: 600;
    transition: all var(--transition);
  }

  .smart-input:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--focus-ring);
  }

  .smart-input::placeholder {
    color: var(--text-secondary);
    font-weight: 400;
  }

  .smart-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem 1.5rem;
    border: none;
    border-radius: var(--border-radius);
    background: var(--primary-color);
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition);
    white-space: nowrap;
  }

  .smart-btn:hover:not(:disabled) {
    background: var(--button-primary-hover);
    box-shadow: var(--shadow-sm);
  }

  .smart-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .divider {
    height: 1px;
    background: linear-gradient(to right, transparent, var(--border-color), transparent);
    margin: 1.5rem 0;
  }
</style>

