import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as cors from 'cors';

// Initialize Firebase Admin SDK
admin.initializeApp();

const corsHandler = cors({ origin: true });

// PCI Analysis Function
export const analyzePCI = functions.https.onRequest((req, res) => {
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
      const analysisRef = await admin.firestore()
        .collection('pci_analyses')
        .add({
          cells: cells,
          conflicts: conflicts,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
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

// Simple PCI conflict detection function
function analyzeConflictsSimple(cells: any[]) {
  const conflicts: any[] = [];
  
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const cell1 = cells[i];
      const cell2 = cells[j];
      
      // Check for different modulo conflicts
      const modConflicts = [
        { type: 'MOD3', value: 3 },
        { type: 'MOD6', value: 6 },
        { type: 'MOD12', value: 12 },
        { type: 'MOD30', value: 30 }
      ];
      
      for (const modConflict of modConflicts) {
        if (cell1.pci % mod conflict.value === cell2.pci % modConflict.value) {
          conflicts.push({
            primaryCell: cell1,
            conflictingCell: cell2,
            conflictType: modConflict.type,
            severity: 'MEDIUM', // Simplified
            timestamp: Date.now()
          });
        }
      }
    }
  }
  
  return conflicts;
}

// Export cell data function
export const exportCells = functions.https.onRequest((req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const cellsSnapshot = await admin.firestore()
        .collection('sample_cells')
        .get();

      const cells: any[] = [];
      cellsSnapshot.forEach(doc => {
        cells.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return res.json({
        cells: cells,
        count: cells.length,
        exportedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Export Error:', error);
      return res.status(500).json({ error: 'Export failed' });
    }
  });
});

// Get analysis history
export const getAnalysisHistory = functions.https.onRequest((req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const analysesSnapshot = await admin.firestore()
        .collection('pci_analyses')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();

      const analyses: any[] = [];
      analysesSnapshot.forEach(doc => {
        analyses.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return res.json({
        analyses: analyses,
        count: analyses.length
      });
    } catch (error) {
      console.error('Get Analysis History Error:', error);
      return res.status(500).json({ error: 'Failed to get analysis history' });
    }
  });
});
