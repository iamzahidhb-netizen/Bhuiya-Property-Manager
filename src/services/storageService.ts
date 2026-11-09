/**
 * Google Drive Cloud Storage Service
 * 
 * Provides end-to-end integration with the backend Google Drive storage API.
 * Never exposes credentials, refresh tokens, or public sharing links.
 * All preview and download blobs are fetched with authorization headers.
 */

import { auth } from '../lib/firebase.ts';
import { getActiveWorkspaceId, resolveApiBase } from '../lib/apiClient.ts';

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
  driveFileId: string;
  driveFolderId?: string;
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
  status: 'active' | 'deleted';
}

export interface DriveStatus {
  connected: boolean;
  connectedEmail?: string;
  connectedAt?: string;
  lastCheckedAt?: string;
  status: 'connected' | 'disconnected' | 'revoked' | 'unconfigured';
  rootFolderId?: string;
  folderCount?: number;
}

export interface UploadFileOptions {
  file: File;
  category: StorageCategory;
  tenantId?: string;
  propertyId?: string;
  onProgress?: (percent: number) => void;
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

  const wsId = getActiveWorkspaceId();
  if (wsId) {
    headers['x-workspace-id'] = wsId;
  }

  return headers;
}

/**
 * Checks current Google Drive connection status.
 */
export async function getDriveStatus(): Promise<DriveStatus> {
  const base = resolveApiBase();
  const headers = await getAuthHeaders();

  const res = await fetch(`${base}/api/storage/drive/status`, {
    method: 'GET',
    headers
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status} checking drive status`);
  }

  return await res.json();
}

/**
 * Initiates the Google OAuth 2.0 Web Server Authorization Code flow.
 * Returns the Google consent URL or redirects directly.
 */
export async function connectDrive(): Promise<string> {
  const base = resolveApiBase();
  const headers = await getAuthHeaders();
  headers['Content-Type'] = 'application/json';

  const res = await fetch(`${base}/api/storage/drive/connect`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status} initiating OAuth connection`);
  }

  const authUrl = data.url || data.authUrl;
  if (!authUrl) {
    throw new Error('সার্ভার থেকে গুগল অনুমোদন লিংক পাওয়া যায়নি।');
  }

  return authUrl;
}

/**
 * Disconnects Google Drive from the application.
 */
export async function disconnectDrive(): Promise<{ success: boolean }> {
  const base = resolveApiBase();
  const headers = await getAuthHeaders();
  headers['Content-Type'] = 'application/json';

  const res = await fetch(`${base}/api/storage/drive/disconnect`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status} disconnecting Drive`);
  }

  return data;
}

/**
 * Tests Google Drive token validity and folder structure access.
 */
export async function testDriveConnection(): Promise<{ success: boolean; email?: string }> {
  const base = resolveApiBase();
  const headers = await getAuthHeaders();
  headers['Content-Type'] = 'application/json';

  const res = await fetch(`${base}/api/storage/drive/test`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status} testing Drive connection`);
  }

  return data;
}

/**
 * Helper to convert a File to base64 string.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a document or photo to Google Drive with Firestore metadata recording.
 */
export async function uploadStorageFile(options: UploadFileOptions): Promise<StorageFile> {
  const { file, category, tenantId, propertyId, onProgress } = options;

  if (!file) {
    throw new Error('ফাইল সিলেক্ট করুন');
  }

  // File size validation (25MB limit)
  const MAX_SIZE = 25 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('ফাইলের সাইজ ২৫ মেগাবাইটের (25MB) বেশি হতে পারবে না।');
  }

  if (onProgress) onProgress(15);

  const base64Data = await fileToBase64(file);
  if (onProgress) onProgress(40);

  const base = resolveApiBase();
  const headers = await getAuthHeaders();
  headers['Content-Type'] = 'application/json';

  const payload = {
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    fileSize: file.size,
    category,
    tenantId: tenantId || null,
    propertyId: propertyId || null,
    fileData: base64Data
  };

  if (onProgress) onProgress(70);

  const res = await fetch(`${base}/api/storage/files/upload`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Upload failed: HTTP ${res.status}`);
  }

  if (onProgress) onProgress(100);

  return data.file;
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
 * Deletes a file from Google Drive and updates Firestore status to 'deleted'.
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

  const blob = await res.blob();
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
