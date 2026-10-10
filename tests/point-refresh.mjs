import assert from 'node:assert/strict';
import { createPointReader, subscribePointRefresh, affectsPoints } from '../lib/point-refresh.mjs';
import { apiFetch } from '../lib/api-client.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const pending = [], updates = [];
const reader = createPointReader(signal => { const value = deferred(); pending.push({ ...value, signal }); return value.promise; }, update => updates.push(update));
const first = reader.refresh(), second = reader.refresh();
assert.equal(pending[0].signal.aborted, true);
pending[1].resolve({ success: true, balance: 18 }); await second;
pending[0].resolve({ success: true, balance: 99 }); await first;
assert.equal(updates.filter(item => item.data).length, 1);
assert.equal(updates.at(-1).data.balance, 18, 'An older request cannot overwrite a newer balance');
const logout = reader.refresh(); reader.dispose();
pending[2].resolve({ success: true, balance: 500 }); await logout;
assert.equal(updates.filter(item => item.data).length, 1, 'A disposed user reader cannot publish');

const failures = [];
let attempt = 0;
const recovery = createPointReader(async () => { if (++attempt === 1) throw Error('offline'); return { success: true, balance: 7 }; }, update => failures.push(update));
await recovery.refresh(); assert.equal(failures.at(-1).error, true);
await recovery.refresh(); assert.equal(failures.at(-1).data.balance, 7); assert.equal(failures.at(-1).error, false);
recovery.dispose();
const timeoutUpdates = [];
const timeout = createPointReader(() => new Promise(() => {}), update => timeoutUpdates.push(update), 5);
await timeout.refresh(); assert.equal(timeoutUpdates.at(-1).error, true); timeout.dispose();
const malformed = createPointReader(async () => ({ success: true, balance: '200' }), update => timeoutUpdates.push(update));
await malformed.refresh(); assert.equal(timeoutUpdates.at(-1).error, true); malformed.dispose();

const target = new EventTarget(); target.document = new EventTarget(); target.document.visibilityState = 'visible';
let interval, cleared = false, refreshes = 0;
target.setInterval = callback => { interval = callback; return 1; }; target.clearInterval = () => { cleared = true; };
const unsubscribe = subscribePointRefresh(() => { refreshes++; }, target);
target.dispatchEvent(new Event('nq:points-changed')); assert.equal(refreshes, 1);
target.dispatchEvent(new Event('online')); assert.equal(refreshes, 2);
target.document.visibilityState = 'hidden'; interval(); assert.equal(refreshes, 2);
target.document.visibilityState = 'visible';
const storage = new Event('storage'); storage.key = 'nq:points-refresh'; target.dispatchEvent(storage); assert.equal(refreshes, 3);
unsubscribe(); target.dispatchEvent(new Event('nq:points-changed')); assert.equal(refreshes, 3); assert.equal(cleared, true);

for (const path of ['/api/points', '/api/posts', '/api/comments', '/api/social', '/api/points/refunds', '/api/points/withdrawals']) assert.equal(affectsPoints(path, { method: 'POST' }), true);
assert.equal(affectsPoints('/api/points', { method: 'GET' }), false);
assert.equal(affectsPoints('/api/points/recharge?orderId=5', {}, { order: { status: 'paid' } }), true);
assert.equal(affectsPoints('/api/points/recharge?orderId=5', {}, { order: { status: 'pending' } }), false);
assert.equal(affectsPoints('/api/points/recharge', { method: 'POST' }), false, 'Creating an unpaid order does not change the balance');
assert.equal(affectsPoints('/api/products', { method: 'PATCH' }), false);

let events = 0; target.localStorage = { setItem(key, value) { assert.equal(key, 'nq:points-refresh'); assert.equal(value.includes('balance'), false); } };
globalThis.window = target;
target.addEventListener('nq:points-changed', () => events++);
const response = (success, status = 200) => new Response(JSON.stringify({ success }), { status, headers: { 'Content-Type': 'application/json' } });
await apiFetch('/api/points', { method: 'POST' }, async () => response(true)); assert.equal(events, 1);
await assert.rejects(() => apiFetch('/api/points', { method: 'POST' }, async () => response(false, 409))); assert.equal(events, 1, 'Rejected mutations never announce a balance change');
await apiFetch('/api/points', {}, async () => response(true)); assert.equal(events, 1, 'Reading points cannot trigger an invalidation loop');
delete globalThis.window;
console.log('Point refresh tests passed: ordering, account disposal, timeout, recovery, invalidation, cross-tab and event cleanup');
