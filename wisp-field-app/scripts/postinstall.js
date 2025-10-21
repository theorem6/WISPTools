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
  
  // Update barcode-scanning version and add Play Services dependency
  let patched = false;
  
  if (content.includes("'com.google.mlkit:barcode-scanning:17.0.0'")) {
    content = content.replace(
      "'com.google.mlkit:barcode-scanning:17.0.0'",
      "'com.google.mlkit:barcode-scanning:17.2.0'"
    );
    patched = true;
  }
  
  if (!content.includes('play-services-mlkit-barcode-scanning')) {
    // Add Play Services ML Kit dependency
    content = content.replace(
      "implementation 'com.google.mlkit:barcode-scanning:17.2.0'",
      "implementation 'com.google.mlkit:barcode-scanning:17.2.0'\n    implementation 'com.google.android.gms:play-services-mlkit-barcode-scanning:18.3.0'"
    );
    patched = true;
  }
  
  if (patched) {
    fs.writeFileSync(buildGradlePath, content, 'utf8');
    console.log('✅ Fixed vision-camera-code-scanner barcode scanning dependencies');
  } else {
    console.log('ℹ️  vision-camera-code-scanner already patched');
  }
} else {
  console.log('⚠️  vision-camera-code-scanner not found');
}

console.log('✅ Patches applied successfully');

