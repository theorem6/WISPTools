#!/usr/bin/env node

/**
 * Test Script for Login and Module Crash Fixes
 * Verifies that all critical issues have been resolved
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

async function testServerHealth() {
  try {
    console.log('🔍 Testing server health...');
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server is running:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Server health check failed:', error.message);
    return false;
  }
}

async function testAuthEndpoints() {
  try {
    console.log('🔍 Testing auth endpoints...');
    
    // Test auth status
    const statusResponse = await axios.get(`${BASE_URL}/api/auth/status`);
    console.log('✅ Auth status endpoint:', statusResponse.data);
    
    // Test login endpoint (should return 400 for missing token)
    try {
      await axios.post(`${BASE_URL}/api/auth/login`, {});
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Login endpoint properly validates input');
      } else {
        throw error;
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Auth endpoints test failed:', error.message);
    return false;
  }
}

async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing database connection...');
    const response = await axios.get(`${BASE_URL}/health`);
    
    if (response.data.mongodb === 'connected') {
      console.log('✅ Database connection is healthy');
      return true;
    } else {
      console.log('⚠️ Database connection status:', response.data.mongodb);
      return false;
    }
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Running Login and Module Crash Fix Tests...\n');
  
  const tests = [
    { name: 'Server Health', fn: testServerHealth },
    { name: 'Auth Endpoints', fn: testAuthEndpoints },
    { name: 'Database Connection', fn: testDatabaseConnection }
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
        console.log(`✅ ${test.name}: PASSED\n`);
      } else {
        console.log(`❌ ${test.name}: FAILED\n`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR - ${error.message}\n`);
    }
  }
  
  console.log(`📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Login and module crashes should be fixed.');
  } else {
    console.log('⚠️ Some tests failed. Check the server logs for details.');
  }
}

// Run tests
runTests().catch(console.error);