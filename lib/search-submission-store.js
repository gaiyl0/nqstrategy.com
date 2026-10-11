import crypto from 'node:crypto';
import db from './db.js';
import { encryptPaymentSecret, decryptPaymentSecret } from './payment-secret-vault.mjs';
import { canonicalSite, publicSearchPages, pageFingerprint } from './seo-public-pages.js';
import { SEARCH_ENGINES, submitSearchBatch, validateGoogleCredentials, validGoogleProperty } from './search-providers.mjs';

const CONFIG_KEY = 'searchSubmissionPrivateConfig';
const STATUS_KEY = 'searchSubmissionPrivateStatus';
function read(database, key, fallback = {}) {
  const value = database.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value;
  return value ? JSON.parse(value) : fallback;
}
function write(database, key, value) {
  database.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value));
}
export function searchConfig(database = db, env = process.env, secrets = false) {
  const config = read(database, CONFIG_KEY);
  const site = canonicalSite(env);
  const result = { site, baiduEnabled: !!config.baiduEnabled, bingEnabled: !!config.bingEnabled, googleEnabled: !!config.googleEnabled,
    googleProperty: config.googleProperty || `${site}/`, baiduTokenConfigured: !!config.baiduToken, googleCredentialsConfigured: !!config.googleCredentials,
    bingKey: config.bingKey || '', sogouSitemapSubmitted: !!config.sogouSitemapSubmitted };
  if (secrets) for (const name of ['baiduToken', 'googleCredentials']) result[name] = config[name] ? decryptPaymentSecret(config[name], `search.${name}`, env) : '';
  return result;
}
export function saveSearchConfig(input, database = db, env = process.env, audit) {
  return database.transaction(() => {
    const config = read(database, CONFIG_KEY);
    for (const key of ['baiduEnabled', 'bingEnabled', 'googleEnabled', 'sogouSitemapSubmitted']) if (typeof input[key] === 'boolean') config[key] = input[key];
    const site = canonicalSite(env);
    if (input.googleProperty !== undefined) {
      if (!validGoogleProperty(input.googleProperty, site)) throw new Error('SEARCH_GOOGLE_PROPERTY_INVALID');
      config.googleProperty = input.googleProperty;
    }
    if (input.baiduToken) {
      if (!/^[A-Za-z0-9_-]{8,200}$/.test(input.baiduToken)) throw new Error('SEARCH_BAIDU_TOKEN_INVALID');
      config.baiduToken = encryptPaymentSecret(input.baiduToken, 'search.baiduToken', env);
    }
    if (input.googleCredentials) config.googleCredentials = encryptPaymentSecret(JSON.stringify(validateGoogleCredentials(input.googleCredentials)), 'search.googleCredentials', env);
    if (input.clearBaiduToken) { delete config.baiduToken; config.baiduEnabled = false; }
    if (input.clearGoogleCredentials) { delete config.googleCredentials; config.googleEnabled = false; }
    if (config.baiduEnabled && !config.baiduToken) throw new Error('SEARCH_BAIDU_TOKEN_REQUIRED');
    if (config.googleEnabled && !config.googleCredentials) throw new Error('SEARCH_GOOGLE_CREDENTIALS_REQUIRED');
    if (config.bingEnabled && !config.bingKey) config.bingKey = crypto.randomBytes(24).toString('hex');
    write(database, CONFIG_KEY, config);
    if (audit && !audit()) throw new Error('SEARCH_CONFIG_AUDIT_FAILED');
    return searchConfig(database, env);
  })();
}

export function scanSearchQueue(database = db, env = process.env, force = false) {
  const pages = publicSearchPages(database, env);
  const config = searchConfig(database, env);
  const updated = new Date().toISOString();
  const upsert = database.prepare(`INSERT INTO search_submissions(engine,url,fingerprint,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(engine,url) DO UPDATE SET fingerprint=excluded.fingerprint,state='pending',attempts=0,next_at=0,lease_token=NULL,lease_until=0,last_error=NULL,updated_at=excluded.updated_at
    WHERE search_submissions.fingerprint!=excluded.fingerprint OR ?=1`);
  database.transaction(() => {
    for (const engine of SEARCH_ENGINES) {
      const candidates = engine === 'google' ? [{ url: `${config.site}/sitemap.xml`, fingerprint: pageFingerprint(pages.map(page => [page.url, page.fingerprint])) }] : pages;
      const current = new Set(candidates.map(page => page.url));
      for (const row of database.prepare('SELECT url FROM search_submissions WHERE engine=?').all(engine)) if (!current.has(row.url)) database.prepare('DELETE FROM search_submissions WHERE engine=? AND url=?').run(engine, row.url);
      if (!config[`${engine}Enabled`]) continue;
      for (const page of candidates) upsert.run(engine, page.url, page.fingerprint, updated, force ? 1 : 0);
    }
  })();
  return pages;
}

export function searchDashboard(database = db, env = process.env) {
  return { config: searchConfig(database, env), status: read(database, STATUS_KEY),
    counts: database.prepare('SELECT engine,state,COUNT(*) AS count FROM search_submissions GROUP BY engine,state').all(),
    recent: database.prepare('SELECT engine,url,state,attempts,last_error,submitted_at,updated_at FROM search_submissions ORDER BY updated_at DESC LIMIT 30').all(),
    pages: publicSearchPages(database, env).map(page => page.url) };
}

export async function runSearchSubmissions(database = db, env = process.env, fetcher = fetch) {
  scanSearchQueue(database, env);
  const config = searchConfig(database, env, true);
  const now = Date.now();
  const results = [];
  for (const engine of SEARCH_ENGINES) {
    if (!config[`${engine}Enabled`]) continue;
    const lease = crypto.randomUUID();
    const rows = database.transaction(() => {
      const due = database.prepare("SELECT * FROM search_submissions WHERE engine=? AND state IN ('pending','retry','verifying','sending') AND next_at<=? AND lease_until<=? ORDER BY updated_at LIMIT 100").all(engine, now, now);
      const claim = database.prepare("UPDATE search_submissions SET state='sending',lease_token=?,lease_until=? WHERE engine=? AND url=?");
      for (const row of due) claim.run(lease, now + 120000, engine, row.url);
      return due;
    })();
    if (!rows.length) continue;
    let result, error;
    try { result = await submitSearchBatch(engine, config, rows.map(row => row.url), fetcher); }
    catch (caught) { error = /^SEARCH_[A-Z0-9_]+$/.test(caught.message || '') ? caught.message : 'SEARCH_SUBMISSION_FAILED'; }
    database.transaction(() => {
      const finish = database.prepare('UPDATE search_submissions SET state=?,attempts=?,next_at=?,lease_until=0,lease_token=NULL,last_error=?,submitted_at=?,updated_at=? WHERE engine=? AND url=? AND lease_token=? AND fingerprint=?');
      for (const row of rows) {
        const accepted = result?.accepted.includes(row.url);
        const attempts = row.attempts + 1;
        const reason = error || (!accepted ? 'SEARCH_URL_REJECTED' : result.pendingVerification ? 'SEARCH_KEY_VERIFICATION_PENDING' : null);
        const state = accepted && !result.pendingVerification ? 'accepted' : attempts >= 8 ? 'failed' : result?.pendingVerification ? 'verifying' : 'retry';
        const delay = reason === 'SEARCH_HTTP_429' || (result?.remain === 0) ? 86400000 : Math.min(86400000, 600000 * 2 ** Math.min(attempts - 1, 7));
        finish.run(state, attempts, now + delay, reason, state === 'accepted' ? new Date().toISOString() : row.submitted_at, new Date().toISOString(), engine, row.url, lease, row.fingerprint);
      }
      const status = read(database, STATUS_KEY);
      status[engine] = { checkedAt: new Date().toISOString(), accepted: result?.accepted.length || 0, pendingVerification: !!result?.pendingVerification, remain: result?.remain ?? null, error: error || null };
      write(database, STATUS_KEY, status);
    })();
    results.push({ engine, count: rows.length, error: error || null });
  }
  // Heartbeat is visible even while all provider switches are off.
  database.transaction(() => { const current = read(database, STATUS_KEY); write(database, STATUS_KEY, { ...current, workerCheckedAt: new Date().toISOString() }); })();
  return results;
}
