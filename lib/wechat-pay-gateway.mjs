import { signWechatRequest, verifyWechatResponse, verifiedWechatTrade } from './wechat-pay-crypto.mjs';

const API_ORIGIN='https://api.mch.weixin.qq.com';

export function wechatOutTradeNo(orderId) {
  if(!Number.isSafeInteger(orderId)||orderId<=0)return null;
  return `NQPR${orderId}`;
}

function validateConfig(config) {
  if(!config||!config.merchantId||!config.appId||!config.merchantCertificateSerial||!config.merchantPrivateKey||
    !config.platformCertificateSerial||!config.platformCertificate||!config.notifyUrl||
    new URL(config.notifyUrl).protocol!=='https:')throw new Error('WECHAT_PAYMENT_CONFIG_UNAVAILABLE');
}

async function wechatApi(method,pathname,payload,config,fetchImpl) {
  validateConfig(config);
  const body=payload?JSON.stringify(payload):'';
  const authorization=signWechatRequest({method,pathname,body,merchantId:config.merchantId,
    merchantCertificateSerial:config.merchantCertificateSerial,merchantPrivateKey:config.merchantPrivateKey});
  const response=await fetchImpl(`${API_ORIGIN}${pathname}`,{method,headers:{Authorization:authorization,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body}:{}),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('WECHAT_PAYMENT_API_ERROR');
  const responseBody=await response.text();
  if(responseBody.length>128000)throw new Error('WECHAT_RESPONSE_TOO_LARGE');
  verifyWechatResponse({headers:response.headers,body:responseBody,
    platformCertificateSerial:config.platformCertificateSerial,platformCertificate:config.platformCertificate});
  try{return JSON.parse(responseBody);}catch{throw new Error('WECHAT_RESPONSE_INVALID');}
}

export async function createWechatNativeOrder(order,config,fetchImpl=fetch) {
  validateConfig(config);
  if(order?.provider!=='wechat'||order.status!=='pending'||!Number.isSafeInteger(order.cny_fen)||order.cny_fen<=0||
    !Number.isSafeInteger(order.expires_at)||!Number.isFinite(new Date(order.expires_at).getTime())||!wechatOutTradeNo(order.id))throw new Error('WECHAT_ORDER_INVALID');
  const response=await wechatApi('POST','/v3/pay/transactions/native',{
    appid:config.appId,mchid:config.merchantId,description:'Nexus Quant 积分充值',
    out_trade_no:wechatOutTradeNo(order.id),time_expire:new Date(order.expires_at).toISOString(),
    notify_url:config.notifyUrl,amount:{total:order.cny_fen,currency:'CNY'},
  },config,fetchImpl);
  if(typeof response.code_url!=='string'||!response.code_url.startsWith('weixin://wxpay/bizpayurl?')||response.code_url.length>2048)
    throw new Error('WECHAT_CODE_URL_INVALID');
  return {orderId:order.id,codeUrl:response.code_url,expiresAt:order.expires_at};
}

export async function queryWechatNativeOrder(order,config,fetchImpl=fetch) {
  validateConfig(config);
  if(order?.provider!=='wechat'||!wechatOutTradeNo(order.id))throw new Error('WECHAT_ORDER_INVALID');
  const pathname=`/v3/pay/transactions/out-trade-no/${wechatOutTradeNo(order.id)}?mchid=${encodeURIComponent(config.merchantId)}`;
  const query=await wechatApi('GET',pathname,null,config,fetchImpl);
  if(query.trade_state!=='SUCCESS')return {orderId:order.id,state:query.trade_state};
  return {orderId:order.id,state:'SUCCESS',settlement:verifiedWechatTrade(query,{
    merchantId:config.merchantId,appId:config.appId,outTradeNo:wechatOutTradeNo(order.id),
    cnyFen:order.cny_fen,orderId:order.id,
  })};
}
