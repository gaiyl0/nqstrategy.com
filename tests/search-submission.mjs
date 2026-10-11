import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { jwtVerify, importSPKI } from 'jose';
import { submitSearchBatch, validateGoogleCredentials } from '../lib/search-providers.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-search-test-'));
process.env.NEXUS_DB_PATH = path.join(root, 'test.db');
process.env.NEXUS_AUTO_MIGRATE = '1';
const env = { ...process.env, APP_ORIGINS: 'https://nexus.test', NEXT_PUBLIC_SITE_URL: 'https://nexus.test', JWT_SECRET: 'search-test-only-secret-0123456789abcdef' };
const { default: db } = await import('../lib/db.js');
const { searchConfig, saveSearchConfig, scanSearchQueue, runSearchSubmissions, searchDashboard } = await import('../lib/search-submission-store.js');
const { publicSearchPages } = await import('../lib/seo-public-pages.js');
const { readBrandWorkspace, updateBrandWorkspace } = await import('../lib/site-brand-store.js');
const response = (status, data = {}) => new Response(JSON.stringify(data), { status });
try {
  const config = { site: 'https://nexus.test', baiduToken: 'test-token-only', bingKey: 'a'.repeat(48) };
  const urls = ['https://nexus.test/forum/1', 'https://nexus.test/forum/2'];
  const result = await submitSearchBatch('baidu', config, urls, async (url, options) => {
    assert.equal(new URL(url).origin, 'http://data.zz.baidu.com');
    assert.equal(new URL(url).searchParams.get('site'), config.site);
    assert.equal(options.redirect, 'error'); assert.equal(options.body, urls.join('\n'));
    return response(200, { success: 1, remain: 9, not_valid: [urls[1]] });
  });
  assert.deepEqual(result.accepted, [urls[0]]); assert.deepEqual(result.rejected, [urls[1]]);
  await assert.rejects(submitSearchBatch('baidu', config, urls, async () => response(200, { success: 1 })), /AMBIGUOUS/);
  await assert.rejects(submitSearchBatch('baidu', config, urls, async () => { throw new Error('request leaked token test-token-only'); }), /^Error: SEARCH_NETWORK_FAILED$/);
  await assert.rejects(submitSearchBatch('bing', config, ['https://attacker.test/private']), /URLS_INVALID/);
  const pending = await submitSearchBatch('bing', config, urls, async (url, options) => {
    assert.equal(url, 'https://api.indexnow.org/indexnow');
    const body = JSON.parse(options.body);
    assert.equal(body.keyLocation, `${config.site}/indexnow-key.txt`); assert.deepEqual(body.urlList, urls);
    return response(202);
  });
  assert.equal(pending.pendingVerification, true);
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const raw = JSON.stringify({ type: 'service_account', client_email: 'search@test-project.iam.gserviceaccount.com', private_key: rsa.privateKey, token_uri: 'https://attacker.test' });
  const credentials = validateGoogleCredentials(raw);
  assert.equal(credentials.token_uri, undefined);
  assert.throws(() => validateGoogleCredentials(JSON.stringify({ type: 'service_account', client_email: 'evil@example.com', private_key: rsa.privateKey })), /INVALID/);
  let googleCalls = 0;
  await submitSearchBatch('google', { ...config, googleProperty: `${config.site}/`, googleCredentials: JSON.stringify(credentials) }, [`${config.site}/sitemap.xml`], async (url, options) => {
    googleCalls++;
    if (googleCalls === 1) {
      assert.equal(url, 'https://oauth2.googleapis.com/token');
      const assertion = new URLSearchParams(options.body).get('assertion');
      const { payload } = await jwtVerify(assertion, await importSPKI(rsa.publicKey, 'RS256'), { issuer: credentials.client_email, audience: url });
      assert.equal(payload.scope, 'https://www.googleapis.com/auth/webmasters');
      return response(200, { access_token: 'test-access-token' });
    }
    assert.ok(url.startsWith('https://www.googleapis.com/webmasters/v3/sites/'));
    assert.equal(options.method, 'PUT'); assert.equal(options.headers.Authorization, 'Bearer test-access-token');
    return new Response(null, { status: 204 });
  });
  assert.equal(googleCalls, 2);
  await assert.rejects(submitSearchBatch('google', { ...config, googleProperty: 'https://attacker.test/' }, [`${config.site}/sitemap.xml`]), /PROPERTY_INVALID/);

  assert.throws(() => saveSearchConfig({ baiduEnabled: true }, db, env), /TOKEN_REQUIRED/);
  assert.throws(() => saveSearchConfig({ bingEnabled: true }, db, env, () => false), /AUDIT_FAILED/);
  assert.equal(searchConfig(db, env).bingEnabled, false, 'configuration rolls back when audit fails');
  saveSearchConfig({ baiduToken: config.baiduToken, baiduEnabled: true, bingEnabled: true, googleCredentials: raw, googleEnabled: true }, db, env);
  const stored = db.prepare("SELECT value FROM settings WHERE key='searchSubmissionPrivateConfig'").get().value;
  assert.ok(!stored.includes(config.baiduToken)); assert.ok(!stored.includes('PRIVATE KEY'));
  assert.equal(searchConfig(db, env).baiduToken, undefined); assert.equal(searchConfig(db, env).googleCredentials, undefined);
  assert.equal(searchConfig(db, env, true).baiduToken, config.baiduToken);
  assert.match(searchConfig(db, env).bingKey, /^[a-f0-9]{48}$/);
  db.prepare("INSERT INTO products(title,author,slug,points_price,status,moderation_status) VALUES('Public EA','Test','tianwei-test-ea',200,'active','visible')").run();
  const before = publicSearchPages(db, env);
  assert.ok(before.some(page => page.url.endsWith('/market/tianwei-test-ea')), 'a public strategy slug is not an administrator path');
  assert.ok(before.every(page => !/^\/(?:profile|tianwei|api)(?:\/|$)/.test(new URL(page.url).pathname) && !new URL(page.url).search));
  scanSearchQueue(db, env);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM search_submissions').get().n, before.length * 2 + 1);
  const successMock = async (url, options) => {
    if (String(url).startsWith('http://data.zz.baidu.com')) return response(200, { success: options.body.split('\n').length, remain: 100 });
    if (url === 'https://oauth2.googleapis.com/token') return response(200, { access_token: 'token' });
    return response(200);
  };
  await runSearchSubmissions(db, env, successMock);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM search_submissions WHERE state!='accepted'").get().n, 0);
  assert.ok(searchDashboard(db, env).status.workerCheckedAt);
  assert.equal((await runSearchSubmissions(db, env, () => { throw new Error('unchanged content should not submit'); })).length, 0);
  // Content edits queue again, visitor counters do not.
  const postId = db.prepare("INSERT INTO posts(title,content,author,category,moderation_status) VALUES('Search test','Original','Test','MQL5','visible')").run().lastInsertRowid;
  scanSearchQueue(db, env); await runSearchSubmissions(db, env, successMock);
  db.prepare('UPDATE posts SET views=views+1 WHERE id=?').run(postId);
  assert.equal((await runSearchSubmissions(db, env, successMock)).length, 0);
  db.prepare("UPDATE posts SET content='Edited' WHERE id=?").run(postId);
  const failed = await runSearchSubmissions(db, env, async () => response(429));
  assert.equal(failed.length, 3);
  const retry = db.prepare("SELECT * FROM search_submissions WHERE engine='baidu' AND url=?").get(`${config.site}/forum/${postId}`);
  assert.equal(retry.state, 'retry'); assert.equal(retry.last_error, 'SEARCH_HTTP_429'); assert.ok(retry.next_at > Date.now() + 80000000);
  assert.equal((await runSearchSubmissions(db, env, successMock)).length, 0, 'backoff prevents immediate repeat');
  // Active leases prevent simultaneous workers from posting the same batch.
  scanSearchQueue(db, env, true);
  db.prepare("UPDATE search_submissions SET state='sending',lease_until=?,lease_token='other-worker'").run(Date.now() + 60000);
  assert.equal((await runSearchSubmissions(db, env, successMock)).length, 0);
  db.prepare("UPDATE posts SET moderation_status='hidden' WHERE id=?").run(postId);
  scanSearchQueue(db, env);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM search_submissions WHERE url=?').get(`${config.site}/forum/${postId}`).n, 0);
  const workspace = readBrandWorkspace(db);
  updateBrandWorkspace({ action: 'draft', revision: workspace.revision, config: { ...workspace.published, forumMode: 'disabled', catalogEnabled: false } }, null, db);
  updateBrandWorkspace({ action: 'publish', revision: workspace.revision + 1 }, null, db);
  assert.ok(publicSearchPages(db, env).every(page => !/\/forum(?:\/|$)|\/market(?:\/|$)/.test(page.url)));
  saveSearchConfig({ clearBaiduToken: true, clearGoogleCredentials: true }, db, env);
  assert.equal(searchConfig(db, env).baiduEnabled, false); assert.equal(searchConfig(db, env).googleEnabled, false);
  console.log('Search submission tests passed: official adapters, encrypted configuration, public selection, deduplication, retry and worker leases');
} finally { db.close(); }
