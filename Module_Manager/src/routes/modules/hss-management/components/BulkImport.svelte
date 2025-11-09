<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let tenantId: string;
  export let HSS_API: string;
  
  const dispatch = createEventDispatcher();
  
  let fileInput: HTMLInputElement;
  let uploading = false;
  let uploadResult: any = null;
  let csvData: any[] = [];
  let showPreview = false;

  const csvTemplate = `imsi,msisdn,full_name,ki,opc,qci,group_id,bandwidth_plan_id
310150123456789,15551234567,John Doe,00112233445566778899AABBCCDDEEFF,63BFA50EE6523365FF14C1F45F88737D,9,group_residential,plan_gold
310150123456790,15551234568,Jane Smith,FFEEDDCCBBAA998877665544332211,8E27B6AF0E692E750F32667A3B14605D,9,group_business,plan_silver`;

  function downloadTemplate() {
    const blob = new Blob([csvTemplate], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subscriber_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function triggerFileSelect() {
    fileInput.click();
  }

  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const text = await file.text();
    parseCsv(text);
  }

  function parseCsv(csvText: string) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    csvData = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      csvData.push(row);
    }
    
    showPreview = true;
    uploadResult = null;
  }

  async function uploadSubscribers() {
    if (csvData.length === 0) return;
    
    uploading = true;
    uploadResult = null;

    try {
      const response = await fetch(`${HSS_API}/subscribers/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({ subscribers: csvData })
      });

      if (response.ok) {
        uploadResult = await response.json();
        csvData = [];
        showPreview = false;
        dispatch('imported');
      } else {
        const error = await response.text();
        uploadResult = { success: false, error };
      }
    } catch (error: unknown) {
      console.error('Error uploading subscribers:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      uploadResult = { success: false, error: message };
    }
    
    uploading = false;
  }

  function cancelUpload() {
    csvData = [];
    showPreview = false;
    uploadResult = null;
  }
</script>

<div class="bulk-import">
  <div class="header">
    <h2>Bulk Import Subscribers</h2>
    <button class="btn-template" on:click={downloadTemplate}>
      📥 Download CSV Template
    </button>
  </div>

  <div class="upload-section">
    <div class="instructions">
      <h3>Import Instructions:</h3>
      <ol>
        <li>Download the CSV template above</li>
        <li>Fill in subscriber details (IMSI, Ki, OPc are required)</li>
        <li>Upload the CSV file below</li>
        <li>Review the preview and confirm import</li>
      </ol>
      
      <div class="field-guide">
        <h4>Required Fields:</h4>
        <ul>
          <li><strong>imsi</strong>: 15-digit IMSI (e.g., 310150123456789)</li>
          <li><strong>ki</strong>: 32-character hex key (e.g., 00112233...EEFF)</li>
          <li><strong>opc</strong>: 32-character hex OP/OPc key</li>
        </ul>
        <h4>Optional Fields:</h4>
        <ul>
          <li><strong>msisdn</strong>: Phone number</li>
          <li><strong>full_name</strong>: Subscriber name</li>
          <li><strong>qci</strong>: QoS Class Identifier (default: 9)</li>
          <li><strong>group_id</strong>: Subscriber group</li>
          <li><strong>bandwidth_plan_id</strong>: Bandwidth plan</li>
        </ul>
      </div>
    </div>

    {#if !showPreview}
      <div class="dropzone" on:click={triggerFileSelect}>
        <div class="dropzone-content">
          <div class="icon">📄</div>
          <p>Click to select CSV file</p>
          <p class="hint">or drag and drop</p>
        </div>
      </div>
      <input 
        type="file" 
        bind:this={fileInput}
        on:change={handleFileSelect}
        accept=".csv"
        style="display: none;"
      />
    {/if}
  </div>

  {#if showPreview && csvData.length > 0}
    <div class="preview-section">
      <div class="preview-header">
        <h3>Preview: {csvData.length} subscribers</h3>
        <button class="btn-cancel" on:click={cancelUpload}>Cancel</button>
      </div>

      <div class="preview-table">
        <table>
          <thead>
            <tr>
              <th>IMSI</th>
              <th>MSISDN</th>
              <th>Name</th>
              <th>QCI</th>
              <th>Group</th>
              <th>Plan</th>
            </tr>
          </thead>
          <tbody>
            {#each csvData.slice(0, 10) as subscriber}
              <tr>
                <td>{subscriber.imsi}</td>
                <td>{subscriber.msisdn || '-'}</td>
                <td>{subscriber.full_name || '-'}</td>
                <td>{subscriber.qci || 9}</td>
                <td>{subscriber.group_id || '-'}</td>
                <td>{subscriber.bandwidth_plan_id || '-'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if csvData.length > 10}
          <p class="more-rows">... and {csvData.length - 10} more rows</p>
        {/if}
      </div>

      <button 
        class="btn-upload" 
        on:click={uploadSubscribers}
        disabled={uploading}
      >
        {uploading ? 'Uploading...' : `Import ${csvData.length} Subscribers`}
      </button>
    </div>
  {/if}

  {#if uploadResult}
    <div class="result {uploadResult.success === false ? 'error' : 'success'}">
      {#if uploadResult.success === false}
        <h3>❌ Import Failed</h3>
        <p>{uploadResult.error}</p>
      {:else}
        <h3>✅ Import Successful!</h3>
        <p>Successfully imported {uploadResult.imported || csvData.length} subscribers</p>
        {#if uploadResult.errors && uploadResult.errors.length > 0}
          <details>
            <summary>{uploadResult.errors.length} errors</summary>
            <ul>
              {#each uploadResult.errors as error}
                <li>{error}</li>
              {/each}
            </ul>
          </details>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .bulk-import {
    padding: 2rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #1a202c;
  }

  .btn-template {
    background: #10b981;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
  }

  .btn-template:hover {
    background: #059669;
  }

  .upload-section {
    margin-bottom: 2rem;
  }

  .instructions {
    background: #f8fafc;
    padding: 1.5rem;
    border-radius: 8px;
    margin-bottom: 2rem;
  }

  .instructions h3 {
    margin-top: 0;
    color: #1a202c;
  }

  .instructions ol {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }

  .field-guide {
    margin-top: 1.5rem;
    font-size: 0.875rem;
  }

  .field-guide h4 {
    margin: 1rem 0 0.5rem 0;
    color: #334155;
  }

  .field-guide ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .field-guide li {
    margin: 0.25rem 0;
    color: #64748b;
  }

  .dropzone {
    border: 2px dashed #cbd5e1;
    border-radius: 8px;
    padding: 3rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .dropzone:hover {
    border-color: #3b82f6;
    background: #f8fafc;
  }

  .dropzone-content .icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .dropzone-content p {
    margin: 0.5rem 0;
    color: #334155;
    font-weight: 500;
  }

  .dropzone-content .hint {
    font-size: 0.875rem;
    color: #64748b;
  }

  .preview-section {
    margin-top: 2rem;
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .preview-header h3 {
    margin: 0;
    color: #1a202c;
  }

  .btn-cancel {
    background: #ef4444;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-cancel:hover {
    background: #dc2626;
  }

  .preview-table {
    overflow-x: auto;
    margin-bottom: 1.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
  }

  th {
    background: #f8fafc;
    font-weight: 600;
    color: #334155;
    font-size: 0.875rem;
  }

  td {
    font-size: 0.875rem;
    color: #64748b;
  }

  .more-rows {
    padding: 1rem;
    text-align: center;
    color: #64748b;
    font-size: 0.875rem;
    margin: 0;
    background: #f8fafc;
  }

  .btn-upload {
    width: 100%;
    background: #3b82f6;
    color: white;
    border: none;
    padding: 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
  }

  .btn-upload:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-upload:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .result {
    margin-top: 2rem;
    padding: 1.5rem;
    border-radius: 8px;
  }

  .result.success {
    background: #d1fae5;
    border: 1px solid #10b981;
  }

  .result.error {
    background: #fee2e2;
    border: 1px solid #ef4444;
  }

  .result h3 {
    margin-top: 0;
  }

  .result.success h3 {
    color: #065f46;
  }

  .result.error h3 {
    color: #991b1b;
  }

  details {
    margin-top: 1rem;
  }

  summary {
    cursor: pointer;
    font-weight: 500;
    color: #334155;
  }

  details ul {
    margin-top: 0.5rem;
    padding-left: 1.5rem;
  }

  details li {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0.25rem 0;
  }
</style>



