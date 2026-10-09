import crypto from 'node:crypto';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const JSON_BODY_EXCEPTIONS = new Set(['/api/auth/me']);
const MULTIPART_PATHS = new Set(['/api/upload', '/api/evidence', '/api/strategy-report', '/api/post-attachments']);
const TOKEN_AUTH_PATHS = new Set(['/api/licenses/verify']);
const SIGNED_WEBHOOK_CONTENT_TYPES = new Map([
  ['/api/payments/webhooks/wechat-pay','application/json'],
  ['/api/payments/webhooks/alipay','application/x-www-form-urlencoded'],
]);

function parseOrigin(value, label) {
  const text = String(value || '').trim();
  if (!text || text === 'null') throw new Error(`${label} contains an invalid origin`);
  let url;
  try { url = new URL(text); } catch { throw new Error(`${label} contains an invalid origin`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || url.pathname !== '/' || url.search || url.hash || url.origin !== text) {
    throw new Error(`${label} entries must be exact HTTP(S) origins without path, query, credentials, or trailing slash`);
  }
  return url.origin;
}

export function validateCsrfConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const rawOrigins = String(env.APP_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean);
  if (production && rawOrigins.length === 0) throw new Error('APP_ORIGINS must contain at least one exact origin in production');
  const origins = [...new Set(rawOrigins.map((origin) => parseOrigin(origin, 'APP_ORIGINS')))];
  if (production && origins.some((origin) => !origin.startsWith('https://'))) {
    throw new Error('APP_ORIGINS must use HTTPS in production');
  }
  const automationSecret = String(env.CSRF_AUTOMATION_SECRET || '');
  if (automationSecret && automationSecret.length < 32) throw new Error('CSRF_AUTOMATION_SECRET must contain at least 32 characters');
  return { production, origins, automationSecret: automationSecret || null };
}

function secureTokenMatch(expected, supplied) {
  const left = crypto.createHash('sha256').update(String(expected)).digest();
  const right = crypto.createHash('sha256').update(String(supplied || '')).digest();
  return crypto.timingSafeEqual(left, right);
}

function requestOrigin(value, exact = false) {
  const text = String(value || '').trim();
  if (!text || text === 'null') return null;
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if (exact && (text !== url.origin || url.pathname !== '/' || url.search || url.hash)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function originsForRequest(request, config, env) {
  const url = new URL(request.url);
  const origins = config.origins.length > 0 ? [...config.origins] : [url.origin];
  // Next dev may normalize a loopback request URL to localhost even when the
  // browser used 127.0.0.1. Accept only loopback aliases on the same protocol
  // and port in development; production retains the exact configured list.
  const loopbackHosts = ['localhost', '127.0.0.1', '[::1]'];
  if (env.NODE_ENV === 'development' && loopbackHosts.includes(url.hostname)) {
    for (const hostname of loopbackHosts) {
      origins.push(`${url.protocol}//${hostname}${url.port ? `:${url.port}` : ''}`);
    }
  }
  return origins;
}

export function verifyCsrfRequest(request, env = process.env) {
  const method = String(request.method || 'GET').toUpperCase();
  if (!UNSAFE_METHODS.has(method)) return { allowed: true, reason: 'SAFE_METHOD' };
  const config = validateCsrfConfig(env);
  const pathname = new URL(request.url).pathname;
  if(SIGNED_WEBHOOK_CONTENT_TYPES.has(pathname)){
    const contentType=String(request.headers.get('content-type')||'').toLowerCase();
    return contentType.startsWith(SIGNED_WEBHOOK_CONTENT_TYPES.get(pathname))
      ?{allowed:true,reason:'SIGNED_PAYMENT_WEBHOOK'}
      :{allowed:false,status:415,reason:'CONTENT_TYPE_NOT_ALLOWED'};
  }
  if(TOKEN_AUTH_PATHS.has(pathname)){
    const contentType=String(request.headers.get('content-type')||'').toLowerCase();
    return contentType.startsWith('application/json')?{allowed:true,reason:'SIGNED_TOKEN_ENDPOINT'}:{allowed:false,status:415,reason:'CONTENT_TYPE_NOT_ALLOWED'};
  }

  const authorization = String(request.headers.get('authorization') || '');
  if (config.automationSecret && authorization.startsWith('Bearer ')
    && secureTokenMatch(config.automationSecret, authorization.slice(7))) {
    return { allowed: true, reason: 'AUTOMATION_TOKEN' };
  }

  const allowedOrigins = originsForRequest(request, config, env);
  const originHeader = request.headers.get('origin');
  let suppliedOrigin;
  let source;
  if (originHeader !== null) {
    suppliedOrigin = requestOrigin(originHeader, true);
    source = 'origin';
    if (!suppliedOrigin) return { allowed: false, status: 403, reason: 'ORIGIN_INVALID' };
  } else {
    suppliedOrigin = requestOrigin(request.headers.get('referer'));
    source = 'referer';
    if (!suppliedOrigin) return { allowed: false, status: 403, reason: 'ORIGIN_MISSING' };
  }
  if (!allowedOrigins.includes(suppliedOrigin)) {
    return { allowed: false, status: 403, reason: 'ORIGIN_NOT_ALLOWED', suppliedOrigin, source };
  }

  if (method !== 'DELETE' && !JSON_BODY_EXCEPTIONS.has(pathname)) {
    const contentType = String(request.headers.get('content-type') || '').toLowerCase();
    const expected = method === 'POST' && MULTIPART_PATHS.has(pathname) ? 'multipart/form-data' : 'application/json';
    if (!contentType.startsWith(expected)) {
      return { allowed: false, status: 415, reason: 'CONTENT_TYPE_NOT_ALLOWED', suppliedOrigin, source };
    }
  }
  return { allowed: true, reason: 'ORIGIN_ALLOWED', suppliedOrigin, source };
}

export function allowedCorsOrigin(request, env = process.env) {
  const origin = requestOrigin(request.headers.get('origin'), true);
  if (!origin) return null;
  const config = validateCsrfConfig(env);
  const allowed = originsForRequest(request, config, env);
  return allowed.includes(origin) ? origin : null;
}

if (process.env.NODE_ENV === 'production') validateCsrfConfig(process.env);
