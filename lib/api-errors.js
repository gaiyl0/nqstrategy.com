import crypto from 'node:crypto';
import { NextResponse } from 'next/server.js';
import { createSecurityContext, writeAudit } from './security.js';

const GENERIC_MESSAGE = '服务暂时异常，请稍后重试';

function fallbackContext(request) {
  return {
    requestId: crypto.randomUUID(),
    sourceHash: crypto.createHash('sha256').update('security-context-unavailable').digest('hex'),
    sourceResolved: false,
    sourceTrusted: false,
    sourceReason: 'security_context_unavailable',
    userId: null,
    actorRole: null,
    userAgent: String(request?.headers?.get?.('user-agent') || '').slice(0, 300),
  };
}

function securityContext(request) {
  try { return createSecurityContext(request); }
  catch { return fallbackContext(request); }
}

function redactDiagnostic(value) {
  return String(value || 'Unknown error')
    .replace(/\b(?:bearer\s+)?[a-z0-9_-]*(?:token|secret|password|pass|code)[a-z0-9_-]*\s*[:=]\s*[^\s,;]+/gi, '[REDACTED]')
    .replace(/[A-Za-z]:\\[^\r\n]*/g, '[WINDOWS_PATH]')
    .replace(/(?:^|\s)\/(?:[^\s/]+\/)+[^\s]*/g, ' [ABSOLUTE_PATH]')
    .replace(/'[^'\r\n]*'/g, "'[VALUE]'")
    .replace(/"[^"\r\n]*"/g, '"[VALUE]"')
    .slice(0, 500);
}

function errorMetadata(error, request) {
  const stack = String(error?.stack || '');
  return {
    method: String(request?.method || 'UNKNOWN').slice(0, 16),
    errorName: String(error?.name || 'Error').slice(0, 80),
    exceptionKind: String(error?.code || 'UNSPECIFIED').slice(0, 100),
    diagnostic: redactDiagnostic(error?.message || error),
    stackDigest: crypto.createHash('sha256').update(stack).digest('hex'),
  };
}

export function withApiErrors(handler, { route = 'unknown' } = {}) {
  return async function apiErrorBoundary(request, routeContext) {
    const context = securityContext(request);
    try {
      const response = await handler(request, routeContext);
      if (!(response instanceof Response)) throw new TypeError('Route handler did not return a Response');
      if (!response.headers.has('X-Request-ID')) response.headers.set('X-Request-ID', context.requestId);
      return response;
    } catch (error) {
      const written = writeAudit(context, {
        eventType: 'api.internal_error',
        outcome: 'failure',
        reasonCode: 'UNHANDLED_EXCEPTION',
        targetType: 'api_route',
        targetId: route,
        metadata: errorMetadata(error, request),
      });
      console.error(`[${context.requestId}] ${request?.method || 'UNKNOWN'} ${route} failed`);
      return NextResponse.json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: GENERIC_MESSAGE,
        requestId: context.requestId,
      }, {
        status: 500,
        headers: {
          'X-Request-ID': context.requestId,
          'X-Audit-Status': written ? 'ok' : 'degraded',
          'Cache-Control': 'no-store',
        },
      });
    }
  };
}

export { GENERIC_MESSAGE };
