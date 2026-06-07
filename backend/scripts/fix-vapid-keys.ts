#!/usr/bin/env ts-node
/**
 * Check if VAPID keys are in correct format for Apple Push
 */

import * as fs from 'fs';
import * as path from 'path';

console.log('\n🔑 Checking VAPID Keys Format\n');
console.log('='.repeat(80));

// Load .env file
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');

// Extract VAPID keys
const publicKeyMatch = envContent.match(/VAPID_PUBLIC_KEY=(.+)/);
const privateKeyMatch = envContent.match(/VAPID_PRIVATE_KEY=(.+)/);

if (!publicKeyMatch || !privateKeyMatch) {
  console.log('❌ VAPID keys not found in .env');
  process.exit(1);
}

const publicKey = publicKeyMatch[1].trim();
const privateKey = privateKeyMatch[1].trim();

console.log('\n📊 VAPID Public Key:');
console.log(`  Value: ${publicKey.substring(0, 40)}...`);
console.log(`  Length: ${publicKey.length}`);
console.log(`  Has '-': ${publicKey.includes('-')}`);
console.log(`  Has '_': ${publicKey.includes('_')}`);
console.log(`  Has '+': ${publicKey.includes('+')}`);
console.log(`  Has '/': ${publicKey.includes('/')}`);
console.log(`  Has '=': ${publicKey.includes('=')}`);

console.log('\n📊 VAPID Private Key:');
console.log(`  Value: ${privateKey.substring(0, 40)}...`);
console.log(`  Length: ${privateKey.length}`);
console.log(`  Has '-': ${privateKey.includes('-')}`);
console.log(`  Has '_': ${privateKey.includes('_')}`);
console.log(`  Has '+': ${privateKey.includes('+')}`);
console.log(`  Has '/': ${privateKey.includes('/')}`);
console.log(`  Has '=': ${privateKey.includes('=')}`);

// Check format
const isPublicUrlSafe = publicKey.includes('-') || publicKey.includes('_');
const isPrivateUrlSafe = privateKey.includes('-') || privateKey.includes('_');

console.log('\n' + '='.repeat(80));
if (isPublicUrlSafe || isPrivateUrlSafe) {
  console.log('⚠️  VAPID keys are in URL-safe format');
  console.log('For Apple Push, they might need to be in standard Base64');
  
  // Try to convert
  const publicStd = publicKey.replace(/-/g, '+').replace(/_/g, '/');
  const privateStd = privateKey.replace(/-/g, '+').replace(/_/g, '/');
  
  // Add padding if needed
  const publicPadding = (4 - (publicStd.length % 4)) % 4;
  const privatePadding = (4 - (privateStd.length % 4)) % 4;
  
  const publicFinal = publicStd + '='.repeat(publicPadding);
  const privateFinal = privateStd + '='.repeat(privatePadding);
  
  console.log('\n💡 Suggested conversion:');
  console.log(`VAPID_PUBLIC_KEY=${publicFinal}`);
  console.log(`VAPID_PRIVATE_KEY=${privateFinal}`);
} else {
  console.log('✅ VAPID keys are already in standard Base64 format');
}
console.log('='.repeat(80));

