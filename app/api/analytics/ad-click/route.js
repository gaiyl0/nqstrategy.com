import { withApiErrors } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { recordAdClick } from '@/lib/site-analytics';

export const dynamic = 'force-dynamic';

function safeDestination(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch { return null; }
}

async function GETHandler(request) {
  const button = request.nextUrl.searchParams.get('button');
  if (button !== null && button !== '1' && button !== '2') {
    return NextResponse.json({ success: false, message: '广告按钮不存在' }, { status: 404 });
  }
  const secondButton = button === '2';
  const enabled = db.prepare("SELECT value FROM settings WHERE key='exchangeAdEnabled'").get()?.value === 'true';
  const destination = safeDestination(db.prepare('SELECT value FROM settings WHERE key=?').get(secondButton ? 'exchangeAdUrl2' : 'exchangeAdUrl')?.value);
  if (!enabled || !destination) {
    return NextResponse.json({ success: false, message: '广告链接当前不可用' }, { status: 404 });
  }
  await recordAdClick(request, destination, (await getSessionUser())?.role==='admin', secondButton ? 'exchange_home_2' : 'exchange_home');
  return NextResponse.redirect(destination, 302);
}

export const GET = withApiErrors(GETHandler, { route: '/api/analytics/ad-click' });
