// Quote only. A paid order must still be completed by a verified payment callback.
export function quoteHybridPayment(usdPrice, pointsBalance, requestedPoints) {
  const cents = Math.round(Number(usdPrice) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0 || !Number.isSafeInteger(pointsBalance) || pointsBalance < 0 || !Number.isSafeInteger(requestedPoints) || requestedPoints < 0) throw new Error('INVALID_PAYMENT_QUOTE');
  const maxPoints = Math.min(pointsBalance, Math.floor(cents / 100));
  const pointsUsed = Math.min(requestedPoints, maxPoints);
  return {maxPoints, pointsUsed, cashDueCents:cents - pointsUsed * 100};
}
