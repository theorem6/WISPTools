<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { apiService } from '$lib/services/apiService';
  import { authService } from '$lib/services/authService';

  let files: any[] = [];
  let isLoading = true;
  let error = '';
  let success = '';
  let tenantName = '';
  
  // Upload state
  let isUploading = false;
  let uploadFile: File | null = null;
  let uploadFileType = 'firmware';
  let uploadDescription = '';
  
  // Delete confirmation
  let deleteConfirmFile: string | null = null;

  const fileTypes = [
    { value: 'firmware', label: '1 Firmware Upgrade Image', description: 'Device firmware/software upgrade' },
    { value: 'config', label: '3 Vendor Configuration File', description: 'Device configuration backup/restore' },
    { value: 'web-content', label: '2 Web Content', description: 'Web UI or content files' },
    { value: 'vendor-log', label: '4 Vendor Log File', description: 'Log files' }
  ];

  onMount(async () => {
    if (!browser) return;

    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      await goto('/login');
      return;
    }

    // Check if user is system admin
    const { isPlatformAdmin } = await import('$lib/services/adminService');
    const isAdmin = isPlatformAdmin(currentUser.email || '');
    
    const tenantId = localStorage.getItem('selectedTenantId') || '';
    tenantName = localStorage.getItem('selectedTenantName') || 'Organization';

    // System admins can access without tenant, but show a message
    if (!tenantId && !isAdmin) {
      error = 'No tenant selected. Please select a tenant.';
      setTimeout(() => goto('/tenant-selector'), 2000);
      isLoading = false;
      return;
    }

    if (!tenantId && isAdmin) {
      error = 'System Admin: Please select a tenant to manage files';
      isLoading = false;
      return;
    }

    await loadFiles();
    isLoading = false;
  });

  async function loadFiles() {
    try {
      // In production, this would call GenieACS FS to list files
      // For now, we'll show placeholder with instructions
      files = [];
    } catch (err: any) {
      error = err.message || 'Failed to load files';
    }
  }

  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      uploadFile = target.files[0];
    }
  }

  async function handleUpload() {
    if (!uploadFile) {
      error = 'Please select a file to upload';
      return;
    }

    isUploading = true;
    error = '';

    try {
      // Upload file to GenieACS File Server
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('fileType', uploadFileType);
      formData.append('description', uploadDescription);

      // This would upload to Firebase Function that proxies to GenieACS FS
      const response = await fetch('/api/genieacs-fs/upload', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        success = `File "${uploadFile.name}" uploaded successfully!`;
        uploadFile = null;
        uploadDescription = '';
        await loadFiles();
      } else {
        error = 'Upload failed';
      }
    } catch (err: any) {
      error = err.message || 'Failed to upload file';
    } finally {
      isUploading = false;
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  function getFileTypeLabel(type: string): string {
    const found = fileTypes.find(ft => ft.value === type);
    return found ? found.label : type;
  }
</script>

<div class="files-page">
  <div class="page-header">
    <div>
      <button class="back-btn" on:click={() => goto('/modules/acs-cpe-management')}>
        ← Back to ACS Management
      </button>
      <h1>📁 File Management</h1>
      <p class="subtitle">{tenantName} - Firmware & Configuration Files</p>
    </div>
  </div>

  {#if error}
    <div class="error-message">
      <span>⚠️</span>
      <span>{error}</span>
      <button class="dismiss-btn" on:click={() => error = ''}>✕</button>
    </div>
  {/if}

  {#if success}
    <div class="success-message">
      <span>✅</span>
      <span>{success}</span>
      <button class="dismiss-btn" on:click={() => success = ''}>✕</button>
    </div>
  {/if}

  <!-- Upload Section -->
  <div class="upload-section">
    <h2>📤 Upload File</h2>
    <p class="section-subtitle">Upload firmware images or configuration files for CPE devices</p>

    <div class="upload-form">
      <div class="form-group">
        <label for="file-input">Select File</label>
        <input
          id="file-input"
          type="file"
          on:change={handleFileSelect}
          accept=".bin,.img,.tar,.gz,.zip,.xml,.json"
        />
        {#if uploadFile}
          <p class="file-info">
            Selected: <strong>{uploadFile.name}</strong> ({formatFileSize(uploadFile.size)})
          </p>
        {/if}
      </div>

      <div class="form-group">
        <label for="file-type">File Type</label>
        <select id="file-type" bind:value={uploadFileType}>
          {#each fileTypes as type}
            <option value={type.value}>{type.label}</option>
          {/each}
        </select>
        <p class="help-text">TR-069 FileType parameter for Download RPC</p>
      </div>

      <div class="form-group">
        <label for="description">Description (Optional)</label>
        <input
          id="description"
          type="text"
          bind:value={uploadDescription}
          placeholder="e.g., Firmware v2.4.1 for Nokia devices"
        />
      </div>

      <button 
        class="btn-primary" 
        on:click={handleUpload}
        disabled={!uploadFile || isUploading}
      >
        {#if isUploading}
          <span class="spinner"></span>
          Uploading...
        {:else}
          📤 Upload File
        {/if}
      </button>
    </div>
  </div>

  <!-- TR-069 Download Method Info -->
  <div class="info-panel">
    <h2>📚 TR-069 Firmware Upgrade Methods</h2>
    
    <div class="method-card recommended">
      <div class="method-header">
        <h3>✅ Recommended: URL-based Download</h3>
        <span class="badge">Best Practice</span>
      </div>
      <p>Use TR-069 <code>Download</code> RPC with file URL from GenieACS File Server</p>
      
      <div class="method-details">
        <h4>How it Works:</h4>
        <ol>
          <li>Upload firmware file to File Server (this page)</li>
          <li>File stored in GenieACS FS (MongoDB GridFS)</li>
          <li>System generates URL: <code>http://your-domain.com/fs/{'{filename}'}</code></li>
          <li>Create Download task in Presets or manually</li>
          <li>CPE downloads file from URL and installs</li>
        </ol>

        <h4>Task Parameters:</h4>
        <div class="code-block">
          Task Name: download<br/>
          File Type: 1 (Firmware Upgrade Image)<br/>
          URL: http://your-domain.com/fs/firmware-v2.4.1.bin<br/>
          Username: (optional - if auth required)<br/>
          Password: (optional - if auth required)
        </div>

        <h4>Advantages:</h4>
        <ul>
          <li>✅ Standardized TR-069 method</li>
          <li>✅ Works with all TR-069 compliant devices</li>
          <li>✅ Can use HTTPS for security</li>
          <li>✅ Progress tracking available</li>
          <li>✅ Can schedule downloads</li>
        </ul>
      </div>
    </div>

    <div class="method-card">
      <div class="method-header">
        <h3>Alternative: ScheduleDownload RPC</h3>
      </div>
      <p>Schedule firmware download for specific time (maintenance window)</p>
      
      <div class="method-details">
        <h4>Use Case:</h4>
        <p>When you want to upgrade devices at night or during low-traffic periods</p>
        
        <h4>Parameters:</h4>
        <ul>
          <li>FileType, URL (same as Download)</li>
          <li>TimeWindow: Start and end time</li>
          <li>CPE downloads during specified window</li>
        </ul>
      </div>
    </div>

    <div class="method-card">
      <div class="method-header">
        <h3>Vendor Specific Methods</h3>
      </div>
      <p>Some vendors (Huawei, Nokia, ZTE) have custom upgrade methods</p>
      
      <div class="method-details">
        <h4>Examples:</h4>
        <ul>
          <li>X_HUAWEI_Download</li>
          <li>X_NOKIA_SoftwareUpgrade</li>
          <li>X_ZTE_FirmwareUpgrade</li>
        </ul>
        
        <p class="warning">⚠️ Not recommended - vendor lock-in and not standardized</p>
      </div>
    </div>
  </div>

  <!-- Quick Start Guide -->
  <div class="info-panel">
    <h2>🚀 Quick Start: Firmware Upgrade</h2>
    
    <div class="steps-grid">
      <div class="step-card">
        <div class="step-number">1</div>
        <h3>Upload Firmware</h3>
        <p>Upload firmware file using the form above</p>
      </div>

      <div class="step-card">
        <div class="step-number">2</div>
        <h3>Note the URL</h3>
        <p>File Server URL: <code>http://domain:7567/{'{filename}'}</code></p>
      </div>

      <div class="step-card">
        <div class="step-number">3</div>
        <h3>Create Preset or Task</h3>
        <p>Go to Presets/Admin → Create Download task</p>
      </div>

      <div class="step-card">
        <div class="step-number">4</div>
        <h3>Apply to Devices</h3>
        <p>Task executes on next device inform</p>
      </div>
    </div>
  </div>

  <!-- Current Implementation Notice -->
  <div class="notice-panel">
    <h3>🔧 Implementation Status</h3>
    <p><strong>File Server Setup Required:</strong></p>
    <ul>
      <li>GenieACS File Server must be running on backend</li>
      <li>Configure <code>FS_HOSTNAME</code> in GenieACS config</li>
      <li>Ensure port 7567 is accessible</li>
      <li>Files stored in MongoDB GridFS per tenant</li>
    </ul>
    
    <p><strong>For Now:</strong></p>
    <p>You can manually upload files to the GenieACS File Server via:</p>
    <div class="code-block">
      # Via HTTP PUT<br/>
      curl -T firmware.bin http://your-server:7567/firmware-v2.4.1.bin
    </div>
    
    <p>Then use the URL in Download tasks: <code>http://your-server:7567/firmware-v2.4.1.bin</code></p>
  </div>
</div>

<style>
  .files-page {
    min-height: 100vh;
    background: var(--bg-primary);
    padding: 2rem;
  }

  .page-header {
    max-width: 1400px;
    margin: 0 auto 2rem;
  }

  .back-btn {
    background: none;
    border: none;
    color: var(--brand-primary);
    cursor: pointer;
    font-size: 0.875rem;
    margin-bottom: 1rem;
    padding: 0.5rem 0;
  }

  .back-btn:hover {
    text-decoration: underline;
  }

  h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: var(--text-secondary);
  }

  .error-message, .success-message {
    max-width: 1400px;
    margin: 0 auto 1.5rem;
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .error-message {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .success-message {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }

  .dismiss-btn {
    margin-left: auto;
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: inherit;
    opacity: 0.7;
    padding: 0.25rem;
  }

  .dismiss-btn:hover {
    opacity: 1;
  }

  .upload-section, .info-panel, .notice-panel {
    max-width: 1400px;
    margin: 0 auto 2rem;
    background: var(--card-bg);
    border-radius: 1rem;
    padding: 2rem;
    border: 1px solid var(--border-color);
  }

  .section-subtitle {
    color: var(--text-secondary);
    margin-bottom: 1.5rem;
  }

  .upload-form {
    display: grid;
    gap: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .form-group input[type="file"],
  .form-group input[type="text"],
  .form-group select {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .file-info {
    margin-top: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .help-text {
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .btn-primary {
    padding: 0.875rem 1.5rem;
    background: var(--brand-primary);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--brand-primary-hover);
    transform: translateY(-2px);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .method-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.75rem;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .method-card.recommended {
    border: 2px solid #22c55e;
    background: rgba(34, 197, 94, 0.05);
  }

  .method-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .method-header h3 {
    margin: 0;
    font-size: 1.25rem;
  }

  .badge {
    padding: 0.25rem 0.75rem;
    background: #22c55e;
    color: white;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .method-details {
    margin-top: 1rem;
  }

  .method-details h4 {
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    font-size: 1rem;
  }

  .method-details ol, .method-details ul {
    padding-left: 1.5rem;
    color: var(--text-secondary);
  }

  .method-details li {
    margin-bottom: 0.5rem;
  }

  .code-block {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1rem;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    margin: 0.5rem 0;
    line-height: 1.6;
  }

  code {
    background: var(--bg-primary);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    color: var(--brand-primary);
  }

  .warning {
    color: #f59e0b;
    font-weight: 500;
  }

  .steps-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin-top: 1.5rem;
  }

  .step-card {
    text-align: center;
    padding: 1.5rem;
    background: var(--bg-secondary);
    border-radius: 0.75rem;
    border: 1px solid var(--border-color);
  }

  .step-number {
    width: 40px;
    height: 40px;
    background: var(--brand-primary);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0 auto 1rem;
  }

  .step-card h3 {
    font-size: 1rem;
    margin-bottom: 0.5rem;
  }

  .step-card p {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .notice-panel {
    background: rgba(251, 191, 36, 0.05);
    border-color: rgba(251, 191, 36, 0.3);
  }

  .notice-panel h3 {
    margin-bottom: 1rem;
  }

  .notice-panel ul {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
    color: var(--text-secondary);
  }

  .notice-panel li {
    margin-bottom: 0.5rem;
  }

  @media (max-width: 768px) {
    .files-page {
      padding: 1rem;
    }

    .steps-grid {
      grid-template-columns: 1fr;
    }
  }
</style>