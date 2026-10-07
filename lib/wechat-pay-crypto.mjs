import crypto from 'node:crypto';

const MAX_CLOCK_SKEW_SECONDS = 300;

export function signWechatRequest({method,pathname,body='',merchantId,merchantCertificateSerial,merchantPrivateKey,nonce=crypto.randomBytes(16).toString('hex'),timestamp=Math.floor(Date.now()/1000)}) {
  if(!/^(GET|POST)$/.test(method)||!pathname.startsWith('/')||pathname.includes('#')||
    !/^[0-9A-Za-z_-]{6,32}$/.test(merchantId)||!/^\w{10,128}$/.test(merchantCertificateSerial)||
    typeof body!=='string'||!merchantPrivateKey||!/^[a-f0-9]{32}$/.test(nonce)||!Number.isSafeInteger(timestamp))throw new Error('WECHAT_SIGNING_CONFIG_INVALID');
  const message=`${method}\n${pathname}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature=crypto.sign('RSA-SHA256',Buffer.from(message),merchantPrivateKey).toString('base64');
  return `WECHATPAY2-SHA256-RSA2048 mchid="${merchantId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${merchantCertificateSerial}",signature="${signature}"`;
}

export function verifyWechatResponse({headers,body,platformCertificateSerial,platformCertificate,now=Date.now()}) {
  const timestamp=Number(headers.get('wechatpay-timestamp'));
  const nonce=headers.get('wechatpay-nonce');
  const serial=headers.get('wechatpay-serial');
  const signature=headers.get('wechatpay-signature');
  if(!Number.isSafeInteger(timestamp)||Math.abs(now/1000-timestamp)>MAX_CLOCK_SKEW_SECONDS||
    !nonce||!signature||serial!==platformCertificateSerial||!platformCertificate||typeof body!=='string')throw new Error('WECHAT_SIGNATURE_INVALID');
  const message=`${timestamp}\n${nonce}\n${body}\n`;
  let verified=false;
  try{verified=crypto.verify('RSA-SHA256',Buffer.from(message),platformCertificate,Buffer.from(signature,'base64'));}catch{}
  if(!verified)throw new Error('WECHAT_SIGNATURE_INVALID');
  return true;
}

export function decryptWechatNotificationResource(resource,apiV3Key) {
  if(!resource||resource.algorithm!=='AEAD_AES_256_GCM'||typeof apiV3Key!=='string'||Buffer.byteLength(apiV3Key)!==32||
    typeof resource.nonce!=='string'||typeof resource.associated_data!=='string'||typeof resource.ciphertext!=='string')throw new Error('WECHAT_RESOURCE_INVALID');
  const encrypted=Buffer.from(resource.ciphertext,'base64');
  if(encrypted.length<17)throw new Error('WECHAT_RESOURCE_INVALID');
  try{
    const decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(apiV3Key),Buffer.from(resource.nonce));
    decipher.setAAD(Buffer.from(resource.associated_data));
    decipher.setAuthTag(encrypted.subarray(-16));
    return JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(0,-16)),decipher.final()]).toString('utf8'));
  }catch{throw new Error('WECHAT_RESOURCE_INVALID');}
}

export function verifiedWechatTrade(query,{merchantId,appId,outTradeNo,cnyFen,orderId}) {
  if(query?.trade_state!=='SUCCESS'||query.mchid!==merchantId||query.appid!==appId||
    query.out_trade_no!==outTradeNo||query.amount?.currency!=='CNY'||query.amount?.total!==cnyFen||
    !/^[0-9A-Za-z_-]{6,128}$/.test(query.transaction_id||''))throw new Error('WECHAT_TRADE_MISMATCH');
  const paidAt=Date.parse(query.success_time);
  if(!Number.isSafeInteger(paidAt))throw new Error('WECHAT_TRADE_TIME_INVALID');
  return {orderId,provider:'wechat',providerTradeNo:query.transaction_id,cnyFen,paidAt};
}
