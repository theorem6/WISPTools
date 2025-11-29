#!/usr/bin/env node
/**
 * Update Agent Manifest
 * Calculates SHA256 hashes for all agent scripts and updates the manifest
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const MANIFEST_PATH = path.join(__dirname, '../agent-manifest.json');
const SCRIPTS_DIR = path.join(__dirname);

async function calculateFileHash(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

async function updateManifest() {
  console.log('Updating agent manifest...');
  
  // Read current manifest
  let manifest;
  try {
    const manifestContent = await fs.readFile(MANIFEST_PATH, 'utf8');
    manifest = JSON.parse(manifestContent);
  } catch (error) {
    console.error('Failed to read manifest:', error.message);
    process.exit(1);
  }
  
  // Update hashes for all scripts
  for (const [scriptName, scriptInfo] of Object.entries(manifest.scripts || {})) {
    const scriptPath = path.join(SCRIPTS_DIR, scriptInfo.filename);
    
    try {
      const stats = await fs.stat(scriptPath);
      if (!stats.isFile()) {
        console.warn(`  ${scriptName}: File not found or not a file: ${scriptPath}`);
        continue;
      }
      
      const hash = await calculateFileHash(scriptPath);
      if (hash) {
        manifest.scripts[scriptName].sha256 = hash;
        console.log(`  ${scriptName}: Updated hash to ${hash.substring(0, 16)}...`);
      }
    } catch (error) {
      console.warn(`  ${scriptName}: Error processing: ${error.message}`);
    }
  }
  
  // Update timestamp
  manifest.updated_at = new Date().toISOString();
  
  // Write updated manifest
  try {
    await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
    console.log('\nManifest updated successfully!');
    console.log(`  Updated at: ${manifest.updated_at}`);
    console.log(`  Scripts: ${Object.keys(manifest.scripts).length}`);
  } catch (error) {
    console.error('Failed to write manifest:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  updateManifest().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { updateManifest };

