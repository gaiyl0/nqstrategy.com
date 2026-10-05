import { withApiErrors } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { parseJson, settingsSchema } from '@/lib/validation';
import { DEFAULT_COMMUNITY_CONTENT, normalizeCommunityContent } from '@/lib/community-content';

export const dynamic = 'force-dynamic';

// 定义安全白名单：仅这些公开展示字段允许下发给普通访客
const PUBLIC_SETTINGS_KEYS = new Set([
  'siteName', 'contactEmail', 'socialXUrl', 'telegramGroupUrl', 'primaryColor', 'frontendDesign', 'adminDesign', 'homeModules', 'featuredRotationSeconds', 'featuredAutoRotate', 'homeHeroTitle', 'homeHeroDescription', 'homeArticleCount',
  'usdtAddress', 'btcAddress', 'ethAddress',
  'broker1Name', 'broker1Desc', 'broker1Link',
  'broker2Name', 'broker2Desc', 'broker2Link',
  'broker3Name', 'broker3Desc', 'broker3Link',
  'exchangeAdEnabled', 'exchangeAdTitle', 'exchangeAdDescription', 'exchangeAdCta', 'exchangeAdUrl', 'exchangeAdCta2', 'exchangeAdUrl2', 'featuredProductIds',
  'mt5DownloadEnabled', 'mt5DownloadUrl', 'mt5DownloadLabel', 'mt5DownloadDescription', 'forumCategories', 'communityContent', 'forumNewsEnabled', 'forumStrategyOverviewEnabled'
]);
const PAYMENT_CHANNEL_SETTINGS_KEYS = new Set([
  'wechatPaySetupEnabled', 'wechatPayMchId', 'wechatPayAppId', 'wechatPayNotifyUrl', 'wechatPayCertificateSerial',
  'alipaySetupEnabled', 'alipayAppId', 'alipaySellerId', 'alipayNotifyUrl', 'alipayGateway',
]);
const BOOLEAN_SETTINGS_KEYS = new Set(['mt5DownloadEnabled', 'forumNewsEnabled', 'forumStrategyOverviewEnabled', 'featuredAutoRotate', 'exchangeAdEnabled', 'wechatPaySetupEnabled', 'alipaySetupEnabled']);
const JSON_SETTINGS_KEYS = new Set(['communityContent', 'featuredProductIds', 'homeModules']);
const PAYMENT_SECRET_STATUS = {
  wechatPayApiV3KeyConfigured: 'WECHAT_PAY_API_V3_KEY',
  wechatPayMerchantPrivateKeyConfigured: 'WECHAT_PAY_MERCHANT_PRIVATE_KEY',
  wechatPayPlatformCertificateConfigured: 'WECHAT_PAY_PLATFORM_CERTIFICATE',
  alipayAppPrivateKeyConfigured: 'ALIPAY_APP_PRIVATE_KEY',
  alipayPublicKeyConfigured: 'ALIPAY_PUBLIC_KEY',
};
const ADMIN_SETTINGS_KEYS = new Set([...PUBLIC_SETTINGS_KEYS, ...PAYMENT_CHANNEL_SETTINGS_KEYS, 'smtpHost', 'smtpUser', 'smtpPass']);

async function GETHandler() {
  try {
    const currentUser = await getSessionUser();
    const isAdmin = currentUser?.role === 'admin';

    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};

    for (const row of rows) {
      // 核心安全隔离：只有真正的超管才能读取管理员配置；支付私钥始终不从此接口返回。
      // 普通用户与外部访客只能获取公开展示数据，彻底杜绝发件服务器被盗用
      if ((isAdmin && ADMIN_SETTINGS_KEYS.has(row.key)) || PUBLIC_SETTINGS_KEYS.has(row.key)) {
        settings[row.key] = row.key === 'communityContent'
          ? normalizeCommunityContent(row.value) || DEFAULT_COMMUNITY_CONTENT
          : row.key === 'homeModules'
            ? (() => { try { const items = JSON.parse(row.value); return Array.isArray(items) ? items : []; } catch { return []; } })()
          : ['featuredRotationSeconds','homeArticleCount'].includes(row.key) ? Number(row.value)
          : row.key === 'featuredProductIds'
            ? (() => { try { const ids=JSON.parse(row.value); return Array.isArray(ids) ? ids.map(Number).filter(Number.isInteger).slice(0,3) : []; } catch { return []; } })()
          : BOOLEAN_SETTINGS_KEYS.has(row.key)
            ? row.value === 'true'
            : row.value;
      }
    }

    if (!settings.communityContent) settings.communityContent = DEFAULT_COMMUNITY_CONTENT;
    if (isAdmin) {
      for (const [responseKey, environmentKey] of Object.entries(PAYMENT_SECRET_STATUS)) {
        settings[responseKey] = Boolean(process.env[environmentKey]?.trim());
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
    const body = {
      ...parsed.data,
      ...(parsed.data.communityContent ? {
        communityContent: { ...parsed.data.communityContent, updatedAt: new Date().toISOString().slice(0, 10) },
      } : {}),
    };
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    
    const transaction = db.transaction((data) => {
      for (const [key, value] of Object.entries(data)) {
        stmt.run(key, JSON_SETTINGS_KEYS.has(key) ? JSON.stringify(value) : String(value ?? ''));
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
