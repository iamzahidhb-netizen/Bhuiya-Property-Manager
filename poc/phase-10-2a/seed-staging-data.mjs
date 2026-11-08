/**
 * Phase 10.2B-10: Staging Property, Unit & Tenant Data Seeding Utility
 * 
 * Safely provisions isolated structural read data into staging Firestore ("bhuiya-property-staging")
 * for Phase 10.2B-10 workspace read verification and cross-workspace isolation testing.
 * 
 * Safety Rules:
 * 1. Strictly locked to "bhuiya-property-staging".
 * 2. ZERO financial writes (no expenses, no payments, no bills, no reserves).
 * 3. Enforces currentDocument: { exists: false } create-only semantics.
 * 4. Defaults to dry-run mode; requires --execute flag.
 * 5. Supports cleanup/teardown via --cleanup flag.
 */

import fs from 'fs';
import path from 'path';
import { getWorkerConfig, parseServiceAccountCredentials } from './worker/envConfig.mjs';
import { getFirestoreAccessToken } from './serviceAccountAuth.mjs';
import { FirestoreRestClient } from './firestoreRestClient.mjs';

export const REQUIRED_STAGING_PROJECT_ID = 'bhuiya-property-staging';

export const STAGING_SEED_DATA = {
  // Workspace A: Bhuiya Family
  properties: [
    {
      id: 'prop_ws_bhuiya_family_01',
      data: {
        workspaceId: 'workspace_bhuiya_family',
        ownerUid: 'WunBcW1KihNW2DMTs3R0gUpQ0fh2',
        name: 'ভূঁইয়া বাড়ি',
        nameEn: 'Bhuiya Bari',
        code: 'bhuiya-bari',
        type: 'residential',
        address: 'পৈতৃক ভিটা, বাংলাদেশ',
        totalFloors: 3,
        description: 'পারিবারিক পৈতৃক আবাসিক ভবন ও ইউনিটসমূহ',
        status: 'active',
        isArchived: false,
        createdAt: '2026-11-08T00:00:00Z',
        updatedAt: '2026-11-08T00:00:00Z'
      }
    },
    // Workspace B: Other Demo
    {
      id: 'prop_ws_other_demo_01',
      data: {
        workspaceId: 'workspace_other_demo',
        ownerUid: 'other_owner_uid_999',
        name: 'অন্যান্য বাণিজ্যিক ভবন',
        nameEn: 'Other Commercial Building',
        code: 'other-building',
        type: 'commercial',
        address: 'বাণিজ্যিক এলাকা, বাংলাদেশ',
        totalFloors: 2,
        description: 'পৃথক ডেমো ওয়ার্কস্পেসের বাণিজ্যিক ভবন',
        status: 'active',
        isArchived: false,
        createdAt: '2026-11-08T00:00:00Z',
        updatedAt: '2026-11-08T00:00:00Z'
      }
    }
  ],
  units: [
    {
      id: 'unit_ws_bhuiya_family_101',
      data: {
        workspaceId: 'workspace_bhuiya_family',
        ownerUid: 'WunBcW1KihNW2DMTs3R0gUpQ0fh2',
        propertyId: 'prop_ws_bhuiya_family_01',
        unitNumber: 'Flat 1A',
        type: 'flat',
        floor: 1,
        monthlyRent: 20000,
        serviceCharge: 2000,
        electricityMeterNumber: 'EM-101',
        gasMeterNumber: 'GM-101',
        status: 'occupied',
        isArchived: false,
        createdAt: '2026-11-08T00:00:00Z',
        updatedAt: '2026-11-08T00:00:00Z'
      }
    },
    {
      id: 'unit_ws_other_demo_201',
      data: {
        workspaceId: 'workspace_other_demo',
        ownerUid: 'other_owner_uid_999',
        propertyId: 'prop_ws_other_demo_01',
        unitNumber: 'Shop 1',
        type: 'shop',
        floor: 1,
        monthlyRent: 35000,
        serviceCharge: 3000,
        electricityMeterNumber: 'EM-S1',
        gasMeterNumber: 'GM-S1',
        status: 'occupied',
        isArchived: false,
        createdAt: '2026-11-08T00:00:00Z',
        updatedAt: '2026-11-08T00:00:00Z'
      }
    }
  ],
  tenants: [
    {
      id: 'tenant_ws_bhuiya_family_001',
      data: {
        workspaceId: 'workspace_bhuiya_family',
        ownerUid: 'WunBcW1KihNW2DMTs3R0gUpQ0fh2',
        propertyId: 'prop_ws_bhuiya_family_01',
        unitId: 'unit_ws_bhuiya_family_101',
        name: 'তানভীর আহমেদ',
        mobile: '+8801700000001',
        monthlyRent: 20000,
        advanceDeposit: 40000,
        gasCharge: 1080,
        waterCharge: 500,
        moveInDate: '2026-01-01',
        status: 'active',
        createdAt: '2026-11-08T00:00:00Z',
        updatedAt: '2026-11-08T00:00:00Z'
      }
    },
    {
      id: 'tenant_ws_other_demo_002',
      data: {
        workspaceId: 'workspace_other_demo',
        ownerUid: 'other_owner_uid_999',
        propertyId: 'prop_ws_other_demo_01',
        unitId: 'unit_ws_other_demo_201',
        name: 'করিম চৌধুরী',
        mobile: '+8801700000002',
        monthlyRent: 35000,
        advanceDeposit: 70000,
        gasCharge: 0,
        waterCharge: 1000,
        moveInDate: '2026-02-01',
        status: 'active',
        createdAt: '2026-11-08T00:00:00Z',
        updatedAt: '2026-11-08T00:00:00Z'
      }
    }
  ],
  workspace_members: [
    {
      id: 'workspace_bhuiya_family_demo_manager_uid',
      data: {
        workspaceId: 'workspace_bhuiya_family',
        uid: 'demo_manager_uid',
        role: 'manager',
        status: 'active',
        permissions: {
          canManageTenants: true,
          canCollectRent: true,
          canRecordExpenses: false,
          canViewReports: true
        },
        metadata: {
          provisionedVia: 'phase-10-2b-10-seed',
          provisionedAt: '2026-11-08T00:00:00Z'
        },
        createdAt: '2026-11-08T00:00:00Z',
        updatedAt: '2026-11-08T00:00:00Z'
      }
    },
    {
      id: 'workspace_bhuiya_family_demo_viewer_uid',
      data: {
        workspaceId: 'workspace_bhuiya_family',
        uid: 'demo_viewer_uid',
        role: 'viewer',
        status: 'active',
        permissions: {
          canManageTenants: false,
          canCollectRent: false,
          canRecordExpenses: false,
          canViewReports: false
        },
        metadata: {
          provisionedVia: 'phase-10-2b-10-seed',
          provisionedAt: '2026-11-08T00:00:00Z'
        },
        createdAt: '2026-11-08T00:00:00Z',
        updatedAt: '2026-11-08T00:00:00Z'
      }
    },
    {
      id: 'workspace_other_demo_other_owner_uid_999',
      data: {
        workspaceId: 'workspace_other_demo',
        uid: 'other_owner_uid_999',
        role: 'master_admin',
        status: 'active',
        permissions: {
          canManageTenants: true,
          canCollectRent: true,
          canRecordExpenses: true,
          canViewReports: true
        },
        metadata: {
          provisionedVia: 'phase-10-2b-10-seed',
          provisionedAt: '2026-11-08T00:00:00Z'
        },
        createdAt: '2026-11-08T00:00:00Z',
        updatedAt: '2026-11-08T00:00:00Z'
      }
    }
  ]
};

export async function runStagingSeed(options = {}) {
  const { execute = false, cleanup = false, env = {} } = options;
  const config = getWorkerConfig(env);

  if (config.projectId !== REQUIRED_STAGING_PROJECT_ID) {
    throw new Error(`Safety Violation: Seeding is strictly locked to "${REQUIRED_STAGING_PROJECT_ID}". Detected: "${config.projectId}"`);
  }

  const firestore = new FirestoreRestClient(config.projectId, async () => {
    return await getFirestoreAccessToken(config.credentials, fetch);
  });

  const actions = [];
  const collections = ['properties', 'units', 'tenants', 'workspace_members'];

  for (const col of collections) {
    for (const item of STAGING_SEED_DATA[col]) {
      const existing = await firestore.getDocument(col, item.id);
      if (cleanup) {
        if (existing) {
          actions.push({ type: 'DELETE', collection: col, id: item.id });
          if (execute) {
            await firestore.deleteDocument(col, item.id);
          }
        }
      } else {
        if (!existing) {
          actions.push({ type: 'CREATE', collection: col, id: item.id, data: item.data });
          if (execute) {
            await firestore.createDocument(col, item.id, item.data);
          }
        } else {
          actions.push({ type: 'ALREADY_EXISTS', collection: col, id: item.id });
        }
      }
    }
  }

  return {
    status: execute ? (cleanup ? 'CLEANUP_COMPLETE' : 'SEED_COMPLETE') : 'DRY_RUN_PREVIEW',
    projectId: config.projectId,
    actionsCount: actions.length,
    actions
  };
}

// Standalone CLI invocation
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  (async () => {
    try {
      const devVarsPath = path.resolve('poc/phase-10-2a/.dev.vars');
      let env = {};
      if (fs.existsSync(devVarsPath)) {
        for (const line of fs.readFileSync(devVarsPath, 'utf8').split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const idx = trimmed.indexOf('=');
          if (idx !== -1) env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
        }
      }

      const execute = process.argv.includes('--execute');
      const cleanup = process.argv.includes('--cleanup');

      console.log('Running staging seed (execute=' + execute + ', cleanup=' + cleanup + ')...');
      const res = await runStagingSeed({ execute, cleanup, env });
      console.log(JSON.stringify(res, null, 2));
    } catch (err) {
      console.error('Seed Error:', err.message);
      process.exit(1);
    }
  })();
}
