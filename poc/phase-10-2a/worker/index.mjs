/**
 * Phase 10.2B-5: Cloudflare Pages Advanced Mode (_worker.js) Master Worker Entry
 * 
 * Integrates:
 * - Environment & secrets configuration
 * - Hardened router with CORS preflight & POST method guard
 * - Edge-native Web Crypto RS256 Firebase ID Token verification
 * - Firestore-backed Family Workspace membership lookup (`workspace_members/{workspaceId}_{uid}`)
 * - Server-side Family Workspace RBAC & payload sanitization
 * - Unified 21-Action Registry with packaging dry-run safety gate
 * - Static asset delegation via env.ASSETS and SPA routing fallback
 */

import { getWorkerConfig } from './envConfig.mjs';
import { createPagesWorker, jsonResponse, errorResponse } from '../workerRouter.mjs';
import { verifyFirebaseIdToken } from '../tokenVerifier.mjs';
import { authorizeWorkspaceRequest, sanitizeClientPayload } from '../workspaceAuth.mjs';
import { dispatchAction } from './actionRegistry.mjs';
import { FirestoreRestClient } from '../firestoreRestClient.mjs';
import { getFirestoreAccessToken } from '../serviceAccountAuth.mjs';

/**
 * Resolves or creates a Firestore REST API client instance.
 * Supports injected test clients (__TEST_FIRESTORE_CLIENT__), local emulator, and live service account credentials.
 */
export function getOrCreateFirestoreClient(env, config) {
  if (env?.__TEST_FIRESTORE_CLIENT__) {
    return env.__TEST_FIRESTORE_CLIENT__;
  }
  if (!config || !config.credentials || !config.projectId) {
    return null;
  }
  const rawFetch = env?.FETCH_IMPL || fetch;
  const safeFetch = (url, init) => rawFetch(url, init);
  const tokenProvider = async () => {
    return await getFirestoreAccessToken(config.credentials, safeFetch);
  };
  return new FirestoreRestClient(config.projectId, tokenProvider, {
    fetchImpl: safeFetch,
    emulatorHost: env?.FIRESTORE_EMULATOR_HOST || (typeof process !== 'undefined' ? process.env?.FIRESTORE_EMULATOR_HOST : null)
  });
}

/**
 * Authoritative workspace member lookup.
 * 
 * Schema candidate (from firestore.workspace-candidate.rules):
 * - Collection: 'workspace_members'
 * - Document ID: `${workspaceId}_${uid}`
 * - Fields: workspaceId, uid, role, status ('active'), permissions
 * 
 * Strategy:
 * 1. Checks isolated test mock store (__MOCK_WORKSPACE_MEMBERS__) if provided.
 * 2. If requestedWorkspaceId is missing, fails closed (returns null).
 * 3. Uses Firestore REST client to fetch `workspace_members/{workspaceId}_{uid}`.
 * 4. Validates document exists, status is active, and invariants match.
 * 5. Returns trusted record; zero hardcoded production admin identities.
 */
export async function lookupWorkspaceMember(uid, requestedWorkspaceId, env, workerConfig = null) {
  if (!uid) {
    return null;
  }

  // 1. Check isolated test mock store (strictly in test environments)
  if (env && env.__MOCK_WORKSPACE_MEMBERS__) {
    if (requestedWorkspaceId) {
      const compoundKey = `${requestedWorkspaceId}_${uid}`;
      if (env.__MOCK_WORKSPACE_MEMBERS__[compoundKey]) {
        return env.__MOCK_WORKSPACE_MEMBERS__[compoundKey];
      }
    }
    if (env.__MOCK_WORKSPACE_MEMBERS__[uid]) {
      return env.__MOCK_WORKSPACE_MEMBERS__[uid];
    }
    return null;
  }

  // 2. If requestedWorkspaceId is missing, document ID cannot be determined
  if (!requestedWorkspaceId) {
    return null;
  }

  // 3. Resolve Firestore Client
  const config = workerConfig || getWorkerConfig(env || {});
  const firestore = getOrCreateFirestoreClient(env, config);

  if (!firestore) {
    lookupWorkspaceMember.lastError = `Firestore client is null (hasCreds: ${!!config?.credentials}, hasProj: ${!!config?.projectId}, credError: ${config?.credentialsError})`;
    console.error('[lookupWorkspaceMember]', lookupWorkspaceMember.lastError);
    return null;
  }

  // 4. Firestore-backed lookup
  const docId = `${requestedWorkspaceId}_${uid}`;
  try {
    const doc = await firestore.getDocument('workspace_members', docId);
    if (!doc || !doc.data) {
      lookupWorkspaceMember.lastError = `doc workspace_members/${docId} not found in Firestore`;
      console.warn(`[lookupWorkspaceMember] ${lookupWorkspaceMember.lastError}`);
      return null;
    }

    const data = doc.data;

    // Verify document invariants
    if (data.uid && data.uid !== uid) {
      lookupWorkspaceMember.lastError = `UID mismatch: expected ${uid}, found ${data.uid}`;
      console.warn(`[lookupWorkspaceMember] ${lookupWorkspaceMember.lastError}`);
      return null;
    }
    if (data.workspaceId && data.workspaceId !== requestedWorkspaceId) {
      lookupWorkspaceMember.lastError = `WorkspaceId mismatch: expected ${requestedWorkspaceId}, found ${data.workspaceId}`;
      console.warn(`[lookupWorkspaceMember] ${lookupWorkspaceMember.lastError}`);
      return null;
    }

    return {
      workspaceId: data.workspaceId || requestedWorkspaceId,
      uid: data.uid || uid,
      role: data.role || 'viewer',
      status: data.status || 'inactive',
      permissions: (typeof data.permissions === 'object' && data.permissions !== null) ? data.permissions : {}
    };
  } catch (err) {
    lookupWorkspaceMember.lastError = `getDocument error: ${err?.message || String(err)}`;
    console.error(`[lookupWorkspaceMember ERROR for ${docId}]:`, lookupWorkspaceMember.lastError);
    return null;
  }
}

/**
 * Core API Request Dispatcher
 */
export async function handleCallableApiRequest(request, actionName, env, ctx) {
  const config = getWorkerConfig(env);

  // Check credentials configuration
  if (config.credentialsError) {
    return errorResponse(
      'CONFIG_ERROR',
      `Server configuration error: ${config.credentialsError}`,
      500
    );
  }

  // 1. Extract Bearer Token
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // 2. Verify Firebase ID Token via Web Crypto RS256
  let verifiedUser;
  try {
    const mockJwks = env.__MOCK_JWKS__ || null;
    verifiedUser = await verifyFirebaseIdToken(token, config.projectId, { mockJwks });
  } catch (tokenErr) {
    return errorResponse(
      'UNAUTHENTICATED',
      `Token verification failed: ${tokenErr.message}`,
      401
    );
  }

  // 3. Parse Request Payload
  let rawPayload = {};
  try {
    const bodyText = await request.text();
    if (bodyText && bodyText.trim().length > 0) {
      rawPayload = JSON.parse(bodyText);
    }
  } catch (jsonErr) {
    return errorResponse(
      'INVALID_ARGUMENT',
      `Malformed JSON request body: ${jsonErr.message}`,
      400
    );
  }

  // 4. Server-Side Family Workspace Authorization & RBAC
  let authContext;
  try {
    const requestedWorkspaceId = rawPayload.workspaceId || request.headers.get('x-workspace-id') || null;
    const lookupFn = async (uid, wsId) => {
      const res = await lookupWorkspaceMember(uid, wsId || requestedWorkspaceId, env, config);
      if (!res) lookupFn.lastError = lookupWorkspaceMember.lastError;
      return res;
    };
    authContext = await authorizeWorkspaceRequest(
      {
        callerUid: verifiedUser.uid,
        actionName,
        requestedWorkspaceId
      },
      lookupFn
    );
  } catch (authErr) {
    return errorResponse(
      authErr.code || 'FORBIDDEN',
      authErr.message,
      authErr.status || 403
    );
  }

  // 5. Dispatch Action to Registry Handler
  try {
    const firestore = getOrCreateFirestoreClient(env, config);
    const workerContext = {
      env,
      ctx,
      config,
      verifiedUser,
      authContext,
      firestore
    };

    const actionResult = await dispatchAction(actionName, rawPayload, authContext, workerContext);
    return jsonResponse({ data: actionResult, status: 200 });
  } catch (execErr) {
    return errorResponse(
      execErr.code || 'INTERNAL_ERROR',
      execErr.message,
      execErr.status || 500
    );
  }
}

/**
 * Cloudflare Pages Advanced Mode Worker Export
 */
export const workerInstance = createPagesWorker(handleCallableApiRequest);
export default workerInstance;
