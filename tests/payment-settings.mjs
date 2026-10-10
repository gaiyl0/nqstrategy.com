import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { settingsSchema } from '../lib/validation.js';

const root = process.cwd();
const route = fs.readFileSync(path.join(root, 'app', 'api', 'settings', 'route.js'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'app', 'tianwei', 'page.js'), 'utf8');
const environment = fs.readFileSync(path.join(root, '.env.example'), 'utf8');

const wechatSetup = {
  wechatPaySetupEnabled: true,
  wechatPayMchId: '1900000109',
  wechatPayAppId: 'wx1234567890abcdef',
  wechatPayNotifyUrl: 'https://nexusquant.example/api/payments/webhooks/wechat-pay',
  wechatPayCertificateSerial: '5157F09EFDC096DE15EBE81A47057A7232F1B8E1',
};
const alipaySetup = {
  alipaySetupEnabled: true,
  alipayAppId: '2026000000000000',
  alipaySellerId: '2088000000000000',
  alipayNotifyUrl: 'https://nexusquant.example/api/payments/webhooks/alipay',
  alipayGateway: 'https://openapi.alipay.com/gateway.do',
};

assert.equal(settingsSchema.safeParse(wechatSetup).success, true, 'complete WeChat setup metadata must validate');
assert.equal(settingsSchema.safeParse({ wechatPaySetupEnabled: true, wechatPayMchId: '1900000109' }).success, false, 'enabled WeChat setup must require IDs and a callback URL');
assert.equal(settingsSchema.safeParse({ ...wechatSetup, wechatPayNotifyUrl: 'javascript:alert(1)' }).success, false, 'WeChat callback must be an HTTP(S) URL');
assert.equal(settingsSchema.safeParse(alipaySetup).success, true, 'complete Alipay setup metadata must validate');
assert.equal(settingsSchema.safeParse({ alipaySetupEnabled: true, alipayAppId: '2026000000000000' }).success, false, 'enabled Alipay setup must require a callback URL');
assert.equal(settingsSchema.safeParse({ ...alipaySetup, alipayGateway: 'file:///tmp/gateway' }).success, false, 'Alipay gateway must be an HTTP(S) URL');

for (const key of ['wechatPayMchId', 'wechatPayAppId', 'wechatPayNotifyUrl', 'alipayAppId', 'alipayNotifyUrl']) {
  assert.match(route, new RegExp(`'${key}'`), `${key} must be admin-only settings metadata`);
  assert.doesNotMatch(route.match(/const PUBLIC_SETTINGS_KEYS[\s\S]*?\n\];/)?.[0] || '', new RegExp(`'${key}'`), `${key} must not be public`);
}
for (const environmentKey of ['WECHAT_PAY_API_V3_KEY', 'WECHAT_PAY_MERCHANT_PRIVATE_KEY', 'WECHAT_PAY_PLATFORM_CERTIFICATE', 'ALIPAY_APP_PRIVATE_KEY', 'ALIPAY_PUBLIC_KEY']) {
  assert.match(route, new RegExp(`'${environmentKey}'`), `${environmentKey} presence must be derived server-side`);
  assert.match(environment, new RegExp(`^${environmentKey}=`, 'm'), `${environmentKey} must be documented in the server environment template`);
  assert.doesNotMatch(settingsSchema.safeParse({ [environmentKey]: 'not-allowed' }).success ? 'accepted' : 'rejected', /accepted/, `${environmentKey} must not be accepted as a browser setting`);
}
assert.match(admin, /支付渠道配置/, 'admin sidebar must expose payment channel settings');
assert.match(admin, /人民币积分充值开关未开启/, 'admin payment screen must reflect the runtime checkout gate');
assert.match(admin, /管理界面永不读取或展示原文/, 'admin payment screen must state its secret non-disclosure rule');
assert.match(admin, /paymentSettings/, 'admin must render a dedicated payment settings view');

console.log('Payment settings tests passed: admin-only metadata, server-secret status, validation, and disabled checkout boundary');
