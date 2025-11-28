/**
 * Site Naming Utility
 * Generates site names with :1, :2 suffixes for multiple EPCs at the same site
 */

const { RemoteEPC } = require('../models/distributed-epc-schema');

/**
 * Generate site name with suffix based on site_id
 * Format: {site_id}:1, {site_id}:2, etc.
 * 
 * @param {string} site_id - The site identifier
 * @param {string} tenant_id - Tenant ID
 * @returns {Promise<string>} Site name with appropriate suffix
 */
async function generateSiteNameWithSuffix(site_id, tenant_id) {
  if (!site_id) {
    // If no site_id provided, use a default
    return 'Site-1';
  }
  
  try {
    // Find all EPCs at this site for this tenant
    // Match by site_id OR by site_name starting with site_id (handles both cases)
    const escapedSiteId = site_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingEPCs = await RemoteEPC.find({
      $or: [
        { site_id: site_id, tenant_id: tenant_id },
        { site_name: { $regex: `^${escapedSiteId}(:\\d+)?$` }, tenant_id: tenant_id },
        { site_name: site_id, tenant_id: tenant_id }
      ]
    })
    .select('site_name epc_id site_id')
    .lean();
    
    // Extract existing suffixes from site names
    const suffixes = existingEPCs
      .map(epc => {
        // Extract suffix from site_name format: "site_id:N"
        const match = epc.site_name?.match(/^([^:]+):(\d+)$/);
        if (match) {
          const baseName = match[1];
          const suffix = parseInt(match[2], 10);
          // Only count if base matches our site_id
          if (baseName === site_id || epc.site_id === site_id) {
            return suffix;
          }
        }
        // If site_name equals site_id exactly, it's the first one (no suffix = 1)
        if (epc.site_name === site_id || epc.site_id === site_id) {
          return 1;
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
    
    // If nextSuffix is 1, use site_id directly (no suffix)
    // Otherwise use site_id:nextSuffix
    return nextSuffix === 1 ? site_id : `${site_id}:${nextSuffix}`;
    
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

