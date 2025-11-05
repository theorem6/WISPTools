#!/usr/bin/env node
/**
 * Firebase User Management Script
 * Create or reset users in wisptools-production project
 * 
 * Usage:
 *   node scripts/create-user.js <email> <password>
 *   node scripts/create-user.js <email> <password> --reset
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Load service account key
const serviceAccountPath = path.join(__dirname, '..', 'wisptools-production-firebase-adminsdk.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Service account key not found:', serviceAccountPath);
  console.error('Please place wisptools-production-firebase-adminsdk.json in the root directory');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'wisptools-production'
  });
}

const auth = admin.auth();

async function createUser(email, password) {
  try {
    // Check if user exists
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log(`⚠️  User ${email} already exists`);
      return userRecord;
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // User doesn't exist, create it
        userRecord = await auth.createUser({
          email,
          password,
          emailVerified: false
        });
        console.log(`✅ Created user: ${email}`);
        return userRecord;
      }
      throw error;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    throw error;
  }
}

async function resetPassword(email, newPassword) {
  try {
    const userRecord = await auth.getUserByEmail(email);
    await auth.updateUser(userRecord.uid, {
      password: newPassword
    });
    console.log(`✅ Password reset for: ${email}`);
    return userRecord;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    throw error;
  }
}

async function listUsers() {
  try {
    const listUsersResult = await auth.listUsers();
    console.log('\n📋 Existing Users:');
    listUsersResult.users.forEach((user) => {
      console.log(`  - ${user.email} (UID: ${user.uid})`);
    });
    console.log(`\nTotal: ${listUsersResult.users.length} users\n`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Firebase User Management

Usage:
  node scripts/create-user.js <email> <password>           Create new user or update password
  node scripts/create-user.js <email> <password> --reset  Reset password for existing user
  node scripts/create-user.js --list                      List all users

Examples:
  node scripts/create-user.js user@example.com MyPassword123
  node scripts/create-user.js user@example.com NewPassword123 --reset
  node scripts/create-user.js --list
  `);
  process.exit(0);
}

if (args[0] === '--list') {
  listUsers();
  process.exit(0);
}

const email = args[0];
const password = args[1];
const isReset = args.includes('--reset');

if (!email || !password) {
  console.error('❌ Error: Email and password are required');
  console.error('Usage: node scripts/create-user.js <email> <password> [--reset]');
  process.exit(1);
}

if (password.length < 6) {
  console.error('❌ Error: Password must be at least 6 characters');
  process.exit(1);
}

(async () => {
  try {
    if (isReset) {
      await resetPassword(email, password);
    } else {
      await createUser(email, password);
    }
    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
})();

