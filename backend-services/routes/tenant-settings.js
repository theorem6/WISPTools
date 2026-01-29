/**
 * Tenant App Settings API
 * GET/PUT app-level settings (ACS credentials, company info) for the current tenant.
 * Stored in tenant.settings.appSettings (acs, company).
 */

const express = require('express');
const router = express.Router();
const { Tenant } = require('../models/tenant');
const { UserTenant } = require('../models/user');
const { verifyAuth, isPlatformAdminUser } = require('./users/role-auth-middleware');
const mongoose = require('mongoose');

/**
 * Ensure user has access to the tenant (member or platform admin)
 */
async function requireTenantAccess(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'X-Tenant-ID header required' });
  }
  if (!mongoose.Types.ObjectId.isValid(tenantId)) {
    return res.status(400).json({ error: 'Invalid tenant ID' });
  }
  if (isPlatformAdminUser(req.user)) {
    req.tenantId = tenantId;
    return next();
  }
  const ut = await UserTenant.findOne({
    userId: req.user.uid,
    tenantId,
    status: 'active'
  }).lean();
  if (!ut) {
    return res.status(403).json({ error: 'Forbidden', message: 'No access to this tenant' });
  }
  req.tenantId = tenantId;
  next();
}

/**
 * GET /api/tenant-settings
 * Returns app settings (acsSettings, companyInfo) for the current tenant.
 */
router.get('/', verifyAuth, requireTenantAccess, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId).lean();
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    const appSettings = tenant.settings?.appSettings || {};
    res.json({
      acsSettings: appSettings.acs || { username: '', password: '', url: '' },
      companyInfo: appSettings.company || {
        name: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        phone: '',
        email: ''
      }
    });
  } catch (error) {
    console.error('[tenant-settings] GET error:', error);
    res.status(500).json({ error: 'Failed to load settings', message: error.message });
  }
});

/**
 * PUT /api/tenant-settings
 * Body: { acsSettings?, companyInfo? }
 * Updates tenant.settings.appSettings (merge, not replace).
 */
router.put('/', verifyAuth, requireTenantAccess, async (req, res) => {
  try {
    const { acsSettings, companyInfo } = req.body || {};
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    if (!tenant.settings) tenant.settings = {};
    if (!tenant.settings.appSettings) tenant.settings.appSettings = {};
    if (acsSettings && typeof acsSettings === 'object') {
      tenant.settings.appSettings.acs = {
        username: acsSettings.username ?? tenant.settings.appSettings.acs?.username ?? '',
        password: acsSettings.password ?? tenant.settings.appSettings.acs?.password ?? '',
        url: acsSettings.url ?? tenant.settings.appSettings.acs?.url ?? ''
      };
    }
    if (companyInfo && typeof companyInfo === 'object') {
      tenant.settings.appSettings.company = {
        name: companyInfo.name ?? '',
        address: companyInfo.address ?? '',
        city: companyInfo.city ?? '',
        state: companyInfo.state ?? '',
        zip: companyInfo.zip ?? '',
        phone: companyInfo.phone ?? '',
        email: companyInfo.email ?? ''
      };
    }
    await tenant.save();
    res.json({
      acsSettings: tenant.settings.appSettings.acs || { username: '', password: '', url: '' },
      companyInfo: tenant.settings.appSettings.company || {}
    });
  } catch (error) {
    console.error('[tenant-settings] PUT error:', error);
    res.status(500).json({ error: 'Failed to save settings', message: error.message });
  }
});

module.exports = router;
