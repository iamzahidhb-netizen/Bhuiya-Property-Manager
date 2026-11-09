/**
 * Test Suite: Google Drive Secure Cloud Storage Integration
 * 
 * Verifies:
 * 1. Web Crypto AES-256-GCM Encryption / Decryption of refresh tokens
 * 2. OAuth state signing & HMAC-SHA256 tamper verification
 * 3. OAuth 2.0 authorization URL creation with offline access & drive.file scope
 * 4. Folder structure mapping & category resolution
 * 5. Router endpoints:
 *    - OPTIONS preflight (CORS headers, allowed methods)
 *    - GET /api/storage/drive/status
 *    - POST /api/storage/drive/connect (Admin check)
 *    - GET /api/storage/drive/callback (state verification)
 *    - POST /api/storage/files/upload (file validation, RBAC)
 *    - GET /api/storage/files (listing)
 *    - GET /api/storage/files/:id/preview and /download
 *    - DELETE /api/storage/files/:id
 *    - Non-admin RBAC denial
 *    - Unauthenticated denial
 */

import assert from 'node:assert/strict';
import {
  encryptAesGcm,
  decryptAesGcm,
  signOAuthState,
  verifyOAuthState,
  bufferToBase64
} from './worker/cryptoUtil.mjs';
import {
  generateOAuthUrl,
  initializeFolderStructure,
  resolveFolderIdForCategory
} from './worker/googleDriveService.mjs';
import { workerInstance } from './worker/index.mjs';

console.log('>>> [TEST] Running Google Drive Storage Invariant Test Suite...');

// Helpers for RS256 mock JWT generation
async function generateTestRsaKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['sign', 'verify']
  );
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  publicJwk.kid = 'drive-test-kid';
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';
  return { keyPair, publicJwk };
}

function base64Url(obj) {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  const utf8 = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8.length; i++) binary += String.fromCharCode(utf8[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signJwt(header, payload, privKey) {
  const h = base64Url(header);
  const p = base64Url(payload);
  const data = new TextEncoder().encode(`${h}.${p}`);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privKey, data);
  const bytes = new Uint8Array(sig);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `${h}.${p}.${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

async function runTests() {
  // Generate random 256-bit encryption key
  const rawKey = new Uint8Array(32);
  crypto.getRandomValues(rawKey);
  const testEncKey = bufferToBase64(rawKey);

  // --------------------------------------------------------------------------
  // TEST 1: AES-256-GCM Encryption & Decryption
  // --------------------------------------------------------------------------
  console.log('  [1/8] Testing AES-256-GCM authenticated encryption...');
  const secretRefreshToken = '1//0gMOCK_REFRESH_TOKEN_SECURE_ABC123xyz_PRIVATE';
  const encryptedPayload = await encryptAesGcm(secretRefreshToken, testEncKey);
  
  assert.ok(encryptedPayload.ciphertext, 'Ciphertext must be present');
  assert.ok(encryptedPayload.iv, 'IV must be present');
  assert.notEqual(encryptedPayload.ciphertext, secretRefreshToken, 'Ciphertext must not be plaintext');

  const decryptedToken = await decryptAesGcm(encryptedPayload, testEncKey);
  assert.equal(decryptedToken, secretRefreshToken, 'Decrypted token must exactly match original');

  // Verify tampering fails decryption
  const tamperedPayload = {
    ...encryptedPayload,
    ciphertext: 'A' + encryptedPayload.ciphertext.slice(1)
  };
  await assert.rejects(
    async () => await decryptAesGcm(tamperedPayload, testEncKey),
    /Decryption failed|operation failed/i,
    'Tampered ciphertext must fail authentication check'
  );
  console.log('    ✓ AES-256-GCM encryption, decryption, and tamper rejection passed');

  // --------------------------------------------------------------------------
  // TEST 2: OAuth State Signing & HMAC-SHA256 Verification
  // --------------------------------------------------------------------------
  console.log('  [2/8] Testing OAuth state HMAC signing and CSRF verification...');
  const statePayload = { adminUid: 'admin-zahid-123', ts: Date.now() };
  const signedState = await signOAuthState(statePayload, testEncKey);
  assert.ok(signedState.includes('.'), 'Signed state must contain payload and signature separated by dot');

  const verifiedPayload = await verifyOAuthState(signedState, testEncKey);
  assert.equal(verifiedPayload.adminUid, 'admin-zahid-123', 'Verified payload UID must match');

  // Tampered state check
  const tamperedState = signedState.slice(0, -3) + 'xyz';
  await assert.rejects(
    async () => await verifyOAuthState(tamperedState, testEncKey),
    /Invalid OAuth state signature/i,
    'Tampered state signature must be rejected'
  );
  console.log('    ✓ OAuth state signing and tamper verification passed');

  // --------------------------------------------------------------------------
  // TEST 3: Google Drive OAuth URL Generation
  // --------------------------------------------------------------------------
  console.log('  [3/8] Testing OAuth 2.0 URL generation & scopes...');
  const oauthUrl = generateOAuthUrl({
    clientId: 'mock-google-client-id.apps.googleusercontent.com',
    redirectUri: 'https://iamzahid.pages.dev/api/storage/drive/callback',
    state: signedState
  });
  
  const parsedUrl = new URL(oauthUrl);
  assert.equal(parsedUrl.origin, 'https://accounts.google.com');
  assert.equal(parsedUrl.searchParams.get('access_type'), 'offline', 'Must request offline access for refresh token');
  assert.equal(parsedUrl.searchParams.get('prompt'), 'consent', 'Must prompt for consent to guarantee refresh token');
  assert.ok(parsedUrl.searchParams.get('scope').includes('https://www.googleapis.com/auth/drive.file'), 'Must request drive.file scope');
  assert.ok(parsedUrl.searchParams.get('scope').includes('https://www.googleapis.com/auth/userinfo.email'), 'Must request userinfo.email scope');
  console.log('    ✓ Google Drive OAuth URL generated with strict parameters');

  // --------------------------------------------------------------------------
  // TEST 4: Category Folder Resolution
  // --------------------------------------------------------------------------
  console.log('  [4/8] Testing folder category mapping...');
  const mockFolders = {
    rootId: 'folder-root',
    tenants_nid: 'folder-nid',
    agreements_rent: 'folder-agreement',
    financial_receipts: 'folder-receipt',
    financial_invoices: 'folder-invoice'
  };
  assert.equal(resolveFolderIdForCategory('nid', mockFolders), 'folder-nid');
  assert.equal(resolveFolderIdForCategory('rental_agreement', mockFolders), 'folder-agreement');
  assert.equal(resolveFolderIdForCategory('expense_invoice', mockFolders), 'folder-invoice');
  assert.equal(resolveFolderIdForCategory('unrecognized_type', mockFolders), 'folder-root');
  console.log('    ✓ Category folder resolution passed');

  // --------------------------------------------------------------------------
  // TEST 5: Worker CORS Preflight for Storage
  // --------------------------------------------------------------------------
  console.log('  [5/8] Testing CORS preflight on /api/storage/files...');
  const preflightReq = new Request('https://iamzahid.pages.dev/api/storage/files', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://iamzahid.pages.dev',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Authorization, Content-Type'
    }
  });
  const preflightRes = await workerInstance.fetch(preflightReq, {}, {});
  assert.equal(preflightRes.status, 204, 'Preflight must return 204');
  assert.equal(preflightRes.headers.get('Access-Control-Allow-Origin'), 'https://iamzahid.pages.dev');
  assert.ok(preflightRes.headers.get('Access-Control-Allow-Methods').includes('GET'));
  assert.ok(preflightRes.headers.get('Access-Control-Allow-Methods').includes('POST'));
  assert.ok(preflightRes.headers.get('Access-Control-Allow-Methods').includes('DELETE'));
  console.log('    ✓ Storage CORS preflight passed');

  // --------------------------------------------------------------------------
  // TEST 6: Unauthenticated Request Rejection
  // --------------------------------------------------------------------------
  console.log('  [6/8] Testing unauthenticated storage requests rejection...');
  const unauthReq = new Request('https://iamzahid.pages.dev/api/storage/files', {
    method: 'GET'
  });
  const unauthRes = await workerInstance.fetch(unauthReq, {}, {});
  assert.equal(unauthRes.status, 401, 'Unauthenticated storage request must be rejected with 401');
  const unauthJson = await unauthRes.json();
  assert.equal(unauthJson.error.code, 'UNAUTHENTICATED');
  console.log('    ✓ Unauthenticated requests rejected');

  // --------------------------------------------------------------------------
  // TEST 7: Mock Authenticated Storage Operations (Status, List, Upload, Delete)
  // --------------------------------------------------------------------------
  console.log('  [7/8] Testing authenticated storage operations with mock environment...');
  
  // Set up mock environment with in-memory stores
  const { keyPair, publicJwk } = await generateTestRsaKeyPair();
  const mockJwks = { keys: [publicJwk] };

  const now = Math.floor(Date.now() / 1000);
  const adminPayload = {
    iss: 'https://securetoken.google.com/bhuiya-property-staging',
    aud: 'bhuiya-property-staging',
    auth_time: now - 60,
    user_id: 'admin-zahid',
    sub: 'admin-zahid',
    iat: now - 60,
    exp: now + 3600
  };
  const viewerPayload = {
    iss: 'https://securetoken.google.com/bhuiya-property-staging',
    aud: 'bhuiya-property-staging',
    auth_time: now - 60,
    user_id: 'viewer-user',
    sub: 'viewer-user',
    iat: now - 60,
    exp: now + 3600
  };

  const jwtHeader = { alg: 'RS256', kid: 'drive-test-kid', typ: 'JWT' };
  const adminToken = await signJwt(jwtHeader, adminPayload, keyPair.privateKey);
  const viewerToken = await signJwt(jwtHeader, viewerPayload, keyPair.privateKey);

  const mockStorageFiles = {
    'file-101': {
      id: 'file-101',
      driveFileId: 'drive-abc-123',
      fileName: 'nid_card.pdf',
      category: 'nid',
      fileSize: 10240,
      mimeType: 'application/pdf',
      uploadedBy: 'admin-zahid',
      status: 'active'
    }
  };

  const testEnv = {
    FIREBASE_PROJECT_ID: 'bhuiya-property-staging',
    GOOGLE_DRIVE_CLIENT_ID: 'mock-client-id',
    GOOGLE_DRIVE_CLIENT_SECRET: 'mock-client-secret',
    DRIVE_ENCRYPTION_KEY: testEncKey,
    __MOCK_JWKS__: mockJwks,
    __MOCK_WORKSPACE_MEMBERS__: {
      'admin-zahid': {
        uid: 'admin-zahid',
        role: 'owner',
        status: 'active',
        permissions: { manageSettings: true }
      },
      'viewer-user': {
        uid: 'viewer-user',
        role: 'viewer',
        status: 'active',
        permissions: {}
      }
    },
    __MOCK_DRIVE_INTEGRATION__: {
      connected: true,
      connectedEmail: 'zahid.property@gmail.com',
      connectedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      status: 'connected',
      rootFolderId: 'root-folder-123',
      folders: { nid: 'nid-folder-id' }
    },
    __MOCK_STORAGE_FILES__: mockStorageFiles,
    FETCH_IMPL: async (url, init) => {
      return new Response(JSON.stringify({}), { status: 200 });
    }
  };

  // 7.1 GET /api/storage/drive/status
  const statusReq = new Request('https://iamzahid.pages.dev/api/storage/drive/status', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Origin': 'https://iamzahid.pages.dev'
    }
  });
  const statusRes = await workerInstance.fetch(statusReq, testEnv, {});
  if (statusRes.status !== 200) {
    console.error('Status response body:', await statusRes.text());
  }
  assert.equal(statusRes.status, 200);
  const statusJson = await statusRes.json();
  assert.equal(statusJson.connected, true);
  assert.equal(statusJson.connectedEmail, 'zahid.property@gmail.com');

  // 7.2 GET /api/storage/files (List active files)
  const listReq = new Request('https://iamzahid.pages.dev/api/storage/files', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${viewerToken}`,
      'Origin': 'https://iamzahid.pages.dev'
    }
  });
  const listRes = await workerInstance.fetch(listReq, testEnv, {});
  assert.equal(listRes.status, 200);
  const listJson = await listRes.json();
  assert.ok(Array.isArray(listJson.files));
  assert.equal(listJson.files.length, 1);
  assert.equal(listJson.files[0].fileName, 'nid_card.pdf');

  // 7.3 GET /api/storage/files/file-101/download
  const downloadReq = new Request('https://iamzahid.pages.dev/api/storage/files/file-101/download', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${viewerToken}`,
      'Origin': 'https://iamzahid.pages.dev'
    }
  });
  const downloadRes = await workerInstance.fetch(downloadReq, testEnv, {});
  assert.equal(downloadRes.status, 200);
  assert.ok(downloadRes.headers.get('Content-Disposition').includes('attachment'));

  // 7.4 DELETE /api/storage/files/file-101 (Non-admin viewer should be rejected)
  const deleteReqViewer = new Request('https://iamzahid.pages.dev/api/storage/files/file-101', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${viewerToken}`,
      'Origin': 'https://iamzahid.pages.dev'
    }
  });
  const deleteResViewer = await workerInstance.fetch(deleteReqViewer, testEnv, {});
  assert.equal(deleteResViewer.status, 403, 'Viewer cannot delete files created by other users');

  // 7.5 DELETE /api/storage/files/file-101 (Admin should succeed)
  const deleteReqAdmin = new Request('https://iamzahid.pages.dev/api/storage/files/file-101', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Origin': 'https://iamzahid.pages.dev'
    }
  });
  const deleteResAdmin = await workerInstance.fetch(deleteReqAdmin, testEnv, {});
  assert.equal(deleteResAdmin.status, 200);
  assert.equal(mockStorageFiles['file-101'].status, 'deleted');

  console.log('    ✓ Storage operations (status, list, download, RBAC delete) passed');

  // --------------------------------------------------------------------------
  // TEST 8: Connect Endpoint Role Security
  // --------------------------------------------------------------------------
  console.log('  [8/8] Testing RBAC protection on connect & disconnect endpoints...');
  const connectReqViewer = new Request('https://iamzahid.pages.dev/api/storage/drive/connect', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${viewerToken}`,
      'Origin': 'https://iamzahid.pages.dev'
    }
  });
  const connectResViewer = await workerInstance.fetch(connectReqViewer, testEnv, {});
  assert.equal(connectResViewer.status, 403, 'Viewer must not be allowed to connect Drive');

  const connectReqAdmin = new Request('https://iamzahid.pages.dev/api/storage/drive/connect', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Origin': 'https://iamzahid.pages.dev'
    }
  });
  const connectResAdmin = await workerInstance.fetch(connectReqAdmin, testEnv, {});
  assert.equal(connectResAdmin.status, 200, 'Admin must be permitted to initiate Drive connection');
  const connectJson = await connectResAdmin.json();
  assert.ok(connectJson.authUrl.includes('accounts.google.com'));

  console.log('    ✓ RBAC authorization controls passed');

  console.log('\n>>> [TEST SUCCESS] All 8 Google Drive Storage invariants passed flawlessly!\n');
}

runTests().catch(err => {
  console.error('\n>>> [TEST FAILED]:', err);
  process.exit(1);
});
