import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { parseJson } from '@/lib/validation';
import { withApiErrors } from '@/lib/api-errors';
import { createSecurityContext, enforceRateLimits, writeAudit } from '@/lib/security';
import { searchDashboard, saveSearchConfig, scanSearchQueue, runSearchSubmissions } from '@/lib/search-submission-store';

const schema = z.object({ action: z.enum(['save', 'scan', 'retry', 'run']),
  baiduEnabled: z.boolean().optional(), bingEnabled: z.boolean().optional(), googleEnabled: z.boolean().optional(),
  baiduToken: z.string().trim().max(200).optional(), googleCredentials: z.string().trim().max(16000).optional(),
  googleProperty: z.string().trim().max(500).optional(), sogouSitemapSubmitted: z.boolean().optional(),
  clearBaiduToken: z.boolean().optional(), clearGoogleCredentials: z.boolean().optional(),
}).strict();
const messages = {
  SEARCH_GOOGLE_PROPERTY_INVALID: 'Google 资源必须是当前网站的完整网址（末尾加 /）或 sc-domain:域名。',
  SEARCH_BAIDU_TOKEN_INVALID: '百度推送密钥格式不正确。', SEARCH_BAIDU_TOKEN_REQUIRED: '请先填写百度推送密钥。',
  SEARCH_GOOGLE_CREDENTIALS_REQUIRED: '请先填写 Google 服务账号 JSON 密钥。',
};
async function GETHandler() {
  const user = await getSessionUser();
  if (user?.role !== 'admin') return NextResponse.json({ message: '仅管理员可以管理搜索引擎提交' }, { status: 403 });
  return NextResponse.json({ success: true, ...searchDashboard() }, { headers: { 'Cache-Control': 'no-store' } });
}
async function POSTHandler(request) {
  const user = await getSessionUser();
  if (user?.role !== 'admin') return NextResponse.json({ message: '仅管理员可以管理搜索引擎提交' }, { status: 403 });
  const context = createSecurityContext(request, user);
  const limited = enforceRateLimits(context, 'search.submission', [{ policy: { scope: 'search.admin', limit: 20, windowMs: 3600000 }, identifier: `user:${user.id}` }]);
  if (limited) return limited;
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return parsed.response;
  const { action, ...input } = parsed.data;
  const audit = () => writeAudit(context, { eventType: 'search.submission.admin', outcome: 'success', reasonCode: 'ADMIN_SEARCH_ACTION', userId: user.id, actorRole: user.role, targetType: 'search_settings', targetId: action, metadata: { action, fields: Object.keys(input) } });
  if (action === 'save') {
    try { saveSearchConfig(input, undefined, undefined, audit); }
    catch (error) { return NextResponse.json({ message: messages[error.message] || '配置未保存，请检查密钥格式和服务器加密配置。' }, { status: 400 }); }
  }
  else if (!audit()) return NextResponse.json({ message: '审计记录不可用，请稍后重试。' }, { status: 503 });
  if (action === 'run') await runSearchSubmissions();
  else scanSearchQueue(undefined, undefined, action === 'retry');
  return NextResponse.json({ success: true, ...searchDashboard() }, { headers: { 'Cache-Control': 'no-store' } });
}
export const GET = withApiErrors(GETHandler, { route: '/api/search-submission' });
export const POST = withApiErrors(POSTHandler, { route: '/api/search-submission' });
