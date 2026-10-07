import db from './db.js';
import crypto from 'node:crypto';
import {configuredRechargeExchangeRate} from './point-recharge.js';

const setting=key=>db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value?.trim()||'';
const envPem=key=>String(process.env[key]||'').replaceAll('\\n','\n').trim();

export function pointCheckoutEnabled(userId=null) {
  if(process.env.POINT_RECHARGE_ENABLED!=='1')return false;
  const allowlist=String(process.env.POINT_RECHARGE_TEST_USER_IDS||'').trim();
  if(!allowlist)return true;
  return Number.isSafeInteger(userId)&&allowlist.split(',').some(value=>Number(value.trim())===userId&&/^\d+$/.test(value.trim()));
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

export function pointRechargeAvailability(userId=null) {
  let rate;
  try{rate=configuredRechargeExchangeRate();}catch{return {enabled:false,providers:[],cnyFenPerUsd:null};}
  if(!pointCheckoutEnabled(userId))return {enabled:false,providers:[],cnyFenPerUsd:rate};
  if(rate==null)return {enabled:false,providers:[],cnyFenPerUsd:null};
  const providers=[];
  try{const config=wechatPaymentConfig();crypto.createPrivateKey(config.merchantPrivateKey);crypto.createPublicKey(config.platformCertificate);
    if(new URL(config.notifyUrl).protocol==='https:'&&/^[A-Fa-f0-9]{10,128}$/.test(config.merchantCertificateSerial))providers.push('wechat');}catch{}
  try{const config=alipayPaymentConfig();crypto.createPrivateKey(config.privateKey);crypto.createPublicKey(config.publicKey);
    if(new URL(config.notifyUrl).protocol==='https:'&&['https://openapi.alipay.com/gateway.do','https://openapi-sandbox.dl.alipaydev.com/gateway.do'].includes(config.gateway))providers.push('alipay');}catch{}
  return {enabled:providers.length>0,providers,cnyFenPerUsd:rate};
}
