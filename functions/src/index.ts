// Firebase Functions - Main Entry Point
// Combines PCI analysis and GenieACS integration

import { onRequest } from 'firebase-functions/v2/https';
import cors from 'cors';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin
import { initializeApp } from 'firebase-admin/app';
initializeApp();

const corsHandler = cors({ origin: true });
const db = getFirestore();

// PCI Analysis Function (existing)
export const analyzePCI = onRequest({
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 30
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const { cells } = req.body;
      
      if (!cells || !Array.isArray(cells)) {
        return res.status(400).json({ error: 'Invalid cells data' });
      }

      // Analyze PCI conflicts (simplified version)
      const conflicts = analyzeConflictsSimple(cells);
      
      // Save analysis to Firestore
      const analysisRef = await db.collection('pci_analyses').add({
        cells: cells,
        conflicts: conflicts,
        timestamp: FieldValue.serverTimestamp(),
        cellCount: cells.length,
        conflictCount: conflicts.length
      });

      return res.json({
        analysisId: analysisRef.id,
        conflicts: conflicts,
        summary: {
          totalCells: cells.length,
          totalConflicts: conflicts.length,
          criticalConflicts: conflicts.filter(c => c.severity === 'CRITICAL').length
        }
      });
    } catch (error) {
      console.error('PCI Analysis Error:', error);
      return res.status(500).json({ error: 'Analysis failed' });
    }
  });
});

// Export GenieACS bridge functions (connects to real GenieACS)
export {
  proxyGenieACSNBI,
  syncGenieACSDevices,
  getDeviceParameters,
  executeDeviceTask,
  getDevicePerformanceMetrics
} from './genieacsBridge.js';

// Export simplified GenieACS integration functions (Firestore only - fallback)
export {
  syncCPEDevices,
  getCPEDevices,
  getCPEDevice,
  updateCPELocation,
  getCPEPerformanceMetrics
} from './simpleGenieacsIntegration.js';

// Export simplified GenieACS core services (placeholders)
export {
  genieacsCWMP,
  genieacsNBI,
  genieacsFS,
  genieacsUI
} from './simpleGenieacsServices.js';

// Export clean presets management functions
export {
  getPresets,
  createPreset,
  deletePreset,
  initializeSamplePresets
} from './cleanPresetsManagement.js';

// Export provisions management functions (disabled for now - TypeScript errors)
// export {
//   getProvisions,
//   createProvision,
//   updateProvision,
//   deleteProvision,
//   initializeSampleProvisions
// } from './provisionsManagement';

// Export faults management functions (disabled for now - TypeScript errors)
// export {
//   getFaults,
//   getFault,
//   createFault,
//   resolveFault,
//   initializeSampleFaults
// } from './faultsManagement';

// Simple PCI conflict detection function (existing)
function analyzeConflictsSimple(cells: any[]) {
  const conflicts: any[] = [];
  
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const cell1 = cells[i];
      const cell2 = cells[j];
      
      // Check for PCI conflicts
      if (cell1.pci === cell2.pci) {
        conflicts.push({
          type: 'COLLISION',
          severity: 'CRITICAL',
          cell1: cell1,
          cell2: cell2,
          distance: calculateDistance(cell1, cell2)
        });
      }
      
      // Check for Mod3 conflicts
      if (cell1.pci % 3 === cell2.pci % 3) {
        conflicts.push({
          type: 'MOD3',
          severity: 'HIGH',
          cell1: cell1,
          cell2: cell2,
          distance: calculateDistance(cell1, cell2)
        });
      }
    }
  }
  
  return conflicts;
}

// Calculate distance between two cells
function calculateDistance(cell1: any, cell2: any): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(cell2.latitude - cell1.latitude);
  const dLon = toRadians(cell2.longitude - cell1.longitude);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(cell1.latitude)) * Math.cos(toRadians(cell2.latitude)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}