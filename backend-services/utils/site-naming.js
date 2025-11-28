/**
 * Site Naming Utility
 * Generates site names with :1, :2 suffixes for multiple EPCs at the same site
 */

const { RemoteEPC } = require('../models/distributed-epc-schema');
const mongoose = require('mongoose');

/**
 * Generate site name with suffix based on site_id
 * Format: {SiteName}:1, {SiteName}:2, etc.
 * 
 * @param {string} site_id - The site identifier (ObjectId or string)
 * @param {string} tenant_id - Tenant ID
 * @returns {Promise<string>} Site name with appropriate suffix
 */
async function generateSiteNameWithSuffix(site_id, tenant_id) {
  if (!site_id) {
    // If no site_id provided, use a default
    return 'Site-1';
  }
  
  try {
    // First, try to look up the actual site name from UnifiedSite collection
    let baseSiteName = null;
    try {
      const db = mongoose.connection.db;
      const UnifiedSite = db.collection('unifiedsites');
      
      // Try to find the site by _id
      const siteObjId = mongoose.Types.ObjectId.isValid(site_id) 
        ? new mongoose.Types.ObjectId(site_id) 
        : site_id;
      
      const site = await UnifiedSite.findOne({
        _id: siteObjId,
        tenantId: tenant_id
      });
      
      if (site && site.name) {
        baseSiteName = site.name;
      }
    } catch (siteLookupError) {
      console.warn('[Site Naming] Could not lookup site name from UnifiedSite:', siteLookupError.message);
    }
    
    // If we couldn't find the site name, use site_id as fallback
    if (!baseSiteName) {
      baseSiteName = site_id;
    }
    
    // Find all EPCs at this site for this tenant
    // Match by site_id
    const existingEPCs = await RemoteEPC.find({
      site_id: site_id,
      tenant_id: tenant_id
    })
    .select('site_name epc_id site_id')
    .lean();
    
    // Extract existing suffixes from site names
    // Look for patterns like "SiteName:1", "SiteName:2", etc.
    const escapedBaseName = baseSiteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const suffixes = existingEPCs
      .map(epc => {
        if (!epc.site_name) return null;
        
        // Extract suffix from site_name format: "BaseName:N" or "BaseName"
        const match = epc.site_name.match(/^(.+?)(?::(\d+))?$/);
        if (match) {
          const namePart = match[1];
          const suffixPart = match[2] ? parseInt(match[2], 10) : 1;
          
          // If the name part matches our base name (or the site_id matches), use the suffix
          if (namePart === baseSiteName || namePart === site_id || epc.site_id === site_id) {
            return suffixPart;
          }
        }
        return null;
      })
      .filter(s => s !== null)
      .sort((a, b) => a - b);
    
    // Find the next available suffix
    let nextSuffix = 1;
    if (suffixes.length > 0) {
      // Find the first gap in the sequence
      for (let i = 0; i < suffixes.length; i++) {
        if (suffixes[i] !== i + 1) {
          nextSuffix = i + 1;
          break;
        }
        nextSuffix = i + 2;
      }
    }
    
    // Return format: "SiteName:1", "SiteName:2", etc.
    // If nextSuffix is 1 and it's the first EPC, we can omit the suffix or include it
    // For consistency, always include the suffix
    return nextSuffix === 1 && suffixes.length === 0 
      ? baseSiteName 
      : `${baseSiteName}:${nextSuffix}`;
    
  } catch (error) {
    console.error('[Site Naming] Error generating site name:', error);
    // Fallback to site_id with :1
    return `${site_id}:1`;
  }
}

/**
 * Update site names for all EPCs at a site to ensure proper numbering
 * This should be called when an EPC is deleted or site_id changes
 * 
 * @param {string} site_id - The site identifier
 * @param {string} tenant_id - Tenant ID
 */
async function renumberSiteEPCs(site_id, tenant_id) {
  try {
    const epcs = await RemoteEPC.find({
      site_id: site_id,
      tenant_id: tenant_id
    })
    .sort({ created_at: 1 }) // Sort by creation date to maintain order
    .lean();
    
    for (let i = 0; i < epcs.length; i++) {
      const epc = epcs[i];
      const expectedName = i === 0 ? site_id : `${site_id}:${i + 1}`;
      
      if (epc.site_name !== expectedName) {
        await RemoteEPC.updateOne(
          { _id: epc._id },
          { $set: { site_name: expectedName } }
        );
        console.log(`[Site Naming] Updated EPC ${epc.epc_id} site_name to ${expectedName}`);
      }
    }
  } catch (error) {
    console.error('[Site Naming] Error renumbering site EPCs:', error);
  }
}

module.exports = {
  generateSiteNameWithSuffix,
  renumberSiteEPCs
};

