#!/usr/bin/env node
/**
 * Update VAPID keys to Standard Base64 format in .env
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');

console.log('\n🔧 Updating VAPID keys to Standard Base64...\n');

// Read current .env
let envContent = fs.readFileSync(envPath, 'utf-8');

// New keys in Standard Base64 format
const newPublicKey = 'BHP4sJ++IgJepI+tImGr613Oqoy/bgKQHM8fZOLf4viipPbp8DKbHU2yD0VMSPtEff6rXyo5hPS8xTMvRN+ReoA=';
const newPrivateKey = 'ZqBCdzLycDap2n2x0582vVe/+cAVIZug9w8nQBtaEGc=';

// Replace VAPID keys
envContent = envContent.replace(
  /^VAPID_PUBLIC_KEY=.+$/m,
  `VAPID_PUBLIC_KEY=${newPublicKey}`
);

envContent = envContent.replace(
  /^VAPID_PRIVATE_KEY=.+$/m,
  `VAPID_PRIVATE_KEY=${newPrivateKey}`
);

// Write back
fs.writeFileSync(envPath, envContent, 'utf-8');

console.log('✅ VAPID_PUBLIC_KEY updated');
console.log('✅ VAPID_PRIVATE_KEY updated');
console.log('\n📋 New values:');
console.log(`  PUBLIC:  ${newPublicKey.substring(0, 40)}...`);
console.log(`  PRIVATE: ${newPrivateKey.substring(0, 40)}...`);
console.log('\n✅ Done! Please restart the backend.');

