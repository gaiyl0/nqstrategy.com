import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { parseJson } from '@/lib/validation';
import { withApiErrors } from '@/lib/api-errors';
import { createSecurityContext, writeAudit } from '@/lib/security';
import { siteBrandSchema } from '@/lib/site-brand.mjs';
import { readBrandWorkspace, updateBrandWorkspace } from '@/lib/site-brand-store';

export const dynamic = 'force-dynamic';
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('draft'), revision: z.number().int().nonnegative(), config: siteBrandSchema }).strict(),
  z.object({ action: z.enum(['publish','restore']), revision: z.number().int().nonnegative() }).strict(),
]);
async function GETHandler() {
  if ((await getSessionUser())?.role !== 'admin') return NextResponse.json({ success: false }, { status: 403 });
  return NextResponse.json({ success: true, workspace: readBrandWorkspace() }, { headers: { 'Cache-Control': 'private, no-store' } });
}
async function POSTHandler(request) {
  const user = await getSessionUser();
  if (user?.role !== 'admin') return NextResponse.json({ success: false, message: '仅管理员可配置品牌页面' }, { status: 403 });
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return parsed.response;
  const context = createSecurityContext(request, user);
  try {
    const workspace = updateBrandWorkspace(parsed.data, metadata => writeAudit(context, {
      eventType: 'site.brand.update', outcome: 'success', reasonCode: parsed.data.action, targetType: 'settings', metadata,
    }));
    return NextResponse.json({ success: true, workspace });
  } catch (error) {
    if (error.message === 'BRAND_REVISION_CONFLICT') return NextResponse.json({ success: false, message: '设置已被其他操作修改，请重新载入后编辑' }, { status: 409 });
    if (error.message === 'BRAND_HISTORY_EMPTY') return NextResponse.json({ success: false, message: '尚无可恢复的版本' }, { status: 400 });
    throw error;
  }
}
export const GET = withApiErrors(GETHandler, { route: '/api/site-brand' });
export const POST = withApiErrors(POSTHandler, { route: '/api/site-brand' });
