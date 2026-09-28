import { withApiErrors } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { parseJson, settingsSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

// 定义安全白名单：仅这些公开展示字段允许下发给普通访客
const PUBLIC_SETTINGS_KEYS = new Set([
  'siteName', 'contactEmail', 'primaryColor',
  'usdtAddress', 'btcAddress', 'ethAddress',
  'broker1Name', 'broker1Desc', 'broker1Link',
  'broker2Name', 'broker2Desc', 'broker2Link',
  'broker3Name', 'broker3Desc', 'broker3Link',
  'forumCategories'
]);
const ADMIN_SETTINGS_KEYS = new Set([...PUBLIC_SETTINGS_KEYS, 'smtpHost', 'smtpUser', 'smtpPass']);

async function GETHandler() {
  try {
    const currentUser = await getSessionUser();
    const isAdmin = currentUser?.role === 'admin';

    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};

    for (const row of rows) {
      // 核心安全隔离：只有真正的超管才能读取 smtpHost, smtpUser, smtpPass 等私密凭据
      // 普通用户与外部访客只能获取公开展示数据，彻底杜绝发件服务器被盗用
      if ((isAdmin && ADMIN_SETTINGS_KEYS.has(row.key)) || PUBLIC_SETTINGS_KEYS.has(row.key)) {
        settings[row.key] = row.value;
      }
    }

    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({}, { status: 500 });
  }
}

async function POSTHandler(request) {
  try {
    // 强制服务端鉴权：绝不信任客户端，必须当前会话是 admin 才能修改配置
    const currentUser = await getSessionUser();
    if (currentUser?.role !== 'admin') {
      return NextResponse.json(
        { success: false, message: '越权拒绝：仅超级管理员有权修改平台参数' }, 
        { status: 403 }
      );
    }

    const parsed = await parseJson(request, settingsSchema);
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    
    const transaction = db.transaction((data) => {
      for (const [key, value] of Object.entries(data)) {
        stmt.run(key, String(value ?? ''));
      }
    });
    transaction(body);

    return NextResponse.json({ success: true, message: '核心配置已保存生效' });
  } catch (error) {
    return NextResponse.json({ success: false, message: '保存配置失败' }, { status: 500 });
  }
}

export const GET = withApiErrors(GETHandler, { route: '/api/settings' });
export const POST = withApiErrors(POSTHandler, { route: '/api/settings' });
