<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { inventoryService } from '$lib/services/inventoryService';
  import { bundleService } from '$lib/services/bundleService';
  import { getApiUrl } from '$lib/config/api';
  
  export let show = false;
  
  const dispatch = createEventDispatcher();
  
  let loading = false;
  let error = '';
  let success = '';
  let importing = false;
  let importProgress = { current: 0, total: 0, type: '' };
  
  // Import configuration
  let selectedImportType: ImportType = 'inventory';
  let fileInput: HTMLInputElement;
  let uploadedFile: File | null = null;
  let parsedData: any[] = [];
  let previewData: any[] = [];
  let showPreview = false;
  let validationErrors: ValidationError[] = [];
  let importResults: ImportResult | null = null;
  
  type ImportType = 
    | 'inventory' 
    | 'customers' 
    | 'plans' 
    | 'sites' 
    | 'network-equipment' 
    | 'work-orders' 
    | 'users' 
    | 'bundles';
  
  interface ValidationError {
    row: number;
    field: string;
    message: string;
    value?: any;
  }
  
  interface ImportResult {
    imported: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
    warnings: Array<{ row: number; warning: string }>;
  }
  
  const importTypes: Array<{ value: ImportType; label: string; icon: string; description: string }> = [
    { value: 'inventory', label: 'Inventory Items', icon: '📦', description: 'Import hardware inventory items' },
    { value: 'customers', label: 'Customers', icon: '👥', description: 'Import customer records' },
    { value: 'plans', label: 'Plans/Projects', icon: '🗺️', description: 'Import deployment plans' },
    { value: 'sites', label: 'Sites/Towers', icon: '🏗️', description: 'Import tower sites' },
    { value: 'network-equipment', label: 'Network Equipment', icon: '📡', description: 'Import network equipment' },
    { value: 'work-orders', label: 'Work Orders', icon: '📋', description: 'Import work orders' },
    { value: 'users', label: 'Users', icon: '👤', description: 'Import user accounts' },
    { value: 'bundles', label: 'Hardware Bundles', icon: '📚', description: 'Import hardware bundles' }
  ];
  
  $: tenantId = $currentTenant?.id || '';
  
  function close() {
    show = false;
    reset();
    dispatch('close');
  }
  
  function reset() {
    uploadedFile = null;
    parsedData = [];
    previewData = [];
    showPreview = false;
    validationErrors = [];
    importResults = null;
    error = '';
    success = '';
    importing = false;
    importProgress = { current: 0, total: 0, type: '' };
    if (fileInput) {
      fileInput.value = '';
    }
  }
  
  function handleFileSelect() {
    fileInput?.click();
  }
  
  async function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (!file) return;
    
    uploadedFile = file;
    error = '';
    success = '';
    
    // Validate file type
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      error = `Invalid file type. Please upload a CSV or Excel file (.csv, .xlsx, .xls)`;
      uploadedFile = null;
      return;
    }
    
    // Parse file
    try {
      await parseFile(file);
    } catch (err: any) {
      error = err.message || 'Failed to parse file';
      uploadedFile = null;
    }
  }
  
  async function parseFile(file: File) {
    loading = true;
    error = '';
    
    try {
      const text = await file.text();
      
      if (file.name.endsWith('.csv')) {
        parsedData = parseCSV(text);
      } else {
        error = 'Excel files (.xlsx, .xls) require additional libraries. Please convert to CSV first.';
        loading = false;
        return;
      }
      
      if (parsedData.length === 0) {
        error = 'No data found in file. Please check the file format.';
        loading = false;
        return;
      }
      
      // Validate and preview
      await validateData();
      previewData = parsedData.slice(0, 10); // Show first 10 rows
      showPreview = true;
      
    } catch (err: any) {
      error = err.message || 'Failed to parse file';
      throw err;
    } finally {
      loading = false;
    }
  }
  
  function parseCSV(text: string): any[] {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row');
    }
    
    const headers = parseCSVLine(lines[0]);
    const data: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === 0 || values.every(v => !v.trim())) continue; // Skip empty rows
      
      const row: any = { _rowIndex: i + 1 };
      headers.forEach((header, index) => {
        row[header.trim()] = values[index]?.trim() || '';
      });
      data.push(row);
    }
    
    return data;
  }
  
  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }
  
  async function validateData() {
    validationErrors = [];
    
    // Basic validation based on import type
    switch (selectedImportType) {
      case 'inventory':
        validateInventoryData();
        break;
      case 'customers':
        validateCustomerData();
        break;
      case 'plans':
        validatePlanData();
        break;
      case 'sites':
        validateSiteData();
        break;
      case 'network-equipment':
        validateNetworkEquipmentData();
        break;
      case 'work-orders':
        validateWorkOrderData();
        break;
      case 'users':
        validateUserData();
        break;
      case 'bundles':
        validateBundleData();
        break;
    }
    
    return validationErrors.length === 0;
  }
  
  function validateInventoryData() {
    const requiredFields = ['serialNumber', 'category', 'equipmentType'];
    
    parsedData.forEach((row, index) => {
      requiredFields.forEach(field => {
        if (!row[field] || !row[field].trim()) {
          validationErrors.push({
            row: row._rowIndex || index + 2,
            field,
            message: `${field} is required`,
            value: row[field]
          });
        }
      });
      
      // Validate status
      if (row.status) {
        const validStatuses = ['available', 'deployed', 'reserved', 'in-transit', 'maintenance', 'rma', 'retired', 'lost', 'sold'];
        if (!validStatuses.includes(row.status.toLowerCase())) {
          validationErrors.push({
            row: row._rowIndex || index + 2,
            field: 'status',
            message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
            value: row.status
          });
        }
      }
      
      // Validate category
      if (row.category) {
        const validCategories = [
          'EPC Equipment', 'Radio Equipment', 'Antennas', 'Power Systems',
          'Networking Equipment', 'Transmission Equipment', 'Environmental Control',
          'Monitoring & Control', 'Structural & Housing', 'Test Equipment',
          'CPE Devices', 'SIM Cards', 'Cables & Accessories', 'Tools', 'Spare Parts', 'Other'
        ];
        if (!validCategories.includes(row.category)) {
          validationErrors.push({
            row: row._rowIndex || index + 2,
            field: 'category',
            message: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
            value: row.category
          });
        }
      }
    });
  }
  
  function validateCustomerData() {
    const requiredFields = ['firstName', 'lastName', 'primaryPhone'];
    
    parsedData.forEach((row, index) => {
      if (!row.isLead || row.isLead.toLowerCase() !== 'true') {
        requiredFields.forEach(field => {
          if (!row[field] || !row[field].trim()) {
            validationErrors.push({
              row: row._rowIndex || index + 2,
              field,
              message: `${field} is required for non-lead customers`,
              value: row[field]
            });
          }
        });
      }
      
      // Validate email format if provided
      if (row.email && !isValidEmail(row.email)) {
        validationErrors.push({
          row: row._rowIndex || index + 2,
          field: 'email',
          message: 'Invalid email format',
          value: row.email
        });
      }
    });
  }
  
  function validatePlanData() {
    const requiredFields = ['name'];
    
    parsedData.forEach((row, index) => {
      requiredFields.forEach(field => {
        if (!row[field] || !row[field].trim()) {
          validationErrors.push({
            row: row._rowIndex || index + 2,
            field,
            message: `${field} is required`,
            value: row[field]
          });
        }
      });
      
      // Validate status
      if (row.status) {
        const validStatuses = ['draft', 'active', 'ready', 'approved', 'authorized', 'rejected', 'deployed', 'cancelled'];
        if (!validStatuses.includes(row.status.toLowerCase())) {
          validationErrors.push({
            row: row._rowIndex || index + 2,
            field: 'status',
            message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
            value: row.status
          });
        }
      }
      
      // Validate coordinates if provided
      if (row.latitude && (isNaN(parseFloat(row.latitude)) || parseFloat(row.latitude) < -90 || parseFloat(row.latitude) > 90)) {
        validationErrors.push({
          row: row._rowIndex || index + 2,
          field: 'latitude',
          message: 'Invalid latitude. Must be between -90 and 90',
          value: row.latitude
        });
      }
      
      if (row.longitude && (isNaN(parseFloat(row.longitude)) || parseFloat(row.longitude) < -180 || parseFloat(row.longitude) > 180)) {
        validationErrors.push({
          row: row._rowIndex || index + 2,
          field: 'longitude',
          message: 'Invalid longitude. Must be between -180 and 180',
          value: row.longitude
        });
      }
    });
  }
  
  function validateSiteData() {
    const requiredFields = ['name', 'latitude', 'longitude'];
    
    parsedData.forEach((row, index) => {
      requiredFields.forEach(field => {
        if (!row[field] || !row[field].trim()) {
          validationErrors.push({
            row: row._rowIndex || index + 2,
            field,
            message: `${field} is required`,
            value: row[field]
          });
        }
      });
      
      // Validate coordinates
      if (row.latitude && (isNaN(parseFloat(row.latitude)) || parseFloat(row.latitude) < -90 || parseFloat(row.latitude) > 90)) {
        validationErrors.push({
          row: row._rowIndex || index + 2,
          field: 'latitude',
          message: 'Invalid latitude. Must be between -90 and 90',
          value: row.latitude
        });
      }
      
      if (row.longitude && (isNaN(parseFloat(row.longitude)) || parseFloat(row.longitude) < -180 || parseFloat(row.longitude) > 180)) {
        validationErrors.push({
          row: row._rowIndex || index + 2,
          field: 'longitude',
          message: 'Invalid longitude. Must be between -180 and 180',
          value: row.longitude
        });
      }
    });
  }
  
  function validateNetworkEquipmentData() {
    const requiredFields = ['name', 'hardware_type'];
    
    parsedData.forEach((row, index) => {
      requiredFields.forEach(field => {
        if (!row[field] || !row[field].trim()) {
          validationErrors.push({
            row: row._rowIndex || index + 2,
            field,
            message: `${field} is required`,
            value: row[field]
          });
        }
      });
    });
  }
  
  function validateWorkOrderData() {
    const requiredFields = ['title', 'type'];
    
    parsedData.forEach((row, index) => {
      requiredFields.forEach(field => {
        if (!row[field] || !row[field].trim()) {
          validationErrors.push({
            row: row._rowIndex || index + 2,
            field,
            message: `${field} is required`,
            value: row[field]
          });
        }
      });
    });
  }
  
  function validateUserData() {
    const requiredFields = ['email'];
    
    parsedData.forEach((row, index) => {
      requiredFields.forEach(field => {
        if (!row[field] || !row[field].trim()) {
          validationErrors.push({
            row: row._rowIndex || index + 2,
            field,
            message: `${field} is required`,
            value: row[field]
          });
        }
      });
      
      // Validate email format
      if (row.email && !isValidEmail(row.email)) {
        validationErrors.push({
          row: row._rowIndex || index + 2,
          field: 'email',
          message: 'Invalid email format',
          value: row.email
        });
      }
    });
  }
  
  function validateBundleData() {
    const requiredFields = ['name'];
    
    parsedData.forEach((row, index) => {
      requiredFields.forEach(field => {
        if (!row[field] || !row[field].trim()) {
          validationErrors.push({
            row: row._rowIndex || index + 2,
            field,
            message: `${field} is required`,
            value: row[field]
          });
        }
      });
    });
  }
  
  function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  function downloadTemplate() {
    const templates: Record<ImportType, string> = {
      inventory: getInventoryTemplate(),
      customers: getCustomerTemplate(),
      plans: getPlanTemplate(),
      sites: getSiteTemplate(),
      'network-equipment': getNetworkEquipmentTemplate(),
      'work-orders': getWorkOrderTemplate(),
      users: getUserTemplate(),
      bundles: getBundleTemplate()
    };
    
    const template = templates[selectedImportType];
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedImportType}-import-template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  function getInventoryTemplate(): string {
    return `serialNumber,category,equipmentType,manufacturer,model,assetTag,barcode,qrCode,status,condition,currentLocation.type,currentLocation.warehouse.name,notes
SN123456789,Radio Equipment,Base Station (eNodeB/gNodeB),Ubiquiti,AirFiber 5X,AT-001,BC-001,QR-001,available,new,warehouse,Main Warehouse,Test item
SN123456790,Antennas,Sector Antenna,Ubiquiti,AF-5XHD-23,AT-002,,,available,new,warehouse,Main Warehouse,`;
  }
  
  function getCustomerTemplate(): string {
    return `customerId,firstName,lastName,email,primaryPhone,serviceAddress.street,serviceAddress.city,serviceAddress.state,serviceAddress.zipCode,serviceAddress.latitude,serviceAddress.longitude,serviceStatus,isLead
CUST-001,John,Doe,john@example.com,555-1234,123 Main St,City,ST,12345,40.7128,-74.0060,active,false
CUST-002,Jane,Smith,jane@example.com,555-5678,456 Oak Ave,City,ST,12346,40.7130,-74.0062,pending,false`;
  }
  
  function getPlanTemplate(): string {
    return `name,description,status,location.addressLine1,location.city,location.state,location.postalCode,location.latitude,location.longitude,marketing.targetRadiusMiles
Project Alpha,Deployment project for Alpha area,draft,789 Main St,City,ST,12345,40.7128,-74.0060,5
Project Beta,Deployment project for Beta area,active,321 Elm St,City,ST,12346,40.7130,-74.0062,10`;
  }
  
  function getSiteTemplate(): string {
    return `name,type,latitude,longitude,address.street,address.city,address.state,address.zipCode,altitude,towerHeight
Site Alpha,tower,40.7128,-74.0060,123 Main St,City,ST,12345,100,150
Site Beta,tower,40.7130,-74.0062,456 Oak Ave,City,ST,12346,120,175`;
  }
  
  function getNetworkEquipmentTemplate(): string {
    return `name,hardware_type,siteId,status,config,notes
Radio 1,radio,site-id-1,deployed,{"frequency":"2500","power":"20"},Main site radio
Router 1,router,site-id-1,deployed,{"ip":"192.168.1.1"},Core router`;
  }
  
  function getWorkOrderTemplate(): string {
    return `title,type,status,priority,customerId,siteId,scheduledDate,dueDate,description
Install CPE,installation,pending,high,customer-id-1,site-id-1,2025-01-15,2025-01-20,Install customer CPE
Maintain Tower,maintenance,scheduled,medium,,site-id-1,2025-01-10,2025-01-10,Quarterly maintenance`;
  }
  
  function getUserTemplate(): string {
    return `email,displayName,role,status
user1@example.com,User One,admin,active
user2@example.com,User Two,viewer,active`;
  }
  
  function getBundleTemplate(): string {
    return `name,description,bundleType,status,items,tags
Standard Site Kit,Standard deployment bundle,site-deployment,active,"[{""category"":""Radio Equipment"",""equipmentType"":""Base Station"",""quantity"":1}]",standard
CPE Installation Kit,CPE installation bundle,cpe-installation,active,"[{""category"":""CPE Devices"",""equipmentType"":""LTE CPE"",""quantity"":1}]",cpe`;
  }
  
  async function performImport() {
    if (!parsedData || parsedData.length === 0) {
      error = 'No data to import';
      return;
    }
    
    if (!tenantId || tenantId.trim() === '') {
      error = 'No tenant selected. Please select a tenant before importing.';
      return;
    }
    
    if (validationErrors.length > 0) {
      error = `Please fix ${validationErrors.length} validation error(s) before importing`;
      return;
    }
    
    importing = true;
    error = '';
    success = '';
    importResults = null;
    
    try {
      importProgress = { current: 0, total: parsedData.length, type: selectedImportType };
      
      // Prepare data for import
      const dataToImport = parsedData.map(row => {
        const { _rowIndex, ...item } = row;
        return item;
      });
      
      let result: ImportResult;
      
      switch (selectedImportType) {
        case 'inventory':
          result = await importInventory(dataToImport);
          break;
        case 'customers':
          result = await importCustomers(dataToImport);
          break;
        case 'plans':
          result = await importPlans(dataToImport);
          break;
        case 'sites':
          result = await importSites(dataToImport);
          break;
        case 'network-equipment':
          result = await importNetworkEquipment(dataToImport);
          break;
        case 'work-orders':
          result = await importWorkOrders(dataToImport);
          break;
        case 'users':
          result = await importUsers(dataToImport);
          break;
        case 'bundles':
          result = await importBundles(dataToImport);
          break;
        default:
          throw new Error('Unknown import type');
      }
      
      importResults = result;
      
      if (result.failed === 0) {
        success = `Successfully imported ${result.imported} ${selectedImportType} item(s)`;
      } else {
        success = `Imported ${result.imported} item(s), ${result.failed} failed`;
      }
      
      // Auto-close after 3 seconds if all successful
      if (result.failed === 0) {
        setTimeout(() => {
          close();
        }, 3000);
      }
      
    } catch (err: any) {
      error = err.message || 'Import failed';
      console.error('Import error:', err);
    } finally {
      importing = false;
      importProgress = { current: 0, total: 0, type: '' };
    }
  }
  
  async function importInventory(items: any[]): Promise<ImportResult> {
    const result: ImportResult = {
      imported: 0,
      failed: 0,
      errors: [],
      warnings: []
    };
    
    try {
      const response = await inventoryService.bulkImport(items);
      result.imported = response.imported || items.length;
      return result;
    } catch (err: any) {
      result.failed = items.length;
      result.errors = items.map((_, index) => ({
        row: index + 2,
        error: err.message || 'Import failed'
      }));
      throw err;
    }
  }
  
  async function importCustomers(items: any[]): Promise<ImportResult> {
    const result: ImportResult = {
      imported: 0,
      failed: 0,
      errors: [],
      warnings: []
    };
    
    try {
      const apiUrl = getApiUrl('CUSTOMERS');
      const token = await getAuthToken();
      
      const response = await fetch(`${apiUrl}/bulk-import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId
        },
        body: JSON.stringify({ items })
      });
      
      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      result.imported = data.imported || items.length;
      return result;
    } catch (err: any) {
      result.failed = items.length;
      result.errors = items.map((_, index) => ({
        row: index + 2,
        error: err.message || 'Import failed'
      }));
      throw err;
    }
  }
  
  async function importPlans(items: any[]): Promise<ImportResult> {
    const result: ImportResult = {
      imported: 0,
      failed: 0,
      errors: [],
      warnings: []
    };
    
    // Import plans one by one for better error handling
    const { planService } = await import('$lib/services/planService');
    
    for (let i = 0; i < items.length; i++) {
      try {
        await planService.createPlan(items[i]);
        result.imported++;
        importProgress.current = i + 1;
      } catch (err: any) {
        result.failed++;
        result.errors.push({
          row: i + 2,
          error: err.message || 'Failed to import'
        });
      }
    }
    
    return result;
  }
  
  async function importSites(items: any[]): Promise<ImportResult> {
    const result: ImportResult = {
      imported: 0,
      failed: 0,
      errors: [],
      warnings: []
    };
    
    try {
      const apiUrl = getApiUrl('NETWORK');
      const token = await getAuthToken();
      
      const response = await fetch(`${apiUrl}/sites/bulk-import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId
        },
        body: JSON.stringify({ sites: items })
      });
      
      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      result.imported = data.imported || items.length;
      return result;
    } catch (err: any) {
      result.failed = items.length;
      result.errors = items.map((_, index) => ({
        row: index + 2,
        error: err.message || 'Import failed'
      }));
      throw err;
    }
  }
  
  async function importNetworkEquipment(items: any[]): Promise<ImportResult> {
    const result: ImportResult = {
      imported: 0,
      failed: 0,
      errors: [],
      warnings: []
    };
    
    try {
      const apiUrl = getApiUrl('NETWORK');
      const token = await getAuthToken();
      
      const response = await fetch(`${apiUrl}/equipment/bulk-import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId
        },
        body: JSON.stringify({ equipment: items })
      });
      
      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      result.imported = data.imported || items.length;
      return result;
    } catch (err: any) {
      result.failed = items.length;
      result.errors = items.map((_, index) => ({
        row: index + 2,
        error: err.message || 'Import failed'
      }));
      throw err;
    }
  }
  
  async function importWorkOrders(items: any[]): Promise<ImportResult> {
    const result: ImportResult = {
      imported: 0,
      failed: 0,
      errors: [],
      warnings: []
    };
    
    try {
      const apiUrl = getApiUrl('WORK_ORDERS') || '/api/work-orders';
      const token = await getAuthToken();
      
      const response = await fetch(`${apiUrl}/bulk-import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId
        },
        body: JSON.stringify({ workOrders: items })
      });
      
      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      result.imported = data.imported || items.length;
      return result;
    } catch (err: any) {
      result.failed = items.length;
      result.errors = items.map((_, index) => ({
        row: index + 2,
        error: err.message || 'Import failed'
      }));
      throw err;
    }
  }
  
  async function importUsers(items: any[]): Promise<ImportResult> {
    const result: ImportResult = {
      imported: 0,
      failed: 0,
      errors: [],
      warnings: []
    };
    
    try {
      const apiUrl = getApiUrl('USERS') || '/api/users';
      const token = await getAuthToken();
      
      const response = await fetch(`${apiUrl}/bulk-import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId
        },
        body: JSON.stringify({ users: items })
      });
      
      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      result.imported = data.imported || items.length;
      return result;
    } catch (err: any) {
      result.failed = items.length;
      result.errors = items.map((_, index) => ({
        row: index + 2,
        error: err.message || 'Import failed'
      }));
      throw err;
    }
  }
  
  async function importBundles(items: any[]): Promise<ImportResult> {
    const result: ImportResult = {
      imported: 0,
      failed: 0,
      errors: [],
      warnings: []
    };
    
    // Import bundles one by one
    for (let i = 0; i < items.length; i++) {
      try {
        // Parse items field if it's a string
        if (typeof items[i].items === 'string') {
          items[i].items = JSON.parse(items[i].items);
        }
        
        // Parse tags if it's a string
        if (typeof items[i].tags === 'string') {
          items[i].tags = items[i].tags.split(',').map((t: string) => t.trim()).filter(Boolean);
        }
        
        await bundleService.createBundle(items[i]);
        result.imported++;
        importProgress.current = i + 1;
      } catch (err: any) {
        result.failed++;
        result.errors.push({
          row: i + 2,
          error: err.message || 'Failed to import'
        });
      }
    }
    
    return result;
  }
  
  async function getAuthToken(): Promise<string> {
    const { auth } = await import('$lib/firebase');
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }
    return await currentUser.getIdToken();
  }
  
  function getTableHeaders(): string[] {
    if (parsedData.length === 0) return [];
    return Object.keys(parsedData[0]).filter(key => key !== '_rowIndex');
  }
  
  function cancelImport() {
    showPreview = false;
    reset();
  }
</script>

{#if show}
  {#if !tenantId || tenantId.trim() === ''}
    <div class="import-overlay" on:click={close}>
      <div class="import-panel" on:click|stopPropagation>
        <div class="import-header">
          <h2>📥 Import Data</h2>
          <button class="close-btn" on:click={close}>✕</button>
        </div>
        <div class="import-content">
          <div class="alert alert-error">
            <span>❌</span>
            <span>No tenant selected. Please select a tenant before importing data.</span>
          </div>
          <div class="import-actions">
            <button class="btn-primary" on:click={close}>Close</button>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="import-overlay" on:click={close}>
      <div class="import-panel" on:click|stopPropagation>
      <div class="import-header">
        <h2>📥 Import Data</h2>
        <button class="close-btn" on:click={close}>✕</button>
      </div>
      
      <div class="import-content">
        {#if error}
          <div class="alert alert-error">
            <span>❌</span>
            <span>{error}</span>
            <button on:click={() => error = ''}>✕</button>
          </div>
        {/if}
        
        {#if success}
          <div class="alert alert-success">
            <span>✓</span>
            <span>{success}</span>
            <button on:click={() => success = ''}>✕</button>
          </div>
        {/if}
        
        {#if !showPreview && !importing}
          <!-- Step 1: Select Import Type -->
          <div class="import-step">
            <h3>1. Select Data Type to Import</h3>
            <p class="step-description">Choose the type of data you want to import</p>
            
            <div class="import-types-grid">
              {#each importTypes as type}
                <button
                  class="import-type-card"
                  class:active={selectedImportType === type.value}
                  on:click={() => selectedImportType = type.value}
                >
                  <span class="icon">{type.icon}</span>
                  <span class="label">{type.label}</span>
                  <span class="description">{type.description}</span>
                </button>
              {/each}
            </div>
          </div>
          
          <!-- Step 2: Download Template or Upload File -->
          <div class="import-step">
            <h3>2. Prepare Your Data</h3>
            <p class="step-description">Download a template or upload your CSV file</p>
            
            <div class="template-actions">
              <button class="btn-download" on:click={downloadTemplate}>
                📄 Download CSV Template
              </button>
            </div>
            
            <div class="upload-section">
              {#if !uploadedFile}
                <div class="dropzone" on:click={handleFileSelect}>
                  <div class="dropzone-content">
                    <span class="dropzone-icon">📁</span>
                    <p>Click to select CSV file</p>
                    <p class="hint">or drag and drop</p>
                    <p class="file-types">Supported: .csv</p>
                  </div>
                </div>
                <input
                  bind:this={fileInput}
                  type="file"
                  accept=".csv"
                  on:change={handleFileChange}
                  style="display: none;"
                />
              {:else}
                <div class="file-selected">
                  <span class="file-icon">📄</span>
                  <div class="file-info">
                    <span class="file-name">{uploadedFile.name}</span>
                    <span class="file-size">({(uploadedFile.size / 1024).toFixed(2)} KB)</span>
                  </div>
                  <button class="btn-remove" on:click={reset}>✕</button>
                </div>
              {/if}
              
              {#if loading}
                <div class="loading-indicator">
                  <div class="spinner"></div>
                  <p>Parsing file...</p>
                </div>
              {/if}
            </div>
          </div>
        {/if}
        
        <!-- Step 3: Preview and Validate -->
        {#if showPreview && !importing}
          <div class="import-step">
            <h3>3. Review & Import</h3>
            <p class="step-description">Review your data and fix any errors before importing</p>
            
            <div class="preview-stats">
              <div class="stat">
                <span class="stat-label">Total Rows:</span>
                <span class="stat-value">{parsedData.length}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Preview:</span>
                <span class="stat-value">First {previewData.length} rows</span>
              </div>
              {#if validationErrors.length > 0}
                <div class="stat error-stat">
                  <span class="stat-label">Errors:</span>
                  <span class="stat-value">{validationErrors.length}</span>
                </div>
              {/if}
            </div>
            
            {#if validationErrors.length > 0}
              <div class="validation-errors">
                <h4>Validation Errors</h4>
                <div class="errors-list">
                  {#each validationErrors.slice(0, 10) as err}
                    <div class="error-item">
                      <span class="error-row">Row {err.row}</span>
                      <span class="error-field">{err.field}:</span>
                      <span class="error-message">{err.message}</span>
                      {#if err.value}
                        <span class="error-value">(Value: {err.value})</span>
                      {/if}
                    </div>
                  {/each}
                  {#if validationErrors.length > 10}
                    <p class="more-errors">... and {validationErrors.length - 10} more errors</p>
                  {/if}
                </div>
              </div>
            {/if}
            
            <div class="preview-table">
              <div class="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      {#each getTableHeaders() as header}
                        <th>{header}</th>
                      {/each}
                    </tr>
                  </thead>
                  <tbody>
                    {#each previewData as row}
                      <tr>
                        {#each getTableHeaders() as header}
                          <td>{row[header] || '-'}</td>
                        {/each}
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div class="import-actions">
              <button class="btn-secondary" on:click={cancelImport}>
                Cancel
              </button>
              <button
                class="btn-primary"
                on:click={performImport}
                disabled={validationErrors.length > 0}
              >
                {validationErrors.length > 0
                  ? `Fix ${validationErrors.length} Error(s) First`
                  : `Import ${parsedData.length} Item(s)`
                }
              </button>
            </div>
          </div>
        {/if}
        
        <!-- Step 4: Import Progress -->
        {#if importing}
          <div class="import-step">
            <h3>4. Importing...</h3>
            
            <div class="import-progress">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  style="width: {importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%"
                ></div>
              </div>
              <div class="progress-text">
                {importProgress.current} of {importProgress.total} items imported
              </div>
            </div>
          </div>
        {/if}
        
        <!-- Step 5: Import Results -->
        {#if importResults && !importing}
          <div class="import-step">
            <h3>5. Import Complete</h3>
            
            <div class="import-results">
              <div class="result-stat success-stat">
                <span class="result-icon">✓</span>
                <span class="result-label">Imported:</span>
                <span class="result-value">{importResults.imported}</span>
              </div>
              {#if importResults.failed > 0}
                <div class="result-stat error-stat">
                  <span class="result-icon">✕</span>
                  <span class="result-label">Failed:</span>
                  <span class="result-value">{importResults.failed}</span>
                </div>
              {/if}
            </div>
            
            {#if importResults.errors && importResults.errors.length > 0}
              <div class="import-errors">
                <h4>Import Errors</h4>
                <div class="errors-list">
                  {#each importResults.errors.slice(0, 10) as err}
                    <div class="error-item">
                      <span class="error-row">Row {err.row}:</span>
                      <span class="error-message">{err.error}</span>
                    </div>
                  {/each}
                  {#if importResults.errors.length > 10}
                    <p class="more-errors">... and {importResults.errors.length - 10} more errors</p>
                  {/if}
                </div>
              </div>
            {/if}
            
            <div class="import-actions">
              <button class="btn-primary" on:click={close}>
                Close
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
  {/if}
{/if}

<style>
  .import-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    padding: 1rem;
    backdrop-filter: blur(4px);
  }
  
  .import-panel {
    background: var(--card-bg, var(--bg-primary));
    border-radius: 12px;
    box-shadow: var(--shadow-xl);
    width: 100%;
    max-width: 900px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: var(--text-primary);
  }
  
  .import-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }
  
  .import-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text-primary);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    transition: all 0.2s;
  }
  
  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  
  .import-content {
    flex: 1;
    overflow-y: auto;
    padding: 2rem;
  }
  
  .alert {
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .alert-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    color: #ef4444;
  }
  
  .alert-success {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid #10b981;
    color: #10b981;
  }
  
  .alert button {
    margin-left: auto;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    opacity: 0.5;
  }
  
  .alert button:hover {
    opacity: 1;
  }
  
  .import-step {
    margin-bottom: 2rem;
  }
  
  .import-step h3 {
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
    color: var(--text-primary);
  }
  
  .step-description {
    color: var(--text-secondary);
    margin: 0 0 1.5rem;
    font-size: 0.95rem;
  }
  
  .import-types-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .import-type-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1.5rem 1rem;
    border: 2px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-secondary);
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
  }
  
  .import-type-card:hover {
    border-color: var(--primary);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
  
  .import-type-card.active {
    border-color: var(--primary);
    background: var(--primary-light, rgba(59, 130, 246, 0.1));
  }
  
  .import-type-card .icon {
    font-size: 2rem;
  }
  
  .import-type-card .label {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 1rem;
  }
  
  .import-type-card .description {
    font-size: 0.75rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }
  
  .template-actions {
    margin-bottom: 1.5rem;
  }
  
  .btn-download {
    padding: 0.75rem 1.5rem;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-download:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  .upload-section {
    margin-top: 1.5rem;
  }
  
  .dropzone {
    border: 2px dashed var(--border-color);
    border-radius: 0.75rem;
    padding: 3rem 2rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    background: var(--bg-secondary);
  }
  
  .dropzone:hover {
    border-color: var(--primary);
    background: var(--bg-tertiary);
  }
  
  .dropzone-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  
  .dropzone-icon {
    font-size: 3rem;
    opacity: 0.5;
  }
  
  .dropzone p {
    margin: 0;
    color: var(--text-primary);
    font-weight: 500;
  }
  
  .dropzone .hint {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
  
  .dropzone .file-types {
    color: var(--text-secondary);
    font-size: 0.75rem;
    margin-top: 0.5rem;
  }
  
  .file-selected {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--bg-secondary);
  }
  
  .file-icon {
    font-size: 2rem;
  }
  
  .file-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .file-name {
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .file-size {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  
  .btn-remove {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    transition: all 0.2s;
  }
  
  .btn-remove:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  
  .loading-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .preview-stats {
    display: flex;
    gap: 2rem;
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
  }
  
  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .stat-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .stat-value {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .error-stat .stat-value {
    color: #ef4444;
  }
  
  .validation-errors,
  .import-errors {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: rgba(239, 68, 68, 0.05);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 0.5rem;
  }
  
  .validation-errors h4,
  .import-errors h4 {
    margin: 0 0 0.75rem;
    color: #ef4444;
    font-size: 1rem;
  }
  
  .errors-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
  }
  
  .error-item {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 0.25rem;
    font-size: 0.875rem;
    flex-wrap: wrap;
  }
  
  .error-row {
    font-weight: 600;
    color: #ef4444;
  }
  
  .error-field {
    color: var(--text-primary);
    font-weight: 500;
  }
  
  .error-message {
    color: var(--text-secondary);
  }
  
  .error-value {
    color: var(--text-secondary);
    font-style: italic;
  }
  
  .more-errors {
    margin: 0.5rem 0 0;
    padding: 0.5rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.875rem;
    font-style: italic;
  }
  
  .preview-table {
    margin-bottom: 1.5rem;
  }
  
  .table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
  }
  
  .preview-table table {
    width: 100%;
    border-collapse: collapse;
    background: var(--bg-primary);
  }
  
  .preview-table thead {
    background: var(--bg-tertiary);
    position: sticky;
    top: 0;
  }
  
  .preview-table th {
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-primary);
    border-bottom: 2px solid var(--border-color);
    white-space: nowrap;
  }
  
  .preview-table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
    font-size: 0.875rem;
    white-space: nowrap;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .preview-table tbody tr:hover {
    background: var(--bg-secondary);
  }
  
  .import-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
  }
  
  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--primary);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--bg-tertiary);
  }
  
  .import-progress {
    margin-top: 1.5rem;
  }
  
  .progress-bar {
    width: 100%;
    height: 24px;
    background: var(--bg-secondary);
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }
  
  .progress-fill {
    height: 100%;
    background: var(--primary);
    transition: width 0.3s ease;
    border-radius: 12px;
  }
  
  .progress-text {
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
  
  .import-results {
    display: flex;
    gap: 2rem;
    margin-bottom: 1.5rem;
    padding: 1.5rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
  }
  
  .result-stat {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
  }
  
  .result-icon {
    font-size: 1.5rem;
  }
  
  .result-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
  
  .result-value {
    margin-left: auto;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
  }
  
  .success-stat .result-icon {
    color: #10b981;
  }
  
  .success-stat .result-value {
    color: #10b981;
  }
  
  .error-stat .result-icon {
    color: #ef4444;
  }
  
  .error-stat .result-value {
    color: #ef4444;
  }
  
  @media (max-width: 768px) {
    .import-panel {
      max-width: 100%;
      max-height: 100vh;
      border-radius: 0;
    }
    
    .import-types-grid {
      grid-template-columns: 1fr;
    }
    
    .import-actions {
      flex-direction: column;
    }
    
    .import-actions button {
      width: 100%;
    }
  }
</style>

