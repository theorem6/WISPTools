<!-- CPE Performance Metrics Modal -->
<!-- Displays detailed performance data when a CPE device is clicked -->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { CPEDevice } from '$lib/genieacs/models/cpeDevice';
  import type { CPEPerformanceData } from '$lib/genieacs/mappers/enhancedArcGISMapper';

  export let cpeDevice: CPEDevice | null = null;
  export let isOpen: boolean = false;
  export let onClose: () => void = () => {};

  let performanceData: CPEPerformanceData | null = null;
  let loading = false;
  let error: string | null = null;
  let signalChart: HTMLCanvasElement;
  let bandwidthChart: HTMLCanvasElement;
  let latencyChart: HTMLCanvasElement;
  let signalChartInstance: any = null;
  let bandwidthChartInstance: any = null;
  let latencyChartInstance: any = null;

  // Chart.js will be loaded dynamically
  let Chart: any = null;

  // Watch for device changes
  $: if (cpeDevice && isOpen) {
    loadPerformanceData();
  }

  // Watch for modal open/close
  $: if (!isOpen) {
    cleanup();
  }

  onMount(async () => {
    // Dynamically import Chart.js
    try {
      const chartModule = await import('chart.js/auto');
      Chart = chartModule.default ?? chartModule.Chart;
    } catch (err) {
      console.error('Failed to load Chart.js:', err);
    }
  });

  onDestroy(() => {
    cleanup();
  });

  async function loadPerformanceData() {
    if (!cpeDevice) return;

    loading = true;
    error = null;

    try {
      // TODO: Replace with actual API call to get performance data
      // For now, use the device's current performance metrics
      performanceData = {
        deviceId: cpeDevice.id,
        signalStrength: cpeDevice.performanceMetrics.signalStrength,
        bandwidth: cpeDevice.performanceMetrics.bandwidth,
        latency: cpeDevice.performanceMetrics.latency,
        packetLoss: cpeDevice.performanceMetrics.packetLoss,
        uptime: cpeDevice.performanceMetrics.uptime,
        timestamp: cpeDevice.performanceMetrics.lastUpdate
      };

      // Initialize charts after a short delay to ensure DOM is ready
      setTimeout(() => {
        initializeCharts();
      }, 100);

    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load performance data';
      console.error('Error loading performance data:', err);
    } finally {
      loading = false;
    }
  }

  function initializeCharts() {
    if (!Chart || !performanceData) return;

    // Initialize signal strength chart
    if (signalChart && !signalChartInstance) {
      signalChartInstance = new Chart(signalChart, {
        type: 'line',
        data: {
          labels: ['Current'],
          datasets: [{
            label: 'Signal Strength (dBm)',
            data: [performanceData.signalStrength],
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: false,
              title: {
                display: true,
                text: 'dBm'
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    }

    // Initialize bandwidth chart
    if (bandwidthChart && !bandwidthChartInstance) {
      bandwidthChartInstance = new Chart(bandwidthChart, {
        type: 'bar',
        data: {
          labels: ['Current'],
          datasets: [{
            label: 'Bandwidth (Mbps)',
            data: [performanceData.bandwidth],
            backgroundColor: 'rgba(34, 197, 94, 0.8)',
            borderColor: 'rgb(34, 197, 94)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Mbps'
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    }

    // Initialize latency chart
    if (latencyChart && !latencyChartInstance) {
      latencyChartInstance = new Chart(latencyChart, {
        type: 'line',
        data: {
          labels: ['Current'],
          datasets: [{
            label: 'Latency (ms)',
            data: [performanceData.latency],
            borderColor: 'rgb(245, 158, 11)',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            tension: 0.1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'ms'
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    }
  }

  function cleanup() {
    if (signalChartInstance) {
      signalChartInstance.destroy();
      signalChartInstance = null;
    }
    if (bandwidthChartInstance) {
      bandwidthChartInstance.destroy();
      bandwidthChartInstance = null;
    }
    if (latencyChartInstance) {
      latencyChartInstance.destroy();
      latencyChartInstance = null;
    }
  }

  function formatUptime(uptimeSeconds: number): string {
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  function getSignalStrengthColor(strength: number): string {
    if (strength >= -50) return 'text-green-600';
    if (strength >= -60) return 'text-green-500';
    if (strength >= -70) return 'text-yellow-500';
    if (strength >= -80) return 'text-orange-500';
    return 'text-red-500';
  }

  function getSignalStrengthLabel(strength: number): string {
    if (strength >= -50) return 'Excellent';
    if (strength >= -60) return 'Good';
    if (strength >= -70) return 'Fair';
    if (strength >= -80) return 'Poor';
    return 'Very Poor';
  }

  function handleClose() {
    onClose();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }
</script>

{#if isOpen && cpeDevice}
  <div 
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    on:click={handleBackdropClick}
    role="dialog"
    aria-modal="true"
    aria-labelledby="cpe-modal-title"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <div>
          <h2 id="cpe-modal-title" class="text-xl font-semibold text-gray-900">
            CPE Performance Metrics
          </h2>
          <p class="text-sm text-gray-600 mt-1">
            {cpeDevice.deviceId.manufacturer} {cpeDevice.deviceId.productClass}
          </p>
          <p class="text-xs text-gray-500">
            Serial: {cpeDevice.deviceId.serialNumber}
          </p>
        </div>
        <button
          on:click={handleClose}
          class="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close modal"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
        {#if loading}
          <div class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span class="ml-2 text-gray-600">Loading performance data...</span>
          </div>
        {:else if error}
          <div class="bg-red-50 border border-red-200 rounded-md p-4">
            <div class="flex">
              <svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
              </svg>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800">Error loading performance data</h3>
                <p class="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        {:else if performanceData}
          <!-- Device Status -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-gray-50 rounded-lg p-4">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="w-3 h-3 rounded-full {cpeDevice.status === 'online' ? 'bg-green-400' : cpeDevice.status === 'offline' ? 'bg-red-400' : 'bg-gray-400'}"></div>
                </div>
                <div class="ml-3">
                  <p class="text-sm font-medium text-gray-900">Status</p>
                  <p class="text-sm text-gray-600 capitalize">{cpeDevice.status}</p>
                </div>
              </div>
            </div>

            <div class="bg-gray-50 rounded-lg p-4">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path>
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm font-medium text-gray-900">Location</p>
                  <p class="text-sm text-gray-600">
                    {performanceData.timestamp.toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div class="bg-gray-50 rounded-lg p-4">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path>
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm font-medium text-gray-900">Last Update</p>
                  <p class="text-sm text-gray-600">
                    {performanceData.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Performance Metrics Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <!-- Signal Strength -->
            <div class="bg-white border border-gray-200 rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-600">Signal Strength</p>
                  <p class="text-2xl font-semibold {getSignalStrengthColor(performanceData.signalStrength)}">
                    {performanceData.signalStrength} dBm
                  </p>
                  <p class="text-xs text-gray-500">{getSignalStrengthLabel(performanceData.signalStrength)}</p>
                </div>
                <div class="flex-shrink-0">
                  <svg class="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"></path>
                  </svg>
                </div>
              </div>
            </div>

            <!-- Bandwidth -->
            <div class="bg-white border border-gray-200 rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-600">Bandwidth</p>
                  <p class="text-2xl font-semibold text-blue-600">
                    {performanceData.bandwidth} Mbps
                  </p>
                </div>
                <div class="flex-shrink-0">
                  <svg class="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                  </svg>
                </div>
              </div>
            </div>

            <!-- Latency -->
            <div class="bg-white border border-gray-200 rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-600">Latency</p>
                  <p class="text-2xl font-semibold text-orange-600">
                    {performanceData.latency} ms
                  </p>
                </div>
                <div class="flex-shrink-0">
                  <svg class="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path>
                  </svg>
                </div>
              </div>
            </div>

            <!-- Uptime -->
            <div class="bg-white border border-gray-200 rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-600">Uptime</p>
                  <p class="text-2xl font-semibold text-green-600">
                    {formatUptime(performanceData.uptime)}
                  </p>
                </div>
                <div class="flex-shrink-0">
                  <svg class="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Charts -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Signal Strength Chart -->
            <div class="bg-white border border-gray-200 rounded-lg p-4">
              <h3 class="text-lg font-medium text-gray-900 mb-4">Signal Strength Trend</h3>
              <div class="h-48">
                <canvas bind:this={signalChart}></canvas>
              </div>
            </div>

            <!-- Bandwidth Chart -->
            <div class="bg-white border border-gray-200 rounded-lg p-4">
              <h3 class="text-lg font-medium text-gray-900 mb-4">Bandwidth Usage</h3>
              <div class="h-48">
                <canvas bind:this={bandwidthChart}></canvas>
              </div>
            </div>

            <!-- Latency Chart -->
            <div class="bg-white border border-gray-200 rounded-lg p-4">
              <h3 class="text-lg font-medium text-gray-900 mb-4">Latency Trend</h3>
              <div class="h-48">
                <canvas bind:this={latencyChart}></canvas>
              </div>
            </div>

            <!-- Additional Info -->
            <div class="bg-white border border-gray-200 rounded-lg p-4">
              <h3 class="text-lg font-medium text-gray-900 mb-4">Device Information</h3>
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">IP Address:</span>
                  <span class="text-sm font-medium">{cpeDevice.networkInfo.ipAddress}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">MAC Address:</span>
                  <span class="text-sm font-medium">{cpeDevice.networkInfo.macAddress}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Connection Type:</span>
                  <span class="text-sm font-medium capitalize">{cpeDevice.networkInfo.connectionType}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Software Version:</span>
                  <span class="text-sm font-medium">{cpeDevice.softwareVersion || 'Unknown'}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Hardware Version:</span>
                  <span class="text-sm font-medium">{cpeDevice.hardwareVersion || 'Unknown'}</span>
                </div>
                {#if cpeDevice.location.accuracy}
                  <div class="flex justify-between">
                    <span class="text-sm text-gray-600">GPS Accuracy:</span>
                    <span class="text-sm font-medium">{cpeDevice.location.accuracy}m</span>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end px-6 py-3 bg-gray-50 border-t border-gray-200">
        <button
          on:click={handleClose}
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Custom styles for the modal */
  .performance-popup {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  .metric {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .metric:last-child {
    border-bottom: none;
  }
  
  .metric .label {
    font-weight: 500;
    color: #374151;
  }
  
  .metric .value {
    font-weight: 600;
    color: #1f2937;
  }
</style>
