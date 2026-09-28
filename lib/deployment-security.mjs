import crypto from 'crypto';
import { isIP } from 'node:net';

const ALLOWED_PROXY_MODES = new Set(['cloudflare', 'nginx', 'forwarded']);
const PROXY_SECRET_HEADER = 'x-nexus-proxy-secret';

function envValue(env, key) {
  return String(env[key] || '').trim();
}

export function validateDeploymentSecurity(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const proxyMode = envValue(env, 'TRUSTED_PROXY_MODE').toLowerCase();
  const proxySecret = String(env.TRUSTED_PROXY_SHARED_SECRET || '');
  const rateLimitBackend = envValue(env, 'RATE_LIMIT_BACKEND').toLowerCase();
  const topology = envValue(env, 'DEPLOYMENT_TOPOLOGY').toLowerCase();

  if (!production && !proxyMode) {
    return {
      production: false,
      proxyMode: null,
      proxySecret: null,
      rateLimitBackend: rateLimitBackend || 'sqlite',
      topology: topology || 'single-instance',
    };
  }

  if (!ALLOWED_PROXY_MODES.has(proxyMode)) {
    throw new Error('TRUSTED_PROXY_MODE must be explicitly set to cloudflare, nginx, or forwarded');
  }
  if (proxySecret.length < 32) {
    throw new Error('TRUSTED_PROXY_SHARED_SECRET must contain at least 32 characters');
  }
  if (rateLimitBackend !== 'sqlite') {
    throw new Error('RATE_LIMIT_BACKEND must be sqlite for the current implementation');
  }
  if (topology !== 'single-instance') {
    throw new Error('DEPLOYMENT_TOPOLOGY must be single-instance while RATE_LIMIT_BACKEND=sqlite; multi-instance requires a shared rate-limit store');
  }

  return { production, proxyMode, proxySecret, rateLimitBackend, topology };
}

function secretsMatch(expected, supplied) {
  const expectedDigest = crypto.createHash('sha256').update(String(expected)).digest();
  const suppliedDigest = crypto.createHash('sha256').update(String(supplied || '')).digest();
  return crypto.timingSafeEqual(expectedDigest, suppliedDigest);
}

function singleIpHeader(request, headerName) {
  const raw = String(request.headers.get(headerName) || '').trim();
  if (!raw || raw.includes(',') || raw.length > 64 || isIP(raw) === 0) return null;
  return raw;
}

export function resolveTrustedClientIp(request, env = process.env) {
  let config;
  try {
    config = validateDeploymentSecurity(env);
  } catch {
    return { ip: null, trusted: false, reason: 'deployment_config_invalid' };
  }

  if (!config.proxyMode) return { ip: null, trusted: false, reason: 'proxy_not_configured' };
  if (!secretsMatch(config.proxySecret, request.headers.get(PROXY_SECRET_HEADER))) {
    return { ip: null, trusted: false, reason: 'proxy_auth_failed' };
  }

  const headerName = {
    cloudflare: 'cf-connecting-ip',
    nginx: 'x-real-ip',
    forwarded: 'x-forwarded-for',
  }[config.proxyMode];
  const ip = singleIpHeader(request, headerName);
  if (!ip) return { ip: null, trusted: false, reason: 'client_ip_invalid' };
  return { ip, trusted: true, reason: 'trusted_proxy' };
}

if (process.env.NODE_ENV === 'production') {
  validateDeploymentSecurity(process.env);
}
