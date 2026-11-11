function moneyToMinorUnits(amount: number): bigint {
  if (!Number.isFinite(amount)) {
    throw new RangeError('Money amounts must be finite numbers.');
  }

  const match = /^(-?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/
    .exec(amount.toString().toLowerCase());
  if (!match) {
    throw new RangeError('Money amount could not be parsed.');
  }

  const sign = match[1] === '-' ? -1n : 1n;
  const fraction = match[3] || '';
  const exponent = Number(match[4] || 0);
  const digits = BigInt(`${match[2]}${fraction}`);
  const shift = 2 - fraction.length + exponent;

  if (shift >= 0) {
    return sign * digits * 10n ** BigInt(shift);
  }

  const divisor = 10n ** BigInt(-shift);
  const quotient = digits / divisor;
  const remainder = digits % divisor;
  // Round once at the poisha boundary; all subsequent arithmetic stays integral.
  const rounded = remainder * 2n >= divisor ? quotient + 1n : quotient;

  return sign * rounded;
}

function minorUnitsToMoney(amount: bigint): number {
  const numericAmount = Number(amount);
  if (!Number.isSafeInteger(numericAmount)) {
    throw new RangeError('Money total exceeds the supported precision.');
  }

  return numericAmount / 100;
}

function roundedDivision(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new RangeError('Money division requires a non-zero denominator.');
  }

  const isNegative = (numerator < 0n) !== (denominator < 0n);
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  const quotient = absoluteNumerator / absoluteDenominator;
  const remainder = absoluteNumerator % absoluteDenominator;
  const rounded = remainder * 2n >= absoluteDenominator ? quotient + 1n : quotient;

  return isNegative ? -rounded : rounded;
}

export function sumMoney(amounts: readonly number[]): number;
export function sumMoney<T>(values: readonly T[], getAmount: (value: T) => number): number;
export function sumMoney<T>(
  values: readonly T[],
  getAmount?: (value: T) => number
): number {
  let total = 0n;

  for (const value of values) {
    const amount = getAmount ? getAmount(value) : value;
    if (typeof amount !== 'number') {
      throw new TypeError('Money totals require numeric amounts.');
    }
    total += moneyToMinorUnits(amount);
  }

  return minorUnitsToMoney(total);
}

export function subtractMoney(minuend: number, subtrahend: number): number {
  return minorUnitsToMoney(
    moneyToMinorUnits(minuend) - moneyToMinorUnits(subtrahend)
  );
}

export function proportionalMoney(
  amount: number,
  numerator: number,
  denominator: number
): number {
  const amountMinor = moneyToMinorUnits(amount);
  const numeratorMinor = moneyToMinorUnits(numerator);
  const denominatorMinor = moneyToMinorUnits(denominator);
  const wholeTakaDenominator = denominatorMinor * 100n;
  const roundedTaka = roundedDivision(
    amountMinor * numeratorMinor,
    wholeTakaDenominator
  );

  return minorUnitsToMoney(roundedTaka * 100n);
}

export function averageMoney(total: number, count: number): number {
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new RangeError('Money averages require a positive integer count.');
  }

  const roundedTaka = roundedDivision(
    moneyToMinorUnits(total),
    100n * BigInt(count)
  );

  return minorUnitsToMoney(roundedTaka * 100n);
}
