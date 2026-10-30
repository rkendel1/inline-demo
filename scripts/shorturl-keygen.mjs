#!/usr/bin/env node
// Generates the one-time owner id + P-256 private key for the short_url integration.
// Copy the printed lines into your .env.local (never commit the private key).
//
// Usage: node scripts/shorturl-keygen.mjs
import { generateKeyPairSync, randomBytes } from 'crypto';

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
const owner = randomBytes(16).toString('hex');

console.log('# --- short_url integration (add to .env.local) ---');
console.log('SHORT_URL_BASE_URL=https://0-2.ca');
console.log(`SHORT_URL_OWNER=${owner}`);
console.log('SHORT_URL_CODE=demo');
console.log('SHORT_URL_PRIVATE_KEY="' + pem.trim().replace(/\n/g, '\\n') + '"');
console.log('#');
console.log('# The first time you set a demo live, this key claims the SHORT_URL_CODE link');
console.log('# (trust-on-first-use). Keep the private key secret and back it up — it is the');
console.log('# only thing that can edit that short link afterwards.');
