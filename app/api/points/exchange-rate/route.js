import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiErrors } from '@/lib/api-errors';
import { getSessionUser } from '@/lib/auth';
import { parseJson } from '@/lib/validation';
import { configuredRechargeExchangeRate, quotePointRecharge, setRechargeExchangeRate } from '@/lib/point-recharge';

export const dynamic = 'force-dynamic';

async function GETHandler(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, message: '请先登录' }, { status: 401 });
  const rate = configuredRechargeExchangeRate();
  const points = Number(new URL(request.url).searchParams.get('points') || 0);
  if (points) {
    if(rate==null)return NextResponse.json({success:false,message:'管理员尚未设置充值汇率'},{status:409});
    try { return NextResponse.json({ success: true, quote: quotePointRecharge(points, rate) }); }
    catch { return NextResponse.json({ success: false, message: '积分数量无效' }, { status: 400 }); }
  }
  return NextResponse.json({ success: true, cnyFenPerUsd: rate, rechargeEnabled: false });
}

async function POSTHandler(request) {
  const user = await getSessionUser();
  if (user?.role !== 'admin') return NextResponse.json({ success: false, message: '仅管理员可设置汇率' }, { status: 403 });
  const parsed = await parseJson(request, z.object({ cnyFenPerUsd: z.number().int().min(100).max(2000) }).strict());
  if (!parsed.success) return parsed.response;
  return NextResponse.json({ success: true, cnyFenPerUsd: setRechargeExchangeRate(parsed.data.cnyFenPerUsd), rechargeEnabled: false });
}

export const GET = withApiErrors(GETHandler, { route: '/api/points/exchange-rate' });
export const POST = withApiErrors(POSTHandler, { route: '/api/points/exchange-rate' });
