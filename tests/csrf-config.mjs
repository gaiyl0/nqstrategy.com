import assert from 'node:assert/strict';
import { allowedCorsOrigin, validateCsrfConfig, verifyCsrfRequest } from '../lib/csrf-config.mjs';

const production = {
  NODE_ENV: 'production', APP_ORIGINS: 'https://nexus.test,https://admin.nexus.test',
  CSRF_AUTOMATION_SECRET: 'automation-secret-0123456789abcdef',
};
function request(method, pathname, headers = {}) {
  return new Request(`https://internal.invalid${pathname}`, { method, headers });
}

assert.throws(() => validateCsrfConfig({ NODE_ENV: 'production' }), /APP_ORIGINS/);
assert.throws(() => validateCsrfConfig({ NODE_ENV: 'production', APP_ORIGINS: 'http://nexus.test' }), /HTTPS/);
assert.throws(() => validateCsrfConfig({ NODE_ENV: 'production', APP_ORIGINS: 'https://nexus.test/' }), /exact/);
assert.equal(verifyCsrfRequest(request('GET', '/api/settings'), production).allowed, true);
assert.equal(verifyCsrfRequest(request('POST', '/api/auth/login', { origin: 'https://nexus.test', 'content-type': 'application/json' }), production).allowed, true);
assert.equal(verifyCsrfRequest(request('POST', '/api/auth/login', { referer: 'https://nexus.test/login', 'content-type': 'application/json' }), production).allowed, true);
assert.equal(verifyCsrfRequest(request('POST', '/api/auth/login', { origin: 'https://evil.test', 'content-type': 'application/json' }), production).reason, 'ORIGIN_NOT_ALLOWED');
assert.equal(verifyCsrfRequest(request('POST', '/api/auth/login', { origin: 'null', 'content-type': 'application/json' }), production).reason, 'ORIGIN_INVALID');
assert.equal(verifyCsrfRequest(request('POST', '/api/auth/login', { origin: 'https://nexus.test/path', 'content-type': 'application/json' }), production).reason, 'ORIGIN_INVALID');
assert.equal(verifyCsrfRequest(request('POST', '/api/auth/login', { 'content-type': 'application/json' }), production).reason, 'ORIGIN_MISSING');
assert.equal(verifyCsrfRequest(request('POST', '/api/auth/login', { origin: 'https://nexus.test', 'content-type': 'text/plain' }), production).status, 415);
assert.equal(verifyCsrfRequest(request('POST', '/api/upload', { origin: 'https://nexus.test', 'content-type': 'multipart/form-data; boundary=x' }), production).allowed, true);
assert.equal(verifyCsrfRequest(request('POST', '/api/upload', { origin: 'https://nexus.test', 'content-type': 'application/json' }), production).status, 415);
assert.equal(verifyCsrfRequest(request('POST', '/api/evidence', { origin: 'https://nexus.test', 'content-type': 'multipart/form-data; boundary=x' }), production).allowed, true);
assert.equal(verifyCsrfRequest(request('POST', '/api/evidence', { origin: 'https://nexus.test', 'content-type': 'application/json' }), production).status, 415);
assert.equal(verifyCsrfRequest(request('PATCH', '/api/evidence', { origin: 'https://nexus.test', 'content-type': 'application/json' }), production).allowed, true);
assert.equal(verifyCsrfRequest(request('PATCH', '/api/evidence', { origin: 'https://nexus.test', 'content-type': 'multipart/form-data; boundary=x' }), production).status, 415);
assert.equal(verifyCsrfRequest(request('POST', '/api/strategy-report', { origin: 'https://nexus.test', 'content-type': 'multipart/form-data; boundary=x' }), production).allowed, true);
assert.equal(verifyCsrfRequest(request('POST', '/api/strategy-report', { origin: 'https://nexus.test', 'content-type': 'application/json' }), production).status, 415);
assert.equal(verifyCsrfRequest(request('DELETE', '/api/products?id=1', { origin: 'https://nexus.test' }), production).allowed, true);
assert.equal(verifyCsrfRequest(request('POST', '/api/auth/me', { origin: 'https://nexus.test' }), production).allowed, true);
assert.equal(verifyCsrfRequest(request('PATCH', '/api/users', { authorization: `Bearer ${production.CSRF_AUTOMATION_SECRET}`, 'content-type': 'application/json' }), production).reason, 'AUTOMATION_TOKEN');
assert.equal(verifyCsrfRequest(request('PATCH', '/api/users', { authorization: 'Bearer wrong', 'content-type': 'application/json' }), production).reason, 'ORIGIN_MISSING');
assert.equal(allowedCorsOrigin(request('OPTIONS', '/api/users', { origin: 'https://admin.nexus.test' }), production), 'https://admin.nexus.test');
assert.equal(allowedCorsOrigin(request('OPTIONS', '/api/users', { origin: 'https://evil.test' }), production), null);

console.log(JSON.stringify({ passed: true, assertions: 25 }));
