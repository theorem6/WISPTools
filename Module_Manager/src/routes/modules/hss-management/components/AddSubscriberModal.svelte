<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let tenantId: string;
  export let HSS_API: string;
  export let groups: any[] = [];
  export let bandwidthPlans: any[] = [];
  
  const dispatch = createEventDispatcher();
  
  // Subscriber form data (Open5GS HSS compatible)
  let formData = {
    imsi: '',
    msisdn: '',
    ki: '',
    opc: '',
    amf: '8000', // Default AMF
    sqn: '000000000000', // Default SQN
    qci: 9, // Default QCI
    apn: 'internet', // Default APN
    
    // Additional fields
    subscriber_name: '',
    email: '',
    group_id: '',
    bandwidth_plan_id: '',
    
    // QoS settings
    max_bandwidth_ul: 100, // Mbps
    max_bandwidth_dl: 100, // Mbps
    
    // Network slice settings (5G)
    slice_id: 1,
    service_type: 1,
    
    // Status
    enabled: true
  };
  
  let loading = false;
  let error = '';
  
  async function handleSubmit() {
    // Validation
    if (!formData.imsi || formData.imsi.length < 15) {
      error = 'IMSI must be 15 digits';
      return;
    }
    if (!formData.ki || formData.ki.length !== 32) {
      error = 'Ki must be 32 hex characters';
      return;
    }
    if (!formData.opc || formData.opc.length !== 32) {
      error = 'OPc must be 32 hex characters';
      return;
    }
    if (!formData.subscriber_name) {
      error = 'Subscriber name is required';
      return;
    }
    if (!formData.group_id) {
      error = 'Please select a group';
      return;
    }
    if (!formData.bandwidth_plan_id) {
      error = 'Please select a bandwidth plan';
      return;
    }
    
    loading = true;
    error = '';
    
    try {
      const response = await fetch(`${HSS_API}/subscribers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add subscriber');
      }
      
      dispatch('success');
      close();
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
  
  function generateRandomHex(length: number) {
    const chars = '0123456789ABCDEF';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  function generateKi() {
    formData.ki = generateRandomHex(32);
  }
  
  function generateOPc() {
    formData.opc = generateRandomHex(32);
  }
  
  function close() {
    dispatch('close');
  }
</script>

<div class="modal-overlay" on:click={close}>
  <div class="modal" on:click|stopPropagation>
    <div class="modal-header">
      <h2>🔐 Add New Subscriber</h2>
      <button class="close-btn" on:click={close}>✕</button>
    </div>
    
    <form on:submit|preventDefault={handleSubmit}>
      {#if error}
        <div class="error-message">⚠️ {error}</div>
      {/if}
      
      <!-- Basic Information -->
      <div class="section">
        <h3>📱 Basic Information</h3>
        
        <div class="form-group">
          <label for="imsi">IMSI <span class="required">*</span></label>
          <input 
            id="imsi"
            type="text" 
            bind:value={formData.imsi}
            placeholder="e.g., 001010000000001"
            maxlength="15"
            pattern="[0-9]{15}"
            required
          />
          <small>15-digit International Mobile Subscriber Identity</small>
        </div>
        
        <div class="form-group">
          <label for="msisdn">MSISDN (Phone Number)</label>
          <input 
            id="msisdn"
            type="text" 
            bind:value={formData.msisdn}
            placeholder="e.g., +1234567890"
            maxlength="15"
          />
          <small>Optional: Mobile Station ISDN Number</small>
        </div>
        
        <div class="form-group">
          <label for="subscriber_name">Subscriber Name <span class="required">*</span></label>
          <input 
            id="subscriber_name"
            type="text" 
            bind:value={formData.subscriber_name}
            placeholder="John Doe"
            required
          />
        </div>
        
        <div class="form-group">
          <label for="email">Email</label>
          <input 
            id="email"
            type="email" 
            bind:value={formData.email}
            placeholder="user@example.com"
          />
        </div>
      </div>
      
      <!-- Security Credentials -->
      <div class="section">
        <h3>🔒 Security Credentials (3GPP Milenage)</h3>
        
        <div class="form-group">
          <label for="ki">Ki (Authentication Key) <span class="required">*</span></label>
          <div class="input-with-button">
            <input 
              id="ki"
              type="text" 
              bind:value={formData.ki}
              placeholder="32 hex characters"
              maxlength="32"
              pattern="[0-9A-Fa-f]{32}"
              required
            />
            <button type="button" class="gen-btn" on:click={generateKi}>🎲 Generate</button>
          </div>
          <small>128-bit key in hex format</small>
        </div>
        
        <div class="form-group">
          <label for="opc">OPc (Operator Code) <span class="required">*</span></label>
          <div class="input-with-button">
            <input 
              id="opc"
              type="text" 
              bind:value={formData.opc}
              placeholder="32 hex characters"
              maxlength="32"
              pattern="[0-9A-Fa-f]{32}"
              required
            />
            <button type="button" class="gen-btn" on:click={generateOPc}>🎲 Generate</button>
          </div>
          <small>128-bit operator variant key in hex format</small>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="amf">AMF (Authentication Management Field)</label>
            <input 
              id="amf"
              type="text" 
              bind:value={formData.amf}
              placeholder="8000"
              maxlength="4"
              pattern="[0-9A-Fa-f]{4}"
            />
            <small>16-bit value (hex)</small>
          </div>
          
          <div class="form-group">
            <label for="sqn">SQN (Sequence Number)</label>
            <input 
              id="sqn"
              type="text" 
              bind:value={formData.sqn}
              placeholder="000000000000"
              maxlength="12"
              pattern="[0-9A-Fa-f]{12}"
            />
            <small>48-bit value (hex)</small>
          </div>
        </div>
      </div>
      
      <!-- Network Settings -->
      <div class="section">
        <h3>🌐 Network Settings</h3>
        
        <div class="form-row">
          <div class="form-group">
            <label for="qci">QCI (QoS Class Identifier)</label>
            <select id="qci" bind:value={formData.qci}>
              <option value={5}>5 - IMS Signaling</option>
              <option value={9}>9 - Default Bearer (Internet)</option>
              <option value={6}>6 - Video (buffered streaming)</option>
              <option value={7}>7 - Voice, video (live streaming)</option>
              <option value={8}>8 - Video (buffered streaming)</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="apn">APN (Access Point Name)</label>
            <input 
              id="apn"
              type="text" 
              bind:value={formData.apn}
              placeholder="internet"
            />
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="max_bandwidth_ul">Max Upload (Mbps)</label>
            <input 
              id="max_bandwidth_ul"
              type="number" 
              bind:value={formData.max_bandwidth_ul}
              min="1"
              max="10000"
            />
          </div>
          
          <div class="form-group">
            <label for="max_bandwidth_dl">Max Download (Mbps)</label>
            <input 
              id="max_bandwidth_dl"
              type="number" 
              bind:value={formData.max_bandwidth_dl}
              min="1"
              max="10000"
            />
          </div>
        </div>
      </div>
      
      <!-- Group & Plan Assignment -->
      <div class="section">
        <h3>👥 Group & Bandwidth Plan <span class="required">*</span></h3>
        
        <div class="form-group">
          <label for="group_id">Subscriber Group <span class="required">*</span></label>
          <select id="group_id" bind:value={formData.group_id} required>
            <option value="">-- Select Group --</option>
            {#each groups as group}
              <option value={group.group_id}>{group.name} ({group.member_count || 0} members)</option>
            {/each}
          </select>
          <small>Groups help organize subscribers</small>
        </div>
        
        <div class="form-group">
          <label for="bandwidth_plan_id">Bandwidth Plan <span class="required">*</span></label>
          <select id="bandwidth_plan_id" bind:value={formData.bandwidth_plan_id} required>
            <option value="">-- Select Plan --</option>
            {#each bandwidthPlans as plan}
              <option value={plan.plan_id}>
                {plan.name} - ⬆️{plan.upload_mbps}Mbps / ⬇️{plan.download_mbps}Mbps
              </option>
            {/each}
          </select>
          <small>Bandwidth plans control speed limits</small>
        </div>
      </div>
      
      <!-- Status -->
      <div class="section">
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={formData.enabled} />
            <span>Enable subscriber immediately</span>
          </label>
          <small>Uncheck to add subscriber in disabled state</small>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="modal-actions">
        <button type="button" class="btn-secondary" on:click={close} disabled={loading}>
          Cancel
        </button>
        <button type="submit" class="btn-primary" disabled={loading}>
          {loading ? '⏳ Adding...' : '✅ Add Subscriber'}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }
  
  .modal {
    background: var(--card-bg, white);
    border-radius: 12px;
    max-width: 800px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
    position: sticky;
    top: 0;
    background: var(--card-bg, white);
    z-index: 10;
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  
  form {
    padding: 2rem;
  }
  
  .section {
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }
  
  .section:last-of-type {
    border-bottom: none;
  }
  
  .section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: var(--text-primary);
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  
  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .required {
    color: #ef4444;
  }
  
  input[type="text"],
  input[type="email"],
  input[type="number"],
  select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color, #d0d0d0);
    border-radius: 6px;
    font-size: 0.95rem;
    transition: all 0.2s;
    background: var(--input-bg, white);
    color: var(--text-primary);
  }
  
  input:focus,
  select:focus {
    outline: none;
    border-color: var(--brand-primary, #2563eb);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }
  
  small {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  
  .input-with-button {
    display: flex;
    gap: 0.5rem;
  }
  
  .input-with-button input {
    flex: 1;
  }
  
  .gen-btn {
    padding: 0.75rem 1rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
  }
  
  .gen-btn:hover {
    background: var(--bg-hover);
    transform: translateY(-1px);
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }
  
  .checkbox-label input[type="checkbox"] {
    width: auto;
    cursor: pointer;
  }
  
  .error-message {
    padding: 1rem;
    background: #fee;
    border: 1px solid #fcc;
    border-radius: 6px;
    color: #c33;
    margin-bottom: 1rem;
  }
  
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
  }
  
  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }
  
  .btn-primary {
    background: var(--brand-primary, #2563eb);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--brand-primary-dark, #1d4ed8);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  }
  
  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-hover);
  }
  
  .btn-primary:disabled,
  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    .modal {
      width: 95%;
      max-height: 95vh;
    }
    
    form {
      padding: 1rem;
    }
    
    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>



