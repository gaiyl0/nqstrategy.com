import assert from 'node:assert/strict';
import {
  BASIS_POINTS,
  calculateRevenueSplit,
  CREATOR_REVENUE_BPS,
  PLATFORM_COMMISSION_BPS,
} from '../lib/revenue-split.mjs';

assert.equal(CREATOR_REVENUE_BPS, 8_000);
assert.equal(PLATFORM_COMMISSION_BPS, 2_000);
assert.equal(CREATOR_REVENUE_BPS + PLATFORM_COMMISSION_BPS, BASIS_POINTS);
assert.deepEqual(calculateRevenueSplit(39_900), {
  grossMinor: 39_900,
  creatorMinor: 31_920,
  platformMinor: 7_980,
  creatorBps: 8_000,
  platformBps: 2_000,
});
assert.deepEqual(calculateRevenueSplit(101), {
  grossMinor: 101,
  creatorMinor: 80,
  platformMinor: 21,
  creatorBps: 8_000,
  platformBps: 2_000,
});
assert.throws(() => calculateRevenueSplit(0), /REVENUE_SPLIT_AMOUNT_INVALID/);
assert.throws(() => calculateRevenueSplit(1.5), /REVENUE_SPLIT_AMOUNT_INVALID/);

console.log('Payment configuration tests passed: fixed 80/20 creator/platform split and minor-unit conservation');
