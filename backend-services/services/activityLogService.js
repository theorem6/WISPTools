/**
 * User Activity Logging Service
 * Logs key user actions for audit and compliance
 */

const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  userEmail: { type: String },
  action: { type: String, required: true, index: true },
  resource: { type: String },
  resourceId: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now, index: true }
}, { collection: 'user_activity_logs' });

const ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);

async function logActivity(data) {
  try {
    await ActivityLog.create({
      tenantId: data.tenantId,
      userId: data.userId,
      userEmail: data.userEmail,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId,
      details: data.details,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent
    });
  } catch (err) {
    console.error('[ActivityLog] Failed to log:', err.message);
  }
}

function createActivityLogger(req) {
  const userId = req.user?.uid;
  const userEmail = req.user?.email;
  const tenantId = req.tenantId;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
  const userAgent = req.headers['user-agent'];

  return (action, resource, resourceId, details) => {
    if (!userId) return;
    logActivity({
      tenantId,
      userId,
      userEmail,
      action,
      resource,
      resourceId,
      details,
      ipAddress,
      userAgent
    });
  };
}

module.exports = {
  logActivity,
  createActivityLogger,
  ActivityLog
};
