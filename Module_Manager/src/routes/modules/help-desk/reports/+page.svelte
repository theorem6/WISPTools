<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { currentTenant } from '$lib/stores/tenantStore';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { workOrderService } from '$lib/services/workOrderService';
  import { ticketReportGenerator } from '$lib/services/ticketReports';
  import type { TicketReport, ChartData } from '$lib/services/ticketReports';

  let isLoading = true;
  let error = '';
  let report: TicketReport | null = null;
  let statusChart: ChartData | null = null;
  let priorityChart: ChartData | null = null;
  let categoryChart: ChartData | null = null;
  let typeChart: ChartData | null = null;

  $: tenantId = $currentTenant?.id || '';
  $: tenantName = $currentTenant?.displayName || 'Organization';

  onMount(async () => {
    await loadReport();
  });

  async function loadReport() {
    isLoading = true;
    error = '';

    try {
      const [tickets, stats] = await Promise.all([
        workOrderService.getWorkOrders({}),
        workOrderService.getStats()
      ]);

      // Get SLA breached tickets
      const slaBreached = await workOrderService.getSLABreachedTickets().catch(() => []);

      // Generate report
      report = ticketReportGenerator.generateReport(tickets, tenantName, {
        slaBreached,
        overdue: [],
        criticalOpen: tickets.filter(t => 
          t.priority === 'critical' && 
          ['open', 'assigned', 'in-progress'].includes(t.status || '')
        )
      });

      // Generate charts
      statusChart = ticketReportGenerator.generateStatusChart(tickets);
      priorityChart = ticketReportGenerator.generatePriorityChart(tickets);
      categoryChart = ticketReportGenerator.generateCategoryChart(tickets);
      typeChart = ticketReportGenerator.generateTypeChart(tickets);

    } catch (err: any) {
      error = err.message || 'Failed to load report';
      console.error('Report loading error:', err);
    } finally {
      isLoading = false;
    }
  }

  function handleExportCSV() {
    if (!report) return;
    const csv = ticketReportGenerator.generateCSV(report.tickets);
    ticketReportGenerator.downloadCSV(csv, `ticket-report-${Date.now()}.csv`);
  }

  function handleExportPDF() {
    if (!report) return;
    const html = ticketReportGenerator.generatePDFHTML(report);
    ticketReportGenerator.printPDF(html);
  }

  function formatHours(hours: number): string {
    if (hours < 24) {
      return `${Math.round(hours)}h`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.round(hours % 24);
      return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    }
  }
</script>

<TenantGuard>
<div class="reports-page">
  <div class="page-header">
    <div class="header-left">
      <button class="back-btn" on:click={() => goto('/modules/help-desk')}>
        ← Back to Help Desk
      </button>
      <h1>📊 Ticket Reports & Analytics</h1>
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
        <div class="card-icon">🎧</div>
        <div class="card-content">
          <div class="card-value">{report.summary.totalTickets}</div>
          <div class="card-label">Total Tickets</div>
        </div>
      </div>

      <div class="summary-card open">
        <div class="card-icon">📋</div>
        <div class="card-content">
          <div class="card-value">{report.summary.openTickets}</div>
          <div class="card-label">Open Tickets</div>
        </div>
      </div>

      <div class="summary-card resolved">
        <div class="card-icon">✅</div>
        <div class="card-content">
          <div class="card-value">{report.summary.resolvedTickets}</div>
          <div class="card-label">Resolved Tickets</div>
        </div>
      </div>

      <div class="summary-card">
        <div class="card-icon">⏱️</div>
        <div class="card-content">
          <div class="card-value">{formatHours(report.summary.avgResolutionTime)}</div>
          <div class="card-label">Avg Resolution Time</div>
        </div>
      </div>
    </div>

    <!-- Alerts -->
    {#if report.alerts.slaBreached.length > 0}
      <div class="alert-section warning">
        <h3>⚠️ SLA Breached Tickets ({report.alerts.slaBreached.length})</h3>
        <ul>
          {#each report.alerts.slaBreached.slice(0, 5) as ticket}
            <li>
              <strong>{ticket.ticketNumber || ticket._id}</strong> - {ticket.title} - {ticket.priority} priority
              {#if ticket.assignedToName}
                (Assigned to: {ticket.assignedToName})
              {/if}
            </li>
          {/each}
          {#if report.alerts.slaBreached.length > 5}
            <li><em>...and {report.alerts.slaBreached.length - 5} more</em></li>
          {/if}
        </ul>
      </div>
    {/if}

    {#if report.alerts.criticalOpen.length > 0}
      <div class="alert-section critical">
        <h3>🔴 Critical Open Tickets ({report.alerts.criticalOpen.length})</h3>
        <ul>
          {#each report.alerts.criticalOpen.slice(0, 5) as ticket}
            <li>
              <strong>{ticket.ticketNumber || ticket._id}</strong> - {ticket.title}
              {#if ticket.assignedToName}
                (Assigned to: {ticket.assignedToName})
              {/if}
            </li>
          {/each}
          {#if report.alerts.criticalOpen.length > 5}
            <li><em>...and {report.alerts.criticalOpen.length - 5} more</em></li>
          {/if}
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
                    style="width: {(statusChart.datasets[0].data[i] / report.summary.totalTickets) * 100}%; background: {statusChart.datasets[0].backgroundColor?.[i] || '#7c3aed'}"
                  ></div>
                  <span class="bar-value">{statusChart.datasets[0].data[i]}</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Priority Distribution -->
      <div class="chart-card">
        <h3>Priority Distribution</h3>
        {#if priorityChart}
          <div class="chart-bars">
            {#each priorityChart.labels as label, i}
              <div class="bar-group">
                <div class="bar-label">{label}</div>
                <div class="bar-container">
                  <div 
                    class="bar" 
                    style="width: {(priorityChart.datasets[0].data[i] / report.summary.totalTickets) * 100}%; background: {priorityChart.datasets[0].backgroundColor?.[i] || '#7c3aed'}"
                  ></div>
                  <span class="bar-value">{priorityChart.datasets[0].data[i]}</span>
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
                <div class="bar-label">{label || 'customer-facing'}</div>
                <div class="bar-container">
                  <div 
                    class="bar" 
                    style="width: {(categoryChart.datasets[0].data[i] / report.summary.totalTickets) * 100}%; background: {categoryChart.datasets[0].backgroundColor?.[i] || '#7c3aed'}"
                  ></div>
                  <span class="bar-value">{categoryChart.datasets[0].data[i]}</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Type Distribution -->
      <div class="chart-card">
        <h3>Type Distribution</h3>
        {#if typeChart}
          <div class="chart-bars">
            {#each typeChart.labels as label, i}
              <div class="bar-group">
                <div class="bar-label">{label}</div>
                <div class="bar-container">
                  <div 
                    class="bar" 
                    style="width: {(typeChart.datasets[0].data[i] / report.summary.totalTickets) * 100}%; background: {typeChart.datasets[0].backgroundColor?.[i] || '#7c3aed'}"
                  ></div>
                  <span class="bar-value">{typeChart.datasets[0].data[i]}</span>
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
              <td>{((count / report.summary.totalTickets) * 100).toFixed(1)}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="table-section">
      <h3>By Priority</h3>
      <table>
        <thead>
          <tr>
            <th>Priority</th>
            <th>Count</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          {#each Object.entries(report.summary.byPriority) as [priority, count]}
            <tr>
              <td>{priority}</td>
              <td>{count}</td>
              <td>{((count / report.summary.totalTickets) * 100).toFixed(1)}%</td>
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
              <td>{category || 'customer-facing'}</td>
              <td>{count}</td>
              <td>{((count / report.summary.totalTickets) * 100).toFixed(1)}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="table-section">
      <h3>By Assigned To</h3>
      <table>
        <thead>
          <tr>
            <th>Assigned To</th>
            <th>Count</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          {#each Object.entries(report.summary.byAssignedTo) as [assignedTo, count]}
            <tr>
              <td>{assignedTo}</td>
              <td>{count}</td>
              <td>{((count / report.summary.totalTickets) * 100).toFixed(1)}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="table-section">
      <h3>SLA Compliance</h3>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Count</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>On Time</td>
            <td>{report.summary.slaCompliance.onTime}</td>
            <td>{report.summary.slaCompliance.onTime + report.summary.slaCompliance.breached > 0 
              ? ((report.summary.slaCompliance.onTime / (report.summary.slaCompliance.onTime + report.summary.slaCompliance.breached)) * 100).toFixed(1) 
              : '0'}%</td>
          </tr>
          <tr>
            <td>Breached</td>
            <td>{report.summary.slaCompliance.breached}</td>
            <td>{report.summary.slaCompliance.onTime + report.summary.slaCompliance.breached > 0 
              ? ((report.summary.slaCompliance.breached / (report.summary.slaCompliance.onTime + report.summary.slaCompliance.breached)) * 100).toFixed(1) 
              : '0'}%</td>
          </tr>
          <tr>
            <td>No SLA</td>
            <td>{report.summary.slaCompliance.noSLA}</td>
            <td>-</td>
          </tr>
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

  .reports-page .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    gap: 1rem;
  }

  .reports-page .header-left h1 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }

  .reports-page .subtitle {
    color: var(--text-secondary);
    margin: 0;
  }

  .reports-page .back-btn {
    background: none;
    border: 1px solid var(--border-color);
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-secondary);
    margin-bottom: 1rem;
    transition: all 0.2s;
  }

  .reports-page .back-btn:hover {
    background: var(--bg-hover);
    border-color: var(--primary);
    color: var(--primary);
  }

  .reports-page .header-actions {
    display: flex;
    gap: 0.75rem;
  }

  .reports-page .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .reports-page .btn-primary {
    background: var(--primary);
    color: white;
  }

  .reports-page .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-2px);
  }

  .reports-page .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .reports-page .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .reports-page .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4rem;
    gap: 1rem;
  }

  .reports-page .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(59, 130, 246, 0.2);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: reports-spin 0.8s linear infinite;
  }

  @keyframes reports-spin {
    to { transform: rotate(360deg); }
  }

  .reports-page .error-banner {
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

  .reports-page .error-banner button {
    margin-left: auto;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    opacity: 0.5;
  }

  .reports-page .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .reports-page .summary-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .reports-page .summary-card.open {
    border-left: 4px solid #f59e0b;
  }

  .reports-page .summary-card.resolved {
    border-left: 4px solid #10b981;
  }

  .reports-page .card-icon {
    font-size: 2.5rem;
  }

  .reports-page .card-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--primary);
  }

  .reports-page .card-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .reports-page .alert-section {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .reports-page .alert-section.warning {
    background: rgba(251, 191, 36, 0.1);
    border-color: #f59e0b;
  }

  .reports-page .alert-section.critical {
    background: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
  }

  .reports-page .alert-section h3 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }

  .reports-page .alert-section ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .reports-page .alert-section li {
    margin: 0.5rem 0;
  }

  .reports-page .charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .reports-page .chart-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
  }

  .reports-page .chart-card h3 {
    margin: 0 0 1.5rem 0;
    color: var(--text-primary);
  }

  .reports-page .chart-bars {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .reports-page .bar-group {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .reports-page .bar-label {
    min-width: 120px;
    font-weight: 500;
    font-size: 0.875rem;
    text-transform: capitalize;
  }

  .reports-page .bar-container {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .reports-page .bar {
    height: 32px;
    border-radius: 4px;
    min-width: 2px;
    transition: width 0.3s ease;
  }

  .reports-page .bar-value {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .reports-page .table-section {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .reports-page .table-section h3 {
    margin: 0 0 1rem 0;
  }

  .reports-page table {
    width: 100%;
    border-collapse: collapse;
  }

  .reports-page th {
    background: var(--bg-secondary);
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    border-bottom: 2px solid var(--border-color);
  }

  .reports-page td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }

  .reports-page tr:hover {
    background: var(--bg-hover);
  }

  @media (max-width: 768px) {
    .reports-page .page-header {
      flex-direction: column;
    }

    .reports-page .charts-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

