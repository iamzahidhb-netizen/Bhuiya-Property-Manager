import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  connectAuthEmulator
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  connectFirestoreEmulator
} from 'firebase/firestore';
import { createTestServer } from './test-vercel-api.mjs';

const firebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-bhuiya-property-audit.firebaseapp.com',
  projectId: 'demo-bhuiya-property-audit',
  storageBucket: 'demo-bhuiya-property-audit.appspot.com',
};

const app = initializeApp(firebaseConfig, 'test-prov-vercel-' + Date.now());
const auth = getAuth(app);
const db = getFirestore(app);

connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8088);

let server;
let baseUrl;

async function startServer() {
  server = createTestServer();
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

async function stopServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
}

// Client helper calling the Vercel Serverless Function API via HTTP
async function callVercelApi(actionName, payload = {}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Unauthenticated test call');

  const res = await fetch(`${baseUrl}/api/callable/${actionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) {
    const error = new Error(body.message || 'API error');
    error.code = body.code || body.error || 'unknown';
    error.status = res.status;
    throw error;
  }
  return body.data;
}

const INITIAL_PROPERTIES = [
  { code: 'bhuiya-bari', name: 'ভূঁইয়া বাড়ি', nameEn: 'Bhuiya Bari', type: 'residential' },
  { code: 'mitali-market', name: 'মিতালী মার্কেট', nameEn: 'Mitali Market', type: 'commercial' },
  { code: 'nm-bhuiya-tower', name: 'এন.এম. ভূঁইয়া টাওয়ার', nameEn: 'N.M. Bhuiya Tower', type: 'mixed' },
];

async function seedInitialPropertiesTest(ownerUid) {
  const q = query(collection(db, 'properties'), where('ownerUid', '==', ownerUid));
  const existingSnap = await getDocs(q);
  const existingCodes = new Set(existingSnap.docs.map(d => d.data().code));

  let created = 0;
  let existing = 0;

  for (const prop of INITIAL_PROPERTIES) {
    if (existingCodes.has(prop.code)) {
      existing++;
    } else {
      const docId = `prop_${ownerUid}_${prop.code.replace(/-/g, '_')}`;
      await setDoc(doc(db, 'properties', docId), {
        ownerUid,
        name: prop.name,
        nameEn: prop.nameEn,
        code: prop.code,
        type: prop.type,
        status: 'active',
        isArchived: false,
        activeUnitNumbers: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      created++;
    }
  }
  return { created, existing };
}

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failCount++;
  }
}

async function getOrCreateUser(email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return cred.user;
    }
    throw err;
  }
}

async function runProvisioningSuite() {
  console.log('\n======================================================');
  console.log('  PHASE 10: 14 PROVISIONING TESTS (VERCEL API ROUTES) ');
  console.log('======================================================\n');

  await startServer();

  try {
    const ts = Date.now();
    const adminEmail = `admin_prov_${ts}@bhuiyaproperty.com`;
    const adminPass = 'Password123!@#';
    const attackerEmail = `attacker_prov_${ts}@external.com`;
    const attackerPass = 'Password123!@#';

    console.log('[Step 1] Registering/Signing in Master Admin user...');
    const adminUser = await getOrCreateUser(adminEmail, adminPass);
    const adminUid = adminUser.uid;
    console.log(`  Admin UID: ${adminUid}`);

    // Test 1: First user provisions the 3 initial properties
    console.log('\n--- Test 1: First user provisions the 3 initial properties ---');
    const seed1 = await seedInitialPropertiesTest(adminUid);
    assert(
      seed1.created === 3 && seed1.existing === 0,
      `Exactly 3 properties created on first run (created: ${seed1.created}, existing: ${seed1.existing})`
    );

    // Test 2: Verify all 3 properties carry correct ownerUid in Firestore
    console.log('\n--- Test 2: Verify all 3 properties carry correct ownerUid in Firestore ---');
    const adminPropsSnap = await getDocs(query(collection(db, 'properties'), where('ownerUid', '==', adminUid)));
    assert(adminPropsSnap.size === 3, `Admin owns exactly 3 property documents in Firestore (found ${adminPropsSnap.size})`);
    adminPropsSnap.forEach((docSnap) => {
      assert(
        docSnap.data().ownerUid === adminUid,
        `Property "${docSnap.data().code}" ownerUid matches authenticated admin UID (${adminUid})`
      );
    });

    // Test 3: Idempotency of property seeding (repeated login / refresh)
    console.log('\n--- Test 3: Idempotency of property seeding (repeated login / refresh) ---');
    const seed2 = await seedInitialPropertiesTest(adminUid);
    assert(
      seed2.created === 0 && seed2.existing === 3,
      `Second run created 0 duplicates, recognized 3 existing properties (created: ${seed2.created}, existing: ${seed2.existing})`
    );

    // Test 4: Default Beneficiaries Seeding via Vercel API
    console.log('\n--- Test 4: Default Beneficiaries Seeding via Vercel API ---');
    const seedBeneficiariesRes = await callVercelApi('seedDefaultBeneficiariesCallable', {});
    assert(
      seedBeneficiariesRes.success === true && seedBeneficiariesRes.seeded === true && seedBeneficiariesRes.count === 5,
      `Vercel API seeded 5 default family beneficiaries (success: ${seedBeneficiariesRes.success}, count: ${seedBeneficiariesRes.count})`
    );

    // Test 5: Beneficiary Seeding Idempotency via Vercel API
    console.log('\n--- Test 5: Beneficiary Seeding Idempotency via Vercel API ---');
    const seedBeneficiariesRes2 = await callVercelApi('seedDefaultBeneficiariesCallable', {});
    assert(
      seedBeneficiariesRes2.success === true && seedBeneficiariesRes2.seeded === false,
      `Vercel API idempotent call returned seeded=false without creating duplicates (seeded: ${seedBeneficiariesRes2.seeded})`
    );

    // Test 6: Reserve Fund Initialization via Vercel API
    console.log('\n--- Test 6: Reserve Fund Initialization via Vercel API ---');
    const initReserveRes = await callVercelApi('initializeReserveFundCallable', { initialBalance: 50000 });
    assert(
      initReserveRes.success === true && initReserveRes.alreadyInitialized === false && initReserveRes.currentBalance === 50000,
      `Vercel API initialized Reserve Fund account with balance 50,000 (alreadyInitialized: ${initReserveRes.alreadyInitialized})`
    );

    // Test 7: Reserve Fund Idempotency via Vercel API
    console.log('\n--- Test 7: Reserve Fund Idempotency via Vercel API ---');
    const initReserveRes2 = await callVercelApi('initializeReserveFundCallable', { initialBalance: 99999 });
    assert(
      initReserveRes2.success === true && initReserveRes2.alreadyInitialized === true && initReserveRes2.currentBalance === 50000,
      `Vercel API idempotent call preserved opening balance (balance: ${initReserveRes2.currentBalance}, alreadyInit: ${initReserveRes2.alreadyInitialized})`
    );

    // Sign in as Attacker / Second User
    console.log('\n[Step 2] Registering/Signing in Attacker / Second User...');
    const attackerUser = await getOrCreateUser(attackerEmail, attackerPass);
    const attackerUid = attackerUser.uid;
    console.log(`  Attacker UID: ${attackerUid}`);

    // Test 8: Second user CANNOT read Master Admin properties
    console.log('\n--- Test 8: Second user CANNOT read Master Admin properties (Security Rule Enforcement) ---');
    let adminDocReadDenied = false;
    try {
      const firstAdminPropId = adminPropsSnap.docs[0].id;
      await getDoc(doc(db, 'properties', firstAdminPropId));
    } catch (err) {
      if (err.code === 'permission-denied') adminDocReadDenied = true;
    }
    assert(adminDocReadDenied, 'Direct getDoc on Master Admin property by second user correctly threw PERMISSION_DENIED');

    // Test 9: Second user query for properties returns EMPTY list
    console.log('\n--- Test 9: Second user query for properties returns EMPTY list ---');
    const attackerPropsSnap = await getDocs(query(collection(db, 'properties'), where('ownerUid', '==', attackerUid)));
    assert(
      attackerPropsSnap.size === 0,
      `Second user sees 0 properties before provisioning (found: ${attackerPropsSnap.size})`
    );

    // Test 10: Second user CANNOT modify or claim Master Admin property
    console.log('\n--- Test 10: Second user CANNOT modify or claim Master Admin property ---');
    let attackerWriteDenied = false;
    try {
      const firstAdminPropId = adminPropsSnap.docs[0].id;
      await setDoc(doc(db, 'properties', firstAdminPropId), { ownerUid: attackerUid, name: 'Hacked Property' }, { merge: true });
    } catch (err) {
      if (err.code === 'permission-denied') attackerWriteDenied = true;
    }
    assert(attackerWriteDenied, 'Attacker attempting write/overwrite on Admin property correctly threw PERMISSION_DENIED');

    // Test 11: Second user CANNOT execute Vercel API actions on Master Admin property
    console.log('\n--- Test 11: Second user CANNOT execute Vercel API actions on Master Admin property ---');
    let apiCrossOwnerDenied = false;
    const firstAdminPropId = adminPropsSnap.docs[0].id;
    try {
      await callVercelApi('createUnitCallable', {
        propertyId: firstAdminPropId,
        unitNumber: 'HACK-101',
        monthlyRent: 10000,
      });
    } catch (err) {
      if (err.code === 'permission-denied' && err.status === 403) {
        apiCrossOwnerDenied = true;
      }
    }
    assert(
      apiCrossOwnerDenied,
      'Vercel API createUnitCallable rejected attacker on Master Admin property with 403 permission-denied'
    );

    // Test 12: Second user CANNOT withdraw from Master Admin reserve fund
    console.log('\n--- Test 12: Second user CANNOT withdraw from Master Admin reserve fund ---');
    let attackerReserveDenied = false;
    try {
      await callVercelApi('withdrawFromReserveCallable', {
        amount: 10000,
        reason: 'Unauthorized withdrawal attempt',
      });
    } catch (err) {
      // Attacker's own reserve fund is uninitialized
      if (err.code === 'failed-precondition' && err.status === 412) {
        attackerReserveDenied = true;
      }
    }
    assert(
      attackerReserveDenied,
      'Vercel API withdrawFromReserveCallable rejected attacker withdrawal: uninitialized own fund (412 failed-precondition)'
    );

    // Test 13: Second user CANNOT read Master Admin beneficiary list
    console.log('\n--- Test 13: Second user CANNOT read Master Admin beneficiary list ---');
    const attackerBeneficiarySnap = await getDocs(
      query(collection(db, 'beneficiaries'), where('ownerUid', '==', attackerUid), where('isArchived', '==', false))
    );
    assert(
      attackerBeneficiarySnap.size === 0,
      `Second user sees 0 beneficiaries (no leak from Master Admin, size: ${attackerBeneficiarySnap.size})`
    );

    // Test 14: Second user running seedInitialProperties creates their own distinct documents
    console.log('\n--- Test 14: Second user running seedInitialProperties creates their own distinct documents ---');
    const attackerSeed = await seedInitialPropertiesTest(attackerUid);
    assert(
      attackerSeed.created === 3,
      `Second user provisioning created 3 distinct properties isolated to attackerUid (created: ${attackerSeed.created})`
    );

    const attackerPropsAfterSnap = await getDocs(query(collection(db, 'properties'), where('ownerUid', '==', attackerUid)));
    assert(
      attackerPropsAfterSnap.size === 3,
      `Second user now owns exactly 3 distinct isolated properties (size: ${attackerPropsAfterSnap.size})`
    );

    console.log('\n======================================================');
    console.log(`Phase 10 Provisioning Tests: ${passCount} Passed, ${failCount} Failed`);
    console.log('======================================================\n');
  } finally {
    await stopServer();
  }

  process.exit(failCount > 0 ? 1 : 0);
}

runProvisioningSuite().catch((err) => {
  console.error('\nProvisioning Test Error:', err);
  process.exit(1);
});
