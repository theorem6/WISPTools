<script lang="ts">
  import { reportGenerator, type ConflictReport } from '$lib/reportGenerator';
  import type { Cell, PCIConflict } from '$lib/pciMapper';
  import NokiaConfig from '../acs/NokiaConfig.svelte';

  export let cells: Cell[] = [];
  export let conflicts: PCIConflict[] = [];
  export let recommendations: string[] = [];
  
  let showNokiaConfig = false;

  let report: ConflictReport | null = null;
  let isGenerating = false;

  async function generateReport() {
    if (cells.length === 0) {
      alert('No cells loaded. Please import cell data first.');
      return;
    }

    isGenerating = true;
    
    try {
      report = reportGenerator.generateReport(cells, conflicts, recommendations);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report. Please try again.');
    } finally {
      isGenerating = false;
    }
  }

  function exportToCSV() {
    if (!report) {
      alert('Please generate a report first.');
      return;
    }
    
    reportGenerator.downloadCSV(report);
  }

  function exportToPDF() {
    if (!report) {
      alert('Please generate a report first.');
      return;
    }
    
    reportGenerator.downloadPDF(report);
  }

  // Auto-generate report when data changes
  $: if (cells.length > 0 && conflicts.length >= 0) {
    report = reportGenerator.generateReport(cells, conflicts, recommendations);
  }
</script>

<div class="export-panel">
  <h3>📊 Export Options</h3>
  <p class="export-subtitle">Export conflict reports or generate Nokia base station configurations</p>
  
  {#if !report}
    <div class="generate-section">
      <p class="info-text">
        Generate a comprehensive conflict analysis report with detailed statistics and recommendations.
      </p>
      <button 
        class="generate-button" 
        on:click={generateReport}
        disabled={isGenerating || cells.length === 0}
      >
        {#if isGenerating}
          ⏳ Generating Report...
        {:else}
          📋 Generate Conflict Report
        {/if}
      </button>
    </div>
  {:else}
    <div class="report-summary">
      <h4>Report Summary</h4>
      <div class="summary-stats">
        <div class="stat-item">
          <span class="stat-value">{report.totalCells}</span>
          <span class="stat-label">Total Cells</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{report.totalConflicts}</span>
          <span class="stat-label">Conflicts</span>
        </div>
        <div class="stat-item critical">
          <span class="stat-value">{report.summary.critical}</span>
          <span class="stat-label">Critical</span>
        </div>
        <div class="stat-item high">
          <span class="stat-value">{report.summary.high}</span>
          <span class="stat-label">High</span>
        </div>
      </div>
      
      <div class="export-actions">
        <button class="export-button csv" on:click={exportToCSV}>
          📄 Export CSV
        </button>
        <button class="export-button pdf" on:click={exportToPDF}>
          📋 Export PDF
        </button>
        <button class="export-button nokia" on:click={() => showNokiaConfig = true}>
          📻 Nokia XML
        </button>
      </div>
      
      <div class="report-details">
        <p><strong>Report ID:</strong> {report.reportId}</p>
        <p><strong>Generated:</strong> {report.timestamp.toLocaleString()}</p>
      </div>
    </div>
  {/if}
  
  {#if report && report.totalConflicts > 0}
    <div class="conflict-breakdown">
      <h4>Conflict Breakdown</h4>
      <div class="breakdown-grid">
        <div class="breakdown-item">
          <span class="breakdown-label">Mod3 (CRS)</span>
          <span class="breakdown-value">{report.summary.mod3}</span>
        </div>
        <div class="breakdown-item">
          <span class="breakdown-label">Mod6 (PBCH)</span>
          <span class="breakdown-value">{report.summary.mod6}</span>
        </div>
        <div class="breakdown-item">
          <span class="breakdown-label">Mod30 (PRS)</span>
          <span class="breakdown-value">{report.summary.mod30}</span>
        </div>
        <div class="breakdown-item">
          <span class="breakdown-label">3-Sector</span>
          <span class="breakdown-value">{report.summary.threeSector}</span>
        </div>
        <div class="breakdown-item">
          <span class="breakdown-label">4-Sector</span>
          <span class="breakdown-value">{report.summary.fourSector}</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Nokia Export Modal -->
<NokiaConfig bind:visible={showNokiaConfig} />

<style>
  .export-panel {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1.5rem;
    margin: 1rem 0;
    box-shadow: var(--shadow-sm);
  }

  .export-panel h3 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .export-subtitle {
    margin: 0 0 1rem 0;
    color: var(--text-secondary);
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .export-panel h4 {
    margin: 1rem 0 0.5rem 0;
    color: var(--text-primary);
    font-size: 1rem;
  }

  .info-text {
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin-bottom: 1rem;
    line-height: 1.4;
  }

  .generate-button {
    width: 100%;
    padding: 0.75rem;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--border-radius);
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .generate-button:hover:not(:disabled) {
    background: var(--primary-hover);
    transform: translateY(-1px);
  }

  .generate-button:disabled {
    background: var(--text-muted);
    cursor: not-allowed;
    transform: none;
  }

  .report-summary {
    margin-top: 1rem;
  }

  .summary-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
    gap: 1rem;
    margin: 1rem 0;
  }

  .stat-item {
    text-align: center;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
  }

  .stat-item.critical .stat-value {
    color: var(--danger-color);
  }

  .stat-item.high .stat-value {
    color: var(--warning-color);
  }

  .stat-value {
    display: block;
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--primary-color);
  }

  .stat-label {
    display: block;
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }

  .export-actions {
    display: flex;
    gap: 1rem;
    margin: 1rem 0;
  }

  .export-button {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .export-button:hover {
    background: var(--hover-bg);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .export-button.csv {
    border-color: var(--success-color);
    color: var(--success-color);
  }

  .export-button.csv:hover {
    background: var(--success-color);
    color: white;
  }

  .export-button.pdf {
    border-color: var(--primary-color);
    color: var(--primary-color);
  }

  .export-button.pdf:hover {
    background: var(--primary-color);
    color: white;
  }

  .export-button.nokia {
    border-color: #124191;
    color: #124191;
  }

  .export-button.nokia:hover {
    background: linear-gradient(135deg, #124191 0%, #1a5bc4 100%);
    color: white;
    border-color: #124191;
  }

  .report-details {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--bg-tertiary);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
  }

  .report-details p {
    margin: 0.25rem 0;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .conflict-breakdown {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
  }

  .breakdown-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .breakdown-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
  }

  .breakdown-label {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .breakdown-value {
    font-size: 0.9rem;
    font-weight: bold;
    color: var(--text-primary);
  }

  @media (max-width: 768px) {
    .export-actions {
      flex-direction: column;
    }
    
    .summary-stats {
      grid-template-columns: repeat(2, 1fr);
    }
    
    .breakdown-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
