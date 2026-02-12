/**
 * Simplified GenieACS Services – INTENTIONALLY STUBBED
 *
 * These HTTP endpoints are placeholders only. They return a success payload with a note;
 * they do not connect to GenieACS or MongoDB.
 *
 * Production GenieACS integration uses:
 * - genieacsBridgeMultitenant.ts (proxy to real GenieACS NBI)
 * - genieacsServicesMultitenant.ts (NBI/FS backed by GenieACS when configured)
 *
 * See docs/BACKEND_INTEGRATIONS.md for details.
 */
import { onRequest } from 'firebase-functions/v2/https';
import cors from 'cors';

const corsHandler = cors({ origin: true });

// Placeholder GenieACS CWMP Service
export const genieacsCWMP = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      res.json({
        success: true,
        message: 'GenieACS CWMP service placeholder',
        note: 'MongoDB integration required for full functionality'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Placeholder GenieACS NBI Service
export const genieacsNBI = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      res.json({
        success: true,
        message: 'GenieACS NBI service placeholder',
        note: 'MongoDB integration required for full functionality'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Placeholder GenieACS FS Service
export const genieacsFS = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      res.json({
        success: true,
        message: 'GenieACS FS service placeholder',
        note: 'MongoDB integration required for full functionality'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

// Placeholder GenieACS UI Service
export const genieacsUI = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      res.json({
        success: true,
        message: 'GenieACS UI service placeholder',
        note: 'MongoDB integration required for full functionality'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});
