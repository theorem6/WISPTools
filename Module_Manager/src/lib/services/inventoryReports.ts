/**
 * Inventory Reporting & Analytics Service
 * Generates comprehensive reports, charts, and exports
 */

import type { InventoryItem } from './inventoryService';

export interface InventoryReport {
  generatedAt: Date;
  tenantName: string;
  summary: {
    totalItems: number;
    totalValue: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    byLocation: Record<string, number>;
    byManufacturer: Record<string, number>;
  };
  items: InventoryItem[];
  alerts: {
    lowStock: any[];
    expiringWarranties: InventoryItem[];
    maintenanceDue: InventoryItem[];
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

export class InventoryReportGenerator {
  /**
   * Generate comprehensive inventory report
   */
  generateReport(
    items: InventoryItem[],
    tenantName: string,
    alerts: any = {}
  ): InventoryReport {
    const report: InventoryReport = {
      generatedAt: new Date(),
      tenantName,
      summary: {
        totalItems: items.length,
        totalValue: this.calculateTotalValue(items),
        byStatus: this.groupBy(items, 'status'),
        byCategory: this.groupBy(items, 'category'),
        byLocation: this.groupByLocation(items),
        byManufacturer: this.groupBy(items, 'manufacturer')
      },
      items,
      alerts: {
        lowStock: alerts.lowStock || [],
        expiringWarranties: alerts.expiringWarranties || [],
        maintenanceDue: alerts.maintenanceDue || []
      }
    };

    return report;
  }

  /**
   * Generate CSV export
   */
  generateCSV(items: InventoryItem[]): string {
    const headers = [
      'Asset Tag',
      'Serial Number',
      'Category',
      'Type',
      'Manufacturer',
      'Model',
      'Status',
      'Condition',
      'Location Type',
      'Location Name',
      'Purchase Date',
      'Purchase Price',
      'Warranty End',
      'Notes'
    ];

    const rows = items.map(item => [
      item.assetTag || '',
      item.serialNumber || '',
      item.category || '',
      item.equipmentType || '',
      item.manufacturer || '',
      item.model || '',
      item.status || '',
      item.condition || '',
      item.currentLocation?.type || '',
      item.currentLocation?.siteName || '',
      item.purchaseInfo?.purchaseDate ? new Date(item.purchaseInfo.purchaseDate).toLocaleDateString() : '',
      item.purchaseInfo?.purchasePrice?.toString() || '',
      item.warranty?.endDate ? new Date(item.warranty.endDate).toLocaleDateString() : '',
      item.notes?.replace(/\n/g, ' ') || ''
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  /**
   * Download CSV file
   */
  downloadCSV(csv: string, filename: string = `inventory-${Date.now()}.csv`) {
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
  generatePDFHTML(report: InventoryReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Inventory Report - ${report.tenantName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #7c3aed; border-bottom: 3px solid #7c3aed; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 30px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
    .summary-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; background: #f9f9f9; }
    .summary-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; }
    .summary-card .value { font-size: 28px; font-weight: bold; color: #7c3aed; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #7c3aed; color: white; padding: 12px; text-align: left; }
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
      <h1>📦 Inventory Report</h1>
      <p><strong>Organization:</strong> ${report.tenantName}</p>
    </div>
    <div style="text-align: right;">
      <p><strong>Generated:</strong> ${report.generatedAt.toLocaleString()}</p>
      <p><strong>Total Items:</strong> ${report.summary.totalItems}</p>
    </div>
  </div>

  <h2>Summary</h2>
  <div class="summary">
    <div class="summary-card">
      <h3>Total Items</h3>
      <div class="value">${report.summary.totalItems}</div>
    </div>
    <div class="summary-card">
      <h3>Total Value</h3>
      <div class="value">$${report.summary.totalValue.toLocaleString()}</div>
    </div>
    <div class="summary-card">
      <h3>Locations</h3>
      <div class="value">${Object.keys(report.summary.byLocation).length}</div>
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
          <td>${((count / report.summary.totalItems) * 100).toFixed(1)}%</td>
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
          <td>${category}</td>
          <td>${count}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${report.alerts.expiringWarranties.length > 0 ? `
  <div class="alert-section">
    <h2>⚠️ Expiring Warranties (${report.alerts.expiringWarranties.length})</h2>
    <ul>
      ${report.alerts.expiringWarranties.map(item => `
        <li><strong>${item.manufacturer} ${item.model}</strong> - SN: ${item.serialNumber} - Expires: ${item.warranty?.endDate ? new Date(item.warranty.endDate).toLocaleDateString() : 'N/A'}</li>
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
  generateStatusChart(items: InventoryItem[]): ChartData {
    const statusCounts = this.groupBy(items, 'status');
    
    return {
      labels: Object.keys(statusCounts),
      datasets: [{
        label: 'Items by Status',
        data: Object.values(statusCounts),
        backgroundColor: [
          '#10b981', // available - green
          '#3b82f6', // deployed - blue
          '#f59e0b', // maintenance - orange
          '#ef4444', // rma - red
          '#6b7280'  // other - gray
        ]
      }]
    };
  }

  /**
   * Generate chart data for category distribution
   */
  generateCategoryChart(items: InventoryItem[]): ChartData {
    const categoryCounts = this.groupBy(items, 'category');
    
    return {
      labels: Object.keys(categoryCounts),
      datasets: [{
        label: 'Items by Category',
        data: Object.values(categoryCounts),
        backgroundColor: [
          '#7c3aed', // primary
          '#ec4899', // secondary
          '#06b6d4', // tertiary
          '#f59e0b',
          '#10b981'
        ]
      }]
    };
  }

  /**
   * Generate chart data for location distribution
   */
  generateLocationChart(items: InventoryItem[]): ChartData {
    const locationCounts = this.groupByLocation(items);
    
    return {
      labels: Object.keys(locationCounts),
      datasets: [{
        label: 'Items by Location',
        data: Object.values(locationCounts),
        backgroundColor: [
          '#3b82f6',
          '#8b5cf6',
          '#ec4899',
          '#f59e0b',
          '#10b981',
          '#06b6d4'
        ]
      }]
    };
  }

  // Helper methods
  private groupBy(items: InventoryItem[], field: keyof InventoryItem): Record<string, number> {
    return items.reduce((acc, item) => {
      const value = String(item[field] || 'Unknown');
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupByLocation(items: InventoryItem[]): Record<string, number> {
    return items.reduce((acc, item) => {
      const location = item.currentLocation?.siteName || item.currentLocation?.type || 'Unknown';
      acc[location] = (acc[location] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private calculateTotalValue(items: InventoryItem[]): number {
    return items.reduce((sum, item) => {
      return sum + (item.purchaseInfo?.purchasePrice || 0);
    }, 0);
  }
}

export const reportGenerator = new InventoryReportGenerator();

