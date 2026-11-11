/**
 * Private Cloudflare R2 storage router.
 */

import {
  checkR2Health,
  createPresignedDownload,
  createPresignedUpload,
  deleteR2Object,
  headR2Object,
  UPLOAD_URL_TTL_SECONDS,
  sha256HexToBase64
} from './r2Service.mjs';
import { jsonResponse, errorResponse } from '../workerRouter.mjs';

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
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
]);
const STORAGE_ID_PATTERN = /^[A-Za-z0-9_-]{1,150}$/;
const CLIENT_FILE_ID_PATTERN = /^file_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hasPermission(authContext, ...permissionNames) {
  if (authContext?.isMasterAdmin) return true;
  return permissionNames.some((permission) => authContext?.permissions?.[permission] === true);
}

function canUploadCategory(authContext, category) {
  if (authContext?.isMasterAdmin) return true;
  if (['rent_receipt', 'payment_proof'].includes(category)) {
    return hasPermission(authContext, 'canCollectRent', 'collectRent', 'manageRentReceipts');
  }
  if (category === 'expense_invoice') {
    return hasPermission(authContext, 'canRecordExpenses', 'addExpense');
  }
  if (['monthly_report', 'yearly_report', 'tax_summary'].includes(category)) {
    return hasPermission(authContext, 'exportReports');
  }
  return hasPermission(
    authContext,
    'canManageTenants',
    'manageTenants',
    'createTenant',
    'updateTenant',
    'updateProperty'
  );
}

function belongsToWorkspace(record, workspaceId, uid) {
  if (record?.workspaceId) return record.workspaceId === workspaceId;
  return Boolean(record?.ownerUid && record.ownerUid === uid);
}

function canAccessFileRecord(record, authContext) {
  return record?.storageProvider === 'cloudflare-r2' &&
    record.workspaceId === authContext.workspaceId;
}

async function assertWorkspaceEntity(firestore, collection, id, authContext) {
  if (!id) return null;
  if (!STORAGE_ID_PATTERN.test(id)) {
    const err = new Error(`Invalid ${collection} identifier`);
    err.code = 'INVALID_ARGUMENT';
    err.status = 400;
    throw err;
  }
  const document = await firestore.getDocument(collection, id);
  if (!document?.data || !belongsToWorkspace(document.data, authContext.workspaceId, authContext.callerUid)) {
    const err = new Error(`${collection} record is unavailable in the active workspace`);
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }
  return document.data;
}

async function validateFileScope(firestore, authContext, { propertyId, tenantId, unitId }) {
  let resolvedPropertyId = propertyId || null;
  if (tenantId) {
    const tenant = await assertWorkspaceEntity(firestore, 'tenants', tenantId, authContext);
    if (resolvedPropertyId && tenant.propertyId !== resolvedPropertyId) {
      const err = new Error('Tenant does not belong to the requested property');
      err.code = 'INVALID_ARGUMENT';
      err.status = 400;
      throw err;
    }
    resolvedPropertyId = tenant.propertyId || resolvedPropertyId;
  }
  if (resolvedPropertyId) {
    await assertWorkspaceEntity(firestore, 'properties', resolvedPropertyId, authContext);
  }
  if (unitId) {
    const unit = await assertWorkspaceEntity(firestore, 'units', unitId, authContext);
    if (resolvedPropertyId && unit.propertyId !== resolvedPropertyId) {
      const err = new Error('Unit does not belong to the requested property');
      err.code = 'INVALID_ARGUMENT';
      err.status = 400;
      throw err;
    }
    resolvedPropertyId = unit.propertyId || resolvedPropertyId;
  }
  return resolvedPropertyId;
}

function createR2ObjectKey({ fileId, category, propertyId, tenantId, uploadedAt }) {
  const segments = ['property-manager'];
  if (propertyId) segments.push('properties', propertyId);
  if (tenantId) segments.push('tenants', tenantId);

  const date = new Date(uploadedAt);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const categoryDirectory = {
    nid: 'documents',
    tenant_photo: 'images',
    personal_document: 'documents',
    rental_agreement: 'agreements',
    agreement_renewal: 'agreements',
    rent_receipt: `rent-receipts/${year}/${month}`,
    expense_invoice: 'documents',
    payment_proof: 'documents',
    property_document: 'documents',
    maintenance_photo: 'images',
    monthly_report: 'documents',
    yearly_report: 'documents',
    tax_summary: 'documents',
    other: 'documents'
  }[category];

  if (!propertyId && !tenantId) segments.push('application');
  segments.push(categoryDirectory, fileId);
  return segments.join('/');
}

function jsonResponseNoStore(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

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
 * Storage API Request Dispatcher
 */
export async function handleStorageRequest(request, pathname, env, ctx, workerContext) {
  const method = request.method;
  const url = new URL(request.url);
  const firestore = workerContext.firestore;
  const authContext = workerContext.authContext;
  const verifiedUser = workerContext.verifiedUser;

  // All remaining storage routes require authenticated session
  if (!verifiedUser) {
    return errorResponse('UNAUTHENTICATED', 'Authentication required for storage operations', 401);
  }

  const callerUid = verifiedUser.uid;
  const isMasterAdmin = authContext?.isMasterAdmin || false;
  const workspaceId = authContext?.workspaceId;
  if (!workspaceId) {
    return errorResponse('PERMISSION_DENIED', 'Verified workspace context is required for storage operations', 403);
  }

  if (pathname === '/api/storage/health' && method === 'GET') {
    try {
      await checkR2Health(env);
      return jsonResponseNoStore({ success: true, provider: 'cloudflare-r2', status: 'available' });
    } catch (healthErr) {
      console.error('[storage] R2 health check failed', {
        name: healthErr.name || 'Error',
        code: healthErr.code || null,
        status: healthErr.$metadata?.httpStatusCode || healthErr.status || null,
        message: typeof healthErr.message === 'string' ? healthErr.message.slice(0, 160) : null,
        requestId: healthErr.$metadata?.requestId || null
      });
      const status = healthErr.status || (healthErr.code === 'R2_NOT_CONFIGURED' ? 503 : 502);
      return errorResponse(healthErr.code || 'R2_UNAVAILABLE', 'Cloudflare R2 is unavailable', status);
    }
  }

  if (pathname === '/api/storage/upload/initiate' && method === 'POST') {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return errorResponse('INVALID_ARGUMENT', 'Request body must be valid JSON', 400);
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return errorResponse('INVALID_ARGUMENT', 'Request body must be a JSON object', 400);
    }

    const {
      fileId,
      fileName,
      mimeType,
      fileSize,
      fileHash,
      category,
      tenantId,
      propertyId,
      unitId,
      voucherId
    } = payload;

    if (!CLIENT_FILE_ID_PATTERN.test(fileId || '')) {
      return errorResponse('INVALID_ARGUMENT', 'A client-generated file ID is required', 400);
    }
    if (
      typeof fileName !== 'string' ||
      !fileName.trim() ||
      fileName.length > 255 ||
      /[\u0000-\u001f\u007f]/.test(fileName)
    ) {
      return errorResponse('INVALID_ARGUMENT', 'A valid original file name is required', 400);
    }
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return errorResponse('INVALID_ARGUMENT', `Invalid storage category "${category}"`, 400);
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return errorResponse('INVALID_ARGUMENT', 'Unsupported file type', 415);
    }
    if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > MAX_FILE_SIZE) {
      return errorResponse('FILE_TOO_LARGE', 'File must be between 1 byte and 25 MiB', 400);
    }
    if (!/^[0-9a-f]{64}$/i.test(fileHash || '')) {
      return errorResponse('INVALID_ARGUMENT', 'A SHA-256 file hash is required', 400);
    }
    if ([tenantId, propertyId, unitId, voucherId].some((id) => id != null && (typeof id !== 'string' || !STORAGE_ID_PATTERN.test(id)))) {
      return errorResponse('INVALID_ARGUMENT', 'Invalid property, tenant, or unit identifier', 400);
    }
    if (!canUploadCategory(authContext, category)) {
      return errorResponse('PERMISSION_DENIED', 'Your workspace role cannot upload this file category', 403);
    }
    if (!firestore) {
      return errorResponse('SERVICE_UNAVAILABLE', 'Database unavailable', 503);
    }

    try {
      const resolvedPropertyId = await validateFileScope(firestore, authContext, { propertyId, tenantId, unitId });
      const existing = await firestore.getDocument(STORAGE_FILES_COLLECTION, fileId);
      let existingRecord = existing?.data || null;

      if (existingRecord) {
        if (
          existingRecord.workspaceId !== workspaceId ||
          existingRecord.uploadedBy !== callerUid ||
          existingRecord.storageProvider !== 'cloudflare-r2' ||
          existingRecord.fileHash !== fileHash ||
          existingRecord.fileSize !== fileSize ||
          existingRecord.mimeType !== mimeType ||
          existingRecord.category !== category ||
          existingRecord.propertyId !== (resolvedPropertyId || null) ||
          existingRecord.tenantId !== (tenantId || null)
        ) {
          return errorResponse('ALREADY_EXISTS', 'Upload ID is already associated with another file', 409);
        }
        if (existingRecord.uploadStatus === 'completed') {
          return jsonResponseNoStore({ success: true, alreadyCompleted: true, file: { id: fileId, ...existingRecord } });
        }
        if (existingRecord.uploadStatus === 'uploaded' || existingRecord.uploadStatus === 'verified') {
          return jsonResponseNoStore({ success: true, needsCompletion: true, fileId });
        }
        if (existingRecord.uploadStatus === 'failed') {
          return errorResponse('UPLOAD_FAILED', 'This upload intent has failed; start a new upload', 409);
        }
      } else {
        const duplicateDocs = await firestore.queryByField(
          STORAGE_FILES_COLLECTION,
          'fileHash',
          'EQUAL',
          fileHash.toLowerCase()
        );
        const duplicate = duplicateDocs
          .map((document) => ({ id: document.id, ...(document.data || {}) }))
          .find((record) =>
            record.workspaceId === workspaceId &&
            record.storageProvider === 'cloudflare-r2' &&
            record.status === 'active' &&
            record.fileHash === fileHash.toLowerCase() &&
            record.fileSize === fileSize &&
            record.category === category &&
            record.propertyId === (resolvedPropertyId || null) &&
            record.tenantId === (tenantId || null)
          );
        if (duplicate) {
          return jsonResponseNoStore({ success: true, duplicate: true, file: duplicate });
        }
      }

      const now = new Date().toISOString();
      const normalizedHash = fileHash.toLowerCase();
      const objectKey = existingRecord?.objectKey || createR2ObjectKey({
        fileId,
        category,
        propertyId: resolvedPropertyId,
        tenantId: tenantId || null,
        uploadedAt: now
      });
      const authorization = await createPresignedUpload(env, {
        objectKey,
        mimeType,
        fileHash: normalizedHash
      });

      if (!existingRecord) {
        existingRecord = {
          id: fileId,
          workspaceId,
          storageProvider: 'cloudflare-r2',
          objectKey,
          fileName: fileName.trim(),
          originalFileName: fileName.trim(),
          mimeType,
          fileSize,
          fileHash: normalizedHash,
          category,
          tenantId: tenantId || null,
          propertyId: resolvedPropertyId || null,
          unitId: unitId || null,
          voucherId: voucherId || null,
          uploadedBy: callerUid,
          uploadedAt: now,
          status: 'pending',
          uploadStatus: 'authorized',
          uploadExpiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
          migrationStatus: 'not-applicable'
        };
        await firestore.createDocument(STORAGE_FILES_COLLECTION, fileId, existingRecord);
      } else {
        await firestore.updateDocument(STORAGE_FILES_COLLECTION, fileId, {
          uploadStatus: 'authorized',
          uploadExpiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
          updatedAt: now
        });
      }

      return jsonResponseNoStore({
        success: true,
        fileId,
        uploadUrl: authorization.url,
        requiredHeaders: authorization.requiredHeaders,
        expiresIn: authorization.expiresIn
      }, 201);
    } catch (initErr) {
      const status = initErr.status || 500;
      return errorResponse(initErr.code || 'UPLOAD_INITIATION_FAILED', initErr.message, status);
    }
  }

  if (pathname === '/api/storage/upload/complete' && method === 'POST') {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return errorResponse('INVALID_ARGUMENT', 'Request body must be valid JSON', 400);
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return errorResponse('INVALID_ARGUMENT', 'Request body must be a JSON object', 400);
    }
    const { fileId } = payload;
    if (!CLIENT_FILE_ID_PATTERN.test(fileId || '')) {
      return errorResponse('INVALID_ARGUMENT', 'A valid file ID is required', 400);
    }
    if (!firestore) {
      return errorResponse('SERVICE_UNAVAILABLE', 'Database unavailable', 503);
    }

    try {
      const document = await firestore.getDocument(STORAGE_FILES_COLLECTION, fileId);
      const fileRecord = document?.data || null;
      if (!fileRecord || fileRecord.workspaceId !== workspaceId || fileRecord.storageProvider !== 'cloudflare-r2') {
        return errorResponse('NOT_FOUND', 'Upload intent was not found in the active workspace', 404);
      }
      if (fileRecord.uploadedBy !== callerUid && !isMasterAdmin) {
        return errorResponse('PERMISSION_DENIED', 'Only the uploader or a workspace admin can complete this upload', 403);
      }
      if (fileRecord.uploadStatus === 'completed') {
        return jsonResponseNoStore({ success: true, file: { id: fileId, ...fileRecord } });
      }

      await firestore.updateDocument(STORAGE_FILES_COLLECTION, fileId, {
        uploadStatus: 'uploaded',
        updatedAt: new Date().toISOString()
      });
      const actual = await headR2Object(env, fileRecord.objectKey);
      const expectedChecksum = fileRecord.fileHash;
      if (
        actual.fileSize !== fileRecord.fileSize ||
        actual.mimeType !== fileRecord.mimeType ||
        actual.fileHash !== expectedChecksum ||
        (actual.checksumSha256 && actual.checksumSha256 !== sha256HexToBase64(expectedChecksum))
      ) {
        await firestore.updateDocument(STORAGE_FILES_COLLECTION, fileId, {
          uploadStatus: 'failed',
          uploadError: 'Uploaded object did not match authorized metadata',
          updatedAt: new Date().toISOString()
        });
        return errorResponse('INTEGRITY_CHECK_FAILED', 'Uploaded object failed size, type, or checksum verification', 422);
      }
      await firestore.updateDocument(STORAGE_FILES_COLLECTION, fileId, {
        uploadStatus: 'verified',
        updatedAt: new Date().toISOString()
      });
      const completedAt = new Date().toISOString();
      const completedRecord = {
        status: 'active',
        uploadStatus: 'completed',
        completedAt,
        updatedAt: completedAt
      };
      await firestore.updateDocument(STORAGE_FILES_COLLECTION, fileId, completedRecord);
      await recordStorageAudit(firestore, {
        actorUid: callerUid,
        action: 'r2_file_uploaded',
        fileRecordId: fileId,
        result: 'success',
        details: { category: fileRecord.category, size: fileRecord.fileSize }
      });
      return jsonResponseNoStore({
        success: true,
        file: { id: fileId, ...fileRecord, ...completedRecord }
      });
    } catch (completeErr) {
      const status = completeErr.status || (completeErr.name === 'NotFound' ? 409 : 500);
      const code = completeErr.code || (completeErr.name === 'NotFound' ? 'OBJECT_NOT_FOUND' : 'UPLOAD_COMPLETION_FAILED');
      return errorResponse(code, status === 409 ? 'Uploaded object is not present in R2 yet' : completeErr.message, status);
    }
  }

  // =========================================================================
  // GET /api/storage/files (List active R2 files)
  // =========================================================================
  if (pathname === '/api/storage/files' && method === 'GET') {
    const category = url.searchParams.get('category');
    const tenantId = url.searchParams.get('tenantId');
    const propertyId = url.searchParams.get('propertyId');
    const voucherId = url.searchParams.get('voucherId');

    if (env.__MOCK_STORAGE_FILES__) {
      let filtered = Object.values(env.__MOCK_STORAGE_FILES__).filter(
        (file) => file.status === 'active' &&
          file.storageProvider === 'cloudflare-r2' &&
          canAccessFileRecord(file, authContext)
      );
      if (category) filtered = filtered.filter(f => f.category === category);
      if (tenantId) filtered = filtered.filter(f => f.tenantId === tenantId);
      if (propertyId) filtered = filtered.filter(f => f.propertyId === propertyId);
      if (voucherId) filtered = filtered.filter(f => f.voucherId === voucherId);
      return jsonResponse({ success: true, files: filtered, count: filtered.length });
    }

    if (!firestore) {
      return errorResponse('SERVICE_UNAVAILABLE', 'Database unavailable', 503);
    }

    const workspaceDocs = await firestore.queryByField(STORAGE_FILES_COLLECTION, 'workspaceId', 'EQUAL', workspaceId);
    const legacyDocs = await firestore.queryByField(STORAGE_FILES_COLLECTION, 'uploadedBy', 'EQUAL', callerUid);
    const docsById = new Map([...workspaceDocs, ...legacyDocs].map((document) => [document.id, document]));
    let files = [...docsById.values()]
      .map((document) => ({ id: document.id, ...(document.data || {}) }))
      .filter((file) => file.status === 'active' && canAccessFileRecord(file, authContext));

    if (category) {
      files = files.filter(f => f.category === category);
    }
    if (tenantId) {
      files = files.filter(f => f.tenantId === tenantId);
    }
    if (propertyId) {
      files = files.filter(f => f.propertyId === propertyId);
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
    if (!canAccessFileRecord(fileRecord, authContext)) {
      return errorResponse('NOT_FOUND', 'File not found or has been deleted', 404);
    }

    // 8.1 DELETE /api/storage/files/:id
    if (method === 'DELETE') {
      if (!isMasterAdmin && fileRecord.uploadedBy !== callerUid) {
        return errorResponse('PERMISSION_DENIED', 'You do not have permission to delete this file', 403);
      }

      try {
        if (!env.__MOCK_STORAGE_FILES__) {
          await deleteR2Object(env, fileRecord.objectKey);
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
        const signedDownload = await createPresignedDownload(env, {
          objectKey: fileRecord.objectKey,
          mimeType: fileRecord.mimeType || 'application/octet-stream',
          fileName: fileRecord.originalFileName || fileRecord.fileName,
          disposition: subAction === 'download' ? 'attachment' : 'inline'
        });
        await recordStorageAudit(firestore, {
          actorUid: callerUid,
          action: subAction === 'download' ? 'file_download_authorized' : 'file_preview_authorized',
          fileRecordId: fileId,
          result: 'success'
        });
        return jsonResponseNoStore({
          success: true,
          url: signedDownload.url,
          expiresIn: signedDownload.expiresIn,
          mimeType: fileRecord.mimeType,
          fileName: fileRecord.originalFileName || fileRecord.fileName
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
