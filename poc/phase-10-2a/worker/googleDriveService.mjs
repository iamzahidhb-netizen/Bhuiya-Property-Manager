/**
 * Google Drive API v3 Service Module
 * Cloudflare Worker / Web Platform Native
 * 
 * Implements:
 * 1. OAuth 2.0 Web Server authorization flow
 * 2. Token exchange & auto-refresh
 * 3. Automatic 5-tier folder structure hierarchy creation
 * 4. Multipart streaming file upload
 * 5. Private file download and streaming proxy
 * 6. File trashing and token revocation
 */

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const GOOGLE_DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

export const DRIVE_REQUIRED_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const USERINFO_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';

export const ROOT_FOLDER_NAME = 'Anwar Bhuiyan Property Manager';

/**
 * Generates the Google OAuth 2.0 Authorization URL.
 */
export function generateOAuthUrl({ clientId, redirectUri, state }) {
  if (!clientId || !redirectUri || !state) {
    throw new Error('Missing required OAuth parameters');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: `${DRIVE_REQUIRED_SCOPE} ${USERINFO_SCOPE}`,
    access_type: 'offline',
    prompt: 'consent', // Forces refresh_token return on re-authorization
    include_granted_scopes: 'true',
    state
  });

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Exchanges authorization code for access_token and refresh_token.
 */
export async function exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri }, fetchImpl = fetch) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });

  const res = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data.error_description || data.error || res.statusText;
    const err = new Error(`Google token exchange failed: ${msg}`);
    err.code = 'OAUTH_EXCHANGE_FAILED';
    err.status = res.status;
    throw err;
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresIn: data.expires_in,
    scope: data.scope || ''
  };
}

/**
 * Uses a refresh_token to acquire a fresh access_token.
 */
export async function refreshAccessToken({ refreshToken, clientId, clientSecret }, fetchImpl = fetch) {
  if (!refreshToken) throw new Error('Missing refresh token');

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token'
  });

  const res = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data.error_description || data.error || res.statusText;
    const err = new Error(`Failed to refresh Google access token: ${msg}`);
    err.code = data.error === 'invalid_grant' ? 'TOKEN_REVOKED' : 'REFRESH_FAILED';
    err.status = res.status;
    throw err;
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in
  };
}

/**
 * Fetches the authenticated Google User info (email).
 */
export async function getConnectedUserInfo(accessToken, fetchImpl = fetch) {
  const res = await fetchImpl(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Google userinfo (HTTP ${res.status})`);
  }

  const data = await res.json();
  return {
    email: data.email || null,
    id: data.id || null,
    name: data.name || null
  };
}

/**
 * Idempotently finds or creates a folder in Google Drive.
 */
export async function findOrCreateFolder(folderName, parentFolderId = null, accessToken, fetchImpl = fetch) {
  let query = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  }

  const listUrl = `${GOOGLE_DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
  const listRes = await fetchImpl(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (listRes.ok) {
    const listData = await listRes.json();
    if (listData.files && listData.files.length > 0) {
      return listData.files[0].id;
    }
  }

  // Folder does not exist, create it
  const createPayload = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentFolderId) {
    createPayload.parents = [parentFolderId];
  }

  const createRes = await fetchImpl(`${GOOGLE_DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(createPayload)
  });

  const createData = await createRes.json();
  if (!createRes.ok || !createData.id) {
    throw new Error(`Failed to create Google Drive folder "${folderName}": ${createData.error?.message || createRes.statusText}`);
  }

  return createData.id;
}

/**
 * Idempotently builds the full 5-group folder hierarchy required by the specification.
 */
export async function initializeFolderStructure(accessToken, fetchImpl = fetch) {
  // 1. Root Folder
  const rootId = await findOrCreateFolder(ROOT_FOLDER_NAME, null, accessToken, fetchImpl);

  // Group 1: Tenants
  const tenantsRoot = await findOrCreateFolder('Tenants', rootId, accessToken, fetchImpl);
  const tenantsNid = await findOrCreateFolder('NID', tenantsRoot, accessToken, fetchImpl);
  const tenantsPhotos = await findOrCreateFolder('Tenant Photos', tenantsRoot, accessToken, fetchImpl);
  const tenantsPersonal = await findOrCreateFolder('Personal Documents', tenantsRoot, accessToken, fetchImpl);

  // Group 2: Agreements
  const agreementsRoot = await findOrCreateFolder('Agreements', rootId, accessToken, fetchImpl);
  const agreementsRent = await findOrCreateFolder('Rental Agreements', agreementsRoot, accessToken, fetchImpl);
  const agreementsRenewals = await findOrCreateFolder('Renewals', agreementsRoot, accessToken, fetchImpl);

  // Group 3: Financial Records
  const financialRoot = await findOrCreateFolder('Financial Records', rootId, accessToken, fetchImpl);
  const financialReceipts = await findOrCreateFolder('Rent Receipts', financialRoot, accessToken, fetchImpl);
  const financialInvoices = await findOrCreateFolder('Expense Invoices', financialRoot, accessToken, fetchImpl);
  const financialProofs = await findOrCreateFolder('Payment Proofs', financialRoot, accessToken, fetchImpl);

  // Group 4: Properties
  const propertiesRoot = await findOrCreateFolder('Properties', rootId, accessToken, fetchImpl);
  const propertiesDocs = await findOrCreateFolder('Property Documents', propertiesRoot, accessToken, fetchImpl);
  const propertiesMaintenance = await findOrCreateFolder('Maintenance Photos', propertiesRoot, accessToken, fetchImpl);

  // Group 5: Reports
  const reportsRoot = await findOrCreateFolder('Reports', rootId, accessToken, fetchImpl);
  const reportsMonthly = await findOrCreateFolder('Monthly Reports', reportsRoot, accessToken, fetchImpl);
  const reportsYearly = await findOrCreateFolder('Yearly Reports', reportsRoot, accessToken, fetchImpl);
  const reportsTax = await findOrCreateFolder('Tax Summaries', reportsRoot, accessToken, fetchImpl);

  return {
    rootId,
    folders: {
      tenants_nid: tenantsNid,
      tenants_photos: tenantsPhotos,
      tenants_personal: tenantsPersonal,
      agreements_rent: agreementsRent,
      agreements_renewals: agreementsRenewals,
      financial_receipts: financialReceipts,
      financial_invoices: financialInvoices,
      financial_proofs: financialProofs,
      properties_docs: propertiesDocs,
      properties_maintenance: propertiesMaintenance,
      reports_monthly: reportsMonthly,
      reports_yearly: reportsYearly,
      reports_tax: reportsTax
    }
  };
}

/**
 * Maps a file category to its destination folder ID.
 */
export function resolveFolderIdForCategory(category, folders = {}) {
  const map = {
    nid: folders.tenants_nid,
    tenant_photo: folders.tenants_photos,
    personal_document: folders.tenants_personal,
    rental_agreement: folders.agreements_rent,
    agreement_renewal: folders.agreements_renewals,
    rent_receipt: folders.financial_receipts,
    expense_invoice: folders.financial_invoices,
    payment_proof: folders.financial_proofs,
    property_document: folders.properties_docs,
    maintenance_photo: folders.properties_maintenance,
    monthly_report: folders.reports_monthly,
    yearly_report: folders.reports_yearly,
    tax_summary: folders.reports_tax
  };
  return map[category] || folders.properties_docs || folders.rootId || null;
}

/**
 * Uploads a file buffer directly to Google Drive via multipart upload.
 */
export async function uploadFileToDrive({
  fileName,
  mimeType,
  parentFolderId,
  fileBytes
}, accessToken, fetchImpl = fetch) {
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    mimeType: mimeType || 'application/octet-stream'
  };
  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const mediaHeader = `${delimiter}Content-Type: ${metadata.mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`;

  // Encode fileBytes to base64
  let binary = '';
  const len = fileBytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(fileBytes[i]);
  }
  const base64Media = btoa(binary);

  const multipartBody = `${metadataPart}${mediaHeader}${base64Media}${closeDelimiter}`;

  const uploadUrl = `${GOOGLE_DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime`;
  const res = await fetchImpl(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartBody
  });

  const data = await res.json();
  if (!res.ok || !data.id) {
    const msg = data.error?.message || res.statusText;
    const err = new Error(`Google Drive upload failed: ${msg}`);
    err.code = 'DRIVE_UPLOAD_FAILED';
    err.status = res.status;
    throw err;
  }

  return {
    driveFileId: data.id,
    fileName: data.name,
    mimeType: data.mimeType,
    fileSize: parseInt(data.size || fileBytes.length, 10),
    uploadedAt: data.createdTime || new Date().toISOString()
  };
}

/**
 * Streams / downloads a file from Google Drive.
 */
export async function downloadFileFromDrive(driveFileId, accessToken, fetchImpl = fetch) {
  const downloadUrl = `${GOOGLE_DRIVE_API_BASE}/files/${driveFileId}?alt=media`;
  const res = await fetchImpl(downloadUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const err = new Error(`Failed to fetch file from Google Drive (HTTP ${res.status})`);
    err.code = res.status === 404 ? 'FILE_NOT_FOUND' : 'DRIVE_DOWNLOAD_FAILED';
    err.status = res.status;
    throw err;
  }

  return res;
}

/**
 * Moves a file to trash in Google Drive.
 */
export async function deleteFileFromDrive(driveFileId, accessToken, fetchImpl = fetch) {
  const deleteUrl = `${GOOGLE_DRIVE_API_BASE}/files/${driveFileId}`;
  const res = await fetchImpl(deleteUrl, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete file from Google Drive (HTTP ${res.status})`);
  }

  return true;
}

/**
 * Revokes Google OAuth token.
 */
export async function revokeGoogleToken(token, fetchImpl = fetch) {
  if (!token) return;
  try {
    await fetchImpl(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  } catch (_) {
    // Ignore network failure on revoke
  }
}
