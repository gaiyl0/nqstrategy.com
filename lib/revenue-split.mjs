// Payment settlement policy. Keep this server-owned and import it from the
// future payment settlement transaction; do not accept a split from clients
// or from an administrator request.
export const CREATOR_REVENUE_BPS = 8_000;
export const PLATFORM_COMMISSION_BPS = 2_000;
export const BASIS_POINTS = 10_000;

if (CREATOR_REVENUE_BPS + PLATFORM_COMMISSION_BPS !== BASIS_POINTS) {
  throw new Error('REVENUE_SPLIT_INVALID');
}

export function calculateRevenueSplit(amountMinor) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('REVENUE_SPLIT_AMOUNT_INVALID');
  }
  // Allocate any indivisible minor-unit remainder to the platform so that
  // creator + platform always exactly equals the settled customer payment.
  const creatorMinor = Math.floor((amountMinor * CREATOR_REVENUE_BPS) / BASIS_POINTS);
  return {
    grossMinor: amountMinor,
    creatorMinor,
    platformMinor: amountMinor - creatorMinor,
    creatorBps: CREATOR_REVENUE_BPS,
    platformBps: PLATFORM_COMMISSION_BPS,
  };
}
