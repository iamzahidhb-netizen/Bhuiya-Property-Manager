import fs from 'fs';

let code = fs.readFileSync('src/services/storageService.ts', 'utf8');

// Add offline imports
if (!code.includes('STORES')) {
  code = code.replace(
    "import { getActiveWorkspaceId, resolveApiBase } from '../lib/apiClient.ts';",
    "import { getActiveWorkspaceId, resolveApiBase } from '../lib/apiClient.ts';\nimport { STORES, saveItem, type OfflineAttachment } from '../lib/offlineDb';"
  );
}

// Add isOffline to StorageFile
code = code.replace(
  "  status: 'active' | 'deleted';",
  "  status: 'active' | 'deleted';\n  isOffline?: boolean;"
);

// Update uploadStorageFile with offline fallback
const oldUploadFnRegex = /export async function uploadStorageFile[\s\S]*?return data\.file;\s*\}/;
const newUploadFn = `export async function uploadStorageFile(options: UploadFileOptions): Promise<StorageFile> {
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

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (isOnline) {
    try {
      if (onProgress) onProgress(70);

      const res = await fetch(\`\${base}/api/storage/files/upload\`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || \`Upload failed: HTTP \${res.status}\`);
      }

      if (onProgress) onProgress(100);
      return data.file;
    } catch (netErr: unknown) {
      console.warn('[StorageService] Online upload failed; caching attachment offline:', netErr);
    }
  }

  // Offline Attachment Persistence
  const offlineId = \`file_offline_\${Date.now()}_\${Math.random().toString(36).substring(2, 7)}\`;
  const offlineAttachment: OfflineAttachment = {
    id: offlineId,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    fileSize: file.size,
    category,
    tenantId: tenantId || undefined,
    propertyId: propertyId || undefined,
    base64Data,
    status: 'pending',
    createdAt: Date.now(),
  };

  await saveItem(STORES.OFFLINE_ATTACHMENTS, offlineAttachment);

  if (onProgress) onProgress(100);

  return {
    id: offlineId,
    fileName: file.name,
    originalFileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    fileSize: file.size,
    category,
    tenantId: tenantId || undefined,
    propertyId: propertyId || undefined,
    uploadedBy: auth.currentUser?.uid || 'offline_user',
    uploadedAt: new Date().toISOString(),
    status: 'active',
    isOffline: true,
  };
}`;

code = code.replace(oldUploadFnRegex, newUploadFn);

fs.writeFileSync('src/services/storageService.ts', code, 'utf8');
console.log('storageService updated with offline attachment support');
