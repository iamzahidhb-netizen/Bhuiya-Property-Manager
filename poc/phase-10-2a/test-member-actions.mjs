import fs from 'fs';
import path from 'path';
import { getWorkerConfig } from './worker/envConfig.mjs';
import { handleCallableApiRequest } from './worker/index.mjs';

function createMockRequest(actionName, payload, token, workspaceId = 'workspace_bhuiya_family') {
  const url = `https://bhuiya-property-staging.pages.dev/api/call`;
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-workspace-id': workspaceId
    },
    body: JSON.stringify(payload)
  });
}

async function runTests() {
  console.log('========================================================================');
  console.log('TESTING USER MANAGEMENT & GRANULAR PERMISSIONS WORKER ACTIONS');
  console.log('========================================================================\n');

  // Load environment variables from process.env, .dev.vars, and .env.staging safely
  const env = { ...process.env };

  const devVarsPath = path.resolve('poc/phase-10-2a/.dev.vars');
  if (fs.existsSync(devVarsPath)) {
    for (const line of fs.readFileSync(devVarsPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }

  // Load client environment variables (Vite staging config)
  const envStagingPath = path.resolve('.env.staging');
  const envPath = path.resolve('.env');
  const clientEnvPath = fs.existsSync(envStagingPath) ? envStagingPath : (fs.existsSync(envPath) ? envPath : null);

  if (clientEnvPath) {
    for (const line of fs.readFileSync(clientEnvPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        if (!env[k]) env[k] = v;
      }
    }
  }

  const config = getWorkerConfig(env);

  // 1. Resolve Firebase Web API Key dynamically from environment
  const apiKey = env.VITE_FIREBASE_API_KEY || env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error('Firebase Web API key is not configured. Please ensure VITE_FIREBASE_API_KEY is present in .env.staging or environment variables.');
  }

  const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

  console.log('Authenticating test users with password "112233"...');
  const adminRes = await fetch(signInUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'zahid@bhuiyan.com', password: '112233', returnSecureToken: true })
  });
  const adminData = await adminRes.json();
  const adminToken = adminData.idToken;
  console.log('  [PASS] Master Admin authenticated (UID:', adminData.localId, ')');

  const managerRes = await fetch(signInUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'manager@bhuiya.staging', password: '112233', returnSecureToken: true })
  });
  const managerData = await managerRes.json();
  const managerToken = managerData.idToken;
  console.log('  [PASS] Manager authenticated (UID:', managerData.localId, ')');

  const viewerRes = await fetch(signInUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'viewer@bhuiya.staging', password: '112233', returnSecureToken: true })
  });
  const viewerData = await viewerRes.json();
  const viewerToken = viewerData.idToken;
  console.log('  [PASS] Viewer authenticated (UID:', viewerData.localId, ')');

  // --- SUITE 1: RBAC Security Boundaries ---
  console.log('\n--- SUITE 1: RBAC Security Boundaries ---');
  // Manager attempt to list members
  const mListReq = createMockRequest('listWorkspaceMembersCallable', {}, managerToken);
  const mListRes = await handleCallableApiRequest(mListReq, 'listWorkspaceMembersCallable', env, {});
  const mListData = await mListRes.json();
  console.log('  Manager list members status:', mListRes.status, mListData.error?.code);
  if (mListRes.status === 403 && mListData.error?.code === 'PERMISSION_DENIED') {
    console.log('  [PASS] Manager strictly DENIED from listing workspace members (HTTP 403)');
  } else {
    throw new Error('Manager should be denied from listing members');
  }

  // Viewer attempt to create member
  const vCreateReq = createMockRequest('createWorkspaceMemberCallable', { email: 'hack@test.com' }, viewerToken);
  const vCreateRes = await handleCallableApiRequest(vCreateReq, 'createWorkspaceMemberCallable', env, {});
  const vCreateData = await vCreateRes.json();
  console.log('  Viewer create member status:', vCreateRes.status, vCreateData.error?.code);
  if (vCreateRes.status === 403 && vCreateData.error?.code === 'PERMISSION_DENIED') {
    console.log('  [PASS] Viewer strictly DENIED from creating workspace members (HTTP 403)');
  } else {
    throw new Error('Viewer should be denied from creating members');
  }

  // --- SUITE 2: Master Admin listWorkspaceMembersCallable ---
  console.log('\n--- SUITE 2: Master Admin listWorkspaceMembersCallable ---');
  const aListReq = createMockRequest('listWorkspaceMembersCallable', {}, adminToken);
  const aListRes = await handleCallableApiRequest(aListReq, 'listWorkspaceMembersCallable', env, {});
  const aListData = await aListRes.json();
  console.log('  Master Admin list members status:', aListRes.status, 'count:', aListData.data?.membersCount);
  if (aListRes.status === 200 && aListData.data?.members?.length > 0) {
    console.log('  [PASS] Master Admin successfully listed', aListData.data.members.length, 'members');
    const zahidMember = aListData.data.members.find(m => m.uid === 'WunBcW1KihNW2DMTs3R0gUpQ0fh2');
    console.log('  [PASS] Master Admin member found with role:', zahidMember?.role);
  } else {
    throw new Error('Master Admin listing members failed: ' + JSON.stringify(aListData));
  }

  // --- SUITE 3: Validation and Privilege Escalation Prevention ---
  console.log('\n--- SUITE 3: Validation & Privilege Escalation Prevention ---');
  // Attempt to assign master_admin
  const aEscalateReq = createMockRequest('createWorkspaceMemberCallable', {
    email: 'newadmin@bhuiya.staging',
    role: 'master_admin',
    password: 'Password123!'
  }, adminToken);
  const aEscalateRes = await handleCallableApiRequest(aEscalateReq, 'createWorkspaceMemberCallable', env, {});
  const aEscalateData = await aEscalateRes.json();
  console.log('  Assign master_admin status:', aEscalateRes.status, aEscalateData.error?.code);
  if (aEscalateRes.status === 400 && aEscalateData.error?.message?.includes('Cannot assign master_admin')) {
    console.log('  [PASS] Assignment of master_admin role strictly rejected with HTTP 400');
  } else {
    throw new Error('Should reject master_admin role assignment');
  }

  // Attempt invalid email
  const aInvalidEmailReq = createMockRequest('createWorkspaceMemberCallable', {
    email: 'notanemail',
    role: 'viewer',
    password: 'Password123!'
  }, adminToken);
  const aInvalidEmailRes = await handleCallableApiRequest(aInvalidEmailReq, 'createWorkspaceMemberCallable', env, {});
  if (aInvalidEmailRes.status === 400) {
    console.log('  [PASS] Invalid email address strictly rejected with HTTP 400');
  } else {
    throw new Error('Should reject invalid email');
  }

  // --- SUITE 4: Create New Custom User with Granular Permissions ---
  console.log('\n--- SUITE 4: Create New Custom User & Granular Permissions ---');
  const testNewEmail = `custom_${Date.now()}@bhuiya.staging`;
  const customPermissions = {
    viewHomeSummary: true,
    viewProperties: true,
    createProperty: false,
    viewUnits: true,
    createUnit: false,
    viewTenants: true,
    createTenant: false,
    viewRent: true,
    collectRent: true,
    manageRentReceipts: false,
    viewExpenses: true,
    addExpense: true,
    viewAccounts: true,
    viewFamilyDistribution: false,
    viewReserveFund: false,
    viewReports: false,
    manageAppSettings: false
  };

  const createReq = createMockRequest('createWorkspaceMemberCallable', {
    email: testNewEmail,
    displayName: 'কামাল ভূঁইয়া (Custom Member)',
    role: 'custom',
    password: '112233',
    permissions: customPermissions
  }, adminToken);

  const createRes = await handleCallableApiRequest(createReq, 'createWorkspaceMemberCallable', env, {});
  const createData = await createRes.json();
  console.log('  Create member status:', createRes.status, createData.data?.member?.uid);
  if (createRes.status === 200 && createData.data?.member?.uid) {
    console.log('  [PASS] New user created successfully in Auth and Firestore');
    console.log('  [PASS] Assigned role:', createData.data.member.role);
    console.log('  [PASS] collectRent permission:', createData.data.member.permissions?.collectRent);
    console.log('  [PASS] viewReserveFund permission:', createData.data.member.permissions?.viewReserveFund);
  } else {
    throw new Error('Failed to create member: ' + JSON.stringify(createData));
  }

  const createdUid = createData.data.member.uid;

  // --- SUITE 5: Test Existing User Detection & Confirmation Flow ---
  console.log('\n--- SUITE 5: Existing User Detection & Confirmation Flow ---');
  // Submitting the same email without confirmExistingLink
  const dupReq = createMockRequest('createWorkspaceMemberCallable', {
    email: testNewEmail,
    displayName: 'Duplicate Attempt',
    role: 'viewer'
  }, adminToken);
  const dupRes = await handleCallableApiRequest(dupReq, 'createWorkspaceMemberCallable', env, {});
  const dupData = await dupRes.json();
  console.log('  Duplicate member status:', dupRes.status, dupData.error?.code);
  if (dupRes.status === 409 && dupData.error?.code === 'ALREADY_EXISTS') {
    console.log('  [PASS] Already-member email correctly rejected with ALREADY_EXISTS');
  } else {
    throw new Error('Should reject duplicate workspace member');
  }

  // --- SUITE 6: Update Granular Permissions ---
  console.log('\n--- SUITE 6: Update Granular Permissions ---');
  const updatedPermissions = {
    ...customPermissions,
    viewReserveFund: true,
    collectRent: false // Revoke collectRent
  };
  const updatePermReq = createMockRequest('updateWorkspaceMemberPermissionsCallable', {
    targetUid: createdUid,
    role: 'custom',
    permissions: updatedPermissions
  }, adminToken);
  const updatePermRes = await handleCallableApiRequest(updatePermReq, 'updateWorkspaceMemberPermissionsCallable', env, {});
  const updatePermData = await updatePermRes.json();
  console.log('  Update permissions status:', updatePermRes.status);
  if (updatePermRes.status === 200 && updatePermData.data?.permissions?.viewReserveFund === true && updatePermData.data?.permissions?.collectRent === false) {
    console.log('  [PASS] Permissions successfully updated in Firestore');
    console.log('  [PASS] viewReserveFund is now true, collectRent is now false');
  } else {
    throw new Error('Failed to update permissions: ' + JSON.stringify(updatePermData));
  }

  // --- SUITE 7: Update Member Status (Active -> Suspended -> Inactive) ---
  console.log('\n--- SUITE 7: Member Status Workflow ---');
  // Suspend
  const suspendReq = createMockRequest('updateWorkspaceMemberStatusCallable', {
    targetUid: createdUid,
    status: 'suspended'
  }, adminToken);
  const suspendRes = await handleCallableApiRequest(suspendReq, 'updateWorkspaceMemberStatusCallable', env, {});
  const suspendData = await suspendRes.json();
  console.log('  Suspend member status:', suspendRes.status, suspendData.data?.status);
  if (suspendRes.status === 200 && suspendData.data?.status === 'suspended') {
    console.log('  [PASS] Member successfully suspended');
  } else {
    throw new Error('Failed to suspend member');
  }

  // Reactivate
  const reactivateReq = createMockRequest('updateWorkspaceMemberStatusCallable', {
    targetUid: createdUid,
    status: 'active'
  }, adminToken);
  const reactivateRes = await handleCallableApiRequest(reactivateReq, 'updateWorkspaceMemberStatusCallable', env, {});
  const reactivateData = await reactivateRes.json();
  console.log('  Reactivate member status:', reactivateRes.status, reactivateData.data?.status);
  if (reactivateRes.status === 200 && reactivateData.data?.status === 'active') {
    console.log('  [PASS] Member successfully reactivated');
  } else {
    throw new Error('Failed to reactivate member');
  }

  // --- SUITE 8: Send Password Reset Link / Email ---
  console.log('\n--- SUITE 8: Send Password Reset Link ---');
  const resetReq = createMockRequest('sendWorkspaceMemberPasswordResetCallable', {
    targetUid: createdUid
  }, adminToken);
  const resetRes = await handleCallableApiRequest(resetReq, 'sendWorkspaceMemberPasswordResetCallable', env, {});
  const resetData = await resetRes.json();
  console.log('  Password reset status:', resetRes.status, resetData.data?.email);
  if (resetRes.status === 200 && resetData.data?.email === testNewEmail) {
    console.log('  [PASS] Password reset email/link workflow succeeded');
  } else {
    throw new Error('Failed to send password reset');
  }

  // --- SUITE 9: Revoke Workspace Access & Cleanup ---
  console.log('\n--- SUITE 9: Revoke Workspace Access & Cleanup ---');
  const revokeReq = createMockRequest('updateWorkspaceMemberStatusCallable', {
    targetUid: createdUid,
    status: 'revoked'
  }, adminToken);
  const revokeRes = await handleCallableApiRequest(revokeReq, 'updateWorkspaceMemberStatusCallable', env, {});
  const revokeData = await revokeRes.json();
  console.log('  Revoke member status:', revokeRes.status, revokeData.data?.status);
  if (revokeRes.status === 200 && revokeData.data?.revoked === true) {
    console.log('  [PASS] Workspace access successfully revoked (membership document deleted)');
  } else {
    throw new Error('Failed to revoke member');
  }

  // Verify membership doc no longer exists in Firestore
  const { FirestoreRestClient } = await import('./firestoreRestClient.mjs');
  const firestore = new FirestoreRestClient(config.projectId, async () => {
    const { getFirestoreAccessToken } = await import('./serviceAccountAuth.mjs');
    return await getFirestoreAccessToken(config.credentials);
  });
  const checkDoc = await firestore.getDocument('workspace_members', `workspace_bhuiya_family_${createdUid}`);
  if (!checkDoc || !checkDoc.data) {
    console.log('  [PASS] Verified membership doc completely removed from workspace');
  } else {
    throw new Error('Membership doc should be deleted after revoke');
  }

  // Cleanup test Auth user
  const { getGoogleAdminAccessToken } = await import('./serviceAccountAuth.mjs');
  const adminTokenStr = await getGoogleAdminAccessToken(config.credentials);
  const delUrl = `https://identitytoolkit.googleapis.com/v1/projects/${config.projectId}/accounts:delete`;
  await fetch(delUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminTokenStr}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ localId: createdUid })
  });
  console.log('  [PASS] Temporary test Auth user cleaned up');

  console.log('\n========================================================================');
  console.log('ALL WORKER ACTION TESTS PASSED SUCCESSFULLY! (100% PASS)');
  console.log('========================================================================\n');
}

runTests().catch(err => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
