import { NextResponse } from 'next/server';
import { allowedCorsOrigin, verifyCsrfRequest } from './lib/csrf-config.mjs';
import { createSecurityContext, writeAudit } from './lib/security';

export function proxy(request) {
  const corsOrigin = allowedCorsOrigin(request);
  if (request.method === 'OPTIONS' && request.headers.has('access-control-request-method')) {
    if (!corsOrigin) return blockedResponse(request, { status: 403, reason: 'CORS_ORIGIN_NOT_ALLOWED', source: 'origin' });
    return addCorsHeaders(new NextResponse(null, { status: 204 }), corsOrigin);
  }
  const result = verifyCsrfRequest(request);
  if (result.allowed) return addCorsHeaders(NextResponse.next(), corsOrigin);

  return blockedResponse(request, result);
}

function blockedResponse(request, result) {
  const context = createSecurityContext(request);
  const written = writeAudit(context, {
    eventType: 'security.csrf', outcome: 'blocked', reasonCode: result.reason,
    targetType: 'api_route', targetId: request.nextUrl.pathname,
    metadata: { method: request.method, source: result.source || null },
  });
  const response = NextResponse.json({
    success: false,
    code: result.status === 415 ? 'CONTENT_TYPE_REJECTED' : 'CSRF_ORIGIN_REJECTED',
    message: result.status === 415 ? '请求内容类型不受支持' : '请求来源验证失败',
  }, { status: result.status });
  response.headers.set('X-Request-ID', context.requestId);
  response.headers.set('X-Audit-Status', written ? 'ok' : 'degraded');
  response.headers.set('Vary', 'Origin');
  return response;
}

function addCorsHeaders(response, origin) {
  if (!origin) return response;
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Vary', 'Origin');
  return response;
}

export const config = { matcher: '/api/:path*' };
