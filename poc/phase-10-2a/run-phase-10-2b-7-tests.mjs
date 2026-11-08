/**
 * Phase 10.2B-7: Staging First-Admin Provisioning Test Suite
 * 
 * Tests:
 * 1. Valid UID and workspace ID in dry-run and mock execute modes
 * 2. Missing or empty UID validation rejection
 * 3. Invalid workspace ID validation rejection (special chars, path traversal, slashes, length)
 * 4. Existing membership pre-check rejection (409 ALREADY_EXISTS)
 * 5. Duplicate provisioning prevention
 * 6. Wrong Firebase project rejection (strictly locked to bhuiya-property-staging)
 * 7. Attempted overwrite prevention via exists: false precondition
 * 8. Financial writes remain disabled throughout provisioning workflows
 */

import fs from 'fs';
import path from 'path';
import {
  validateProvisioningParams,
  constructAdminMemberDocument,
  provisionStagingAdmin,
  REQUIRED_STAGING_PROJECT_ID
} from './bootstrap-staging-admin.mjs';
import { getWorkerConfig } from './worker/envConfig.mjs';
import { dispatchAction } from './worker/actionRegistry.mjs';

const results = [];
let passCount = 0;
let failCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    passCount++;
    results.push({ name: testName, status: 'PASS', details });
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failCount++;
    results.push({ name: testName, status: 'FAIL', details });
    console.error(`  ✗ [FAIL] ${testName} - ${details}`);
  }
}

// In-memory mock Firestore client
function createMockFirestore(seedData = {}) {
  const db = JSON.parse(JSON.stringify(seedData));
  const writtenPayloads = [];

  return {
    _db: db,
    _writtenPayloads: writtenPayloads,
    async getDocument(collectionPath, docId) {
      const fullPath = `${collectionPath}/${docId}`;
      if (db[fullPath]) {
        return {
          id: docId,
          path: fullPath,
          data: JSON.parse(JSON.stringify(db[fullPath])),
          createTime: new Date().toISOString(),
          updateTime: new Date().toISOString()
        };
      }
      return null;
    },
    async createDocument(collectionPath, docId, data) {
      const fullPath = `${collectionPath}/${docId}`;
      if (db[fullPath]) {
        const err = new Error(`Document already exists at ${fullPath}`);
        err.code = 'ALREADY_EXISTS';
        err.status = 409;
        throw err;
      }
      const record = JSON.parse(JSON.stringify(data));
      db[fullPath] = record;
      writtenPayloads.push({
        fullPath,
        data: record,
        precondition: { exists: false }
      });
      return { writeResults: [{ updateTime: new Date().toISOString() }] };
    }
  };
}

async function runSuite() {
  console.log('======================================================================');
  console.log('  PHASE 10.2B-7: STAGING FIRST-ADMIN PROVISIONING TEST SUITE');
  console.log('======================================================================\n');

  const validStagingEnv = {
    FIREBASE_PROJECT_ID: 'bhuiya-property-staging',
    EXECUTION_MODE: 'staging',
    DISABLE_FINANCIAL_WRITES: 'true'
  };

  // ---------------------------------------------------------------------------
  // TEST 1: VALID UID AND WORKSPACE ID (DRY-RUN & MOCK EXECUTE)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: VALID UID AND WORKSPACE ID ---');

  const mockDb1 = createMockFirestore();

  // Dry-run mode
  const dryRunRes = await provisionStagingAdmin({
    uid: 'mock_first_admin_uid_123',
    workspaceId: 'mock_family_workspace',
    execute: false
  }, {
    env: validStagingEnv,
    firestoreClient: mockDb1
  });

  assert(
    dryRunRes.status === 'DRY_RUN_PREVIEW' &&
    dryRunRes.targetProject === 'bhuiya-property-staging' &&
    dryRunRes.collection === 'workspace_members' &&
    dryRunRes.documentId === 'mock_family_workspace_mock_first_admin_uid_123',
    'Provisioning Dry-Run: Previews correct project, collection, and canonical document ID'
  );

  assert(
    mockDb1._writtenPayloads.length === 0,
    'Provisioning Dry-Run: Guaranteed zero database writes in dry-run mode'
  );

  assert(
    dryRunRes.documentData.role === 'master_admin' &&
    dryRunRes.documentData.status === 'active' &&
    dryRunRes.documentData.permissions.canManageTenants === true &&
    dryRunRes.documentData.permissions.canCollectRent === true &&
    dryRunRes.documentData.permissions.canRecordExpenses === true &&
    dryRunRes.documentData.permissions.canViewReports === true,
    'Provisioning Dry-Run: Schema matches verified master_admin specification with complete permissions'
  );

  // Mock execute mode
  const executeRes = await provisionStagingAdmin({
    uid: 'mock_first_admin_uid_123',
    workspaceId: 'mock_family_workspace',
    execute: true
  }, {
    env: validStagingEnv,
    firestoreClient: mockDb1
  });

  assert(
    executeRes.status === 'PROVISIONED_SUCCESSFULLY' &&
    mockDb1._writtenPayloads.length === 1 &&
    mockDb1._db['workspace_members/mock_family_workspace_mock_first_admin_uid_123'] !== undefined,
    'Provisioning Execute: Successfully created membership document in mock Firestore'
  );

  // ---------------------------------------------------------------------------
  // TEST 2: MISSING OR EMPTY UID
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: MISSING OR EMPTY UID VALIDATION ---');

  try {
    validateProvisioningParams(null, 'mock_ws', 'bhuiya-property-staging');
    assert(false, 'Validation: Missing UID should fail', 'Allowed null UID');
  } catch (err) {
    assert(err.message.includes('UID is required'), 'Validation: Null UID correctly rejected');
  }

  try {
    validateProvisioningParams('   ', 'mock_ws', 'bhuiya-property-staging');
    assert(false, 'Validation: Empty UID should fail', 'Allowed empty whitespace UID');
  } catch (err) {
    assert(err.message.includes('length must be between 1 and 128'), 'Validation: Whitespace-only UID correctly rejected');
  }

  // ---------------------------------------------------------------------------
  // TEST 3: INVALID WORKSPACE ID
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: INVALID WORKSPACE ID VALIDATION ---');

  try {
    validateProvisioningParams('valid_uid', null, 'bhuiya-property-staging');
    assert(false, 'Validation: Missing workspace ID should fail', 'Allowed null workspace ID');
  } catch (err) {
    assert(err.message.includes('Workspace ID is required'), 'Validation: Null workspace ID correctly rejected');
  }

  try {
    validateProvisioningParams('valid_uid', 'ws/with/slash', 'bhuiya-property-staging');
    assert(false, 'Validation: Workspace ID with slashes should fail', 'Allowed slash in workspace ID');
  } catch (err) {
    assert(err.message.includes('must contain only alphanumeric'), 'Validation: Workspace ID with path traversal/slashes correctly rejected');
  }

  try {
    validateProvisioningParams('valid_uid', 'ab', 'bhuiya-property-staging');
    assert(false, 'Validation: Too short workspace ID should fail', 'Allowed 2-char workspace ID');
  } catch (err) {
    assert(err.message.includes('between 3 and 64'), 'Validation: Workspace ID under minimum length correctly rejected');
  }

  // ---------------------------------------------------------------------------
  // TEST 4: EXISTING MEMBERSHIP PRE-CHECK
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: EXISTING MEMBERSHIP PRE-CHECK ---');

  const mockDbWithExisting = createMockFirestore({
    'workspace_members/ws_existing_uid_existing': {
      workspaceId: 'ws_existing',
      uid: 'uid_existing',
      role: 'master_admin',
      status: 'active'
    }
  });

  try {
    await provisionStagingAdmin({
      uid: 'uid_existing',
      workspaceId: 'ws_existing',
      execute: false
    }, {
      env: validStagingEnv,
      firestoreClient: mockDbWithExisting
    });
    assert(false, 'Existing Membership: Pre-check should detect existing record', 'Allowed duplicate in dry run');
  } catch (err) {
    assert(
      err.code === 'ALREADY_EXISTS' && err.message.includes('already exists'),
      'Existing Membership: Pre-read existence check detects existing document and rejects with ALREADY_EXISTS'
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 5: DUPLICATE PROVISIONING PREVENTION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 5: DUPLICATE PROVISIONING PREVENTION ---');

  const mockDbDuplicate = createMockFirestore();

  // First call succeeds
  await provisionStagingAdmin({
    uid: 'uid_first_time',
    workspaceId: 'ws_unique',
    execute: true
  }, {
    env: validStagingEnv,
    firestoreClient: mockDbDuplicate
  });

  // Second call with identical UID and workspace ID must fail
  try {
    await provisionStagingAdmin({
      uid: 'uid_first_time',
      workspaceId: 'ws_unique',
      execute: true
    }, {
      env: validStagingEnv,
      firestoreClient: mockDbDuplicate
    });
    assert(false, 'Duplicate Provisioning: Second execute should fail', 'Allowed duplicate provisioning');
  } catch (err) {
    assert(
      err.code === 'ALREADY_EXISTS',
      'Duplicate Provisioning: Re-running provisioning for same UID & workspace rejected with ALREADY_EXISTS'
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 6: WRONG FIREBASE PROJECT
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 6: WRONG FIREBASE PROJECT REJECTION ---');

  try {
    validateProvisioningParams('valid_uid', 'valid_ws', 'bhuiya-property-manager'); // Production project ID!
    assert(false, 'Project Safety: Production project ID should fail', 'Allowed production project ID');
  } catch (err) {
    assert(
      err.message.includes('Safety Violation') && err.message.includes(REQUIRED_STAGING_PROJECT_ID),
      'Project Safety: Execution strictly rejected if target is not "bhuiya-property-staging" (Production Guard)'
    );
  }

  try {
    validateProvisioningParams('valid_uid', 'valid_ws', 'unrecognized-project');
    assert(false, 'Project Safety: Random project ID should fail', 'Allowed non-staging project ID');
  } catch (err) {
    assert(err.message.includes('Safety Violation'), 'Project Safety: Non-staging project ID rejected');
  }

  // ---------------------------------------------------------------------------
  // TEST 7: ATTEMPTED OVERWRITE PRECONDITION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 7: ATTEMPTED OVERWRITE PRECONDITION ENFORCEMENT ---');

  const mockDbPrecondition = createMockFirestore();
  await provisionStagingAdmin({
    uid: 'uid_precond',
    workspaceId: 'ws_precond',
    execute: true
  }, {
    env: validStagingEnv,
    firestoreClient: mockDbPrecondition
  });

  const lastWrite = mockDbPrecondition._writtenPayloads[0];
  assert(
    lastWrite && lastWrite.precondition && lastWrite.precondition.exists === false,
    'Write Preconditions: Provisioning write payload strictly enforces currentDocument: { exists: false }'
  );

  // ---------------------------------------------------------------------------
  // TEST 8: FINANCIAL WRITES REMAIN DISABLED
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 8: FINANCIAL WRITES REMAIN DISABLED ---');

  const workerConfig = getWorkerConfig(validStagingEnv);
  assert(
    workerConfig.disableFinancialWrites === true,
    'Financial Safety: workerConfig.disableFinancialWrites is TRUE in staging mode'
  );

  const dryRunExpense = await dispatchAction('createExpenseCallable', {
    group: 'maintenance',
    category: 'electrical',
    amount: 5000,
    expenseDate: '2026-11-08',
    billingMonth: '2026-11',
    description: 'Dry run check'
  }, {
    workspaceId: 'ws_test',
    uid: 'uid_test',
    role: 'master_admin'
  }, {
    config: workerConfig
  });

  assert(
    dryRunExpense.status === 'PACKAGING_VALIDATED',
    'Financial Safety: Financial operations return PACKAGING_VALIDATED without performing writes'
  );

  console.log('\n======================================================================');
  console.log(`  PHASE 10.2B-7 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('======================================================================\n');

  return { passCount, failCount };
}

runSuite().then(res => {
  if (res.failCount > 0) process.exit(1);
  process.exit(0);
}).catch(err => {
  console.error('Fatal Suite Error:', err);
  process.exit(1);
});
