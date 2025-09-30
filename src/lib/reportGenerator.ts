// Conflict Report Generator for PCI Mapper
import type { Cell, PCIConflict } from './pciMapper';

export interface ConflictReport {
  reportId: string;
  timestamp: Date;
  totalCells: number;
  totalConflicts: number;
  conflicts: PCIConflict[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    mod3: number;
    mod6: number;
    mod12: number;
    mod30: number;
    threeSector: number;
    fourSector: number;
  };
  recommendations: string[];
}

export class ReportGenerator {
  /**
   * Generate a comprehensive conflict report
   */
  generateReport(cells: Cell[], conflicts: PCIConflict[], recommendations: string[]): ConflictReport {
    const reportId = `PCI_REPORT_${Date.now()}`;
    
    // Calculate summary statistics
    const summary = {
      critical: conflicts.filter(c => c.severity === 'CRITICAL').length,
      high: conflicts.filter(c => c.severity === 'HIGH').length,
      medium: conflicts.filter(c => c.severity === 'MEDIUM').length,
      low: conflicts.filter(c => c.severity === 'LOW').length,
      mod3: conflicts.filter(c => c.conflictType === 'MOD3').length,
      mod6: conflicts.filter(c => c.conflictType === 'MOD6').length,
      mod12: conflicts.filter(c => c.conflictType === 'MOD12').length,
      mod30: conflicts.filter(c => c.conflictType === 'MOD30').length,
      threeSector: conflicts.filter(c => 
        c.primaryCell.towerType === '3-sector' || c.conflictingCell.towerType === '3-sector'
      ).length,
      fourSector: conflicts.filter(c => 
        c.primaryCell.towerType === '4-sector' || c.conflictingCell.towerType === '4-sector'
      ).length,
    };

    return {
      reportId,
      timestamp: new Date(),
      totalCells: cells.length,
      totalConflicts: conflicts.length,
      conflicts,
      summary,
      recommendations
    };
  }

  /**
   * Export conflict report as CSV
   */
  exportToCSV(report: ConflictReport): string {
    const headers = [
      'Conflict ID',
      'Primary Cell ID',
      'Primary eNodeB',
      'Primary Sector',
      'Primary PCI',
      'Primary Azimuth',
      'Primary Tower Type',
      'Primary Technology',
      'Conflicting Cell ID',
      'Conflicting eNodeB',
      'Conflicting Sector',
      'Conflicting PCI',
      'Conflicting Azimuth',
      'Conflicting Tower Type',
      'Conflicting Technology',
      'Conflict Type',
      'Severity',
      'Distance (m)',
      'Primary RS Power (dBm)',
      'Conflicting RS Power (dBm)',
      'Primary Latitude',
      'Primary Longitude',
      'Conflicting Latitude',
      'Conflicting Longitude'
    ];

    const rows = report.conflicts.map((conflict, index) => [
      index + 1,
      conflict.primaryCell.id,
      conflict.primaryCell.eNodeB,
      conflict.primaryCell.sector,
      conflict.primaryCell.pci,
      conflict.primaryCell.azimuth || this.getDefaultAzimuth(conflict.primaryCell),
      conflict.primaryCell.towerType || '3-sector',
      conflict.primaryCell.technology || 'LTE',
      conflict.conflictingCell.id,
      conflict.conflictingCell.eNodeB,
      conflict.conflictingCell.sector,
      conflict.conflictingCell.pci,
      conflict.conflictingCell.azimuth || this.getDefaultAzimuth(conflict.conflictingCell),
      conflict.conflictingCell.towerType || '3-sector',
      conflict.conflictingCell.technology || 'LTE',
      conflict.conflictType,
      conflict.severity,
      Math.round(conflict.distance),
      conflict.primaryCell.rsPower,
      conflict.conflictingCell.rsPower,
      conflict.primaryCell.latitude,
      conflict.primaryCell.longitude,
      conflict.conflictingCell.latitude,
      conflict.conflictingCell.longitude
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    return csvContent;
  }

  /**
   * Export conflict report as PDF (HTML-based)
   */
  exportToPDF(report: ConflictReport): string {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>PCI Conflict Report - ${report.reportId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        .header { text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .summary-item { text-align: center; padding: 10px; background: white; border-radius: 4px; }
        .summary-value { font-size: 24px; font-weight: bold; color: #007bff; }
        .summary-label { font-size: 14px; color: #666; margin-top: 5px; }
        .conflicts-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .conflicts-table th, .conflicts-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .conflicts-table th { background-color: #f2f2f2; font-weight: bold; }
        .severity-critical { color: #dc3545; font-weight: bold; }
        .severity-high { color: #fd7e14; font-weight: bold; }
        .severity-medium { color: #ffc107; font-weight: bold; }
        .severity-low { color: #28a745; font-weight: bold; }
        .recommendations { margin-top: 30px; }
        .recommendations ul { padding-left: 20px; }
        .recommendations li { margin-bottom: 8px; }
        .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
        @media print { body { margin: 0; } .header { page-break-after: avoid; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>LTE PCI Conflict Analysis Report</h1>
        <p>Report ID: ${report.reportId}</p>
        <p>Generated: ${report.timestamp.toLocaleString()}</p>
    </div>

    <div class="summary">
        <h2>Executive Summary</h2>
        <div class="summary-grid">
            <div class="summary-item">
                <div class="summary-value">${report.totalCells}</div>
                <div class="summary-label">Total Cells</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${report.totalConflicts}</div>
                <div class="summary-label">Total Conflicts</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${report.summary.critical}</div>
                <div class="summary-label">Critical</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${report.summary.high}</div>
                <div class="summary-label">High Priority</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${report.summary.medium}</div>
                <div class="summary-label">Medium</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${report.summary.low}</div>
                <div class="summary-label">Low</div>
            </div>
        </div>

        <h3>Conflict Types</h3>
        <div class="summary-grid">
            <div class="summary-item">
                <div class="summary-value">${report.summary.mod3}</div>
                <div class="summary-label">Mod3 (CRS)</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${report.summary.mod6}</div>
                <div class="summary-label">Mod6 (PBCH)</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${report.summary.mod12}</div>
                <div class="summary-label">Mod12 (PSS/SSS)</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${report.summary.mod30}</div>
                <div class="summary-label">Mod30 (PRS)</div>
            </div>
        </div>

        <h3>Tower Configurations</h3>
        <div class="summary-grid">
            <div class="summary-item">
                <div class="summary-value">${report.summary.threeSector}</div>
                <div class="summary-label">3-Sector (120°)</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${report.summary.fourSector}</div>
                <div class="summary-label">4-Sector (90°)</div>
            </div>
        </div>
    </div>

    <h2>Detailed Conflicts</h2>
    <table class="conflicts-table">
        <thead>
            <tr>
                <th>Primary Cell</th>
                <th>Conflicting Cell</th>
                <th>Conflict Type</th>
                <th>Severity</th>
                <th>Distance (m)</th>
                <th>Primary PCI</th>
                <th>Conflicting PCI</th>
                <th>Primary Azimuth</th>
                <th>Conflicting Azimuth</th>
            </tr>
        </thead>
        <tbody>
            ${report.conflicts.map(conflict => `
                <tr>
                    <td>${conflict.primaryCell.id} (eNB${conflict.primaryCell.eNodeB}/S${conflict.primaryCell.sector})</td>
                    <td>${conflict.conflictingCell.id} (eNB${conflict.conflictingCell.eNodeB}/S${conflict.conflictingCell.sector})</td>
                    <td>${conflict.conflictType}</td>
                    <td class="severity-${conflict.severity.toLowerCase()}">${conflict.severity}</td>
                    <td>${Math.round(conflict.distance)}</td>
                    <td>${conflict.primaryCell.pci}</td>
                    <td>${conflict.conflictingCell.pci}</td>
                    <td>${conflict.primaryCell.azimuth || this.getDefaultAzimuth(conflict.primaryCell)}°</td>
                    <td>${conflict.conflictingCell.azimuth || this.getDefaultAzimuth(conflict.conflictingCell)}°</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="recommendations">
        <h2>Recommendations</h2>
        <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>

    <div class="footer">
        <p>Generated by LTE PCI Conflict Mapper - ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>`;

    return html;
  }

  /**
   * Download CSV file
   */
  downloadCSV(report: ConflictReport, filename?: string): void {
    const csvContent = this.exportToCSV(report);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename || `pci_conflicts_${report.reportId}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  /**
   * Download PDF file (opens in new window for printing)
   */
  downloadPDF(report: ConflictReport, filename?: string): void {
    const htmlContent = this.exportToPDF(report);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
        printWindow.onafterprint = () => {
          URL.revokeObjectURL(url);
        };
      };
    }
  }

  /**
   * Get default azimuth for cell (helper method)
   */
  private getDefaultAzimuth(cell: Cell): number {
    const towerType = cell.towerType || '3-sector';
    
    if (towerType === '3-sector') {
      const sectorAzimuths = [0, 120, 240];
      return sectorAzimuths[(cell.sector - 1) % 3] || 0;
    } else {
      const sectorAzimuths = [0, 90, 180, 270];
      return sectorAzimuths[(cell.sector - 1) % 4] || 0;
    }
  }
}

export const reportGenerator = new ReportGenerator();
