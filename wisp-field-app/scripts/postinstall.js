#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

console.log('🔧 Applying patches...');

// Fix vision-camera-code-scanner barcode scanning dependency
const buildGradlePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'vision-camera-code-scanner',
  'android',
  'build.gradle'
);

if (fs.existsSync(buildGradlePath)) {
  let content = fs.readFileSync(buildGradlePath, 'utf8');
  
  // Update barcode-scanning version
  if (content.includes("'com.google.mlkit:barcode-scanning:17.0.0'")) {
    content = content.replace(
      "'com.google.mlkit:barcode-scanning:17.0.0'",
      "'com.google.mlkit:barcode-scanning:17.2.0'"
    );
    fs.writeFileSync(buildGradlePath, content, 'utf8');
    console.log('✅ Fixed vision-camera-code-scanner barcode scanning dependency');
  } else {
    console.log('ℹ️  vision-camera-code-scanner already patched or version changed');
  }
} else {
  console.log('⚠️  vision-camera-code-scanner not found');
}

console.log('✅ Patches applied successfully');

