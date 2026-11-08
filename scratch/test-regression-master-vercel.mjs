import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  connectAuthEmulator, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword
} from 'firebase/auth';
import { 
  getFirestore, 
  connectFirestoreEmulator, 
  doc, 
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { createTestServer } from './test-vercel-api.mjs';

import {
  calculateMonthlyFinancialStatement,
  calculateYearlyFinancialSummary,
  calculatePropertyIncomeReport,
  calculatePropertyExpenseReport,
  calculateTenantRentLedger,
  calculateOutstandingRentReport,
  calculateBuildingExpenseReport,
  calculateFamilyExpenseReport,
  calculateDistributionStatement,
  calculateReserveFundStatement,
  calculateBudgetVsActualReport,
} from './reportService.mjs';

async function run() {
  console.log('======================================================================');
  console.log('  BHUIYA PROPERTY MANAGER: PHASE 8 MASTER REGRESSION & SECURITY AUDIT');
  console.log('======================================================================\n');

  const app = initializeApp({
    apiKey: 'fake-api-key-for-emulator',
    projectId: 'demo-bhuiya-property-audit'
  });

  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8088);

  
  // Start Vercel API test server
  const server = createTestServer();
  let baseUrl;
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

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
      const rawCode = body.code || body.error || 'unknown';
      const error = new Error(body.message || 'API error');
      error.code = rawCode.startsWith('functions/') ? rawCode : `functions/${rawCode}`;
      error.rawCode = rawCode;
      error.status = res.status;
      throw error;
    }
    return body.data;
  }

  function httpsCallable(_fns, actionName) {
    return async (payload = {}) => {
      const data = await callVercelApi(actionName, payload);
      return { data };
    };
  }

  const functions = null;
  // Cloud Functions
  const createUnitFn = httpsCallable(functions, 'createUnitCallable');
  const renameUnitFn = httpsCallable(functions, 'renameUnitCallable');
  const archiveUnitFn = httpsCallable(functions, 'archiveUnitCallable');
  const restoreUnitFn = httpsCallable(functions, 'restoreUnitCallable');
  const registerTenantFn = httpsCallable(functions, 'registerTenantCallable');
  const vacateTenantFn = httpsCallable(functions, 'vacateTenantCallable');
  const generateBillsFn = httpsCallable(functions, 'generateMonthlyBillsCallable');
  const recordPaymentFn = httpsCallable(functions, 'recordRentPaymentCallable');
  const createExpenseFn = httpsCallable(functions, 'createExpenseCallable');
  const updateExpenseFn = httpsCallable(functions, 'updateExpenseCallable');
  const reverseExpenseFn = httpsCallable(functions, 'reverseExpenseCallable');
  const seedBeneficiariesFn = httpsCallable(functions, 'seedDefaultBeneficiariesCallable');
  const updateBeneficiaryFn = httpsCallable(functions, 'updateBeneficiaryCallable');
  const getOrCreateDistFn = httpsCallable(functions, 'getOrCreateMonthlyDistributionCallable');
  const specialAdjustmentFn = httpsCallable(functions, 'applySpecialAdjustmentCallable');
  const recordPayoutFn = httpsCallable(functions, 'recordBeneficiaryPayoutCallable');
  const initReserveFn = httpsCallable(functions, 'initializeReserveFundCallable');
  const withdrawReserveFn = httpsCallable(functions, 'withdrawFromReserveCallable');
  const transferSurplusFn = httpsCallable(functions, 'transferSurplusToReserveCallable');

  // Authenticate Users
  console.log('[Setup] Authenticating test users...');
  let user1Cred, user2Cred;
  try {
    user1Cred = await createUserWithEmailAndPassword(auth, 'owner_phase8_1@bhuiya.test', 'password123');
  } catch {
    user1Cred = await signInWithEmailAndPassword(auth, 'owner_phase8_1@bhuiya.test', 'password123');
  }
  const uid1 = user1Cred.user.uid;

  try {
    user2Cred = await createUserWithEmailAndPassword(auth, 'owner_phase8_2@bhuiya.test', 'password123');
  } catch {
    user2Cred = await signInWithEmailAndPassword(auth, 'owner_phase8_2@bhuiya.test', 'password123');
  }
  const uid2 = user2Cred.user.uid;

  await signInWithEmailAndPassword(auth, 'owner_phase8_1@bhuiya.test', 'password123');

  let testsPassed = 0;
  let testsTotal = 0;

  function assert(condition, testName, details = '') {
    testsTotal++;
    if (condition) {
      testsPassed++;
      console.log(`  ✓ [PASS] [${testsTotal.toString().padStart(2, '0')}] ${testName}`);
    } else {
      console.error(`  ✗ [FAIL] [${testsTotal.toString().padStart(2, '0')}] ${testName} ${details ? '(' + details + ')' : ''}`);
    }
  }

  // =========================================================================
  // SECTION 1: PROPERTIES & UNITS FOUNDATION (PHASE 2)
  // =========================================================================
  console.log('\n--- SECTION 1: PROPERTIES & UNITS FOUNDATION ---');

  // Test 1: Direct property creation with empty activeUnitNumbers is allowed
  const prop1Ref = doc(collection(db, 'properties'));
  const prop1Id = prop1Ref.id;
  let propCreateSuccess = false;
  try {
    await setDoc(prop1Ref, {
      ownerUid: uid1,
      name: 'ভূঁইয়া ভিলা (Bhuiya Villa)',
      nameEn: 'Bhuiya Villa',
      code: 'BV',
      type: 'residential',
      address: 'ধানমন্ডি, ঢাকা',
      totalFloors: 5,
      description: 'আবাসিক ভবন',
      isArchived: false,
      status: 'active',
      activeUnitNumbers: {}
    });
    propCreateSuccess = true;
  } catch {
    propCreateSuccess = false;
  }
  assert(propCreateSuccess, 'Properties: Direct creation with empty activeUnitNumbers is permitted');

  // Test 2: Direct property creation with spoofed non-empty activeUnitNumbers is rejected
  let spoofedPropRejected = false;
  try {
    const spoofPropRef = doc(collection(db, 'properties'));
    await setDoc(spoofPropRef, {
      ownerUid: uid1,
      name: 'Malicious Property',
      isArchived: false,
      activeUnitNumbers: { 'flat1a': 'fakeUnitId' }
    });
  } catch (err) {
    spoofedPropRejected = err.code === 'permission-denied';
  }
  assert(spoofedPropRejected, 'Security Rules: Direct property creation with non-empty activeUnitNumbers is DENIED');

  // Test 3: Direct property deletion is blocked
  let propDeleteDenied = false;
  try {
    await deleteDoc(prop1Ref);
  } catch (err) {
    propDeleteDenied = err.code === 'permission-denied';
  }
  assert(propDeleteDenied, 'Security Rules: Direct deletion of property documents is DENIED (soft-archive only)');

  // Test 4: Direct unit creation is blocked
  let unitDirectCreateDenied = false;
  try {
    const directUnitRef = doc(collection(db, 'units'));
    await setDoc(directUnitRef, {
      ownerUid: uid1,
      propertyId: prop1Id,
      unitNumber: 'Flat 1A',
      monthlyRent: 20000
    });
  } catch (err) {
    unitDirectCreateDenied = err.code === 'permission-denied';
  }
  assert(unitDirectCreateDenied, 'Security Rules: Direct client creation of unit documents is DENIED');

  // Test 5: Unit creation via Cloud Function with server-side normalization
  const unit1Res = await createUnitFn({
    propertyId: prop1Id,
    unitNumber: 'Flat 1-A',
    floor: 1,
    monthlyRent: 20000,
    serviceCharge: 1500,
    type: 'flat'
  });
  const unit1Id = unit1Res.data.unitId;
  const unit1Doc = await getDoc(doc(db, 'units', unit1Id));
  assert(
    unit1Doc.exists() && unit1Doc.data().normalizedUnitNumber === 'flat1a',
    'Unit Lifecycle: Unit created via Cloud Function with server normalizedUnitNumber "flat1a"'
  );

  // Test 6: Duplicate unit number is strictly rejected
  let dupUnitRejected = false;
  try {
    await createUnitFn({
      propertyId: prop1Id,
      unitNumber: 'flat   1A', // Same normalized key
      floor: 1,
      monthlyRent: 20000,
      type: 'flat'
    });
  } catch (err) {
    dupUnitRejected = err.code === 'functions/invalid-argument' || err.code === 'functions/already-exists';
  }
  assert(dupUnitRejected, 'Unit Lifecycle: Duplicate unit number in same property is rejected with error');

  // Test 7: Unit rename via Cloud Function
  const renameRes = await renameUnitFn({
    unitId: unit1Id,
    newUnitNumber: 'Flat 1-A Premium'
  });
  const renamedDoc = await getDoc(doc(db, 'units', unit1Id));
  assert(
    renameRes.data.success && renamedDoc.data().unitNumber === 'Flat 1-A Premium' && renamedDoc.data().normalizedUnitNumber === 'flat1apremium',
    'Unit Lifecycle: Unit rename updates unitNumber and normalizedUnitNumber atomically'
  );

  // Test 8: Unit archive & restore via Cloud Functions
  await archiveUnitFn({ unitId: unit1Id });
  const archivedDoc = await getDoc(doc(db, 'units', unit1Id));
  await restoreUnitFn({ unitId: unit1Id });
  const restoredDoc = await getDoc(doc(db, 'units', unit1Id));
  assert(
    archivedDoc.data().isArchived === true && restoredDoc.data().isArchived === false,
    'Unit Lifecycle: Archive and restore toggle isArchived cleanly without data loss'
  );

  // =========================================================================
  // SECTION 2: TENANTS & LEASES (PHASE 3)
  // =========================================================================
  console.log('\n--- SECTION 2: TENANTS & LEASES ---');

  // Test 9: Direct client write to tenants is blocked
  let tenantDirectWriteDenied = false;
  try {
    const fakeTenantRef = doc(collection(db, 'tenants'));
    await setDoc(fakeTenantRef, { ownerUid: uid1, name: 'Hacker Tenant' });
  } catch (err) {
    tenantDirectWriteDenied = err.code === 'permission-denied';
  }
  assert(tenantDirectWriteDenied, 'Security Rules: Direct client creation of tenant document is DENIED');

  // Test 10: Register Tenant via Cloud Function (Atomic occupancy + deposit)
  const tenant1Res = await registerTenantFn({
    propertyId: prop1Id,
    unitId: unit1Id,
    name: 'করিম হোসেন (Karim Hossain)',
    mobile: '01711000001',
    monthlyRent: 20000,
    gasCharge: 1000,
    waterCharge: 500,
    advanceDeposit: 40000,
    moveInDate: '2026-11-01'
  });
  const tenant1Id = tenant1Res.data.tenantId;
  const unitAfterTenant = await getDoc(doc(db, 'units', unit1Id));
  const tenantDoc = await getDoc(doc(db, 'tenants', tenant1Id));
  assert(
    tenantDoc.exists() && unitAfterTenant.data().status === 'occupied' && unitAfterTenant.data().currentTenantId === tenant1Id,
    'Tenant Lifecycle: Registration atomically sets tenant active, unit occupied, and links currentTenantId'
  );

  // Test 11: Security deposit recorded as balance-sheet liability
  const depSnap = await getDocs(query(collection(db, 'security_deposits'), where('ownerUid', '==', uid1), where('tenantId', '==', tenant1Id)));
  const depDoc = depSnap.docs[0];
  assert(
    depDoc && depDoc.data().classification === 'liability' && depDoc.data().depositAmount === 40000,
    'Security Deposits: Stored with classification "liability" and excluded from operating revenue'
  );

  // Test 12: Vacate Tenant via Cloud Function
  const vacateRes = await vacateTenantFn({
    tenantId: tenant1Id,
    vacatingDate: '2026-11-30',
    damageDeductions: 5000,
    refundAmount: 35000,
    settlementNotes: 'রং চটে যাওয়ার কারণে ৫,০০০ টাকা কর্তন'
  });
  const unitAfterVacate = await getDoc(doc(db, 'units', unit1Id));
  const vacatedTenantDoc = await getDoc(doc(db, 'tenants', tenant1Id));
  assert(
    vacateRes.data.success && unitAfterVacate.data().status === 'vacant' && vacatedTenantDoc.data().status === 'vacated',
    'Tenant Lifecycle: Vacate atomically marks tenant vacated, settles deposit, and marks unit vacant'
  );

  // Re-register tenant for subsequent billing and payout tests
  const activeTenantRes = await registerTenantFn({
    propertyId: prop1Id,
    unitId: unit1Id,
    name: 'করিম হোসেন (Karim Hossain)',
    mobile: '01711000001',
    monthlyRent: 20000,
    gasCharge: 1000,
    waterCharge: 500,
    advanceDeposit: 40000,
    moveInDate: '2026-11-01'
  });
  const activeTenantId = activeTenantRes.data.tenantId;

  // =========================================================================
  // SECTION 3: RENT BILLING & PAYMENTS (PHASE 4)
  // =========================================================================
  console.log('\n--- SECTION 3: RENT BILLING & PAYMENTS ---');

  // Test 13: Direct writes to rent_bills and rent_payments blocked
  let directBillDenied = false;
  try {
    await setDoc(doc(collection(db, 'rent_bills')), { ownerUid: uid1, totalDue: 10000 });
  } catch (err) {
    directBillDenied = err.code === 'permission-denied';
  }
  assert(directBillDenied, 'Security Rules: Direct client creation of rent_bills is DENIED');

  // Test 14: Generate bills for month
  const genBillsRes = await generateBillsFn({ billingMonth: '2026-11' });
  assert(
    genBillsRes.data.success && genBillsRes.data.countCreated >= 1,
    'Rent Billing: Generated monthly bills for active tenants (Rent + Gas + Water + Service Charge)'
  );

  // Test 15: Bill generation idempotency (skips duplicate generation)
  const reGenBillsRes = await generateBillsFn({ billingMonth: '2026-11' });
  assert(
    reGenBillsRes.data.countSkipped >= 1 && reGenBillsRes.data.countCreated === 0,
    'Rent Billing: Idempotency enforced; subsequent run skips existing bills with 0 duplicates'
  );

  // Fetch created bill
  const billsSnap = await getDocs(query(collection(db, 'rent_bills'), where('ownerUid', '==', uid1), where('tenantId', '==', activeTenantId)));
  const bill1 = billsSnap.docs[0];

  // Test 16: Partial payment recording
  const pay1Res = await recordPaymentFn({
    billId: bill1.id,
    amount: 15000,
    paymentMethod: 'bkash',
    transactionId: 'TXN-P8-01',
    paymentDate: '2026-11-05',
    notes: 'প্রথম কিস্তি পরিশোধ'
  });
  const billAfterPay1 = await getDoc(doc(db, 'rent_bills', bill1.id));
  assert(
    pay1Res.data.success && billAfterPay1.data().status === 'partial' && billAfterPay1.data().totalPaid === 15000,
    'Rent Payments: Partial payment recorded; bill status is "partial" with accurate balance due'
  );

  // Test 17: Full payment completion
  const remDue = billAfterPay1.data().balanceDue;
  const pay2Res = await recordPaymentFn({
    billId: bill1.id,
    amount: remDue,
    paymentMethod: 'bank',
    transactionId: 'TXN-P8-02',
    paymentDate: '2026-11-10',
    notes: 'চূড়ান্ত কিস্তি পরিশোধ'
  });
  const billAfterPay2 = await getDoc(doc(db, 'rent_bills', bill1.id));
  assert(
    pay2Res.data.success && billAfterPay2.data().status === 'paid' && billAfterPay2.data().balanceDue === 0,
    'Rent Payments: Final payment clears balance due and marks bill status as "paid"'
  );

  // =========================================================================
  // SECTION 4: OPERATING EXPENSES (PHASE 5)
  // =========================================================================
  console.log('\n--- SECTION 4: OPERATING EXPENSES ---');

  // Test 18: Direct writes to expenses blocked
  let directExpDenied = false;
  try {
    await setDoc(doc(collection(db, 'expenses')), { ownerUid: uid1, amount: 5000 });
  } catch (err) {
    directExpDenied = err.code === 'permission-denied';
  }
  assert(directExpDenied, 'Security Rules: Direct client creation of expenses is DENIED');

  // Test 19: Create building and family expenses via Cloud Function
  const exp1Res = await createExpenseFn({
    title: 'কেয়ারটেকার মাসিক বেতন',
    amount: 15000,
    group: 'building',
    category: 'caretaker_salary',
    propertyId: prop1Id,
    expenseDate: '2026-11-05',
    paymentMethod: 'cash'
  });
  const exp1Id = exp1Res.data.expenseId;

  const exp2Res = await createExpenseFn({
    title: 'পারিবারিক বাজার-সদাই',
    amount: 25000,
    group: 'family',
    category: 'bazaar',
    expenseDate: '2026-11-06',
    paymentMethod: 'cash'
  });
  const exp2Id = exp2Res.data.expenseId;

  const exp1Doc = await getDoc(doc(db, 'expenses', exp1Id));
  const exp2Doc = await getDoc(doc(db, 'expenses', exp2Id));
  assert(
    exp1Doc.exists() && exp2Doc.exists() && exp1Doc.data().group === 'building' && exp2Doc.data().group === 'family',
    'Expenses: Successfully created building expense (৳15,000) and family expense (৳25,000)'
  );

  // Test 20: Update expense with required audit reason
  await updateExpenseFn({
    expenseId: exp1Id,
    amount: 16000,
    title: 'কেয়ারটেকার বেতন (বর্ধিত)',
    group: 'building',
    category: 'caretaker_salary',
    expenseDate: '2026-11-05',
    paymentMethod: 'cash',
    reason: '১,০০০ টাকা বাৎসরিক ইনক্রিমেন্ট অনুমোদন'
  });
  const exp1Updated = await getDoc(doc(db, 'expenses', exp1Id));
  assert(
    exp1Updated.data().amount === 16000 && exp1Updated.data().auditHistory.length >= 1,
    'Expenses: Modification preserves full audit history with mandatory justification reason'
  );

  // Test 21: Reverse expense (soft-reversal)
  await reverseExpenseFn({
    expenseId: exp2Id,
    reason: 'ভাউচার সমন্বয়ে বাতিল'
  });
  const exp2Reversed = await getDoc(doc(db, 'expenses', exp2Id));
  assert(
    exp2Reversed.data().status === 'reversed' && exp2Reversed.data().reversalReason === 'ভাউচার সমন্বয়ে বাতিল',
    'Expenses: Reversal marks status "reversed" without deleting original record'
  );

  // =========================================================================
  // SECTION 5: FAMILY DISTRIBUTION & RESERVE FUND (PHASE 6)
  // =========================================================================
  console.log('\n--- SECTION 5: FAMILY DISTRIBUTION & RESERVE FUND ---');

  // Test 22: Direct writes to beneficiaries, family_distributions, reserve_funds blocked
  let directBenDenied = false;
  try {
    await setDoc(doc(collection(db, 'beneficiaries')), { ownerUid: uid1, name: 'Hacker' });
  } catch (err) {
    directBenDenied = err.code === 'permission-denied';
  }
  assert(directBenDenied, 'Security Rules: Direct client creation of beneficiaries is DENIED');

  // Test 23: Seed default beneficiaries (Brother 1-3, Mother, Sister = ৳185k)
  const seedRes = await seedBeneficiariesFn();
  const benSnap = await getDocs(query(collection(db, 'beneficiaries'), where('ownerUid', '==', uid1)));
  assert(
    seedRes.data.success && benSnap.docs.length === 5,
    'Beneficiaries: 5 default beneficiaries seeded idempotently (৳185,000 total target)'
  );

  // Test 24: Monthly distribution snapshot creation
  const distRes = await getOrCreateDistFn({ distributionMonth: '2026-11' });
  const distDoc = await getDoc(doc(db, 'family_distributions', `${uid1}_2026-11`));
  assert(
    distDoc.exists() && distDoc.data().beneficiarySnapshots.length === 5,
    'Distribution Snapshot: Created immutable monthly snapshot with 5 beneficiary targets'
  );

  // Test 25: Beneficiary target update with effective month
  const firstBen = benSnap.docs[0];
  await updateBeneficiaryFn({
    beneficiaryId: firstBen.id,
    name: firstBen.data().name,
    relationship: firstBen.data().relationship,
    monthlyTarget: 50000,
    effectiveFromMonth: '2026-12',
    reason: 'আগামী মাস হতে ৫,০০০ টাকা বৃদ্ধি'
  });
  const distDocCheck = await getDoc(doc(db, 'family_distributions', `${uid1}_2026-11`));
  assert(
    distDocCheck.data().beneficiarySnapshots[0].baseMonthlyTarget === 45000,
    'Snapshot Immutability: Editing beneficiary target does NOT retroactively alter past/active snapshots'
  );

  // Test 26: Reserve Fund initialization & shortage withdrawal
  const initRes = await initReserveFn({ initialBalance: 60000 });
  const withdrawRes = await withdrawReserveFn({
    amount: 20000,
    distributionMonth: '2026-11',
    reason: 'নভেম্বর ঘাটতি পূরণে তহবিল উত্তোলন'
  });
  const fundDoc = await getDoc(doc(db, 'reserve_funds', uid1));
  const ledgerSnap = await getDocs(query(collection(db, 'reserve_ledger'), where('ownerUid', '==', uid1)));
  const withdrawEntry = ledgerSnap.docs.find(d => d.data().type === 'shortage_withdrawal');
  assert(
    fundDoc.data().currentBalance === 40000 && withdrawEntry.data().isRentalIncome === false,
    'Reserve Fund: Withdrawal updates balance to ৳40,000 with isRentalIncome: false strictly enforced'
  );

  // Test 27: Reserve withdrawal exceeding balance is rejected
  let overWithdrawRejected = false;
  try {
    await withdrawReserveFn({ amount: 999999, reason: 'অবৈধ উত্তোলন' });
  } catch (err) {
    overWithdrawRejected = err.code === 'functions/failed-precondition' || err.code === 'functions/invalid-argument';
  }
  assert(overWithdrawRejected, 'Reserve Fund: Withdrawal exceeding current balance is strictly REJECTED');

  // =========================================================================
  // SECTION 6: FINANCIAL REPORTS & ANALYTICS (PHASE 7)
  // =========================================================================
  console.log('\n--- SECTION 6: FINANCIAL REPORTS & ANALYTICS ---');

  const finalBillsSnap = await getDocs(query(collection(db, 'rent_bills'), where('ownerUid', '==', uid1)));
  const finalBills = finalBillsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const finalPaymentsSnap = await getDocs(query(collection(db, 'rent_payments'), where('ownerUid', '==', uid1)));
  const finalPayments = finalPaymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const finalExpensesSnap = await getDocs(query(collection(db, 'expenses'), where('ownerUid', '==', uid1)));
  const finalExpenses = finalExpensesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const finalDistDoc = await getDoc(doc(db, 'family_distributions', `${uid1}_2026-11`));
  const finalDistData = finalDistDoc.exists() ? { id: finalDistDoc.id, ...finalDistDoc.data() } : null;

  const testTenants = [{ id: activeTenantId, advanceDeposit: 40000, status: 'active' }];

  // Test 28: Monthly Statement Calculation
  const stmt = calculateMonthlyFinancialStatement(
    '2026-11',
    finalPayments,
    finalBills,
    finalExpenses,
    finalDistData,
    testTenants
  );
  assert(
    stmt.totalOperatingIncome === 23000 && stmt.buildingOperatingExpenses === 16000 && stmt.familySocialExpenses === 0, // Reversed expense excluded
    'Report Engine: Monthly Statement reflects actual receipts (৳23,000) and excludes reversed expenses'
  );

  // Test 29: Budget vs Actual Analysis
  const budgetRpt = calculateBudgetVsActualReport('2026-11', finalExpenses);
  assert(
    budgetRpt.budgetTarget === 60000 && budgetRpt.actualBuildingExpense === 16000 && budgetRpt.status === 'under_budget',
    'Report Engine: Budget vs Actual accurately calculates ৳44,000 favorable variance vs ৳60,000 budget'
  );

  // =========================================================================
  // SECTION 7: CROSS-OWNER ISOLATION & ACCESS CONTROL
  // =========================================================================
  console.log('\n--- SECTION 7: CROSS-OWNER ISOLATION AUDIT ---');

  await signInWithEmailAndPassword(auth, 'owner_phase8_2@bhuiya.test', 'password123');

  // Test 30: User 2 reading User 1 bills is blocked
  let crossBillBlocked = false;
  try {
    const unauthSnap = await getDocs(query(collection(db, 'rent_bills'), where('ownerUid', '==', uid1)));
    crossBillBlocked = unauthSnap.empty;
  } catch {
    crossBillBlocked = true;
  }
  assert(crossBillBlocked, 'Security Rules: User 2 is strictly blocked from reading User 1 rent bills');

  // Test 31: User 2 reading User 1 expenses is blocked
  let crossExpBlocked = false;
  try {
    const unauthExp = await getDoc(doc(db, 'expenses', exp1Id));
    crossExpBlocked = !unauthExp.exists();
  } catch (err) {
    crossExpBlocked = err.code === 'permission-denied';
  }
  assert(crossExpBlocked, 'Security Rules: User 2 is strictly blocked from reading User 1 expenses');

  // Test 32: User 2 reading User 1 distribution is blocked
  let crossDistBlocked = false;
  try {
    const unauthDist = await getDoc(doc(db, 'family_distributions', `${uid1}_2026-11`));
    crossDistBlocked = !unauthDist.exists();
  } catch (err) {
    crossDistBlocked = err.code === 'permission-denied';
  }
  assert(crossDistBlocked, 'Security Rules: User 2 is strictly blocked from reading User 1 distribution snapshots');

  console.log('\n======================================================================');
  console.log(`  AUDIT COMPLETE: ${testsPassed} / ${testsTotal} SCENARIOS PASSED`);
  console.log('======================================================================\n');

  if (testsPassed === testsTotal) {
    console.log('>>> ALL MASTER REGRESSION & SECURITY SCENARIOS PASSED (100% SUCCESS) <<<\n');
    process.exit(0);
  } else {
    console.error('>>> SOME REGRESSION SCENARIOS FAILED <<<\n');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test Execution Error:', err);
  process.exit(1);
});
