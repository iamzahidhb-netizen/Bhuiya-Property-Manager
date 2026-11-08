/**
 * Empirical API Routing Verification Script
 * 
 * Verifies whether the deployed Firebase Hosting preview URL routes requests
 * to the Cloudflare Worker or falls back to Firebase Hosting static SPA rewrites.
 */

import fs from 'fs';
import { getFirestoreAccessToken, pemToBinary } from './serviceAccountAuth.mjs';

const PREVIEW_BASE_URL = 'https://bhuiya-property-staging--readonly-preview-xgsti7az.web.app';
const STAGING_PROJECT_ID = 'bhuiya-property-staging';

async function run() {
  console.log('========================================================================');
  console.log('FINAL PREVIEW API ROUTING VERIFICATION');
  console.log('Target URL:', PREVIEW_BASE_URL);
  console.log('========================================================================\n');

  // 1. Prepare Staging Service Account & Auth
  const devVars = fs.readFileSync('poc/phase-10-2a/.dev.vars', 'utf8');
  let b64 = '';
  for (const l of devVars.split('\n')) {
    if (l.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY=')) {
      b64 = l.substring('FIREBASE_SERVICE_ACCOUNT_KEY='.length).trim();
    }
  }
  const saCreds = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));

  // 2. Generate signed test token for Master Admin
  const jwtHeader = { alg: 'RS256', typ: 'JWT', kid: 'staging_key_01' };
  const jwtPayload = {
    iss: `https://securetoken.google.com/${STAGING_PROJECT_ID}`,
    aud: STAGING_PROJECT_ID,
    sub: 'WunBcW1KihNW2DMTs3R0gUpQ0fh2',
    user_id: 'WunBcW1KihNW2DMTs3R0gUpQ0fh2',
    auth_time: Math.floor(Date.now() / 1000) - 10,
    iat: Math.floor(Date.now() / 1000) - 10,
    exp: Math.floor(Date.now() / 1000) + 3600
  };

  const b64Url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const tokenMsg = `${b64Url(jwtHeader)}.${b64Url(jwtPayload)}`;
  const privateKeyBinary = pemToBinary(saCreds.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBinary,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBytes = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(tokenMsg));
  const masterAdminToken = `${tokenMsg}.${Buffer.from(sigBytes).toString('base64url')}`;

  const testEndpoints = [
    { action: 'getOrCreateMonthlyDistributionCallable', payload: { billingMonth: '2026-11' } },
    { action: 'createUnitCallable', payload: { propertyId: 'prop_01', unitNumber: 'Flat 2B', floor: 2, monthlyRent: 18000 } },
    { action: 'generateMonthlyBillsCallable', payload: { propertyId: 'prop_01', billingMonth: '2026-11' } },
    { action: 'createPropertyCallable', payload: { name: 'Test Property' } }
  ];

  console.log('--- TEST 1: Live Network Probe against Deployed Preview URL ---');

  for (const item of testEndpoints) {
    const targetUrl = `${PREVIEW_BASE_URL}/api/callable/${item.action}`;
    console.log(`\nProbing endpoint: POST ${targetUrl}`);

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${masterAdminToken}`,
        'x-workspace-id': 'workspace_bhuiya_family'
      },
      body: JSON.stringify({ ...item.payload, workspaceId: 'workspace_bhuiya_family' })
    });

    const headersObj = Object.fromEntries(res.headers.entries());
    const rawBody = await res.text();

    console.log(`  -> HTTP Status: ${res.status}`);
    console.log(`  -> Content-Type: ${headersObj['content-type']}`);
    console.log(`  -> Server/Edge: ${headersObj['server'] || 'None'} / Served-By: ${headersObj['x-served-by'] || 'None'}`);
    console.log(`  -> CF-Ray Header present: ${'cf-ray' in headersObj ? 'YES (' + headersObj['cf-ray'] + ')' : 'NO'}`);
    console.log(`  -> Is Body JSON: ${rawBody.trim().startsWith('{') ? 'YES' : 'NO'}`);
    console.log(`  -> Body Snippet: ${rawBody.substring(0, 150).replace(/\r?\n/g, ' ')}...`);

    let isWorkerResponse = false;
    try {
      const parsed = JSON.parse(rawBody);
      if (parsed.data || parsed.error) {
        isWorkerResponse = true;
      }
    } catch (err) {
      console.log(`  -> JSON Parse Failure: ${err.message}`);
    }

    console.log(`  -> Worker Actually Executed: ${isWorkerResponse ? 'YES' : 'NO (Firebase Hosting SPA Fallback)'}`);
  }
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
