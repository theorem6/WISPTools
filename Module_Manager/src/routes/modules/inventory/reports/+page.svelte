<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { currentTenant } from '$lib/stores/tenantStore';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { inventoryService } from '$lib/services/inventoryService';
  import { reportGenerator } from '$lib/services/inventoryReports';
  import type { InventoryReport, ChartData } from '$lib/services/inventoryReports';

  let isLoading = true;
  let error = '';
  let report: InventoryReport | null = null;
  let statusChart: ChartData | null = null;
  let categoryChart: ChartData | null = null;
  let locationChart: ChartData | null = null;

  $: tenantId = $currentTenant?.id || '';
  $: tenantName = $currentTenant?.displayName || 'Organization';

  onMount(async () => {
    await loadReport();
  });

  async function loadReport() {
    isLoading = true;
    error = '';

    try {
      const [itemsResult, stats, expiringWarranties] = await Promise.all([
        inventoryService.getInventory({}),
        inventoryService.getStats(),
        inventoryService.getExpiringWarranties(30)
      ]);

      const items = itemsResult.items;

      // Generate report
      report = reportGenerator.generateReport(items, tenantName, {
        expiringWarranties,
        lowStock: [],
        maintenanceDue: []
      });

      // Generate charts
      statusChart = reportGenerator.generateStatusChart(items);
      categoryChart = reportGenerator.generateCategoryChart(items);
      locationChart = reportGenerator.generateLocationChart(items);

    } catch (err: any) {
      error = err.message || 'Failed to load report';
      console.error('Report loading error:', err);
    } finally {
      isLoading = false;
    }
  }

  function handleExportCSV() {
    if (!report) return;
    const csv = reportGenerator.generateCSV(report.items);
    reportGenerator.downloadCSV(csv, `inventory-report-${Date.now()}.csv`);
  }

  function handleExportPDF() {
    if (!report) return;
    const html = reportGenerator.generatePDFHTML(report);
    reportGenerator.printPDF(html);
  }
</script>

<TenantGuard>
<div class="reports-page">
  <div class="page-header">
    <div class="header-left">
      <button class="back-btn" on:click={() => goto('/modules/inventory')}>
        ← Back to Inventory
      </button>
      <h1>📊 Inventory Reports & Analytics</h1>
      <p class="subtitle">{tenantName}</p>
    </div>

    <div class="header-actions">
      <button class="btn btn-secondary" on:click={loadReport} disabled={isLoading}>
        🔄 Refresh
      </button>
      <button class="btn btn-primary" on:click={handleExportCSV} disabled={!report}>
        📥 Export CSV
      </button>
      <button class="btn btn-primary" on:click={handleExportPDF} disabled={!report}>
        🖨️ Print PDF
      </button>
    </div>
  </div>

  {#if isLoading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Generating report...</p>
    </div>
  {:else if error}
    <div class="error-banner">
      <span>⚠️</span>
      <span>{error}</span>
      <button on:click={() => error = ''}>✕</button>
    </div>
  {:else if report}
    <!-- Summary Cards -->
    <div class="summary-grid">
      <div class="summary-card">
        <div class="card-icon">📦</div>
        <div class="card-content">
          <div class="card-value">{report.summary.totalItems}</div>
          <div class="card-label">Total Items</div>
        </div>
      </div>

      <div class="summary-card">
        <div class="card-icon">💰</div>
        <div class="card-content">
          <div class="card-value">${report.summary.totalValue.toLocaleString()}</div>
          <div class="card-label">Total Value</div>
        </div>
      </div>

      <div class="summary-card">
        <div class="card-icon">📍</div>
        <div class="card-content">
          <div class="card-value">{Object.keys(report.summary.byLocation).length}</div>
          <div class="card-label">Locations</div>
        </div>
      </div>

      <div class="summary-card">
        <div class="card-icon">🏭</div>
        <div class="card-content">
          <div class="card-value">{Object.keys(report.summary.byManufacturer).length}</div>
          <div class="card-label">Manufacturers</div>
        </div>
      </div>
    </div>

    <!-- Alerts -->
    {#if report.alerts.expiringWarranties.length > 0}
      <div class="alert-section warning">
        <h3>⚠️ Expiring Warranties ({report.alerts.expiringWarranties.length})</h3>
        <ul>
          {#each report.alerts.expiringWarranties as item}
            <li>
              <strong>{item.manufacturer} {item.model}</strong>
              - SN: {item.serialNumber}
              - Expires: {item.warranty?.endDate ? new Date(item.warranty.endDate).toLocaleDateString() : 'N/A'}
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <!-- Charts -->
    <div class="charts-grid">
      <!-- Status Distribution -->
      <div class="chart-card">
        <h3>Status Distribution</h3>
        {#if statusChart}
          <div class="chart-bars">
            {#each statusChart.labels as label, i}
              <div class="bar-group">
                <div class="bar-label">{label}</div>
                <div class="bar-container">
                  <div 
                    class="bar" 
                    style="width: {(statusChart.datasets[0].data[i] / report.summary.totalItems) * 100}%; background: {statusChart.datasets[0].backgroundColor?.[i] || '#7c3aed'}"
                  ></div>
                  <span class="bar-value">{statusChart.datasets[0].data[i]}</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Category Distribution -->
      <div class="chart-card">
        <h3>Category Distribution</h3>
        {#if categoryChart}
          <div class="chart-bars">
            {#each categoryChart.labels as label, i}
              <div class="bar-group">
                <div class="bar-label">{label}</div>
                <div class="bar-container">
                  <div 
                    class="bar" 
                    style="width: {(categoryChart.datasets[0].data[i] / report.summary.totalItems) * 100}%; background: {categoryChart.datasets[0].backgroundColor?.[i] || '#7c3aed'}"
                  ></div>
                  <span class="bar-value">{categoryChart.datasets[0].data[i]}</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Location Distribution -->
      <div class="chart-card full-width">
        <h3>Location Distribution</h3>
        {#if locationChart}
          <div class="chart-bars">
            {#each locationChart.labels as label, i}
              <div class="bar-group">
                <div class="bar-label">{label}</div>
                <div class="bar-container">
                  <div 
                    class="bar" 
                    style="width: {(locationChart.datasets[0].data[i] / report.summary.totalItems) * 100}%; background: {locationChart.datasets[0].backgroundColor?.[i] || '#7c3aed'}"
                  ></div>
                  <span class="bar-value">{locationChart.datasets[0].data[i]}</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Detailed Tables -->
    <div class="table-section">
      <h3>By Status</h3>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Count</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          {#each Object.entries(report.summary.byStatus) as [status, count]}
            <tr>
              <td><strong>{status}</strong></td>
              <td>{count}</td>
              <td>{((count / report.summary.totalItems) * 100).toFixed(1)}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="table-section">
      <h3>By Category</h3>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Count</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          {#each Object.entries(report.summary.byCategory) as [category, count]}
            <tr>
              <td>{category}</td>
              <td>{count}</td>
              <td>{((count / report.summary.totalItems) * 100).toFixed(1)}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
</TenantGuard>

<style>
  .reports-page {
    min-height: 100vh;
    background: var(--bg-primary);
    padding: 2rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    gap: 1rem;
  }

  .header-left h1 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }

  .subtitle {
    color: var(--text-secondary);
    margin: 0;
  }

  .back-btn {
    background: none;
    border: 1px solid var(--border-color);
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-secondary);
    margin-bottom: 1rem;
    transition: all 0.2s;
  }

  .back-btn:hover {
    background: var(--bg-hover);
    border-color: var(--brand-primary);
    color: var(--brand-primary);
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--brand-primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--brand-primary-hover);
    transform: translateY(-2px);
  }

  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4rem;
    gap: 1rem;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(124, 58, 237, 0.2);
    border-top-color: var(--brand-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-banner {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .summary-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .card-icon {
    font-size: 2.5rem;
  }

  .card-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--brand-primary);
  }

  .card-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .alert-section {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .alert-section.warning {
    background: rgba(251, 191, 36, 0.1);
    border-color: #f59e0b;
  }

  .alert-section h3 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }

  .alert-section ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .alert-section li {
    margin: 0.5rem 0;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .chart-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
  }

  .chart-card.full-width {
    grid-column: 1 / -1;
  }

  .chart-card h3 {
    margin: 0 0 1.5rem 0;
    color: var(--text-primary);
  }

  .chart-bars {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .bar-group {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .bar-label {
    min-width: 120px;
    font-weight: 500;
    font-size: 0.875rem;
  }

  .bar-container {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .bar {
    height: 32px;
    border-radius: 4px;
    min-width: 2px;
    transition: width 0.3s ease;
  }

  .bar-value {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .table-section {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .table-section h3 {
    margin: 0 0 1rem 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th {
    background: var(--bg-secondary);
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    border-bottom: 2px solid var(--border-color);
  }

  td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }

  tr:hover {
    background: var(--bg-hover);
  }

  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
    }

    .charts-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

