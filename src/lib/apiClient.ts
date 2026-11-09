import { auth } from './firebase.ts';

let activeWorkspaceId: string | null = null;

/**
 * Sets the active workspace context for all outgoing callable API requests.
 */
export function setActiveWorkspaceId(workspaceId: string | null): void {
  activeWorkspaceId = workspaceId;
}

/**
 * Retrieves the current active workspace context.
 */
export function getActiveWorkspaceId(): string | null {
  return activeWorkspaceId;
}

/**
 * Custom API error that mimics Firebase HttpsError for seamless client-side compatibility.
 */
export class ApiClientError extends Error {
  code: string;
  statusCode?: number;

  constructor(code: string, message: string, statusCode?: number) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Invokes a Cloudflare Pages Function / Vercel Serverless Callable API route.
 * Automatically attaches the current user's Firebase ID Token and workspace context.
 *
 * @param actionName The backend callable action (e.g. 'createUnitCallable')
 * @param payload The request body payload
 * @returns Promise<{ data: TRes }> Matching Firebase HttpsCallableResult shape
 */
/**
 * Dynamically resolves the API base URL.
 * Automatically points to Cloudflare Pages staging/production when running inside Android Capacitor / WebView.
 */
export function resolveApiBase(): string {
  const rawApiBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '';
  if (rawApiBase) return rawApiBase.replace(/\/+$/, '');

  if (typeof window !== 'undefined') {
    const isCapacitor = window.location.protocol === 'capacitor:' ||
      (window.location.hostname === 'localhost' && (!window.location.port || window.location.port === '80' || window.location.port === '443'));
    if (isCapacitor) {
      return 'https://iamzahid.pages.dev';
    }
  }
  return '';
}

export async function callCallable<TReq = unknown, TRes = unknown>(
  actionName: string,
  payload?: TReq
): Promise<{ data: TRes }> {
  const user = auth.currentUser;
  if (!user) {
    throw new ApiClientError('unauthenticated', 'User must be authenticated to invoke callable APIs.');
  }

  const idToken = await user.getIdToken();
  const apiBase = resolveApiBase();
  const url = `${apiBase}/api/callable/${actionName}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`,
  };

  const wsId = activeWorkspaceId || 'workspace_bhuiya_family';
  headers['x-workspace-id'] = wsId;

  // Ensure workspaceId is attached to request body if available
  let bodyPayload: unknown = payload ?? {};
  if (
    typeof bodyPayload === 'object' &&
    bodyPayload !== null &&
    !('workspaceId' in (bodyPayload as Record<string, unknown>))
  ) {
    bodyPayload = { ...(bodyPayload as Record<string, unknown>), workspaceId: wsId };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload),
    });
  } catch (netErr) {
    const rawMsg = netErr instanceof Error ? netErr.message : String(netErr);
    throw new ApiClientError(
      'unavailable',
      `সার্ভারের সাথে সংযোগ স্থাপন করা সম্ভব হয়নি (${rawMsg})। দয়া করে ইন্টারনেট সংযোগ বা নেটওয়ার্ক চেক করুন।`
    );
  }

  let responseBody: {
    data?: TRes;
    code?: string;
    error?: string | { code?: string; message?: string };
    message?: string;
  };

  try {
    responseBody = (await response.json()) as typeof responseBody;
  } catch {
    throw new ApiClientError(
      'internal',
      `Failed to parse server response from ${actionName} (HTTP ${response.status}).`,
      response.status
    );
  }

  if (!response.ok) {
    const errObj =
      typeof responseBody?.error === 'object' && responseBody?.error !== null
        ? responseBody.error
        : null;
    const errorCode =
      errObj?.code ||
      responseBody?.code ||
      (typeof responseBody?.error === 'string' ? responseBody.error : 'internal');
    const errorMessage =
      errObj?.message ||
      responseBody?.message ||
      `API request failed with status ${response.status}`;
    throw new ApiClientError(errorCode, errorMessage, response.status);
  }

  return {
    data: responseBody.data as TRes,
  };
}

/**
 * Drop-in replacement factory for Firebase SDK's `httpsCallable`.
 * Enables zero-breaking-change migration across all frontend services.
 *
 * Usage:
 *   const fn = createCallable<InputType, ResultType>('createUnitCallable');
 *   const result = await fn(payload);
 *   return result.data;
 */
export function createCallable<TReq = unknown, TRes = unknown>(
  actionName: string
): (data?: TReq) => Promise<{ data: TRes }> {
  return (data?: TReq) => callCallable<TReq, TRes>(actionName, data);
}
