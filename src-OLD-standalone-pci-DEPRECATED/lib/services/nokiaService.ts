/**
 * Nokia LTE Configuration Service
 * Generates Nokia XML configuration files for LTE base stations
 */

export interface NokiaCarrier {
  id: number;
  earfcnDL: number;
  earfcnUL?: number;
  bandwidth: '10MHz' | '15MHz' | '20MHz';
  pci: number;
  sectorId: number;
  cellName?: string;
}

export interface NokiaSector {
  id: number;
  azimuth: number;
  rmodId: number; // Radio Module ID (1-3)
  carriers: NokiaCarrier[];
}

export interface NokiaBaseStation {
  btsId: string; // e.g., "10219"
  btsName: string; // e.g., "BBU-NKASIA-ALW-CENTREVILLE"
  lnBtsId: string; // Usually same as btsId
  sectors: NokiaSector[];
  ipConfig: {
    managementIP: string;
    managementGateway: string;
    managementSubnet: number; // e.g., 24
    transportIP: string;
    transportGateway: string;
    transportSubnet: number;
  };
  tac: number; // Tracking Area Code
  mcc: string; // Mobile Country Code
  mnc: string; // Mobile Network Code
  mncLength: number; // 2 or 3
}

export class NokiaConfigService {
  /**
   * Generate Nokia XML configuration using reference template
   */
  async generateConfig(config: NokiaBaseStation): Promise<string> {
    // For comprehensive configuration, use template-based generation
    return this.generateFromTemplate(config);
  }
  
  /**
   * Generate configuration using reference template
   * This produces a production-grade 20k+ line configuration
   */
  private async generateFromTemplate(config: NokiaBaseStation): Promise<string> {
    console.log('Nokia: Generating comprehensive configuration from template');
    console.log('Nokia: BTS ID:', config.btsId, 'Sectors:', config.sectors.length);
    
    // Load reference template
    const templatePath = '/nokia/nokia-3s-3c.xml';
    let template: string;
    
    try {
      const response = await fetch(templatePath);
      if (!response.ok) {
        throw new Error('Reference template not found');
      }
      template = await response.text();
      console.log('Nokia: Loaded reference template,', template.split('\n').length, 'lines');
    } catch (error) {
      console.warn('Nokia: Could not load template, falling back to basic generation');
      return this.generateBasicConfig(config);
    }
    
    // Replace template values with actual configuration
    return this.substituteTemplateValues(template, config);
  }
  
  /**
   * Substitute actual values into template
   */
  private substituteTemplateValues(template: string, config: NokiaBaseStation): string {
    let xml = template;
    
    // Replace BTS ID and name (from reference: 10219)
    xml = xml.replace(/MRBTS-10219/g, `MRBTS-${config.btsId}`);
    xml = xml.replace(/LNBTS-10219/g, `LNBTS-${config.lnBtsId}`);
    xml = xml.replace(/BBU-NKASIA-ALW-CENTREVILLE/g, config.btsName);
    xml = xml.replace(/btsId">10219</g, `btsId">${config.btsId}<`);
    xml = xml.replace(/lnBtsId">10219</g, `lnBtsId">${config.lnBtsId}<`);
    
    // Replace IP addresses (from reference: 100.71.2.9/10.71.2.9)
    xml = xml.replace(/100\.71\.2\.9/g, config.ipConfig.managementIP);
    xml = xml.replace(/100\.71\.2\.1/g, config.ipConfig.managementGateway);
    xml = xml.replace(/10\.71\.2\.9/g, config.ipConfig.transportIP);
    xml = xml.replace(/10\.71\.2\.1/g, config.ipConfig.transportGateway);
    
    // Replace TAC (from reference: 1)
    xml = xml.replace(/tac">1</g, `tac">${config.tac}<`);
    
    // Replace MCC/MNC
    xml = xml.replace(/mcc">310</g, `mcc">${config.mcc}<`);
    xml = xml.replace(/mnc">410</g, `mnc">${config.mnc}<`);
    xml = xml.replace(/mncLength">3</g, `mncLength">${config.mncLength}<`);
    
    // Replace cell-specific values (PCIs and EARFCNs)
    xml = this.substituteCellValues(xml, config);
    
    // Update timestamp
    const timestamp = new Date().toISOString();
    xml = xml.replace(/dateTime="[^"]+"/g, `dateTime="${timestamp}"`);
    xml = xml.replace(/id="\d+"/g, `id="${Date.now()}"`);
    
    console.log('Nokia: Configuration generated,', xml.split('\n').length, 'lines');
    return xml;
  }
  
  /**
   * Replace cell-specific PCIs and EARFCNs in template
   */
  private substituteCellValues(template: string, config: NokiaBaseStation): string {
    let xml = template;
    let cellIndex = 1;
    
    // Reference template has 9 cells (3 sectors × 3 carriers)
    // LNCEL-1,4,7 = Sector 1 (PCI 84,85,86 / EARFCN 55640,55840,56040)
    // LNCEL-2,5,8 = Sector 2 (PCI 84,85,86 / EARFCN 55640,55840,56040)
    // LNCEL-3,6,9 = Sector 3 (PCI 84,85,86 / EARFCN 55640,55840,56040)
    
    for (const sector of config.sectors) {
      for (const carrier of sector.carriers) {
        // Replace PCI for this cell
        const cellPattern = new RegExp(`(LNCEL-${cellIndex}[^>]*>\\s*<p name="physCellId">)\\d+`, 'g');
        xml = xml.replace(cellPattern, `$1${carrier.pci}`);
        
        // Replace EARFCN DL
        const earfcnDlPattern = new RegExp(`(LNCEL-${cellIndex}[^>]*>\\s*<p name="earfcnDL">)\\d+`, 'g');
        xml = xml.replace(earfcnDlPattern, `$1${carrier.earfcnDL}`);
        
        // Replace EARFCN UL
        const earfcnUlPattern = new RegExp(`(LNCEL-${cellIndex}[^>]*>\\s*<p name="earfcnUL">)\\d+`, 'g');
        xml = xml.replace(earfcnUlPattern, `$1${carrier.earfcnUL || carrier.earfcnDL}`);
        
        // Replace cell name
        const namePattern = new RegExp(`(LNCEL-${cellIndex}[^>]*>\\s*<p name="cellName">)[^<]+`, 'g');
        xml = xml.replace(namePattern, `$1${carrier.cellName || `Cell-${cellIndex}`}`);
        
        cellIndex++;
      }
    }
    
    return xml;
  }
  
  /**
   * Basic configuration generator (fallback)
   */
  private generateBasicConfig(config: NokiaBaseStation): string {
    const timestamp = new Date().toISOString();
    let cellIndex = 1;
    
    // Build XML document
    let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<raml xmlns="raml21.xsd" version="2.1">
  <cmData type="plan" scope="all" id="${Date.now()}">
    <header>
      <log action="create" dateTime="${timestamp}"/>
    </header>
`;

    // Base station definition
    xml += this.generateBTS(config);
    
    // Equipment module
    xml += this.generateEquipment(config);
    
    // LTE BTS definition
    xml += this.generateLNBTS(config);
    
    // Generate cells for each sector and carrier
    const cells: string[] = [];
    for (const sector of config.sectors) {
      for (const carrier of sector.carriers) {
        cells.push(this.generateCell(config, sector, carrier, cellIndex));
        cellIndex++;
      }
    }
    xml += cells.join('\n');
    
    // Network configuration
    xml += this.generateNetworkConfig(config);
    
    xml += `  </cmData>
</raml>`;
    
    return xml;
  }

  private generateBTS(config: NokiaBaseStation): string {
    return `    <managedObject class="com.nokia.srbts:MRBTS" distName="MRBTS-${config.btsId}" version="SBTS20C_2006_001" operation="create">
      <p name="btsName">${this.escapeXml(config.btsName)}</p>
    </managedObject>
`;
  }

  private generateEquipment(config: NokiaBaseStation): string {
    let xml = `    <managedObject class="com.nokia.srbts.eqm:EQM" distName="MRBTS-${config.btsId}/EQM-1" version="EQM20B_2007_002" operation="create"/>
    <managedObject class="com.nokia.srbts.eqm:APEQM" distName="MRBTS-${config.btsId}/EQM-1/APEQM-1" version="EQM20B_2007_002" operation="create">
      <p name="aldScanningInterval">30 sec</p>
      <p name="allowBbPoolRecoveryReset">true</p>
      <p name="berMajorAlarmThreshold">-12</p>
      <p name="berMinorAlarmThreshold">-13</p>
    </managedObject>
    <managedObject class="com.nokia.srbts.eqm:CABINET" distName="MRBTS-${config.btsId}/EQM-1/APEQM-1/CABINET-1" version="EQM20B_2007_002" operation="create"/>
    <managedObject class="com.nokia.srbts.eqm:BBMOD" distName="MRBTS-${config.btsId}/EQM-1/APEQM-1/CABINET-1/BBMOD-1" version="EQM20B_2007_002" operation="create">
      <p name="bbCardUsage">2</p>
      <p name="prodCodePlanned">473096A.103</p>
      <p name="radioProtSearchOrder">CPRI</p>
      <p name="useFullCapacity">true</p>
    </managedObject>
    <managedObject class="com.nokia.srbts.eqm:BBMOD" distName="MRBTS-${config.btsId}/EQM-1/APEQM-1/CABINET-1/BBMOD-2" version="EQM20B_2007_002" operation="create">
      <p name="bbCardUsage">2</p>
      <p name="prodCodePlanned">473096A</p>
      <p name="radioProtSearchOrder">CPRI</p>
      <p name="useFullCapacity">true</p>
    </managedObject>
    <managedObject class="com.nokia.srbts.eqm:SMOD" distName="MRBTS-${config.btsId}/EQM-1/APEQM-1/CABINET-1/SMOD-1" version="EQM20B_2007_002" operation="create">
      <p name="climateControlOcxoTemperatureLearning">false</p>
      <p name="prodCodePlanned">473095A.203</p>
      <p name="radioProtSearchOrder">CPRI</p>
    </managedObject>
`;

    // Generate RMOD (Radio Modules) for each sector
    for (const sector of config.sectors) {
      xml += this.generateRMOD(config, sector);
    }

    // Hardware topology connections
    xml += this.generateHWTOP(config);

    return xml;
  }

  private generateRMOD(config: NokiaBaseStation, sector: NokiaSector): string {
    return `    <managedObject class="com.nokia.srbts.eqm:RMOD" distName="MRBTS-${config.btsId}/EQM-1/APEQM-1/RMOD-${sector.rmodId}" version="EQM20B_2007_002" operation="create">
      <p name="actPimCancellation">false</p>
      <p name="actSnapshotCollection">false</p>
      <p name="pimCancellingEnabled">true</p>
      <p name="prodCodePlanned">474156A.103</p>
    </managedObject>
    <managedObject class="com.nokia.srbts.eqm:ANTL" distName="MRBTS-${config.btsId}/EQM-1/APEQM-1/RMOD-${sector.rmodId}/ANTL-1" version="EQM20B_2007_002" operation="create">
      <p name="antPortId">1</p>
      <p name="antennaPathDelayDL">20</p>
      <p name="antennaPathDelayUL">20</p>
      <p name="cwaThreshold">215</p>
      <p name="dcVoltage">OFF</p>
      <p name="hdlcCommunicationAllowed">false</p>
      <p name="totalLoss">30</p>
    </managedObject>
    <managedObject class="com.nokia.srbts.eqm:ANTL" distName="MRBTS-${config.btsId}/EQM-1/APEQM-1/RMOD-${sector.rmodId}/ANTL-2" version="EQM20B_2007_002" operation="create">
      <p name="antPortId">2</p>
      <p name="antennaPathDelayDL">20</p>
      <p name="antennaPathDelayUL">20</p>
      <p name="cwaThreshold">215</p>
      <p name="dcVoltage">OFF</p>
      <p name="hdlcCommunicationAllowed">false</p>
      <p name="totalLoss">30</p>
    </managedObject>
    <managedObject class="com.nokia.srbts.eqm:ANTL" distName="MRBTS-${config.btsId}/EQM-1/APEQM-1/RMOD-${sector.rmodId}/ANTL-3" version="EQM20B_2007_002" operation="create">
      <p name="antPortId">3</p>
      <p name="antennaPathDelayDL">20</p>
      <p name="antennaPathDelayUL">20</p>
      <p name="cwaThreshold">215</p>
      <p name="dcVoltage">OFF</p>
      <p name="hdlcCommunicationAllowed">false</p>
      <p name="totalLoss">30</p>
    </managedObject>
    <managedObject class="com.nokia.srbts.eqm:ANTL" distName="MRBTS-${config.btsId}/EQM-1/APEQM-1/RMOD-${sector.rmodId}/ANTL-4" version="EQM20B_2007_002" operation="create">
      <p name="antPortId">4</p>
      <p name="antennaPathDelayDL">20</p>
      <p name="antennaPathDelayUL">20</p>
      <p name="cwaThreshold">215</p>
      <p name="dcVoltage">OFF</p>
      <p name="hdlcCommunicationAllowed">false</p>
      <p name="totalLoss">30</p>
    </managedObject>
`;
  }

  private generateHWTOP(config: NokiaBaseStation): string {
    let xml = `    <managedObject class="com.nokia.srbts.eqm:HWTOP" distName="MRBTS-${config.btsId}/EQM-1/HWTOP-1" version="EQM20B_2007_002" operation="create"/>
    <managedObject class="com.nokia.srbts.eqm:CABLINK" distName="MRBTS-${config.btsId}/EQM-1/HWTOP-1/CABLINK-1" version="EQM20B_2007_002" operation="create">
      <p name="firstEndpointDN">MRBTS-${config.btsId}/EQM-1/APEQM-1/CABINET-1/SMOD-1</p>
      <p name="firstEndpointLabel">BACKPLANE</p>
      <p name="firstEndpointPortId">1</p>
      <p name="iqCompression">none</p>
      <p name="secondEndpointDN">MRBTS-${config.btsId}/EQM-1/APEQM-1/CABINET-1/BBMOD-1</p>
      <p name="secondEndpointLabel">BACKPLANE</p>
    </managedObject>
`;

    // Create CPRI links between baseband and radio modules
    let linkId = 2;
    for (const sector of config.sectors) {
      const bbmodId = sector.rmodId === 1 ? 1 : 2;
      xml += `    <managedObject class="com.nokia.srbts.eqm:CABLINK" distName="MRBTS-${config.btsId}/EQM-1/HWTOP-1/CABLINK-${linkId}" version="EQM20B_2007_002" operation="create">
      <p name="firstEndpointDN">MRBTS-${config.btsId}/EQM-1/APEQM-1/CABINET-1/BBMOD-${bbmodId}</p>
      <p name="firstEndpointLabel">OPT</p>
      <p name="firstEndpointPortId">${sector.rmodId === 1 ? 1 : 2}</p>
      <p name="iqCompression">9bits</p>
      <p name="linkSpeed">Cpri7</p>
      <p name="secondEndpointDN">MRBTS-${config.btsId}/EQM-1/APEQM-1/RMOD-${sector.rmodId}</p>
      <p name="secondEndpointLabel">OPT</p>
      <p name="secondEndpointPortId">1</p>
    </managedObject>
`;
      linkId++;
    }

    return xml;
  }

  private generateLNBTS(config: NokiaBaseStation): string {
    return `    <managedObject class="NOKLTE:LNBTS" distName="MRBTS-${config.btsId}/LNBTS-${config.lnBtsId}" version="xL20C_2007_003" operation="create">
      <p name="lnBtsId">${config.lnBtsId}</p>
      <p name="tac">${config.tac}</p>
    </managedObject>
`;
  }

  private generateCell(
    config: NokiaBaseStation,
    sector: NokiaSector,
    carrier: NokiaCarrier,
    cellIndex: number
  ): string {
    const cellName = carrier.cellName || `${config.btsName}-S${sector.id}-C${carrier.id}`;
    
    return `    <managedObject class="NOKLTE:LNCEL" distName="MRBTS-${config.btsId}/LNBTS-${config.lnBtsId}/LNCEL-${cellIndex}" version="xL20C_2007_003" operation="create">
      <p name="administrativeState">unlocked</p>
      <p name="availabilityStatus">1</p>
      <p name="btsId">${config.btsId}</p>
      <p name="cellBarred">notBarred</p>
      <p name="cellId">${cellIndex}</p>
      <p name="cellName">${this.escapeXml(cellName)}</p>
      <p name="cellRange">15000</p>
      <p name="cellResvInfo">notReserved</p>
      <p name="dlChBw">${carrier.bandwidth}</p>
      <p name="earfcnDL">${carrier.earfcnDL}</p>
      <p name="earfcnUL">${carrier.earfcnUL || this.calculateULEarfcn(carrier.earfcnDL)}</p>
      <p name="lnBtsId">${config.lnBtsId}</p>
      <p name="lnCelId">${cellIndex}</p>
      <p name="numOfTxAntennas">4</p>
      <p name="pMax">23</p>
      <p name="physCellId">${carrier.pci}</p>
      <p name="qRxLevMin">-124</p>
      <p name="referenceSignalPwr">18.0</p>
      <p name="tac">${config.tac}</p>
      <p name="ulChBw">${carrier.bandwidth}</p>
    </managedObject>
    <managedObject class="NOKLTE:LNCEL_TDD" distName="MRBTS-${config.btsId}/LNBTS-${config.lnBtsId}/LNCEL-${cellIndex}/LNCEL_TDD-0" version="xL20C_2007_003" operation="create">
      <p name="specialSubframePattern">7</p>
      <p name="subframeAssignment">2</p>
    </managedObject>
`;
  }

  private calculateULEarfcn(dlEarfcn: number): number {
    // Band 48 TDD - DL and UL use same frequency
    return dlEarfcn;
  }

  private generateNetworkConfig(config: NokiaBaseStation): string {
    return `    <managedObject class="com.nokia.srbts.tnl:TNLSVC" distName="MRBTS-${config.btsId}/TNLSVC-1" version="TNL20C_2007_002" operation="create"/>
    <managedObject class="com.nokia.srbts.tnl:TNL" distName="MRBTS-${config.btsId}/TNLSVC-1/TNL-1" version="TNL20C_2007_002" operation="create"/>
    <managedObject class="com.nokia.srbts.tnl:IPNO" distName="MRBTS-${config.btsId}/TNLSVC-1/TNL-1/IPNO-1" version="TNL20C_2007_002" operation="create">
      <p name="ipNodeType">ipv4only</p>
    </managedObject>
    <managedObject class="com.nokia.srbts.tnl:ETHSVC" distName="MRBTS-${config.btsId}/TNLSVC-1/TNL-1/ETHSVC-1" version="TNL20C_2007_002" operation="create"/>
    <managedObject class="com.nokia.srbts.tnl:ETHIF" distName="MRBTS-${config.btsId}/TNLSVC-1/TNL-1/ETHSVC-1/ETHIF-1" version="TNL20C_2007_002" operation="create">
      <p name="mtu">1522</p>
      <p name="phyInterfaceType">sfp</p>
      <p name="phyPortId">1</p>
      <p name="portSpeed">auto</p>
    </managedObject>
    <managedObject class="com.nokia.srbts.tnl:VLANIF" distName="MRBTS-${config.btsId}/TNLSVC-1/TNL-1/ETHSVC-1/ETHIF-1/VLANIF-1" version="TNL20C_2007_002" operation="create">
      <p name="vlanId">1</p>
    </managedObject>
    <managedObject class="com.nokia.srbts.tnl:VLANIF" distName="MRBTS-${config.btsId}/TNLSVC-1/TNL-1/ETHSVC-1/ETHIF-1/VLANIF-2" version="TNL20C_2007_002" operation="create">
      <p name="vlanId">2</p>
    </managedObject>
    <managedObject class="com.nokia.srbts.tnl:IPIF" distName="MRBTS-${config.btsId}/TNLSVC-1/TNL-1/IPNO-1/IPIF-2" version="TNL20C_2007_002" operation="create">
      <p name="interfaceDN">MRBTS-${config.btsId}/TNLSVC-1/TNL-1/ETHSVC-1/ETHIF-1/VLANIF-1</p>
      <p name="ipMtu">1500</p>
    </managedObject>
    <managedObject class="com.nokia.srbts.tnl:IPADDRESSV4" distName="MRBTS-${config.btsId}/TNLSVC-1/TNL-1/IPNO-1/IPIF-2/IPADDRESSV4-1" version="TNL20C_2007_002" operation="create">
      <p name="ipAddressAllocationMethod">MANUAL</p>
      <p name="localIpAddr">${config.ipConfig.managementIP}</p>
      <p name="localIpPrefixLength">${config.ipConfig.managementSubnet}</p>
    </managedObject>
    <managedObject class="com.nokia.srbts.tnl:IPIF" distName="MRBTS-${config.btsId}/TNLSVC-1/TNL-1/IPNO-1/IPIF-3" version="TNL20C_2007_002" operation="create">
      <p name="interfaceDN">MRBTS-${config.btsId}/TNLSVC-1/TNL-1/ETHSVC-1/ETHIF-1/VLANIF-2</p>
      <p name="ipMtu">1500</p>
    </managedObject>
    <managedObject class="com.nokia.srbts.tnl:IPADDRESSV4" distName="MRBTS-${config.btsId}/TNLSVC-1/TNL-1/IPNO-1/IPIF-3/IPADDRESSV4-1" version="TNL20C_2007_002" operation="create">
      <p name="ipAddressAllocationMethod">MANUAL</p>
      <p name="localIpAddr">${config.ipConfig.transportIP}</p>
      <p name="localIpPrefixLength">${config.ipConfig.transportSubnet}</p>
    </managedObject>
    <managedObject class="com.nokia.srbts.tnl:IPRT" distName="MRBTS-${config.btsId}/TNLSVC-1/TNL-1/IPNO-1/IPRT-1" version="TNL20C_2007_002" operation="create">
      <list name="staticRoutes">
        <item>
          <p name="destinationIpPrefixLength">0</p>
          <p name="destIpAddr">0.0.0.0</p>
          <p name="gateway">${config.ipConfig.managementGateway}</p>
          <p name="preference">1</p>
          <p name="preSrcIpv4Addr">${config.ipConfig.managementIP}</p>
          <p name="routeIpMtu">1500</p>
        </item>
      </list>
    </managedObject>
    <managedObject class="com.nokia.srbts.tnl:IPRT" distName="MRBTS-${config.btsId}/TNLSVC-1/TNL-1/IPNO-1/IPRT-2" version="TNL20C_2007_002" operation="create">
      <list name="staticRoutes">
        <item>
          <p name="destinationIpPrefixLength">0</p>
          <p name="destIpAddr">0.0.0.0</p>
          <p name="gateway">${config.ipConfig.transportGateway}</p>
          <p name="preference">1</p>
          <p name="preSrcIpv4Addr">${config.ipConfig.transportIP}</p>
          <p name="routeIpMtu">1500</p>
        </item>
      </list>
    </managedObject>
`;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Download XML configuration file
   */
  async downloadConfig(config: NokiaBaseStation, filename?: string): Promise<void> {
    const xml = await this.generateConfig(config);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `nokia-config-${config.btsName}-${Date.now()}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Validate configuration
   */
  validateConfig(config: NokiaBaseStation): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.btsId || !/^\d+$/.test(config.btsId)) {
      errors.push('BTS ID must be numeric');
    }

    if (!config.btsName || config.btsName.trim().length === 0) {
      errors.push('BTS name is required');
    }

    if (config.sectors.length === 0) {
      errors.push('At least one sector is required');
    }

    config.sectors.forEach((sector, idx) => {
      if (sector.carriers.length === 0) {
        errors.push(`Sector ${idx + 1} must have at least one carrier`);
      }

      sector.carriers.forEach((carrier, cIdx) => {
        if (carrier.pci < 0 || carrier.pci > 503) {
          errors.push(`Sector ${idx + 1}, Carrier ${cIdx + 1}: PCI must be between 0 and 503`);
        }

        if (carrier.earfcnDL < 55240 || carrier.earfcnDL > 56739) {
          errors.push(`Sector ${idx + 1}, Carrier ${cIdx + 1}: EARFCN DL must be in Band 48 range (55240-56739)`);
        }
      });
    });

    if (!this.isValidIP(config.ipConfig.managementIP)) {
      errors.push('Invalid management IP address');
    }

    if (!this.isValidIP(config.ipConfig.managementGateway)) {
      errors.push('Invalid management gateway');
    }

    if (!this.isValidIP(config.ipConfig.transportIP)) {
      errors.push('Invalid transport IP address');
    }

    if (!this.isValidIP(config.ipConfig.transportGateway)) {
      errors.push('Invalid transport gateway');
    }

    return { valid: errors.length === 0, errors };
  }

  private isValidIP(ip: string): boolean {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255 && part === num.toString();
    });
  }
}

export const nokiaService = new NokiaConfigService();

