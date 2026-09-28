import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

const baseUrl = process.env.TEST_BASE_URL;
const dbPath = process.env.NEXUS_DB_PATH;
assert.ok(baseUrl && dbPath);
const routes = [
  ['POST', '/api/send-code', 'json'], ['POST', '/api/withdraw', 'json'], ['PATCH', '/api/withdraw', 'json'],
  ['POST', '/api/auth/register', 'json'], ['POST', '/api/posts', 'json'], ['PATCH', '/api/posts', 'json'],
  ['DELETE', '/api/posts?id=1', 'none'], ['POST', '/api/orders', 'json'], ['PATCH', '/api/orders', 'json'],
  ['POST', '/api/comments', 'json'], ['PATCH', '/api/comments', 'json'], ['DELETE', '/api/comments?id=1', 'none'],
  ['POST', '/api/upload', 'multipart'], ['PATCH', '/api/users', 'json'], ['DELETE', '/api/users', 'none'],
  ['POST', '/api/settings', 'json'], ['POST', '/api/auth/register/password', 'json'],
  ['POST', '/api/auth/me', 'none'], ['POST', '/api/products', 'json'], ['PATCH', '/api/products', 'json'],
  ['DELETE', '/api/products?id=1', 'none'], ['POST', '/api/auth/login', 'json'],
];

async function call(method, pathname, origin, kind, extraHeaders = {}) {
  const headers = { origin, ...extraHeaders };
  let body;
  if (kind === 'json') { headers['content-type'] = 'application/json'; body = '{}'; }
  if (kind === 'multipart') { const form = new FormData(); form.set('file', new File(['x'], 'x.txt')); body = form; }
  return fetch(`${baseUrl}${pathname}`, { method, headers, body });
}

for (const [method, pathname, kind] of routes) {
  const response = await call(method, pathname, 'https://evil.test', kind);
  assert.equal(response.status, 403, `${method} ${pathname}`);
  assert.equal((await response.json()).code, 'CSRF_ORIGIN_REJECTED');
  assert.equal(response.headers.get('x-audit-status'), 'ok');
}

for (const origin of [null, 'null', 'https://nexus.test/path', 'not-a-url']) {
  const headers = { 'content-type': 'application/json' };
  if (origin !== null) headers.origin = origin;
  const response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers, body: '{}' });
  assert.equal(response.status, 403);
}

const refererAllowed = await fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST', headers: { referer: 'https://nexus.test/login', 'content-type': 'application/json' }, body: '{}',
});
assert.notEqual(refererAllowed.status, 403);
const wrongContent = await fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST', headers: { origin: 'https://nexus.test', 'content-type': 'text/plain' }, body: '{}',
});
assert.equal(wrongContent.status, 415);
assert.equal((await wrongContent.json()).code, 'CONTENT_TYPE_REJECTED');
const validOrigin = await fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST', headers: { origin: 'https://nexus.test', 'content-type': 'application/json' }, body: '{}',
});
assert.notEqual(validOrigin.status, 403);
assert.notEqual(validOrigin.status, 415);
assert.equal(validOrigin.headers.get('access-control-allow-origin'), 'https://nexus.test');
assert.equal(validOrigin.headers.get('access-control-allow-credentials'), 'true');
const automation = await fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST', headers: { authorization: 'Bearer csrf-automation-secret-0123456789abcdef', 'content-type': 'application/json' }, body: '{}',
});
assert.notEqual(automation.status, 403);
const preflight = await fetch(`${baseUrl}/api/users`, {
  method: 'OPTIONS', headers: { origin: 'https://nexus.test', 'access-control-request-method': 'PATCH', 'access-control-request-headers': 'content-type' },
});
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://nexus.test');
const evilPreflight = await fetch(`${baseUrl}/api/users`, {
  method: 'OPTIONS', headers: { origin: 'https://evil.test', 'access-control-request-method': 'PATCH' },
});
assert.equal(evilPreflight.status, 403);

const db = new Database(dbPath, { readonly: true });
const blocked = db.prepare("SELECT COUNT(*) n FROM audit_logs WHERE event_type='security.csrf' AND outcome='blocked'").get().n;
assert.equal(blocked, routes.length + 6);
assert.equal(db.prepare('SELECT COUNT(*) n FROM rate_limit_buckets').get().n, 1);
assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n, 0);
assert.equal(db.prepare('SELECT COUNT(*) n FROM products').get().n, 0);
assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n, 0);
assert.equal(db.prepare('SELECT COUNT(*) n FROM withdrawals').get().n, 0);
console.log(JSON.stringify({ passed: true, protectedMethods: routes.length, blockedAuditRows: blocked, assertions: routes.length * 3 + 21 }));
db.close();
