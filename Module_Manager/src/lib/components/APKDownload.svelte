<script lang="ts">
  /**
   * APK Download Component
   * Provides download link for WISP Multitool mobile app
   */
  
  const APK_VERSION = '1.0.0';
  const APK_URL = 'https://firebasestorage.googleapis.com/v0/b/lte-pci-mapper-65450042-bbf71.appspot.com/o/mobile-app%2FWISP-Multitool-v1.0.0-release.apk?alt=media';
  const APK_SIZE = '~35 MB';
  
  let downloading = false;
  
  function handleDownload() {
    downloading = true;
    window.open(APK_URL, '_blank');
    setTimeout(() => {
      downloading = false;
    }, 2000);
  }
</script>

<div class="apk-download-card">
  <div class="apk-header">
    <span class="apk-icon">📱</span>
    <div class="apk-info">
      <h3>WISP Multitool Mobile App</h3>
      <p>Android field technician app</p>
    </div>
  </div>
  
  <div class="apk-details">
    <div class="detail-item">
      <span class="detail-label">Version:</span>
      <span class="detail-value">{APK_VERSION}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">Size:</span>
      <span class="detail-value">{APK_SIZE}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">Platform:</span>
      <span class="detail-value">Android 7.0+</span>
    </div>
  </div>
  
  <div class="apk-features">
    <h4>Features:</h4>
    <ul>
      <li>✅ Work order notifications</li>
      <li>✅ QR code scanner</li>
      <li>✅ GPS navigation</li>
      <li>✅ Inventory management</li>
      <li>✅ Equipment deployment</li>
    </ul>
  </div>
  
  <button class="download-btn" on:click={handleDownload} disabled={downloading}>
    {#if downloading}
      <span class="spinner-sm"></span>
      Opening...
    {:else}
      ⬇️ Download APK
    {/if}
  </button>
  
  <div class="install-instructions">
    <details>
      <summary>📖 Installation Instructions</summary>
      <ol>
        <li>Download the APK file</li>
        <li>Open the file on your Android device</li>
        <li>Allow "Install from unknown sources" if prompted</li>
        <li>Tap "Install"</li>
        <li>Open app and grant permissions (Camera, Location, Notifications)</li>
        <li>Login with your Google account</li>
        <li>Select your organization</li>
        <li>Start receiving work orders!</li>
      </ol>
    </details>
  </div>
</div>

<style>
  .apk-download-card {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    border: 2px solid #8b5cf6;
  }
  
  .apk-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .apk-icon {
    font-size: 3rem;
  }
  
  .apk-info h3 {
    margin: 0 0 0.25rem;
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  .apk-info p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
  
  .apk-details {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
  }
  
  .detail-item {
    text-align: center;
  }
  
  .detail-label {
    display: block;
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    margin-bottom: 0.25rem;
  }
  
  .detail-value {
    display: block;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .apk-features {
    margin-bottom: 1.5rem;
  }
  
  .apk-features h4 {
    margin: 0 0 0.75rem;
    font-size: 1rem;
    font-weight: 600;
  }
  
  .apk-features ul {
    margin: 0;
    padding-left: 1.5rem;
    list-style: none;
  }
  
  .apk-features li {
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
  }
  
  .download-btn {
    width: 100%;
    padding: 1rem;
    background: #8b5cf6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: all 0.2s;
  }
  
  .download-btn:hover:not(:disabled) {
    background: #7c3aed;
    transform: translateY(-2px);
  }
  
  .download-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .spinner-sm {
    width: 20px;
    height: 20px;
    border: 3px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .install-instructions {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
  }
  
  .install-instructions details {
    cursor: pointer;
  }
  
  .install-instructions summary {
    font-weight: 600;
    color: var(--text-primary);
    user-select: none;
  }
  
  .install-instructions ol {
    margin: 1rem 0 0;
    padding-left: 1.5rem;
  }
  
  .install-instructions li {
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
    line-height: 1.6;
  }
</style>

