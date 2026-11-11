import assert from 'node:assert/strict';
import { createPresignedDownload, createPresignedUpload } from './worker/r2Service.mjs';
import { workerInstance } from './worker/index.mjs';

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
  publicJwk.kid = 'r2-test-kid';
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';
  return { keyPair, publicJwk };
}

function base64Url(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signJwt(header, payload, privateKey) {
  const encodedHeader = base64Url(header);
  const encodedPayload = base64Url(payload);
  const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, data);
  let binary = '';
  for (const byte of new Uint8Array(signature)) binary += String.fromCharCode(byte);
  const encodedSignature = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

async function runTests() {
  const { keyPair, publicJwk } = await generateTestRsaKeyPair();
  const now = Math.floor(Date.now() / 1000);
  const projectId = 'bhuiya-property-staging';
  const workspaceId = 'workspace_bhuiya_family';
  const adminUid = 'r2-admin';
  const viewerUid = 'r2-viewer';
  const jwtHeader = { alg: 'RS256', kid: 'r2-test-kid', typ: 'JWT' };
  const makePayload = (uid) => ({
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    auth_time: now - 60,
    user_id: uid,
    sub: uid,
    iat: now - 60,
    exp: now + 3600
  });
  const adminToken = await signJwt(jwtHeader, makePayload(adminUid), keyPair.privateKey);
  const viewerToken = await signJwt(jwtHeader, makePayload(viewerUid), keyPair.privateKey);
  const testEnv = {
    FIREBASE_PROJECT_ID: projectId,
    __MOCK_JWKS__: { keys: [publicJwk] },
    __MOCK_WORKSPACE_MEMBERS__: {
      [adminUid]: { uid: adminUid, workspaceId, role: 'owner', status: 'active' },
      [viewerUid]: { uid: viewerUid, workspaceId, role: 'viewer', status: 'active', permissions: {} }
    }
  };
  const adminHeaders = {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
    Origin: 'https://iamzahid.pages.dev',
    'x-workspace-id': workspaceId
  };
  const viewerHeaders = { ...adminHeaders, Authorization: `Bearer ${viewerToken}` };

  const preflight = await workerInstance.fetch(new Request(
    'https://iamzahid.pages.dev/api/storage/files',
    {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://iamzahid.pages.dev',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization, Content-Type'
      }
    }
  ), {}, {});
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://iamzahid.pages.dev');

  const unauthenticated = await workerInstance.fetch(
    new Request('https://iamzahid.pages.dev/api/storage/files'),
    {},
    {}
  );
  assert.equal(unauthenticated.status, 401);

  const signedUpload = await createPresignedUpload({
    R2_ACCOUNT_ID: 'test-account',
    R2_BUCKET_NAME: 'private-test-bucket',
    R2_ACCESS_KEY_ID: 'TEST_ACCESS_KEY',
    R2_SECRET_ACCESS_KEY: 'TEST_SECRET_KEY'
  }, {
    objectKey: 'property-manager/properties/property-1/documents/file-test',
    mimeType: 'application/pdf',
    fileHash: 'a'.repeat(64)
  });
  const uploadUrl = new URL(signedUpload.url);
  assert.equal(uploadUrl.hostname, 'test-account.r2.cloudflarestorage.com');
  assert.equal(uploadUrl.searchParams.get('X-Amz-Expires'), '300');
  assert.match(uploadUrl.searchParams.get('X-Amz-SignedHeaders') || '', /x-amz-checksum-sha256/);
  assert.equal(signedUpload.requiredHeaders['x-amz-meta-sha256'], 'a'.repeat(64));
  const signedDownload = await createPresignedDownload({
    R2_ACCOUNT_ID: 'test-account',
    R2_BUCKET_NAME: 'private-test-bucket',
    R2_ACCESS_KEY_ID: 'TEST_ACCESS_KEY',
    R2_SECRET_ACCESS_KEY: 'TEST_SECRET_KEY'
  }, {
    objectKey: 'property-manager/private-file',
    mimeType: 'application/pdf',
    fileName: 'property-record.pdf',
    disposition: 'inline'
  });
  assert.equal(new URL(signedDownload.url).hostname, 'test-account.r2.cloudflarestorage.com');

  const legacyDriveRoute = await workerInstance.fetch(new Request(
    'https://iamzahid.pages.dev/api/storage/drive/status',
    { headers: adminHeaders }
  ), testEnv, {});
  assert.equal(legacyDriveRoute.status, 404);
  const legacyUploadRoute = await workerInstance.fetch(new Request(
    'https://iamzahid.pages.dev/api/storage/files/upload',
    { method: 'POST', headers: adminHeaders, body: '{}' }
  ), testEnv, {});
  assert.equal(legacyUploadRoute.status, 404);

  const r2Collections = {
    properties: {
      'property-1': { workspaceId, ownerUid: adminUid }
    },
    storageFiles: {
      'legacy-drive-file': {
        workspaceId,
        uploadedBy: adminUid,
        fileName: 'old-file.pdf',
        status: 'active'
      },
      'foreign-r2-file': {
        workspaceId: 'another-workspace',
        storageProvider: 'cloudflare-r2',
        objectKey: 'foreign/file',
        fileName: 'foreign.pdf',
        status: 'active',
        uploadedBy: adminUid
      }
    },
    storage_audit_logs: {}
  };
  const firestore = {
    getDocument: async (collection, id) => {
      const data = r2Collections[collection]?.[id];
      return data ? { id, data: { ...data } } : null;
    },
    queryByField: async (collection, field, _operator, value) =>
      Object.entries(r2Collections[collection] || {})
        .filter(([, data]) => data[field] === value)
        .map(([id, data]) => ({ id, data: { ...data } })),
    createDocument: async (collection, id, data) => {
      r2Collections[collection] ||= {};
      if (r2Collections[collection][id]) throw new Error('Document already exists');
      r2Collections[collection][id] = { ...data };
    },
    updateDocument: async (collection, id, data) => {
      if (!r2Collections[collection]?.[id]) throw new Error('Document not found');
      Object.assign(r2Collections[collection][id], data);
    }
  };
  const r2Objects = {};
  const mockR2 = {
    presignUpload: async ({ objectKey, mimeType, fileHash }) => ({
      url: 'https://mock-r2.example.test/signed-upload',
      expiresIn: 300,
      requiredHeaders: { 'Content-Type': mimeType, 'x-amz-meta-sha256': fileHash },
      objectKey
    }),
    headObject: async (objectKey) => {
      if (!r2Objects[objectKey]) throw Object.assign(new Error('Object not found'), { name: 'NotFound' });
      return r2Objects[objectKey];
    },
    presignDownload: async ({ objectKey }) => ({
      url: `https://mock-r2.example.test/signed-download/${encodeURIComponent(objectKey)}`,
      expiresIn: 300
    }),
    deleteObject: async (objectKey) => { delete r2Objects[objectKey]; },
    health: async () => true
  };
  const r2Env = {
    ...testEnv,
    R2_ACCOUNT_ID: 'test-account',
    R2_BUCKET_NAME: 'private-test-bucket',
    R2_ACCESS_KEY_ID: 'TEST_ACCESS_KEY',
    R2_SECRET_ACCESS_KEY: 'TEST_SECRET_KEY',
    __TEST_FIRESTORE_CLIENT__: firestore,
    __MOCK_R2__: mockR2
  };

  const unconfiguredHealth = await workerInstance.fetch(new Request(
    'https://iamzahid.pages.dev/api/storage/health',
    { headers: adminHeaders }
  ), testEnv, {});
  assert.equal(unconfiguredHealth.status, 503);
  assert.equal((await unconfiguredHealth.json()).error.code, 'R2_NOT_CONFIGURED');

  const fileId = 'file_123e4567-e89b-42d3-a456-426614174000';
  const fileHash = 'a'.repeat(64);
  const initiate = await workerInstance.fetch(new Request(
    'https://iamzahid.pages.dev/api/storage/upload/initiate',
    {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        fileId,
        fileName: 'property-record.pdf',
        mimeType: 'application/pdf',
        fileSize: 5,
        fileHash,
        category: 'property_document',
        propertyId: 'property-1'
      })
    }
  ), r2Env, {});
  assert.equal(initiate.status, 201);
  const intent = r2Collections.storageFiles[fileId];
  assert.equal(intent.storageProvider, 'cloudflare-r2');
  assert.equal(intent.workspaceId, workspaceId);
  assert.match(intent.objectKey, /^property-manager\/properties\/property-1\/documents\//);

  const viewerInitiate = await workerInstance.fetch(new Request(
    'https://iamzahid.pages.dev/api/storage/upload/initiate',
    {
      method: 'POST',
      headers: viewerHeaders,
      body: JSON.stringify({
        fileId: 'file_123e4567-e89b-42d3-a456-426614174001',
        fileName: 'restricted.pdf',
        mimeType: 'application/pdf',
        fileSize: 5,
        fileHash,
        category: 'property_document',
        propertyId: 'property-1'
      })
    }
  ), r2Env, {});
  assert.equal(viewerInitiate.status, 403);

  r2Objects[intent.objectKey] = {
    fileSize: 5,
    mimeType: 'application/pdf',
    fileHash,
    checksumSha256: Buffer.from(fileHash, 'hex').toString('base64')
  };
  const complete = await workerInstance.fetch(new Request(
    'https://iamzahid.pages.dev/api/storage/upload/complete',
    { method: 'POST', headers: adminHeaders, body: JSON.stringify({ fileId }) }
  ), r2Env, {});
  assert.equal(complete.status, 200);
  assert.equal((await complete.json()).file.status, 'active');

  const list = await workerInstance.fetch(new Request(
    'https://iamzahid.pages.dev/api/storage/files',
    { headers: adminHeaders }
  ), r2Env, {});
  const listedFiles = (await list.json()).files;
  assert.deepEqual(listedFiles.map((file) => file.id), [fileId]);

  const legacyMetadata = await workerInstance.fetch(new Request(
    'https://iamzahid.pages.dev/api/storage/files/legacy-drive-file',
    { headers: adminHeaders }
  ), r2Env, {});
  assert.equal(legacyMetadata.status, 404);
  const foreignFile = await workerInstance.fetch(new Request(
    'https://iamzahid.pages.dev/api/storage/files/foreign-r2-file/preview',
    { headers: adminHeaders }
  ), r2Env, {});
  assert.equal(foreignFile.status, 404);

  const preview = await workerInstance.fetch(new Request(
    `https://iamzahid.pages.dev/api/storage/files/${fileId}/preview`,
    { headers: adminHeaders }
  ), r2Env, {});
  assert.equal(preview.status, 200);
  assert.match((await preview.json()).url, /^https:\/\/mock-r2\.example\.test\/signed-download\//);

  const viewerDelete = await workerInstance.fetch(new Request(
    `https://iamzahid.pages.dev/api/storage/files/${fileId}`,
    { method: 'DELETE', headers: viewerHeaders }
  ), r2Env, {});
  assert.equal(viewerDelete.status, 403);

  const deleteResponse = await workerInstance.fetch(new Request(
    `https://iamzahid.pages.dev/api/storage/files/${fileId}`,
    { method: 'DELETE', headers: adminHeaders }
  ), r2Env, {});
  assert.equal(deleteResponse.status, 200);
  assert.equal(r2Collections.storageFiles[fileId].status, 'deleted');

  console.log('R2 storage tests passed: authorization, upload integrity, private access, and legacy route removal.');
}

runTests().catch((error) => {
  console.error('R2 storage tests failed:', error);
  process.exit(1);
});
