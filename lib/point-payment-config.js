import db from './db.js';

const setting=key=>db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value?.trim()||'';
const envPem=key=>String(process.env[key]||'').replaceAll('\\n','\n').trim();

export function pointCheckoutEnabled() {
  return process.env.POINT_RECHARGE_ENABLED==='1';
}

export function wechatPaymentConfig() {
  const config={merchantId:setting('wechatPayMchId'),appId:setting('wechatPayAppId'),notifyUrl:setting('wechatPayNotifyUrl'),
    platformCertificateSerial:setting('wechatPayCertificateSerial'),merchantCertificateSerial:String(process.env.WECHAT_PAY_MERCHANT_CERTIFICATE_SERIAL||'').trim(),
    merchantPrivateKey:envPem('WECHAT_PAY_MERCHANT_PRIVATE_KEY'),platformCertificate:envPem('WECHAT_PAY_PLATFORM_CERTIFICATE'),
    apiV3Key:String(process.env.WECHAT_PAY_API_V3_KEY||'')};
  if(setting('wechatPaySetupEnabled')!=='true'||Object.values(config).some(value=>!value)||Buffer.byteLength(config.apiV3Key)!==32)
    throw new Error('WECHAT_PAYMENT_CONFIG_UNAVAILABLE');
  return config;
}

export function alipayPaymentConfig() {
  const config={appId:setting('alipayAppId'),sellerId:setting('alipaySellerId'),notifyUrl:setting('alipayNotifyUrl'),
    gateway:setting('alipayGateway')||'https://openapi.alipay.com/gateway.do',
    privateKey:envPem('ALIPAY_APP_PRIVATE_KEY'),publicKey:envPem('ALIPAY_PUBLIC_KEY')};
  if(setting('alipaySetupEnabled')!=='true'||Object.values(config).some(value=>!value))throw new Error('ALIPAY_PAYMENT_CONFIG_UNAVAILABLE');
  return config;
}
