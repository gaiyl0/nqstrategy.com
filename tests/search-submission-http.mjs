import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-search-http-'));
const port = 3228, origin = 'https://nexus.test';
const jwtSecret = 'search-http-jwt-test-only-0123456789abcdef', proxySecret = 'search-http-proxy-test-only-0123456789abcdef';
const env = { ...process.env, NODE_ENV: 'production', NEXUS_DB_PATH: path.join(root, 'test.db'), NEXUS_AUTO_MIGRATE: '1', JWT_SECRET: jwtSecret,
  AUDIT_INTEGRITY_SECRET: 'search-http-audit-test-only-0123456789abcdef', LEDGER_INTEGRITY_SECRET: 'search-http-ledger-test-only-0123456789abcdef',
  LICENSE_SIGNING_SECRET: 'search-http-signing-test-only-0123456789abcdef', LICENSE_BINDING_SECRET: 'search-http-binding-test-only-0123456789abcdef',
  TRUSTED_PROXY_MODE: 'nginx', TRUSTED_PROXY_SHARED_SECRET: proxySecret, RATE_LIMIT_BACKEND: 'sqlite', DEPLOYMENT_TOPOLOGY: 'single-instance', AUDIT_RETENTION_DAYS: '180', APP_ORIGINS: origin, NEXT_PUBLIC_SITE_URL: origin };
function cookie(id) {
  const data = Buffer.from(JSON.stringify({ id, sv: 1, exp: Date.now() + 300000 })).toString('base64url');
  return `nexus_token=${data}.${crypto.createHmac('sha256', jwtSecret).update(data).digest('base64url')}`;
}
async function request(url, { id, body, headers = {} } = {}) {
  return fetch(`http://127.0.0.1:${port}${url}`, { method: body ? 'POST' : 'GET', headers: { Origin: origin, 'X-Nexus-Proxy-Secret': proxySecret, 'X-Real-IP': '198.51.100.28', ...(id ? { Cookie: cookie(id) } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
let server, output = '';
try {
  const seed = spawnSync(process.execPath, ['--input-type=module', '-e', "import db from './lib/db.js'; db.prepare(\"INSERT INTO users(username,email,password,role) VALUES('search-admin','search-admin@example.invalid','hash','admin'),('search-user','search-user@example.invalid','hash','user')\").run(); db.close();"], { env, encoding: 'utf8', windowsHide: true });
  assert.equal(seed.status, 0, seed.stderr);
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', data => output += data); server.stderr.on('data', data => output += data);
  let ready = false;
  for (let count = 0; count < 80; count++) { await new Promise(resolve => setTimeout(resolve, 500)); try { if ((await request('/api/settings')).ok) { ready = true; break; } } catch {} }
  assert.ok(ready, output);
  assert.equal((await request('/api/search-submission')).status, 403);
  assert.equal((await request('/api/search-submission', { id: 2 })).status, 403);
  assert.equal((await request('/api/search-submission', { id: 2, body: { action: 'save', bingEnabled: true } })).status, 403);
  assert.equal((await request('/indexnow-key.txt')).status, 404);
  assert.equal((await request('/api/search-submission', { id: 1, body: { action: 'save', arbitraryEndpoint: 'https://attacker.test' } })).status, 400);
  assert.equal((await request('/api/search-submission', { id: 1, headers: { Origin: 'https://attacker.test' }, body: { action: 'scan' } })).status, 403);
  const token = 'search-http-test-token-only';
  const saved = await request('/api/search-submission', { id: 1, body: { action: 'save', bingEnabled: true, baiduEnabled: false, baiduToken: token } });
  assert.equal(saved.status, 200); assert.equal(saved.headers.get('cache-control'), 'no-store');
  const text = await saved.text(); assert.ok(!text.includes(token));
  const data = JSON.parse(text); assert.equal(data.config.baiduTokenConfigured, true); assert.equal(data.config.baiduToken, undefined);
  assert.ok(data.counts.some(row => row.engine === 'bing' && row.state === 'pending'));
  const key = await request('/indexnow-key.txt'); assert.equal(key.status, 200); assert.equal(await key.text(), data.config.bingKey);
  for (const id of [undefined, 1, 2]) {
    const settings = await (await request('/api/settings', { id })).text();
    assert.ok(!settings.includes(token)); assert.ok(!settings.includes('searchSubmissionPrivate')); assert.ok(!settings.includes('googleCredentials'));
  }
  const sitemap = await request('/sitemap.xml'); assert.equal(sitemap.status, 200);
  assert.ok(!(await sitemap.text()).includes('/tianwei'));
  const scan = await request('/api/search-submission', { id: 1, body: { action: 'scan' } }); assert.equal(scan.status, 200);
  const clear = await request('/api/search-submission', { id: 1, body: { action: 'save', clearBaiduToken: true, bingEnabled: false } });
  assert.equal(clear.status, 200); assert.equal((await clear.json()).config.baiduTokenConfigured, false);
  console.log('Search submission HTTP passed: administrator authorization, CSRF, private secrets, public key, queue and sitemap. No external submissions performed.');
} finally {
  if (server && server.exitCode === null) { server.kill(); await Promise.race([new Promise(resolve => server.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 2000))]); }
  // Explicit test workspace; retain artifacts if Windows still has open handles.
  assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
  try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch {}
}
