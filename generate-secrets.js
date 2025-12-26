#!/usr/bin/env node

/**
 * Generate secure random secrets for JWT and SESSION
 * Run: node generate-secrets.js
 */

import crypto from 'crypto';

console.log('\n🔐 Generated Secure Secrets for Production:\n');
console.log('Copy these to your backend/.env file on Plesk:\n');
console.log('─'.repeat(60));
console.log(`JWT_SECRET=${crypto.randomBytes(32).toString('hex')}`);
console.log(`SESSION_SECRET=${crypto.randomBytes(32).toString('hex')}`);
console.log('─'.repeat(60));
console.log('\n✅ These are cryptographically secure random strings.\n');
