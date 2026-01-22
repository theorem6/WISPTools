const path = require('path');
try {
  const { InventoryItem } = require('../../models/inventory');
  console.log('SUCCESS: InventoryItem loaded');
} catch (e) {
  console.error('ERROR:', e.message);
}