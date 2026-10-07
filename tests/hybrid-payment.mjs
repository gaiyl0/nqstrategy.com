import assert from 'node:assert/strict';
import {quoteHybridPayment} from '../lib/hybrid-payment.mjs';

assert.deepEqual(quoteHybridPayment(99.5,120,30),{maxPoints:99,pointsUsed:30,cashDueCents:6950});
assert.deepEqual(quoteHybridPayment(99.5,120,120),{maxPoints:99,pointsUsed:99,cashDueCents:50});
assert.deepEqual(quoteHybridPayment(99.5,20,20),{maxPoints:20,pointsUsed:20,cashDueCents:7950});
assert.throws(()=>quoteHybridPayment(99.5,20,-1),/INVALID_PAYMENT_QUOTE/);
console.log('Hybrid payment quote tests passed');
