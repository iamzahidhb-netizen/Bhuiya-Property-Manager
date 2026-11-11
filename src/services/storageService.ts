/**
 * Private Cloudflare R2 storage service.
 * Never exposes storage credentials or public sharing links.
 */

import { auth } from '../lib/firebase.ts';
import { getActiveWorkspaceId, resolveApiBase } from '../lib/apiClient.ts';
import { STORES, saveItem, type OfflineAttachment } from '../lib/offlineDb';
import { syncEngine } from '../lib/syncEngine';
import { StorageNetworkError, uploadFileToR2 } from './storageUploadApi';

export type StorageCategory =
  | 'nid'
  | 'tenant_photo'
  | 'personal_document'
  | 'rental_agreement'
  | 'agreement_renewal'
  | 'rent_receipt'
  | 'expense_invoice'
  | 'payment_proof'
  | 'property_document'
  | 'maintenance_photo'
  | 'monthly_report'
  | 'yearly_report'
  | 'tax_summary'
  | 'other';

export interface StorageFile {
  id: string;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  category: StorageCategory;
  tenantId?: string;
  propertyId?: string;
  uploadedBy: string;
  uploadedAt: string;
  updatedAt?: string;
  status: 'active' | 'deleted' | 'pending';
  storageProvider: 'cloudflare-r2';
  objectKey?: string;
  fileHash?: string;
  uploadStatus?: string;
  isOffline?: boolean;
}

export type R2StorageStatus =
  | { state: 'available' }
  | { state: 'not-configured'; message: string }
  | { state: 'unavailable'; message: string };

export interface UploadFileOptions {
  file: File;
  category: StorageCategory;
  tenantId?: string;
  propertyId?: string;
  onProgress?: (percent: number) => void;
}

function getUploadMimeType(file: File): string {
  if (file.type) return file.type.toLowerCase();
  const extension = file.name.split('.').pop()?.toLowerCase();
  const inferredTypes: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp'
  };
  return extension ? inferredTypes[extension] || 'application/octet-stream' : 'application/octet-stream';
}

/**
 * Resolves current user's ID token and common request headers.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('দয়া করে প্রথমে লগইন করুন (Authentication required)');
  }
  const token = await user.getIdToken();
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`
  };

  const wsId = getActiveWorkspaceId() || 'workspace_bhuiya_family';
  headers['x-workspace-id'] = wsId;

  return headers;
}

export async function getR2StorageStatus(): Promise<R2StorageStatus> {
  const base = resolveApiBase();
  const headers = await getAuthHeaders();
  const res = await fetch(`${base}/api/storage/health`, { method: 'GET', headers });
  let data: { error?: { code?: string; message?: string } };
  try {
    data = await res.json() as typeof data;
  } catch {
    throw new Error(`Storage health check returned an invalid response (HTTP ${res.status}).`);
  }

  if (res.ok) return { state: 'available' };
  const message = data.error?.message || `HTTP ${res.status} checking R2 availability`;
  if (data.error?.code === 'R2_NOT_CONFIGURED') {
    return { state: 'not-configured', message };
  }
  return { state: 'unavailable', message };
}

/**
 * Uploads directly to private R2 through a short-lived, file-scoped presigned URL.
 */
export async function uploadStorageFile(options: UploadFileOptions): Promise<StorageFile> {
  const { file, category, tenantId, propertyId, onProgress } = options;

  if (!file) {
    throw new Error('ফাইল সিলেক্ট করুন');
  }

  // File size validation (25MB limit)
  const MAX_SIZE = 25 * 1024 * 1024;
  if (file.size < 1) {
    throw new Error('Empty files cannot be uploaded.');
  }
  if (file.size > MAX_SIZE) {
    throw new Error('ফাইলের সাইজ ২৫ মেগাবাইটের (25MB) বেশি হতে পারবে না।');
  }
  const mimeType = getUploadMimeType(file);
  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    throw new Error('Unsupported file type. Use PDF, JPEG, PNG, or WebP.');
  }

  const user = auth.currentUser;
  if (!user) throw new Error('Authentication is required to upload files.');
  const uploadId = `file_${crypto.randomUUID()}`;
  const isOnline = typeof navigator === 'undefined' || navigator.onLine;

  if (isOnline) {
    try {
      return await uploadFileToR2(file, {
        fileId: uploadId,
        fileName: file.name,
        mimeType,
        fileSize: file.size,
        category,
        workspaceId: getActiveWorkspaceId() || 'workspace_bhuiya_family',
        tenantId,
        propertyId
      }, onProgress).then((storedFile) => ({
        ...storedFile,
        category,
        tenantId: storedFile.tenantId || undefined,
        propertyId: storedFile.propertyId || undefined
      }));
    } catch (uploadError) {
      if (!(uploadError instanceof StorageNetworkError)) throw uploadError;
    }
  }

  const offlineId = `offline_${crypto.randomUUID()}`;
  const offlineAttachment: OfflineAttachment = {
    id: offlineId,
    uploadId,
    fileName: file.name,
    mimeType,
    fileSize: file.size,
    category,
    workspaceId: getActiveWorkspaceId() || 'workspace_bhuiya_family',
    uploadedBy: user.uid,
    tenantId: tenantId || undefined,
    propertyId: propertyId || undefined,
    blob: file,
    status: 'pending',
    createdAt: Date.now(),
  };

  await saveItem(STORES.OFFLINE_ATTACHMENTS, offlineAttachment);
  await syncEngine.enqueueAction({
    actionName: 'uploadStorageAttachment',
    payload: { uploadId },
    category: 'file',
    workspaceId: getActiveWorkspaceId() || 'workspace_bhuiya_family',
    callerUid: user.uid,
    attachmentIds: [offlineId]
  });

  if (onProgress) onProgress(100);

  return {
    id: uploadId,
    fileName: file.name,
    originalFileName: file.name,
    mimeType,
    fileSize: file.size,
    category,
    tenantId: tenantId || undefined,
    propertyId: propertyId || undefined,
    uploadedBy: user.uid,
    uploadedAt: new Date().toISOString(),
    status: 'pending',
    storageProvider: 'cloudflare-r2',
    uploadStatus: 'pending',
    isOffline: true,
  };
}

/**
 * Retrieves list of active files with optional filtering.
 */
export async function listStorageFiles(filters?: {
  category?: StorageCategory;
  tenantId?: string;
  propertyId?: string;
}): Promise<StorageFile[]> {
  const base = resolveApiBase();
  const headers = await getAuthHeaders();

  const params = new URLSearchParams();
  if (filters?.category) params.set('category', filters.category);
  if (filters?.tenantId) params.set('tenantId', filters.tenantId);
  if (filters?.propertyId) params.set('propertyId', filters.propertyId);

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${base}/api/storage/files${queryString}`, {
    method: 'GET',
    headers
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status} listing files`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Fetches single file metadata.
 */
export async function getStorageFile(fileId: string): Promise<StorageFile> {
  const base = resolveApiBase();
  const headers = await getAuthHeaders();

  const res = await fetch(`${base}/api/storage/files/${encodeURIComponent(fileId)}`, {
    method: 'GET',
    headers
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status} fetching file metadata`);
  }

  const data = await res.json();
  return data.file;
}

/**
 * Deletes a private R2 object and updates its Firestore status to 'deleted'.
 */
export async function deleteStorageFile(fileId: string): Promise<{ success: boolean }> {
  const base = resolveApiBase();
  const headers = await getAuthHeaders();

  const res = await fetch(`${base}/api/storage/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status} deleting file`);
  }

  return data;
}

/**
 * Secure in-memory Blob retrieval for private in-app preview or download.
 * Fetches the raw file stream directly with Bearer token authentication.
 * Generates an ephemeral Object URL (blob:...) that cannot leak credentials.
 */
export async function fetchFileBlob(fileId: string, action: 'preview' | 'download' = 'preview'): Promise<{
  blob: Blob;
  objectUrl: string;
  mimeType: string;
}> {
  const base = resolveApiBase();
  const headers = await getAuthHeaders();

  const endpoint = `${base}/api/storage/files/${encodeURIComponent(fileId)}/${action}`;
  const res = await fetch(endpoint, {
    method: 'GET',
    headers
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status} streaming file`);
  }

  let blob: Blob;
  if (res.headers.get('Content-Type')?.includes('application/json')) {
    const data = await res.json() as { url?: string };
    if (!data.url) throw new Error('Storage API did not return a signed download URL.');
    let downloadResponse: Response;
    try {
      downloadResponse = await fetch(data.url);
    } catch (downloadError) {
      throw new Error(
        downloadError instanceof Error ? downloadError.message : 'Unable to reach private file storage.',
        { cause: downloadError }
      );
    }
    if (!downloadResponse.ok) {
      throw new Error(`Private file download failed: HTTP ${downloadResponse.status}`);
    }
    blob = await downloadResponse.blob();
  } else {
    blob = await res.blob();
  }
  const mimeType = res.headers.get('Content-Type') || blob.type || 'application/octet-stream';
  const objectUrl = URL.createObjectURL(blob);

  return { blob, objectUrl, mimeType };
}

/**
 * Revokes ephemeral Object URL to prevent memory leaks.
 */
export function revokeFileBlobUrl(url: string): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
