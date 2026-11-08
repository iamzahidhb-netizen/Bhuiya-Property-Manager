/**
 * Phase 10.2B-7: Staging First-Admin Membership Provisioning Script
 * 
 * Secure, one-time staging bootstrap script to provision the first master_admin
 * membership document into Cloud Firestore for project "bhuiya-property-staging".
 * 
 * Safety Rules:
 * 1. Strictly locked to project "bhuiya-property-staging" (fails closed on any other project).
 * 2. Enforces create-only semantics with currentDocument: { exists: false } precondition.
 * 3. Never overwrites an existing membership document.
 * 4. Never accepts role or permissions from untrusted input (hardcoded to master_admin).
 * 5. Requires explicit UID and Workspace ID arguments (no guessing, no test defaults).
 * 6. Defaults to DRY-RUN mode; requires --execute flag for actual write.
 * 7. Never prints or logs credentials, private keys, or tokens.
 */

import fs from 'fs';
import path from 'path';
import { getWorkerConfig, parseServiceAccountCredentials } from './worker/envConfig.mjs';
import { getFirestoreAccessToken } from './serviceAccountAuth.mjs';
import { FirestoreRestClient } from './firestoreRestClient.mjs';

export const REQUIRED_STAGING_PROJECT_ID = 'bhuiya-property-staging';

/**
 * Validates UID and workspace ID parameters
 */
export function validateProvisioningParams(uid, workspaceId, projectId) {
  if (projectId !== REQUIRED_STAGING_PROJECT_ID) {
    throw new Error(`Safety Violation: Provisioning script is strictly locked to "${REQUIRED_STAGING_PROJECT_ID}". Detected project: "${projectId}"`);
  }

  if (!uid || typeof uid !== 'string') {
    throw new Error('Invalid Argument: Firebase Authentication UID is required and must be a string.');
  }

  const cleanUid = uid.trim();
  if (cleanUid.length === 0 || cleanUid.length > 128) {
    throw new Error(`Invalid Argument: UID length must be between 1 and 128 characters. Received length: ${cleanUid.length}`);
  }

  if (!/^[a-zA-Z0-9_\-.:+=@]+$/.test(cleanUid)) {
    throw new Error('Invalid Argument: UID contains invalid characters or path traversal elements.');
  }

  if (!workspaceId || typeof workspaceId !== 'string') {
    throw new Error('Invalid Argument: Workspace ID is required and must be a string.');
  }

  const cleanWorkspaceId = workspaceId.trim();
  if (cleanWorkspaceId.length < 3 || cleanWorkspaceId.length > 64) {
    throw new Error(`Invalid Argument: Workspace ID length must be between 3 and 64 characters. Received length: ${cleanWorkspaceId.length}`);
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(cleanWorkspaceId)) {
    throw new Error('Invalid Argument: Workspace ID must contain only alphanumeric characters, underscores, and hyphens (no slashes or special characters).');
  }

  return { uid: cleanUid, workspaceId: cleanWorkspaceId };
}

/**
 * Constructs the canonical membership document matching verified candidate schema:
 * Collection: workspace_members
 * Document ID: {workspaceId}_{uid}
 */
export function constructAdminMemberDocument(uid, workspaceId) {
  const now = new Date().toISOString();
  return {
    workspaceId,
    uid,
    role: 'master_admin',
    status: 'active',
    permissions: {
      canManageTenants: true,
      canCollectRent: true,
      canRecordExpenses: true,
      canViewReports: true
    },
    metadata: {
      provisionedVia: 'phase-10-2b-7-bootstrap',
      provisionedAt: now
    },
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Provisions the first admin membership document
 */
export async function provisionStagingAdmin(params, options = {}) {
  const { uid, workspaceId, execute = false } = params;
  const env = options.env || {};
  const config = options.config || getWorkerConfig(env);

  // 1. Strict Project ID Validation
  const validated = validateProvisioningParams(uid, workspaceId, config.projectId);
  const targetDocId = `${validated.workspaceId}_${validated.uid}`;
  const memberDoc = constructAdminMemberDocument(validated.uid, validated.workspaceId);

  // 2. Resolve Firestore Client
  let firestore = options.firestoreClient || null;
  if (!firestore) {
    if (!config.credentials) {
      throw new Error('Configuration Error: Missing valid service account credentials in environment.');
    }
    firestore = new FirestoreRestClient(config.projectId, async () => {
      return await getFirestoreAccessToken(config.credentials, env.FETCH_IMPL || fetch);
    });
  }

  // 3. Pre-read existence check
  const existingDoc = await firestore.getDocument('workspace_members', targetDocId);
  if (existingDoc) {
    const err = new Error(`Conflict: Membership document "workspace_members/${targetDocId}" already exists. Refusing to overwrite.`);
    err.code = 'ALREADY_EXISTS';
    err.status = 409;
    throw err;
  }

  // 4. Dry-Run Inspection
  if (!execute) {
    return {
      status: 'DRY_RUN_PREVIEW',
      targetProject: config.projectId,
      collection: 'workspace_members',
      documentId: targetDocId,
      documentData: memberDoc,
      writePrecondition: { exists: false },
      message: 'Dry run completed successfully. No data was written to Firestore. Re-run with --execute to perform live creation.'
    };
  }

  // 5. Atomic Create-Only Execution with Precondition
  const writeResult = await firestore.createDocument('workspace_members', targetDocId, memberDoc);

  return {
    status: 'PROVISIONED_SUCCESSFULLY',
    targetProject: config.projectId,
    collection: 'workspace_members',
    documentId: targetDocId,
    writeResult,
    message: `Master Admin membership document "workspace_members/${targetDocId}" successfully created in staging Firestore.`
  };
}

// CLI Execution Helper
function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--uid' && args[i + 1]) {
      parsed.uid = args[++i];
    } else if ((args[i] === '--workspace' || args[i] === '--workspaceId') && args[i + 1]) {
      parsed.workspaceId = args[++i];
    } else if (args[i] === '--execute') {
      parsed.execute = true;
    }
  }
  return parsed;
}

import { pathToFileURL } from 'url';

// Standalone CLI invocation
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    try {
      const args = parseArgs(process.argv.slice(2));

      // Read .dev.vars safely
      const devVarsPath = path.resolve('poc/phase-10-2a/.dev.vars');
      let env = {};
      if (fs.existsSync(devVarsPath)) {
        const lines = fs.readFileSync(devVarsPath, 'utf8').split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
          }
        }
      }

      console.log('======================================================================');
      console.log('  PHASE 10.2B-7: STAGING FIRST-ADMIN PROVISIONING UTILITY');
      console.log('======================================================================\n');

      if (!args.uid || !args.workspaceId) {
        console.log('Usage:');
        console.log('  node poc/phase-10-2a/bootstrap-staging-admin.mjs --uid <AUTH_UID> --workspace <WORKSPACE_ID> [--execute]\n');
        console.log('Examples:');
        console.log('  Dry Run:  node poc/phase-10-2a/bootstrap-staging-admin.mjs --uid myUser123 --workspace my_family_ws');
        console.log('  Execute:  node poc/phase-10-2a/bootstrap-staging-admin.mjs --uid myUser123 --workspace my_family_ws --execute\n');
        process.exit(1);
      }

      const result = await provisionStagingAdmin(args, { env });
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    } catch (err) {
      console.error('\nProvisioning Error:', err.message);
      process.exit(1);
    }
  })();
}
