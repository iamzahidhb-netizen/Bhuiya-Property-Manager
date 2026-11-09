/**
 * Google Drive Secure Storage Router for Cloudflare Pages Worker
 * 
 * Implements:
 * - /api/storage/drive/status
 * - /api/storage/drive/connect
 * - /api/storage/drive/callback
 * - /api/storage/drive/disconnect
 * - /api/storage/drive/test
 * - /api/storage/files/upload
 * - /api/storage/files
 * - /api/storage/files/:id
 * - /api/storage/files/:id/preview
 * - /api/storage/files/:id/download
 * - /api/storage/files/:id (DELETE)
 */

import {
  generateOAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getConnectedUserInfo,
  initializeFolderStructure,
  resolveFolderIdForCategory,
  uploadFileToDrive,
  downloadFileFromDrive,
  deleteFileFromDrive,
  revokeGoogleToken
} from './googleDriveService.mjs';
import {
  encryptAesGcm,
  decryptAesGcm,
  signOAuthState,
  verifyOAuthState,
  base64ToBuffer
} from './cryptoUtil.mjs';
import { jsonResponse, errorResponse } from '../workerRouter.mjs';

const INTEGRATIONS_COLLECTION = 'system_integrations';
const DRIVE_DOC_ID = 'google_drive';
const STORAGE_FILES_COLLECTION = 'storageFiles';
const AUDIT_LOGS_COLLECTION = 'storage_audit_logs';

const ALLOWED_CATEGORIES = [
  'nid',
  'tenant_photo',
  'personal_document',
  'rental_agreement',
  'agreement_renewal',
  'rent_receipt',
  'expense_invoice',
  'payment_proof',
  'property_document',
  'maintenance_photo',
  'monthly_report',
  'yearly_report',
  'tax_summary',
  'other'
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

/**
 * Helper to record storage audit logs in Firestore.
 */
async function recordStorageAudit(firestore, { actorUid, action, fileRecordId, result, details }) {
  if (!firestore) return;
  try {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await firestore.createDocument(AUDIT_LOGS_COLLECTION, id, {
      actorUid: actorUid || 'anonymous',
      action,
      fileRecordId: fileRecordId || null,
      result: result || 'success',
      details: details || null,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to write storage audit log:', err.message);
  }
}

/**
 * Retrieves valid Google Drive access token from stored encrypted refresh token.
 */
/**
 * Resolves Google Drive OAuth secrets with automatic 256-bit AES key derivation and Firestore fallback.
 */
export async function resolveDriveSecrets(env, firestore, config = null) {
  let clientId = env.GOOGLE_DRIVE_CLIENT_ID || null;
  let clientSecret = env.GOOGLE_DRIVE_CLIENT_SECRET || null;
  let encKey = env.DRIVE_ENCRYPTION_KEY || null;

  // 1. Check if configured in Firestore system_integrations/google_drive
  if ((!clientId || !clientSecret || !encKey) && firestore) {
    try {
      const doc = await firestore.getDocument(INTEGRATIONS_COLLECTION, DRIVE_DOC_ID);
      if (doc?.data) {
        if (!clientId && doc.data.clientId) clientId = doc.data.clientId;
        if (!clientSecret && doc.data.clientSecret) clientSecret = doc.data.clientSecret;
        if (!encKey && doc.data.encryptionKey) encKey = doc.data.encryptionKey;
      }
    } catch (_) {}
  }

  // 2. Automatically derive cryptographically secure 256-bit encryption key from service account private key if not set
  if (!encKey) {
    const rawKey = config?.credentials?.private_key || env.FIREBASE_SERVICE_ACCOUNT_KEY || env.FIREBASE_PRIVATE_KEY || 'bhuiya-property-staging-vault-secret';
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawKey));
    const bytes = new Uint8Array(hash);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    encKey = btoa(binary);
  }

  return { clientId, clientSecret, encKey };
}

async function getDriveAuthContext(env, firestore, config = null) {
  const { clientId, clientSecret, encKey } = await resolveDriveSecrets(env, firestore, config);

  if (!clientId || !clientSecret) {
    const err = new Error('Google Drive Client ID বা Client Secret পাওয়া যায়নি। অনুগ্রহ করে সেটিংস থেকে সেট করুন।');
    err.code = 'DRIVE_CONFIG_MISSING';
    err.status = 503;
    throw err;
  }

  // Support injected mock integration in tests
  if (env.__MOCK_DRIVE_INTEGRATION__) {
    return {
      accessToken: 'mock-access-token',
      folders: env.__MOCK_DRIVE_INTEGRATION__.folders || {},
      integration: env.__MOCK_DRIVE_INTEGRATION__
    };
  }

  if (!firestore) {
    throw new Error('Database client unavailable');
  }

  const doc = await firestore.getDocument(INTEGRATIONS_COLLECTION, DRIVE_DOC_ID);
  const data = doc?.data || null;

  if (!data || !data.connected || !data.encryptedRefreshToken) {
    const err = new Error('Google Drive is not connected. Please connect Google Drive in Settings.');
    err.code = 'DRIVE_NOT_CONNECTED';
    err.status = 400;
    throw err;
  }

  let refreshToken;
  try {
    refreshToken = await decryptAesGcm(
      { ciphertext: data.encryptedRefreshToken, iv: data.encryptionIv },
      encKey
    );
  } catch (decErr) {
    const err = new Error('Failed to decrypt stored Google Drive credentials');
    err.code = 'DECRYPTION_FAILED';
    err.status = 500;
    throw err;
  }

  const { accessToken } = await refreshAccessToken(
    { refreshToken, clientId, clientSecret },
    env.FETCH_IMPL || fetch
  );

  return {
    accessToken,
    folders: data.folders || {},
    integration: data
  };
}

/**
 * Storage API Request Dispatcher
 */
export async function handleStorageRequest(request, pathname, env, ctx, workerContext) {
  const method = request.method;
  const url = new URL(request.url);
  const firestore = workerContext.firestore;
  const authContext = workerContext.authContext; // null for callback
  const verifiedUser = workerContext.verifiedUser; // null for callback

  // =========================================================================
  // 1. GET /api/storage/drive/callback (OAuth Redirect Callback)
  // =========================================================================
  if (pathname === '/api/storage/drive/callback' && method === 'GET') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    const appOrigin = url.origin;

    if (error) {
      await recordStorageAudit(firestore, {
        actorUid: null,
        action: 'drive_connect_denied',
        result: 'failed',
        details: { error }
      });
      return Response.redirect(`${appOrigin}/?storage_error=${encodeURIComponent(error)}`, 302);
    }

    if (!code || !state) {
      return errorResponse('INVALID_ARGUMENT', 'Missing OAuth code or state parameter', 400);
    }

    const encKey = env.DRIVE_ENCRYPTION_KEY;
    const clientId = env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = env.GOOGLE_DRIVE_CLIENT_SECRET;
    const redirectUri = env.GOOGLE_DRIVE_REDIRECT_URI || `${url.origin}/api/storage/drive/callback`;

    try {
      const statePayload = await verifyOAuthState(state, encKey);
      const actorUid = statePayload.callerUid;

      const tokens = await exchangeCodeForTokens(
        { code, clientId, clientSecret, redirectUri },
        env.FETCH_IMPL || fetch
      );

      if (!tokens.refreshToken) {
        throw new Error('Google did not return a refresh token. Please re-authorize with consent prompt.');
      }

      const userInfo = await getConnectedUserInfo(tokens.accessToken, env.FETCH_IMPL || fetch);

      // Initialize full 5-group folder structure
      const folderTree = await initializeFolderStructure(tokens.accessToken, env.FETCH_IMPL || fetch);

      // Encrypt refresh token
      const encResult = await encryptAesGcm(tokens.refreshToken, encKey);

      const now = new Date().toISOString();
      const integrationDoc = {
        connected: true,
        connectedEmail: userInfo.email,
        connectedBy: actorUid,
        connectedAt: now,
        lastCheckedAt: now,
        status: 'active',
        scope: tokens.scope,
        rootFolderId: folderTree.rootId,
        folders: folderTree.folders,
        encryptedRefreshToken: encResult.ciphertext,
        encryptionIv: encResult.iv,
        updatedAt: now
      };

      if (firestore) {
        await firestore.setDocument(INTEGRATIONS_COLLECTION, DRIVE_DOC_ID, integrationDoc);
      }

      await recordStorageAudit(firestore, {
        actorUid,
        action: 'drive_connected',
        result: 'success',
        details: { email: userInfo.email }
      });

      return Response.redirect(`${appOrigin}/?storage=connected`, 302);
    } catch (cbErr) {
      console.error('OAuth Callback Error:', cbErr);
      await recordStorageAudit(firestore, {
        actorUid: null,
        action: 'drive_callback_failed',
        result: 'failed',
        details: { message: cbErr.message }
      });
      return Response.redirect(`${appOrigin}/?storage_error=${encodeURIComponent(cbErr.message)}`, 302);
    }
  }

  // All remaining storage routes require authenticated session
  if (!verifiedUser) {
    return errorResponse('UNAUTHENTICATED', 'Authentication required for storage operations', 401);
  }

  const callerUid = verifiedUser.uid;
  const isMasterAdmin = authContext?.isMasterAdmin || false;

  // =========================================================================
  // 2. GET /api/storage/drive/status
  // =========================================================================
  if (pathname === '/api/storage/drive/status' && method === 'GET') {
    if (env.__MOCK_DRIVE_INTEGRATION__) {
      return jsonResponse({
        connected: env.__MOCK_DRIVE_INTEGRATION__.connected,
        connectedEmail: env.__MOCK_DRIVE_INTEGRATION__.connectedEmail,
        connectedAt: env.__MOCK_DRIVE_INTEGRATION__.connectedAt,
        lastCheckedAt: env.__MOCK_DRIVE_INTEGRATION__.lastCheckedAt,
        status: env.__MOCK_DRIVE_INTEGRATION__.status,
        rootFolderId: env.__MOCK_DRIVE_INTEGRATION__.rootFolderId,
        folderCount: Object.keys(env.__MOCK_DRIVE_INTEGRATION__.folders || {}).length
      });
    }

    if (!firestore) {
      return errorResponse('SERVICE_UNAVAILABLE', 'Database unavailable', 503);
    }

    const doc = await firestore.getDocument(INTEGRATIONS_COLLECTION, DRIVE_DOC_ID);
    const data = doc?.data || null;

    const secrets = await resolveDriveSecrets(env, firestore, workerContext?.config);
    const hasConfig = Boolean(secrets.clientId && secrets.clientSecret);

    if (!data || !data.connected) {
      return jsonResponse({
        connected: false,
        status: 'disconnected',
        hasConfig,
        clientId: secrets.clientId ? `${secrets.clientId.slice(0, 12)}...` : null
      });
    }

    return jsonResponse({
      connected: true,
      connectedEmail: data.connectedEmail || null,
      connectedBy: data.connectedBy || null,
      connectedAt: data.connectedAt || null,
      lastCheckedAt: data.lastCheckedAt || null,
      status: data.status || 'active',
      rootFolderId: data.rootFolderId || null,
      folderCount: Object.keys(data.folders || {}).length
    });
  }

  // =========================================================================
  // 3. POST /api/storage/drive/connect (Master Admin ONLY)
  // =========================================================================
  if (pathname === '/api/storage/drive/connect' && method === 'POST') {
    if (!isMasterAdmin) {
      return errorResponse('PERMISSION_DENIED', 'Master Admin role required to connect Google Drive', 403);
    }

    const { clientId, encKey } = await resolveDriveSecrets(env, firestore, workerContext?.config);
    const redirectUri = env.GOOGLE_DRIVE_REDIRECT_URI || `${url.origin}/api/storage/drive/callback`;

    if (!clientId) {
      return errorResponse(
        'CONFIG_ERROR',
        'Google Drive Client ID পাওয়া যায়নি। অনুগ্রহ করে Settings থেকে Client ID ও Secret প্রদান করুন।',
        503
      );
    }

    const state = await signOAuthState(
      { callerUid, workspaceId: authContext.workspaceId || 'workspace_bhuiya_family' },
      encKey
    );

    const authUrl = generateOAuthUrl({ clientId, redirectUri, state });
    return jsonResponse({ success: true, url: authUrl, authUrl });
  }

  // =========================================================================
  // 3.1 POST /api/storage/drive/configure (Master Admin ONLY)
  // =========================================================================
  if (pathname === '/api/storage/drive/configure' && method === 'POST') {
    if (!isMasterAdmin) {
      return errorResponse('PERMISSION_DENIED', 'Master Admin role required to configure Google Drive', 403);
    }

    let payload = {};
    try {
      payload = await request.json();
    } catch (_) {
      return errorResponse('INVALID_ARGUMENT', 'Invalid JSON payload', 400);
    }

    const { clientId, clientSecret } = payload;
    if (!clientId || !clientSecret) {
      return errorResponse('INVALID_ARGUMENT', 'Client ID এবং Client Secret আবশ্যক', 400);
    }

    if (!firestore) {
      return errorResponse('SERVICE_UNAVAILABLE', 'Database client unavailable', 503);
    }

    const existingDoc = await firestore.getDocument(INTEGRATIONS_COLLECTION, DRIVE_DOC_ID);
    const existingData = existingDoc?.data || {};

    const updatedData = {
      ...existingData,
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      configuredAt: new Date().toISOString(),
      configuredBy: callerUid
    };

    if (existingDoc) {
      await firestore.updateDocument(INTEGRATIONS_COLLECTION, DRIVE_DOC_ID, updatedData);
    } else {
      await firestore.createDocument(INTEGRATIONS_COLLECTION, DRIVE_DOC_ID, updatedData);
    }

    return jsonResponse({ success: true, message: 'Google Drive credentials configured successfully' });
  }

  // =========================================================================
  // 4. POST /api/storage/drive/disconnect (Master Admin ONLY)
  // =========================================================================
  if (pathname === '/api/storage/drive/disconnect' && method === 'POST') {
    if (!isMasterAdmin) {
      return errorResponse('PERMISSION_DENIED', 'Master Admin role required to disconnect Google Drive', 403);
    }

    if (env.__MOCK_DRIVE_INTEGRATION__) {
      env.__MOCK_DRIVE_INTEGRATION__.connected = false;
      env.__MOCK_DRIVE_INTEGRATION__.status = 'disconnected';
      return jsonResponse({ success: true, disconnected: true });
    }

    if (firestore) {
      const doc = await firestore.getDocument(INTEGRATIONS_COLLECTION, DRIVE_DOC_ID);
      const data = doc?.data || null;

      if (data?.encryptedRefreshToken && env.DRIVE_ENCRYPTION_KEY) {
        try {
          const refreshToken = await decryptAesGcm(
            { ciphertext: data.encryptedRefreshToken, iv: data.encryptionIv },
            env.DRIVE_ENCRYPTION_KEY
          );
          await revokeGoogleToken(refreshToken, env.FETCH_IMPL || fetch);
        } catch (_) {}
      }

      await firestore.setDocument(INTEGRATIONS_COLLECTION, DRIVE_DOC_ID, {
        connected: false,
        status: 'disconnected',
        disconnectedAt: new Date().toISOString(),
        disconnectedBy: callerUid
      });
    }

    await recordStorageAudit(firestore, {
      actorUid: callerUid,
      action: 'drive_disconnected',
      result: 'success'
    });

    return jsonResponse({ success: true, disconnected: true });
  }

  // =========================================================================
  // 5. POST /api/storage/drive/test (Master Admin ONLY)
  // =========================================================================
  if (pathname === '/api/storage/drive/test' && method === 'POST') {
    if (!isMasterAdmin) {
      return errorResponse('PERMISSION_DENIED', 'Master Admin role required to test connection', 403);
    }

    try {
      const driveAuth = await getDriveAuthContext(env, firestore);
      const userInfo = await getConnectedUserInfo(driveAuth.accessToken, env.FETCH_IMPL || fetch);

      const now = new Date().toISOString();
      if (firestore) {
        await firestore.updateDocument(INTEGRATIONS_COLLECTION, DRIVE_DOC_ID, {
          lastCheckedAt: now,
          status: 'active'
        });
      }

      return jsonResponse({
        success: true,
        status: 'active',
        connectedEmail: userInfo.email,
        folderCount: Object.keys(driveAuth.folders || {}).length,
        checkedAt: now
      });
    } catch (testErr) {
      return errorResponse(testErr.code || 'TEST_FAILED', testErr.message, testErr.status || 500);
    }
  }

  // =========================================================================
  // 6. POST /api/storage/files/upload (Manager / Master Admin)
  // =========================================================================
  if (pathname === '/api/storage/files/upload' && method === 'POST') {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return errorResponse('INVALID_ARGUMENT', 'Request body must be valid JSON', 400);
    }

    const {
      fileData,
      fileName,
      mimeType,
      category,
      tenantId,
      propertyId,
      unitId,
      voucherId
    } = payload;

    if (!fileData || !fileName || !category) {
      return errorResponse('INVALID_ARGUMENT', 'fileData (base64), fileName, and category are required', 400);
    }

    if (!ALLOWED_CATEGORIES.includes(category)) {
      return errorResponse('INVALID_ARGUMENT', `Invalid category "${category}". Allowed: ${ALLOWED_CATEGORIES.join(', ')}`, 400);
    }

    let fileBytes;
    try {
      fileBytes = base64ToBuffer(fileData);
    } catch {
      return errorResponse('INVALID_ARGUMENT', 'Malformed base64 fileData', 400);
    }

    if (fileBytes.byteLength > MAX_FILE_SIZE) {
      return errorResponse('FILE_TOO_LARGE', `File size exceeds 25MB limit (${fileBytes.byteLength} bytes)`, 400);
    }

    try {
      const driveAuth = await getDriveAuthContext(env, firestore);
      const targetFolderId = resolveFolderIdForCategory(category, driveAuth.folders);

      let driveResult;
      if (env.__MOCK_DRIVE_INTEGRATION__) {
        driveResult = {
          driveFileId: `mock_drive_${Date.now()}`,
          fileName,
          mimeType: mimeType || 'application/octet-stream',
          fileSize: fileBytes.byteLength,
          uploadedAt: new Date().toISOString()
        };
      } else {
        driveResult = await uploadFileToDrive({
          fileName,
          mimeType,
          parentFolderId: targetFolderId,
          fileBytes
        }, driveAuth.accessToken, env.FETCH_IMPL || fetch);
      }

      const fileRecordId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const now = new Date().toISOString();

      const fileRecord = {
        id: fileRecordId,
        workspaceId: authContext.workspaceId,
        driveFileId: driveResult.driveFileId,
        driveFolderId: targetFolderId || driveAuth.integration?.rootFolderId || null,
        fileName,
        originalFileName: fileName,
        mimeType: driveResult.mimeType || mimeType || 'application/octet-stream',
        fileSize: driveResult.fileSize || fileBytes.byteLength,
        category,
        tenantId: tenantId || null,
        propertyId: propertyId || null,
        unitId: unitId || null,
        voucherId: voucherId || null,
        status: 'active',
        uploadedBy: callerUid,
        uploadedAt: now,
        updatedAt: now
      };

      if (firestore) {
        await firestore.createDocument(STORAGE_FILES_COLLECTION, fileRecordId, fileRecord);
      }

      await recordStorageAudit(firestore, {
        actorUid: callerUid,
        action: 'file_uploaded',
        fileRecordId,
        result: 'success',
        details: { category, fileName, size: fileRecord.fileSize }
      });

      return jsonResponse({ success: true, file: fileRecord }, 201);
    } catch (uploadErr) {
      await recordStorageAudit(firestore, {
        actorUid: callerUid,
        action: 'file_upload_failed',
        result: 'failed',
        details: { fileName, error: uploadErr.message }
      });
      return errorResponse(uploadErr.code || 'UPLOAD_FAILED', uploadErr.message, uploadErr.status || 500);
    }
  }

  // =========================================================================
  // 7. GET /api/storage/files (List Files)
  // =========================================================================
  if (pathname === '/api/storage/files' && method === 'GET') {
    const category = url.searchParams.get('category');
    const tenantId = url.searchParams.get('tenantId');
    const propertyId = url.searchParams.get('propertyId');
    const voucherId = url.searchParams.get('voucherId');

    if (env.__MOCK_STORAGE_FILES__) {
      let filtered = Object.values(env.__MOCK_STORAGE_FILES__).filter(f => f.status === 'active');
      if (category) filtered = filtered.filter(f => f.category === category);
      if (tenantId) filtered = filtered.filter(f => f.tenantId === tenantId);
      if (propertyId) filtered = filtered.filter(f => f.propertyId === propertyId);
      if (voucherId) filtered = filtered.filter(f => f.voucherId === voucherId);
      return jsonResponse({ success: true, files: filtered, count: filtered.length });
    }

    if (!firestore) {
      return errorResponse('SERVICE_UNAVAILABLE', 'Database unavailable', 503);
    }

    // Query active files by workspaceId
    let queryField = 'workspaceId';
    let queryValue = authContext.workspaceId;
    if (tenantId) {
      queryField = 'tenantId';
      queryValue = tenantId;
    } else if (propertyId) {
      queryField = 'propertyId';
      queryValue = propertyId;
    }

    const docs = await firestore.queryByField(STORAGE_FILES_COLLECTION, queryField, 'EQUAL', queryValue);
    let files = docs.map(d => ({ id: d.id, ...(d.data || {}) })).filter(f => f.status === 'active');

    if (category) {
      files = files.filter(f => f.category === category);
    }
    if (voucherId) {
      files = files.filter(f => f.voucherId === voucherId);
    }

    return jsonResponse({ success: true, files, count: files.length });
  }

  // =========================================================================
  // 8. Single File Operations: /api/storage/files/:id
  // =========================================================================
  const fileMatch = pathname.match(/^\/api\/storage\/files\/([^/]+)(\/(preview|download))?$/);
  if (fileMatch) {
    const fileId = fileMatch[1];
    const subAction = fileMatch[3]; // 'preview' | 'download' | undefined

    let fileRecord = null;
    if (env.__MOCK_STORAGE_FILES__ && env.__MOCK_STORAGE_FILES__[fileId]) {
      fileRecord = env.__MOCK_STORAGE_FILES__[fileId];
    } else if (firestore) {
      const doc = await firestore.getDocument(STORAGE_FILES_COLLECTION, fileId);
      if (doc?.data && doc.data.status === 'active') {
        fileRecord = { id: doc.id, ...doc.data };
      }
    }

    if (!fileRecord) {
      return errorResponse('NOT_FOUND', 'File not found or has been deleted', 404);
    }

    // 8.1 DELETE /api/storage/files/:id
    if (method === 'DELETE') {
      if (!isMasterAdmin && fileRecord.uploadedBy !== callerUid) {
        return errorResponse('PERMISSION_DENIED', 'You do not have permission to delete this file', 403);
      }

      try {
        if (!env.__MOCK_STORAGE_FILES__) {
          const driveAuth = await getDriveAuthContext(env, firestore);
          await deleteFileFromDrive(fileRecord.driveFileId, driveAuth.accessToken, env.FETCH_IMPL || fetch);
        }

        const now = new Date().toISOString();
        if (firestore) {
          await firestore.updateDocument(STORAGE_FILES_COLLECTION, fileId, {
            status: 'deleted',
            deletedAt: now,
            deletedBy: callerUid
          });
        }

        if (env.__MOCK_STORAGE_FILES__) {
          env.__MOCK_STORAGE_FILES__[fileId].status = 'deleted';
        }

        await recordStorageAudit(firestore, {
          actorUid: callerUid,
          action: 'file_deleted',
          fileRecordId: fileId,
          result: 'success'
        });

        return jsonResponse({ success: true, deleted: true });
      } catch (delErr) {
        return errorResponse(delErr.code || 'DELETE_FAILED', delErr.message, delErr.status || 500);
      }
    }

    // 8.2 GET /api/storage/files/:id/preview or /download
    if (method === 'GET' && (subAction === 'preview' || subAction === 'download')) {
      try {
        if (env.__MOCK_STORAGE_FILES__) {
          return new Response('Mock File Content', {
            status: 200,
            headers: {
              'Content-Type': fileRecord.mimeType || 'application/octet-stream',
              'Content-Disposition': `${subAction === 'download' ? 'attachment' : 'inline'}; filename="${encodeURIComponent(fileRecord.fileName)}"`
            }
          });
        }

        const driveAuth = await getDriveAuthContext(env, firestore);
        const driveRes = await downloadFileFromDrive(
          fileRecord.driveFileId,
          driveAuth.accessToken,
          env.FETCH_IMPL || fetch
        );

        const disposition = subAction === 'download' ? 'attachment' : 'inline';
        const responseHeaders = new Headers({
          'Content-Type': fileRecord.mimeType || driveRes.headers.get('Content-Type') || 'application/octet-stream',
          'Content-Disposition': `${disposition}; filename="${encodeURIComponent(fileRecord.fileName)}"`,
          'Cache-Control': 'private, max-age=3600',
          'X-Content-Type-Options': 'nosniff'
        });

        await recordStorageAudit(firestore, {
          actorUid: callerUid,
          action: subAction === 'download' ? 'file_downloaded' : 'file_viewed',
          fileRecordId: fileId,
          result: 'success'
        });

        return new Response(driveRes.body, {
          status: 200,
          headers: responseHeaders
        });
      } catch (streamErr) {
        return errorResponse(streamErr.code || 'STREAM_FAILED', streamErr.message, streamErr.status || 500);
      }
    }

    // 8.3 GET /api/storage/files/:id (Metadata only)
    if (method === 'GET') {
      return jsonResponse({ success: true, file: fileRecord });
    }
  }

  return errorResponse('NOT_FOUND', `Storage endpoint ${pathname} not found`, 404);
}
