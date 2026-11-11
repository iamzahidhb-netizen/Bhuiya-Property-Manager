import fs from 'fs';

let code = fs.readFileSync('src/services/expenseService.ts', 'utf8');

// Add offline imports
if (!code.includes('offlineDb')) {
  code = code.replace(
    "import { parseTimestampMillis } from '../utils/dhakaDate';",
    "import { parseTimestampMillis } from '../utils/dhakaDate';\nimport { STORES, saveItem, saveItemsBatch, getAllItems, type SyncStatus } from '../lib/offlineDb';\nimport { syncEngine } from '../lib/syncEngine';\nimport { auth } from '../lib/firebase';\nimport { getActiveWorkspaceId } from '../lib/apiClient';"
  );
}

// Update CreateExpenseResult interface to include isOffline
code = code.replace(
  '  billingMonth: string;\n}',
  '  billingMonth: string;\n  isOffline?: boolean;\n}'
);

// Update subscribeExpenses to pre-load from cache and merge pending offline
const oldSubExpRegex = /export function subscribeExpenses[\s\S]*?return onSnapshot\([\s\S]*?\n  \);\n\}/;
const newSubExp = `export function subscribeExpenses(
  _ownerUid: string,
  filters: ExpenseFilters,
  onUpdate: (expenses: Expense[]) => void,
  onError?: (error: Error) => void,
  workspaceId?: string | null
): Unsubscribe {
  const effectiveWsId = workspaceId || 'workspace_bhuiya_family';

  // 1. Pre-load from IndexedDB cache
  getAllItems<Expense>(STORES.EXPENSES)
    .then((cached) => {
      if (cached && cached.length > 0) {
        const filtered = cached.filter((e) => {
          if (e.workspaceId && e.workspaceId !== effectiveWsId) return false;
          if (filters.group && filters.group !== 'all' && e.group !== filters.group) return false;
          if (filters.propertyId && e.propertyId !== filters.propertyId) return false;
          if (filters.billingMonth && e.billingMonth !== filters.billingMonth) return false;
          if (filters.category && filters.category !== 'all' && e.category !== filters.category) return false;
          if (filters.status && filters.status !== 'all' && e.status !== filters.status) return false;
          return true;
        });

        filtered.sort((a, b) => {
          if (a.expenseDate !== b.expenseDate) {
            return b.expenseDate.localeCompare(a.expenseDate);
          }
          const timeA = parseTimestampMillis(a.createdAt);
          const timeB = parseTimestampMillis(b.createdAt);
          return timeB - timeA;
        });

        if (filtered.length > 0) {
          onUpdate(filtered);
        }
      }
    })
    .catch((err) => console.warn('[ExpenseService] Failed to read cached expenses:', err));

  const constraints = [where('workspaceId', '==', effectiveWsId)];

  if (filters.group && filters.group !== 'all') {
    constraints.push(where('group', '==', filters.group));
  }
  if (filters.propertyId) {
    constraints.push(where('propertyId', '==', filters.propertyId));
  }
  if (filters.billingMonth) {
    constraints.push(where('billingMonth', '==', filters.billingMonth));
  }
  if (filters.category && filters.category !== 'all') {
    constraints.push(where('category', '==', filters.category));
  }
  if (filters.status && filters.status !== 'all') {
    constraints.push(where('status', '==', filters.status));
  }

  const q = query(collection(db, EXPENSES_COLL), ...constraints);

  return onSnapshot(
    q,
    async (snapshot) => {
      const expenses: Expense[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Expense, 'id'>),
      }));

      // Cache server expenses
      saveItemsBatch(STORES.EXPENSES, expenses).catch((err) =>
        console.warn('[ExpenseService] Failed to cache expenses:', err)
      );

      // Merge local pending offline expenses
      try {
        const cached = await getAllItems<Expense & { syncStatus?: SyncStatus }>(STORES.EXPENSES);
        const pendingOffline = cached.filter((e) => e.syncStatus === 'pending');
        const existingIds = new Set(expenses.map((e) => e.id));

        for (const offExp of pendingOffline) {
          if (!existingIds.has(offExp.id)) {
            expenses.unshift(offExp);
          }
        }
      } catch (mergeErr) {
        console.warn('[ExpenseService] Error merging pending expenses:', mergeErr);
      }

      // Sort newest expense date first, then by createdAt
      expenses.sort((a, b) => {
        if (a.expenseDate !== b.expenseDate) {
          return b.expenseDate.localeCompare(a.expenseDate);
        }
        const timeA = parseTimestampMillis(a.createdAt);
        const timeB = parseTimestampMillis(b.createdAt);
        return timeB - timeA;
      });

      onUpdate(expenses);
    },
    (err) => {
      console.warn('[ExpenseService] subscribeExpenses offline/error:', err.message);
      if (onError) onError(err);
    }
  );
}`;

code = code.replace(oldSubExpRegex, newSubExp);

// Update createExpense with offline fallback
const oldCreateExpRegex = /export async function createExpense[\s\S]*?return res\.data;\s*\}/;
const newCreateExp = `export async function createExpense(
  input: ExpenseFormData
): Promise<CreateExpenseResult> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (isOnline) {
    try {
      const createFn = createCallable<ExpenseFormData, CreateExpenseResult>(
        'createExpenseCallable'
      );
      const res = await createFn(input);

      // Cache confirmed expense in IndexedDB
      const expDoc = {
        id: res.data.expenseId,
        title: input.title,
        group: input.group,
        category: input.category,
        amount: input.amount,
        expenseDate: input.expenseDate,
        billingMonth: res.data.billingMonth || input.expenseDate.slice(0, 7),
        description: input.description,
        propertyId: input.propertyId || null,
        paymentMethod: input.paymentMethod || 'cash',
        workspaceId: getActiveWorkspaceId() || 'workspace_bhuiya_family',
        status: 'active' as const,
        syncStatus: 'synced' as const,
        createdAt: new Date().toISOString(),
      };
      saveItem(STORES.EXPENSES, expDoc).catch(() => {});

      return {
        ...res.data,
        isOffline: false,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isNetworkErr =
        errMsg.includes('Failed to fetch') ||
        errMsg.includes('unavailable') ||
        errMsg.includes('NetworkError');

      if (!isNetworkErr) {
        throw err;
      }
      console.warn('[ExpenseService] Cloud endpoint unreachable; falling back to offline save:', errMsg);
    }
  }

  // Offline Execution Path
  const currentWsId = getActiveWorkspaceId() || 'workspace_bhuiya_family';
  const offlineId = \`exp_offline_\${Date.now()}_\${Math.random().toString(36).substring(2, 7)}\`;
  const billingMonth = input.expenseDate.slice(0, 7);

  const offlineExpDoc = {
    id: offlineId,
    title: input.title,
    group: input.group,
    category: input.category,
    amount: input.amount,
    expenseDate: input.expenseDate,
    billingMonth,
    description: input.description,
    propertyId: input.propertyId || null,
    paymentMethod: input.paymentMethod || 'cash',
    workspaceId: currentWsId,
    status: 'active' as const,
    syncStatus: 'pending' as const,
    isOfflineCreated: true,
    createdAt: new Date().toISOString(),
  };

  await saveItem(STORES.EXPENSES, offlineExpDoc);

  await syncEngine.enqueueAction({
    actionName: 'createExpenseCallable',
    payload: {
      ...input,
      isOfflineGenerated: true,
    },
    category: 'expense',
    workspaceId: currentWsId,
    callerUid: auth.currentUser?.uid || 'offline_user',
    localEntityId: offlineId,
  });

  return {
    success: true,
    expenseId: offlineId,
    title: input.title,
    amount: input.amount,
    group: input.group,
    category: input.category,
    billingMonth,
    isOffline: true,
  };
}`;

code = code.replace(oldCreateExpRegex, newCreateExp);

fs.writeFileSync('src/services/expenseService.ts', code, 'utf8');
console.log('expenseService updated with offline capabilities');
