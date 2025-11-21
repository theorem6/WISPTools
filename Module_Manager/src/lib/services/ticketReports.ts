/**
 * Ticket Reporting & Analytics Service
 * Generates comprehensive reports, charts, and exports for tickets/work orders
 */

import type { WorkOrder } from './workOrderService';

export interface TicketReport {
  generatedAt: Date;
  tenantName: string;
  summary: {
    totalTickets: number;
    openTickets: number;
    resolvedTickets: number;
    avgResolutionTime: number; // hours
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
    byAssignedTo: Record<string, number>;
    slaCompliance: {
      onTime: number;
      breached: number;
      noSLA: number;
    };
  };
  tickets: WorkOrder[];
  alerts: {
    slaBreached: WorkOrder[];
    overdue: WorkOrder[];
    criticalOpen: WorkOrder[];
  };
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string[];
    borderColor?: string[];
  }>;
}

export class TicketReportGenerator {
  /**
   * Generate comprehensive ticket report
   */
  generateReport(
    tickets: WorkOrder[],
    tenantName: string,
    alerts: any = {}
  ): TicketReport {
    const resolvedTickets = tickets.filter(t => 
      t.status === 'resolved' || t.status === 'closed'
    );
    
    const openTickets = tickets.filter(t => 
      ['open', 'assigned', 'in-progress', 'waiting-parts'].includes(t.status || '')
    );

    // Calculate average resolution time
    let avgResolutionTime = 0;
    const ticketsWithResolution = resolvedTickets.filter(t => 
      t.createdAt && (t.completedAt || t.closedAt)
    );
    if (ticketsWithResolution.length > 0) {
      const totalHours = ticketsWithResolution.reduce((sum, t) => {
        const created = new Date(t.createdAt!).getTime();
        const resolved = new Date(t.completedAt || t.closedAt || t.createdAt!).getTime();
        return sum + (resolved - created) / (1000 * 60 * 60);
      }, 0);
      avgResolutionTime = totalHours / ticketsWithResolution.length;
    }

    // SLA Compliance
    const now = new Date();
    const slaBreached = tickets.filter(t => {
      if (!t.sla?.resolutionDeadline || t.status === 'resolved' || t.status === 'closed') {
        return false;
      }
      return new Date(t.sla.resolutionDeadline) < now;
    });

    const slaOnTime = tickets.filter(t => {
      if (!t.sla?.resolutionDeadline || t.status === 'resolved' || t.status === 'closed') {
        return false;
      }
      return new Date(t.sla.resolutionDeadline) >= now;
    });

    const report: TicketReport = {
      generatedAt: new Date(),
      tenantName,
      summary: {
        totalTickets: tickets.length,
        openTickets: openTickets.length,
        resolvedTickets: resolvedTickets.length,
        avgResolutionTime: Math.round(avgResolutionTime * 10) / 10, // Round to 1 decimal
        byStatus: this.groupBy(tickets, 'status'),
        byPriority: this.groupBy(tickets, 'priority'),
        byType: this.groupBy(tickets, 'type'),
        byCategory: this.groupBy(tickets, 'ticketCategory'),
        byAssignedTo: this.groupByAssignedTo(tickets),
        slaCompliance: {
          onTime: slaOnTime.length,
          breached: slaBreached.length,
          noSLA: tickets.length - slaOnTime.length - slaBreached.length
        }
      },
      tickets,
      alerts: {
        slaBreached: alerts.slaBreached || slaBreached,
        overdue: alerts.overdue || [],
        criticalOpen: alerts.criticalOpen || tickets.filter(t => 
          t.priority === 'critical' && openTickets.includes(t)
        )
      }
    };

    return report;
  }

  /**
   * Generate CSV export
   */
  generateCSV(tickets: WorkOrder[]): string {
    const headers = [
      'Ticket Number',
      'Title',
      'Category',
      'Type',
      'Priority',
      'Status',
      'Assigned To',
      'Created At',
      'Created By',
      'Resolved At',
      'Resolution Time (hours)',
      'Customer Name',
      'Customer Phone',
      'Description',
      'Resolution',
      'Root Cause',
      'Preventive Measures'
    ];

    const rows = tickets.map(ticket => {
      let resolutionTime = '';
      if (ticket.createdAt && (ticket.completedAt || ticket.closedAt)) {
        const created = new Date(ticket.createdAt).getTime();
        const resolved = new Date(ticket.completedAt || ticket.closedAt || ticket.createdAt).getTime();
        const hours = (resolved - created) / (1000 * 60 * 60);
        resolutionTime = Math.round(hours * 10) / 10 + 'h';
      }

      const customerName = ticket.affectedCustomers?.[0]?.customerName || 
                          ticket.customerContact?.name || '';
      const customerPhone = ticket.affectedCustomers?.[0]?.phoneNumber || 
                           ticket.customerContact?.phone || '';

      return [
        ticket.ticketNumber || ticket._id || '',
        ticket.title || '',
        ticket.ticketCategory || 'customer-facing',
        ticket.type || '',
        ticket.priority || '',
        ticket.status || '',
        ticket.assignedToName || '',
        ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : '',
        ticket.createdByName || ticket.createdBy || '',
        ticket.completedAt ? new Date(ticket.completedAt).toLocaleString() : 
          (ticket.closedAt ? new Date(ticket.closedAt).toLocaleString() : ''),
        resolutionTime,
        customerName,
        customerPhone,
        (ticket.description || '').replace(/\n/g, ' ').replace(/"/g, '""'),
        (ticket.resolution || '').replace(/\n/g, ' ').replace(/"/g, '""'),
        (ticket.rootCause || '').replace(/\n/g, ' ').replace(/"/g, '""'),
        (ticket.preventiveMeasures || '').replace(/\n/g, ' ').replace(/"/g, '""')
      ];
    });

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  /**
   * Download CSV file
   */
  downloadCSV(csv: string, filename: string = `ticket-report-${Date.now()}.csv`) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Generate PDF-ready HTML
   */
  generatePDFHTML(report: TicketReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Ticket Report - ${report.tenantName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #3b82f6; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 30px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .summary-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; background: #f9f9f9; }
    .summary-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; }
    .summary-card .value { font-size: 28px; font-weight: bold; color: #3b82f6; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #3b82f6; color: white; padding: 12px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #ddd; }
    tr:hover { background: #f5f5f5; }
    .alert-section { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .footer { margin-top: 50px; text-align: center; color: #666; font-size: 12px; }
    @media print {
      body { margin: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>🎧 Ticket Report</h1>
      <p><strong>Organization:</strong> ${report.tenantName}</p>
    </div>
    <div style="text-align: right;">
      <p><strong>Generated:</strong> ${report.generatedAt.toLocaleString()}</p>
      <p><strong>Total Tickets:</strong> ${report.summary.totalTickets}</p>
    </div>
  </div>

  <h2>Summary</h2>
  <div class="summary">
    <div class="summary-card">
      <h3>Total Tickets</h3>
      <div class="value">${report.summary.totalTickets}</div>
    </div>
    <div class="summary-card">
      <h3>Open Tickets</h3>
      <div class="value">${report.summary.openTickets}</div>
    </div>
    <div class="summary-card">
      <h3>Resolved Tickets</h3>
      <div class="value">${report.summary.resolvedTickets}</div>
    </div>
    <div class="summary-card">
      <h3>Avg Resolution</h3>
      <div class="value">${report.summary.avgResolutionTime}h</div>
    </div>
  </div>

  <h2>By Status</h2>
  <table>
    <thead>
      <tr>
        <th>Status</th>
        <th>Count</th>
        <th>Percentage</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(report.summary.byStatus).map(([status, count]) => `
        <tr>
          <td><strong>${status}</strong></td>
          <td>${count}</td>
          <td>${((count / report.summary.totalTickets) * 100).toFixed(1)}%</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>By Priority</h2>
  <table>
    <thead>
      <tr>
        <th>Priority</th>
        <th>Count</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(report.summary.byPriority).map(([priority, count]) => `
        <tr>
          <td>${priority}</td>
          <td>${count}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>By Category</h2>
  <table>
    <thead>
      <tr>
        <th>Category</th>
        <th>Count</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(report.summary.byCategory).map(([category, count]) => `
        <tr>
          <td>${category || 'N/A'}</td>
          <td>${count}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${report.alerts.slaBreached.length > 0 ? `
  <div class="alert-section">
    <h2>⚠️ SLA Breached Tickets (${report.alerts.slaBreached.length})</h2>
    <ul>
      ${report.alerts.slaBreached.slice(0, 10).map(ticket => `
        <li><strong>${ticket.ticketNumber || ticket._id}</strong> - ${ticket.title} - ${ticket.priority} priority</li>
      `).join('')}
    </ul>
  </div>
  ` : ''}

  <div class="footer">
    <p>Generated by LTE WISP Management Platform</p>
    <p>This report contains confidential information</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Print PDF
   */
  printPDF(html: string) {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  }

  /**
   * Generate chart data for status distribution
   */
  generateStatusChart(tickets: WorkOrder[]): ChartData {
    const statusCounts = this.groupBy(tickets, 'status');
    
    return {
      labels: Object.keys(statusCounts),
      datasets: [{
        label: 'Tickets by Status',
        data: Object.values(statusCounts),
        backgroundColor: [
          '#fef3c7', // open - yellow
          '#e0e7ff', // assigned - indigo
          '#dbeafe', // in-progress - blue
          '#fed7aa', // waiting-parts - orange
          '#d1fae5', // resolved - green
          '#f3f4f6'  // closed - gray
        ]
      }]
    };
  }

  /**
   * Generate chart data for priority distribution
   */
  generatePriorityChart(tickets: WorkOrder[]): ChartData {
    const priorityCounts = this.groupBy(tickets, 'priority');
    
    return {
      labels: Object.keys(priorityCounts),
      datasets: [{
        label: 'Tickets by Priority',
        data: Object.values(priorityCounts),
        backgroundColor: [
          '#fee2e2', // critical - red
          '#fed7aa', // high - orange
          '#fef3c7', // medium - yellow
          '#dbeafe'  // low - blue
        ]
      }]
    };
  }

  /**
   * Generate chart data for category distribution
   */
  generateCategoryChart(tickets: WorkOrder[]): ChartData {
    const categoryCounts = this.groupBy(tickets, 'ticketCategory');
    
    return {
      labels: Object.keys(categoryCounts).map(c => c || 'customer-facing'),
      datasets: [{
        label: 'Tickets by Category',
        data: Object.values(categoryCounts),
        backgroundColor: [
          '#3b82f6', // customer-facing - blue
          '#8b5cf6'  // infrastructure - purple
        ]
      }]
    };
  }

  /**
   * Generate chart data for type distribution
   */
  generateTypeChart(tickets: WorkOrder[]): ChartData {
    const typeCounts = this.groupBy(tickets, 'type');
    
    return {
      labels: Object.keys(typeCounts),
      datasets: [{
        label: 'Tickets by Type',
        data: Object.values(typeCounts),
        backgroundColor: [
          '#7c3aed', // primary
          '#ec4899', // secondary
          '#06b6d4', // tertiary
          '#f59e0b',
          '#10b981',
          '#ef4444'
        ]
      }]
    };
  }

  // Helper methods
  private groupBy(tickets: WorkOrder[], field: keyof WorkOrder): Record<string, number> {
    return tickets.reduce((acc, ticket) => {
      const value = String(ticket[field] || 'Unknown');
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupByAssignedTo(tickets: WorkOrder[]): Record<string, number> {
    return tickets.reduce((acc, ticket) => {
      const assignedTo = ticket.assignedToName || ticket.assignedTo || 'Unassigned';
      acc[assignedTo] = (acc[assignedTo] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

export const ticketReportGenerator = new TicketReportGenerator();

