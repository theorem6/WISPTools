// Plan Hardware Analysis Service
// Extracted from plans.js for better organization and maintainability
// Version: 0.2

const axios = require('axios');
const { InventoryItem } = require('../models/inventory');

/**
 * Analyze missing hardware for a plan
 * Compares plan requirements against available inventory
 */
async function analyzeMissingHardware(plan) {
  try {
    const existingInventory = await InventoryItem.find({ tenantId: plan.tenantId }).lean();
    
    // Clear existing missing hardware analysis
    plan.purchasePlan.missingHardware = [];
    plan.purchasePlan.totalEstimatedCost = 0;
    
    // Analyze each hardware requirement
    for (const requirement of plan.hardwareRequirements.needed) {
      const available = existingInventory.filter(item => 
        item.category === requirement.category &&
        item.equipmentType === requirement.equipmentType &&
        (item.status === 'available' || item.status === 'reserved')
      );
      
      const availableQuantity = available.length;
      const neededQuantity = requirement.quantity;
      
      if (availableQuantity < neededQuantity) {
        const missingQuantity = neededQuantity - availableQuantity;
        const costEstimate = await estimateHardwareCost(plan.tenantId, requirement);
        const estimatedCost = costEstimate.estimatedCost;
        
        plan.purchasePlan.missingHardware.push({
          id: `missing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          category: requirement.category,
          equipmentType: requirement.equipmentType,
          manufacturer: requirement.manufacturer,
          model: requirement.model,
          quantity: missingQuantity,
          estimatedCost: estimatedCost * missingQuantity,
          priority: requirement.priority,
          specifications: requirement.specifications,
          reason: generateMissingHardwareReason(requirement, missingQuantity, availableQuantity),
          alternatives: generateAlternatives(requirement),
          costConfidence: costEstimate.confidence,
          costSource: costEstimate.source
        });
        
        plan.purchasePlan.totalEstimatedCost += estimatedCost * missingQuantity;
      }
    }
    
    plan.updatedAt = new Date();
    await plan.save();
  } catch (error) {
    console.error('Error analyzing missing hardware:', error);
    throw error;
  }
}

/**
 * Estimate hardware cost using pricing database
 * Falls back to inventory averages, then hardcoded defaults
 */
async function estimateHardwareCost(tenantId, requirement) {
  try {
    // Try to get price from pricing database
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    
    const params = new URLSearchParams({
      category: requirement.category || '',
      equipmentType: requirement.equipmentType || '',
      manufacturer: requirement.manufacturer || '',
      model: requirement.model || ''
    });
    
    try {
      const response = await axios.get(`${baseUrl}/api/equipment-pricing/price?${params}`, {
        headers: {
          'x-tenant-id': tenantId
        },
        timeout: 5000 // 5 second timeout
      });
      
      if (response.data?.price) {
        return {
          estimatedCost: response.data.price * (requirement.quantity || 1),
          confidence: response.data.confidence || 'high',
          source: response.data.source || 'pricing_database'
        };
      }
    } catch (apiError) {
      console.warn('Pricing API not available, using fallback:', apiError.message);
    }
    
    // Fallback to hardcoded estimates (last resort)
    const costEstimates = {
      'tower': 50000,
      'sector-antenna': 2000,
      'cpe-device': 500,
      'router': 300,
      'switch': 200,
      'power-supply': 150,
      'cable': 5,
      'connector': 10,
      'mounting-hardware': 100,
      'backhaul-radio': 3000,
      'fiber-optic': 2,
      'ups': 800,
      'generator': 5000,
      // Add more defaults
      'Base Station (eNodeB/gNodeB)': 15000,
      'Remote Radio Head (RRH)': 3000,
      'Radio Unit (RU)': 2500,
      'Baseband Unit (BBU)': 8000,
      'Sector Antenna': 2000,
      'Panel Antenna': 1500,
      'Parabolic Dish': 2500,
      'LTE CPE': 500,
      'CBRS CPE': 600,
      'Rectifier': 800,
      'Battery Bank': 1500,
      'UPS': 800,
      'Generator': 5000
    };
    
    const basePrice = costEstimates[requirement.equipmentType] || 1000;
    
    return {
      estimatedCost: basePrice * (requirement.quantity || 1),
      confidence: 'low',
      source: 'fallback_default'
    };
  } catch (error) {
    console.error('Error estimating cost:', error);
    // Ultimate fallback
    return {
      estimatedCost: 1000 * (requirement.quantity || 1),
      confidence: 'low',
      source: 'error_fallback'
    };
  }
}

function generateMissingHardwareReason(requirement, missingQuantity, availableQuantity) {
  if (availableQuantity === 0) {
    return `No ${requirement.equipmentType} equipment available in inventory`;
  } else {
    return `Only ${availableQuantity} ${requirement.equipmentType} available, need ${missingQuantity} more`;
  }
}

function generateAlternatives(requirement) {
  const alternatives = [];
  
  // Add some generic alternatives based on equipment type
  switch (requirement.equipmentType) {
    case 'cpe-device':
      alternatives.push(
        { manufacturer: 'Ubiquiti', model: 'NanoStation M5', estimatedCost: 450, availability: 'in-stock' },
        { manufacturer: 'MikroTik', model: 'SXT Lite5', estimatedCost: 380, availability: 'in-stock' },
        { manufacturer: 'Cambium', model: 'ePMP 1000', estimatedCost: 520, availability: 'backorder' }
      );
      break;
    case 'sector-antenna':
      alternatives.push(
        { manufacturer: 'RFS', model: 'Sector Antenna 120?', estimatedCost: 1800, availability: 'in-stock' },
        { manufacturer: 'CommScope', model: 'Sector Antenna 90?', estimatedCost: 2200, availability: 'in-stock' }
      );
      break;
    case 'router':
      alternatives.push(
        { manufacturer: 'Cisco', model: 'ISR 4331', estimatedCost: 2500, availability: 'in-stock' },
        { manufacturer: 'Juniper', model: 'MX104', estimatedCost: 3000, availability: 'backorder' }
      );
      break;
  }
  
  return alternatives;
}

module.exports = {
  analyzeMissingHardware,
  estimateHardwareCost,
  generateMissingHardwareReason,
  generateAlternatives
};

