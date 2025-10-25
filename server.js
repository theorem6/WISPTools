#!/usr/bin/env node

/**
 * Root Server Entry Point
 * 
 * This file serves as the main entry point for the LTE WISP Management Platform.
 * It starts the backend services from the backend-services directory.
 * 
 * Usage:
 *   node server.js                    # Start backend services
 *   npm start                         # Start frontend (Module_Manager)
 *   npm run dev                       # Start frontend in dev mode
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting LTE WISP Management Platform...');
console.log('📁 Working directory:', process.cwd());

// Check if backend-services directory exists
const backendDir = path.join(__dirname, 'backend-services');
if (!fs.existsSync(backendDir)) {
  console.error('❌ Backend services directory not found:', backendDir);
  process.exit(1);
}

// Check if server.js exists in backend-services
const serverFile = path.join(backendDir, 'server.js');
if (!fs.existsSync(serverFile)) {
  console.error('❌ Backend server.js not found:', serverFile);
  process.exit(1);
}

console.log('🔧 Starting backend services from:', backendDir);

// Change to backend-services directory and start the server
process.chdir(backendDir);

// Start the backend server
const serverProcess = spawn('node', ['server.js'], {
  stdio: 'inherit',
  cwd: backendDir
});

serverProcess.on('error', (error) => {
  console.error('❌ Failed to start backend server:', error);
  process.exit(1);
});

serverProcess.on('exit', (code) => {
  console.log(`🔚 Backend server exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down backend server...');
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down backend server...');
  serverProcess.kill('SIGTERM');
});
