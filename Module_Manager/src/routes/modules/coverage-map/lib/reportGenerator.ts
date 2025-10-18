// Equipment Report Generator
import type { TowerSite, Sector, CPEDevice, NetworkEquipment } from './models';

export interface EquipmentReport {
  towers: TowerSite[];
  sectors: Sector[];
  cpeDevices: CPEDevice[];
  equipment: NetworkEquipment[];
  generatedAt: Date;
  tenantName: string;
}

export class ReportGenerator {
  
  /**
   * Generate CSV report of all equipment
   */
  generateCSV(report: EquipmentReport): string {
    let csv = '';
    
    // Towers CSV
    csv += 'TOWER SITES\n';
    csv += 'ID,Name,Type,Latitude,Longitude,Address,Height (ft),FCC ID,Tower Owner,Gate Code\n';
    report.towers.forEach(tower => {
      csv += `${tower.id},`;
      csv += `"${tower.name}",`;
      csv += `${tower.type},`;
      csv += `${tower.location.latitude},`;
      csv += `${tower.location.longitude},`;
      csv += `"${tower.location.address || ''}",`;
      csv += `${tower.height || ''},`;
      csv += `"${tower.fccId || ''}",`;
      csv += `"${tower.towerOwner || ''}",`;
      csv += `"${tower.gateCode || ''}"\n`;
    });
    
    csv += '\n';
    
    // Sectors CSV
    csv += 'SECTORS\n';
    csv += 'ID,Name,Site ID,Technology,Band,Frequency (MHz),Azimuth,Beamwidth,Status,Antenna Model,Radio Model,Serial Number\n';
    report.sectors.forEach(sector => {
      csv += `${sector.id},`;
      csv += `"${sector.name}",`;
      csv += `${sector.siteId},`;
      csv += `${sector.technology},`;
      csv += `"${sector.band || ''}",`;
      csv += `${sector.frequency || ''},`;
      csv += `${sector.azimuth},`;
      csv += `${sector.beamwidth},`;
      csv += `${sector.status},`;
      csv += `"${sector.antennaModel || ''}",`;
      csv += `"${sector.radioModel || ''}",`;
      csv += `"${sector.antennaSerialNumber || ''}"\n`;
    });
    
    csv += '\n';
    
    // CPE Devices CSV
    csv += 'CPE DEVICES\n';
    csv += 'ID,Name,Manufacturer,Model,Serial Number,Status,Latitude,Longitude,Address,Subscriber,Technology,Azimuth\n';
    report.cpeDevices.forEach(cpe => {
      csv += `${cpe.id},`;
      csv += `"${cpe.name}",`;
      csv += `"${cpe.manufacturer}",`;
      csv += `"${cpe.model}",`;
      csv += `"${cpe.serialNumber}",`;
      csv += `${cpe.status},`;
      csv += `${cpe.location.latitude},`;
      csv += `${cpe.location.longitude},`;
      csv += `"${cpe.location.address || ''}",`;
      csv += `"${cpe.subscriberName || ''}",`;
      csv += `${cpe.technology},`;
      csv += `${cpe.azimuth}\n`;
    });
    
    csv += '\n';
    
    // Network Equipment CSV
    csv += 'NETWORK EQUIPMENT\n';
    csv += 'ID,Name,Type,Manufacturer,Model,Serial Number,Location Type,Status,Latitude,Longitude,Quantity,Purchase Date\n';
    report.equipment.forEach(eq => {
      csv += `${eq.id},`;
      csv += `"${eq.name}",`;
      csv += `${eq.type},`;
      csv += `"${eq.manufacturer}",`;
      csv += `"${eq.model}",`;
      csv += `"${eq.serialNumber}",`;
      csv += `${eq.locationType},`;
      csv += `${eq.status},`;
      csv += `${eq.location.latitude},`;
      csv += `${eq.location.longitude},`;
      csv += `${eq.quantity || 1},`;
      csv += `"${eq.purchaseDate?.toLocaleDateString() || ''}"\n`;
    });
    
    return csv;
  }
  
  /**
   * Generate PDF report (returns HTML that can be printed as PDF)
   */
  generatePDFHTML(report: EquipmentReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Network Equipment Report - ${report.tenantName}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
      color: #333;
    }
    h1 {
      color: #7c3aed;
      border-bottom: 3px solid #7c3aed;
      padding-bottom: 10px;
    }
    h2 {
      color: #5b21b6;
      margin-top: 30px;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 12px;
    }
    th {
      background-color: #7c3aed;
      color: white;
      text-align: left;
      padding: 10px;
      font-weight: bold;
    }
    td {
      padding: 8px;
      border-bottom: 1px solid #ddd;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .summary {
      background-color: #f0f0f0;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
    }
    .summary-item {
      display: inline-block;
      margin-right: 30px;
      font-size: 14px;
    }
    .summary-number {
      font-size: 24px;
      font-weight: bold;
      color: #7c3aed;
    }
    .footer {
      margin-top: 50px;
      text-align: center;
      color: #666;
      font-size: 11px;
    }
    @media print {
      body { margin: 0; }
      h2 { page-break-before: always; }
      table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Network Equipment Report</h1>
  <p><strong>Organization:</strong> ${report.tenantName}</p>
  <p><strong>Generated:</strong> ${report.generatedAt.toLocaleString()}</p>
  
  <div class="summary">
    <div class="summary-item">
      <div class="summary-number">${report.towers.length}</div>
      <div>Tower Sites</div>
    </div>
    <div class="summary-item">
      <div class="summary-number">${report.sectors.length}</div>
      <div>Sectors</div>
    </div>
    <div class="summary-item">
      <div class="summary-number">${report.cpeDevices.length}</div>
      <div>CPE Devices</div>
    </div>
    <div class="summary-item">
      <div class="summary-number">${report.equipment.length}</div>
      <div>Equipment Items</div>
    </div>
  </div>
  
  <h2>Tower Sites</h2>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Type</th>
        <th>Location</th>
        <th>Height</th>
        <th>FCC ID</th>
        <th>Owner</th>
      </tr>
    </thead>
    <tbody>
      ${report.towers.map(tower => `
        <tr>
          <td>${tower.name}</td>
          <td>${tower.type}</td>
          <td>${tower.location.address || `${tower.location.latitude.toFixed(4)}, ${tower.location.longitude.toFixed(4)}`}</td>
          <td>${tower.height || 'N/A'} ft</td>
          <td>${tower.fccId || 'N/A'}</td>
          <td>${tower.towerOwner || 'N/A'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <h2>Sectors</h2>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Technology</th>
        <th>Band</th>
        <th>Azimuth</th>
        <th>Status</th>
        <th>Antenna</th>
        <th>Serial #</th>
      </tr>
    </thead>
    <tbody>
      ${report.sectors.map(sector => `
        <tr>
          <td>${sector.name}</td>
          <td>${sector.technology}</td>
          <td>${sector.band || 'N/A'}</td>
          <td>${sector.azimuth}°</td>
          <td>${sector.status}</td>
          <td>${sector.antennaModel || 'N/A'}</td>
          <td>${sector.antennaSerialNumber || 'N/A'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <h2>CPE Devices</h2>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Manufacturer</th>
        <th>Model</th>
        <th>Serial #</th>
        <th>Status</th>
        <th>Subscriber</th>
        <th>Location</th>
      </tr>
    </thead>
    <tbody>
      ${report.cpeDevices.map(cpe => `
        <tr>
          <td>${cpe.name}</td>
          <td>${cpe.manufacturer}</td>
          <td>${cpe.model}</td>
          <td>${cpe.serialNumber}</td>
          <td>${cpe.status}</td>
          <td>${cpe.subscriberName || 'N/A'}</td>
          <td>${cpe.location.address || `${cpe.location.latitude.toFixed(4)}, ${cpe.location.longitude.toFixed(4)}`}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <h2>Network Equipment Inventory</h2>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Type</th>
        <th>Manufacturer</th>
        <th>Model</th>
        <th>Serial #</th>
        <th>Location</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${report.equipment.map(eq => `
        <tr>
          <td>${eq.name}</td>
          <td>${eq.type}</td>
          <td>${eq.manufacturer}</td>
          <td>${eq.model}</td>
          <td>${eq.serialNumber}</td>
          <td>${eq.locationType}</td>
          <td>${eq.status}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <div class="footer">
    <p>Generated by LTE WISP Management Platform</p>
    <p>${report.generatedAt.toLocaleString()}</p>
  </div>
</body>
</html>
    `;
  }
  
  /**
   * Download CSV file
   */
  downloadCSV(csv: string, filename: string = 'equipment-report.csv') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  /**
   * Print PDF (opens print dialog with HTML)
   */
  printPDF(html: string) {
    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      setTimeout(() => printWindow.close(), 500);
    }
  }
}

export const reportGenerator = new ReportGenerator();

