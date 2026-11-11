import { auth } from '../lib/firebase';
import { getActiveWorkspaceId, resolveApiBase } from '../lib/apiClient';

export interface StorageUploadMetadata {
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  category: string;
  fileHash?: string;
  workspaceId?: string;
  tenantId?: string;
  propertyId?: string;
}

export interface StoredFile {
  id: string;
  storageProvider: 'cloudflare-r2';
  objectKey: string;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  fileHash: string;
  category: string;
  tenantId?: string | null;
  propertyId?: string | null;
  uploadedBy: string;
  uploadedAt: string;
  status: 'active' | 'pending';
  uploadStatus: string;
  [key: string]: unknown;
}

export class StorageNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageNetworkError';
  }
}

async function getStorageHeaders(workspaceId?: string): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication is required to upload files.');
  }
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-workspace-id': workspaceId || getActiveWorkspaceId() || 'workspace_bhuiya_family'
  };
}

async function postJson<T>(path: string, body: unknown, workspaceId?: string): Promise<T> {
  const headers = await getStorageHeaders(workspaceId);
  let response: Response;
  try {
    response = await fetch(`${resolveApiBase()}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new StorageNetworkError(error instanceof Error ? error.message : 'Storage API is unreachable.');
  }

  let result: { error?: { message?: string }; message?: string } & Record<string, unknown>;
  try {
    result = await response.json() as typeof result;
  } catch {
    throw new Error(`Storage API returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(result.error?.message || result.message || `Storage request failed (HTTP ${response.status}).`);
  }
  return result as T;
}

function uploadWithProgress(
  url: string,
  file: Blob,
  headers: Record<string, string>,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.withCredentials = false;
    request.timeout = 120_000;
    for (const [name, value] of Object.entries(headers)) {
      request.setRequestHeader(name, value);
    }
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(10 + Math.floor((event.loaded / event.total) * 85));
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
      } else {
        reject(new Error(`R2 upload failed (HTTP ${request.status}).`));
      }
    };
    request.onerror = () => reject(new StorageNetworkError('Network connection lost during file upload.'));
    request.ontimeout = () => reject(new StorageNetworkError('File upload timed out.'));
    request.onabort = () => reject(new StorageNetworkError('File upload was interrupted.'));
    request.send(file);
  });
}

export async function uploadFileToR2(
  file: Blob,
  metadata: StorageUploadMetadata,
  onProgress?: (percent: number) => void
): Promise<StoredFile> {
  if (!auth.currentUser) {
    throw new Error('Authentication is required to upload files.');
  }

  const hashBuffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', hashBuffer);
  const fileHash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  onProgress?.(5);

  const authorization = await postJson<{
    fileId?: string;
    uploadUrl?: string;
    requiredHeaders?: Record<string, string>;
    duplicate?: boolean;
    alreadyCompleted?: boolean;
    needsCompletion?: boolean;
    file?: StoredFile;
  }>('/api/storage/upload/initiate', { ...metadata, fileHash }, metadata.workspaceId);

  if (authorization.duplicate || authorization.alreadyCompleted) {
    if (!authorization.file) {
      throw new Error('Storage API did not return the existing file record.');
    }
    onProgress?.(100);
    return authorization.file;
  }

  const fileId = authorization.fileId || metadata.fileId;
  if (authorization.needsCompletion) {
    const completed = await postJson<{ file?: StoredFile }>('/api/storage/upload/complete', { fileId }, metadata.workspaceId);
    if (!completed.file) throw new Error('Storage API did not return the completed file record.');
    onProgress?.(100);
    return completed.file;
  }
  if (!authorization.uploadUrl || !authorization.requiredHeaders) {
    throw new Error('Storage API did not return a valid presigned upload URL.');
  }

  await uploadWithProgress(
    authorization.uploadUrl,
    file,
    authorization.requiredHeaders,
    onProgress
  );
  const completed = await postJson<{ file?: StoredFile }>('/api/storage/upload/complete', { fileId }, metadata.workspaceId);
  if (!completed.file) throw new Error('Storage API did not return the completed file record.');
  onProgress?.(100);
  return completed.file;
}
