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
assert.equal(verifyCsrfRequest(request('POST', '/api/post-attachments', { origin: 'https://nexus.test', 'content-type': 'multipart/form-data; boundary=x' }), production).allowed, true);
assert.equal(verifyCsrfRequest(request('DELETE', '/api/products?id=1', { origin: 'https://nexus.test' }), production).allowed, true);
assert.equal(verifyCsrfRequest(request('POST', '/api/auth/me', { origin: 'https://nexus.test' }), production).allowed, true);
assert.equal(verifyCsrfRequest(request('PATCH', '/api/users', { authorization: `Bearer ${production.CSRF_AUTOMATION_SECRET}`, 'content-type': 'application/json' }), production).reason, 'AUTOMATION_TOKEN');
assert.equal(verifyCsrfRequest(request('PATCH', '/api/users', { authorization: 'Bearer wrong', 'content-type': 'application/json' }), production).reason, 'ORIGIN_MISSING');
assert.equal(verifyCsrfRequest(request('POST', '/api/payments/webhooks/wechat-pay', {'content-type':'application/json'}),production).reason,'SIGNED_PAYMENT_WEBHOOK');
assert.equal(verifyCsrfRequest(request('POST', '/api/payments/webhooks/alipay', {'content-type':'application/x-www-form-urlencoded'}),production).reason,'SIGNED_PAYMENT_WEBHOOK');
assert.equal(verifyCsrfRequest(request('POST', '/api/payments/webhooks/alipay', {'content-type':'application/json'}),production).status,415);
assert.equal(allowedCorsOrigin(request('OPTIONS', '/api/users', { origin: 'https://admin.nexus.test' }), production), 'https://admin.nexus.test');
assert.equal(allowedCorsOrigin(request('OPTIONS', '/api/users', { origin: 'https://evil.test' }), production), null);

const development = { NODE_ENV: 'development', APP_ORIGINS: 'https://nexus.test' };
const localRequest = origin => new Request('http://localhost:3000/api/auth/login', {
  method: 'POST', headers: { origin, 'content-type': 'application/json' },
});
for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000']) {
  assert.equal(verifyCsrfRequest(localRequest(origin), development).allowed, true);
  assert.equal(allowedCorsOrigin(localRequest(origin), development), origin);
}
for (const origin of ['http://127.0.0.1:3001', 'https://127.0.0.1:3000', 'http://127.0.0.1.evil.test:3000', 'http://evil.test:3000']) {
  assert.equal(verifyCsrfRequest(localRequest(origin), development).reason, 'ORIGIN_NOT_ALLOWED');
  assert.equal(allowedCorsOrigin(localRequest(origin), development), null);
}
assert.equal(verifyCsrfRequest(localRequest('http://127.0.0.1:3000'), production).allowed, false, 'production never inherits development loopback aliases');
assert.equal(verifyCsrfRequest(request('POST','/api/auth/login',{origin:'http://127.0.0.1:3000','content-type':'application/json'}),development).allowed,false,'non-loopback servers never acquire local aliases');
assert.equal(verifyCsrfRequest(localRequest('null'), development).reason, 'ORIGIN_INVALID');
assert.equal(verifyCsrfRequest(new Request('http://localhost:3000/api/auth/login',{method:'POST',headers:{'content-type':'application/json'}}),development).reason,'ORIGIN_MISSING');
console.log(JSON.stringify({ passed: true, assertions: 47 }));
