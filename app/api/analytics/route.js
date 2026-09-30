import { withApiErrors } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { analyticsQuerySchema, validate, validationErrorResponse } from '@/lib/validation';
import { getSiteAnalytics } from '@/lib/site-analytics';

export const dynamic = 'force-dynamic';

async function GETHandler(request) {
  const user = await getSessionUser();
  if (user?.role !== 'admin') {
    return NextResponse.json({ success: false, message: '仅管理员可查看访问统计' }, { status: user ? 403 : 401 });
  }
  const input = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = validate(analyticsQuerySchema, input);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  return NextResponse.json({ success: true, analytics: getSiteAnalytics(parsed.data) }, {
    headers: { 'cache-control': 'no-store' },
  });
}

export const GET = withApiErrors(GETHandler, { route: '/api/analytics' });
