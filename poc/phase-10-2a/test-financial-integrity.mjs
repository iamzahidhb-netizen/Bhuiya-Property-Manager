import assert from 'node:assert/strict';
import { calculateOperatingSummary, getPaymentBillingMonth } from '../../src/services/financialSummary.ts';
import {
  averageMoney,
  proportionalMoney,
  subtractMoney,
  sumMoney,
} from '../../src/utils/money.ts';

assert.equal(sumMoney([0.1, 0.2]), 0.3);
assert.equal(sumMoney([0.005, -0.005]), 0);
assert.equal(subtractMoney(0.1, 0.2), -0.1);
assert.equal(proportionalMoney(100, 1, 3), 33);
assert.equal(averageMoney(101, 2), 51);
assert.throws(() => sumMoney([Number.NaN]), RangeError);

const paymentAtDhakaMonthBoundary = {
  id: 'payment-boundary',
  billingMonth: '',
  paymentDate: { toMillis: () => Date.parse('2026-10-31T18:00:00.000Z') },
};
assert.equal(getPaymentBillingMonth(paymentAtDhakaMonthBoundary), '2026-11');

const summary = calculateOperatingSummary(
  '2026-11',
  [
    { billingMonth: '2026-11', entryType: 'payment', amount: 10.1 },
    {
      billingMonth: '',
      entryType: 'payment',
      amount: 0.2,
      paymentDate: paymentAtDhakaMonthBoundary.paymentDate,
    },
    { billingMonth: '2026-11', entryType: 'reversal', amount: 500 },
    { billingMonth: '2026-11', entryType: 'adjustment', amount: 700 },
    { billingMonth: '2026-10', entryType: 'payment', amount: 900 },
  ],
  [
    { billingMonth: '2026-11', status: 'active', group: 'building', amount: 0.1 },
    {
      billingMonth: '',
      expenseDate: '2026-11-15',
      status: 'active',
      group: 'family',
      amount: 0.2,
    },
    { billingMonth: '2026-11', status: 'active', group: 'other', amount: 0.3 },
    { billingMonth: '2026-11', status: 'reversed', group: 'building', amount: 400 },
    { billingMonth: '2026-10', status: 'active', group: 'building', amount: 800 },
  ]
);

assert.equal(summary.actualRentCollected, 10.3);
assert.equal(summary.buildingExpenses, 0.1);
assert.equal(summary.familyExpenses, 0.2);
assert.equal(summary.totalActualExpenses, 0.6);
assert.equal(summary.netOperatingSurplus, 9.7);

console.log('Financial integrity regression checks: 12 passed, 0 failed.');
