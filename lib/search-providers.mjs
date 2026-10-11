import crypto from 'node:crypto';
import { SignJWT, importPKCS8 } from 'jose';

export const SEARCH_ENGINES = ['baidu', 'bing', 'google'];
export function validateGoogleCredentials(raw) {
  const data = JSON.parse(raw);
  if (data.type !== 'service_account' || !/^[\w.+-]+@[\w.-]+\.gserviceaccount\.com$/.test(data.client_email || '')) throw new Error('SEARCH_GOOGLE_CREDENTIALS_INVALID');
  const key = crypto.createPrivateKey(data.private_key);
  if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength < 2048) throw new Error('SEARCH_GOOGLE_KEY_INVALID');
  return { client_email: data.client_email, private_key: key.export({ type: 'pkcs8', format: 'pem' }) };
}
export function validGoogleProperty(property, site) {
  return property === `${site}/` || property === `sc-domain:${new URL(site).hostname}`;
}

async function send(fetcher, url, options) {
  try {
    return await fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
  } catch { throw new Error('SEARCH_NETWORK_FAILED'); }
}
async function json(response) {
  try { return await response.json(); } catch { throw new Error('SEARCH_RESPONSE_INVALID'); }
}

// Fixed official endpoints only; remote response text and credential-bearing URLs are never logged.
export async function submitSearchBatch(engine, config, urls, fetcher = fetch) {
  if (!urls.length || urls.length > 100 || urls.some(url => new URL(url).origin !== config.site || new URL(url).search || new URL(url).hash)) throw new Error('SEARCH_URLS_INVALID');
  if (engine === 'baidu') {
    // Baidu documents this HTTP endpoint; its HTTPS certificate does not cover this host.
    // Never bypass TLS verification or follow a redirect carrying the submission token.
    const endpoint = new URL('http://data.zz.baidu.com/urls');
    endpoint.searchParams.set('site', config.site);
    endpoint.searchParams.set('token', config.baiduToken);
    const response = await send(fetcher, endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: urls.join('\n') });
    if (!response.ok) throw new Error(`SEARCH_HTTP_${response.status}`);
    const data = await json(response);
    if (data.error || !Number.isInteger(data.success) || data.success < 0 || data.success > urls.length) throw new Error('SEARCH_RESPONSE_INVALID');
    const rejected = new Set([...(data.not_same_site || []), ...(data.not_valid || [])]);
    const accepted = urls.filter(url => !rejected.has(url));
    if (data.success !== accepted.length) throw new Error('SEARCH_PARTIAL_RESULT_AMBIGUOUS');
    return { accepted, rejected: urls.filter(url => rejected.has(url)), remain: Number.isInteger(data.remain) ? data.remain : null };
  }
  if (engine === 'bing') {
    const response = await send(fetcher, 'https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host: new URL(config.site).hostname, key: config.bingKey, keyLocation: `${config.site}/indexnow-key.txt`, urlList: urls }) });
    if (response.status !== 200 && response.status !== 202) throw new Error(`SEARCH_HTTP_${response.status}`);
    return { accepted: urls, rejected: [], pendingVerification: response.status === 202 };
  }
  if (engine === 'google') {
    if (!validGoogleProperty(config.googleProperty, config.site) || urls[0] !== `${config.site}/sitemap.xml` || urls.length !== 1) throw new Error('SEARCH_GOOGLE_PROPERTY_INVALID');
    const credentials = JSON.parse(config.googleCredentials);
    const key = await importPKCS8(credentials.private_key, 'RS256');
    const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/webmasters' }).setProtectedHeader({ alg: 'RS256', typ: 'JWT' }).setIssuer(credentials.client_email).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(key);
    const tokenResponse = await send(fetcher, 'https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString() });
    if (!tokenResponse.ok) throw new Error(`SEARCH_GOOGLE_AUTH_${tokenResponse.status}`);
    const token = await json(tokenResponse);
    if (typeof token.access_token !== 'string' || !token.access_token) throw new Error('SEARCH_GOOGLE_AUTH_INVALID');
    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.googleProperty)}/sitemaps/${encodeURIComponent(urls[0])}`;
    const response = await send(fetcher, endpoint, { method: 'PUT', headers: { Authorization: `Bearer ${token.access_token}` } });
    if (!response.ok) throw new Error(`SEARCH_HTTP_${response.status}`);
    return { accepted: urls, rejected: [] };
  }
  throw new Error('SEARCH_ENGINE_UNSUPPORTED');
}
