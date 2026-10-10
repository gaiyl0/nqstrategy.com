import crypto from 'node:crypto';

const ALLOWED_GATEWAYS=new Set(['https://openapi.alipay.com/gateway.do','https://openapi-sandbox.dl.alipaydev.com/gateway.do']);

export function alipayOutTradeNo(orderId) {
  return Number.isSafeInteger(orderId)&&orderId>0?`NQPR${orderId}`:null;
}

export function yuanToFen(value) {
  const text=String(value);
  if(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(text))throw new Error('ALIPAY_AMOUNT_INVALID');
  const [yuan,fraction='']=text.split('.');
  const fen=Number(yuan)*100+Number(fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(fen)||fen<=0)throw new Error('ALIPAY_AMOUNT_INVALID');
  return fen;
}

export function fenToYuan(fen) {
  if(!Number.isSafeInteger(fen)||fen<=0)return null;
  return `${Math.floor(fen/100)}.${String(fen%100).padStart(2,'0')}`;
}

export function alipayCanonical(parameters, notification = true) {
  return Object.entries(parameters).filter(([key,value])=>key!=='sign'&&(!notification||key!=='sign_type')&&value!==''&&value!=null)
    .sort(([left],[right])=>left<right?-1:left>right?1:0).map(([key,value])=>`${key}=${value}`).join('&');
}

export function signAlipayParameters(parameters,privateKey) {
  if(!privateKey||parameters.sign_type!=='RSA2'||parameters.charset?.toLowerCase()!=='utf-8')throw new Error('ALIPAY_SIGNING_CONFIG_INVALID');
  // API requests include sign_type; asynchronous notifications exclude it.
  return crypto.sign('RSA-SHA256',Buffer.from(alipayCanonical(parameters,false),'utf8'),privateKey).toString('base64');
}

export function verifyAlipayNotification(parameters,publicKey) {
  if(!publicKey||parameters?.sign_type!=='RSA2'||parameters.charset?.toLowerCase()!=='utf-8'||!parameters.sign)throw new Error('ALIPAY_SIGNATURE_INVALID');
  let valid=false;
  try{valid=crypto.verify('RSA-SHA256',Buffer.from(alipayCanonical(parameters),'utf8'),publicKey,Buffer.from(parameters.sign,'base64'));}catch{}
  if(!valid)throw new Error('ALIPAY_SIGNATURE_INVALID');
  return true;
}

function rawResponseNode(raw,key) {
  const match=new RegExp(`"${key}"\\s*:`).exec(raw);
  if(!match)throw new Error('ALIPAY_RESPONSE_INVALID');
  let start=match.index+match[0].length;
  while(/\s/.test(raw[start]||''))start++;
  if(raw[start]!=='{')throw new Error('ALIPAY_RESPONSE_INVALID');
  let depth=0,quoted=false,escaped=false;
  for(let i=start;i<raw.length;i++){
    const character=raw[i];
    if(escaped){escaped=false;continue;}
    if(character==='\\'&&quoted){escaped=true;continue;}
    if(character==='"'){quoted=!quoted;continue;}
    if(!quoted){if(character==='{')depth++;else if(character==='}'&&--depth===0)return raw.slice(start,i+1);}
  }
  throw new Error('ALIPAY_RESPONSE_INVALID');
}

export function verifyAlipayResponse(raw,key,publicKey) {
  if(typeof raw!=='string'||raw.length>128000||!publicKey)throw new Error('ALIPAY_RESPONSE_INVALID');
  let parsed,node;
  try{parsed=JSON.parse(raw);node=rawResponseNode(raw,key);}catch{throw new Error('ALIPAY_RESPONSE_INVALID');}
  if(!parsed[key]||typeof parsed.sign!=='string')throw new Error('ALIPAY_RESPONSE_INVALID');
  let valid=false;
  try{valid=crypto.verify('RSA-SHA256',Buffer.from(node,'utf8'),publicKey,Buffer.from(parsed.sign,'base64'));}catch{}
  if(!valid)throw new Error('ALIPAY_SIGNATURE_INVALID');
  return parsed[key];
}

export function verifiedAlipayTrade(query,{appId,sellerId,outTradeNo,cnyFen,orderId}) {
  if(query?.code!=='10000'||!['TRADE_SUCCESS','TRADE_FINISHED'].includes(query.trade_status)||
    query.out_trade_no!==outTradeNo||!sellerId||(query.seller_id&&query.seller_id!==sellerId)||
    (query.app_id&&query.app_id!==appId)||yuanToFen(query.total_amount)!==cnyFen||
    !/^[0-9A-Za-z_-]{6,128}$/.test(query.trade_no||''))throw new Error('ALIPAY_TRADE_MISMATCH');
  const date=query.send_pay_date;
  const paidAt=typeof date==='string'&&/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(date)?Date.parse(`${date.replace(' ','T')}+08:00`):NaN;
  if(!Number.isSafeInteger(paidAt))throw new Error('ALIPAY_TRADE_TIME_UNAVAILABLE');
  return {orderId,provider:'alipay',providerTradeNo:query.trade_no,cnyFen,paidAt};
}

function shanghaiTimestamp(now) {
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(now);
}

function paymentWindow(order) {
  const minutes=Math.min(14,Math.floor((order.expires_at-Date.now()-15000)/60000));
  if(!Number.isSafeInteger(minutes)||minutes<1)throw new Error('ALIPAY_ORDER_INVALID');
  return `${minutes}m`;
}

async function alipayApi(method,bizContent,config,fetchImpl) {
  if(!config?.appId||!config.privateKey||!config.publicKey||!config.notifyUrl||!config.sellerId||
    !ALLOWED_GATEWAYS.has(config.gateway)||new URL(config.notifyUrl).protocol!=='https:')throw new Error('ALIPAY_PAYMENT_CONFIG_UNAVAILABLE');
  const parameters={app_id:config.appId,method,format:'JSON',charset:'utf-8',sign_type:'RSA2',timestamp:shanghaiTimestamp(new Date()),version:'1.0',
    notify_url:config.notifyUrl,biz_content:JSON.stringify(bizContent)};
  parameters.sign=signAlipayParameters(parameters,config.privateKey);
  const response=await fetchImpl(config.gateway,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=utf-8'},
    body:new URLSearchParams(parameters).toString(),redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('ALIPAY_API_ERROR');
  return verifyAlipayResponse(await response.text(),`${method.replaceAll('.','_')}_response`,config.publicKey);
}

export async function createAlipayQrOrder(order,config,fetchImpl=fetch) {
  if(order?.provider!=='alipay'||order.status!=='pending'||!alipayOutTradeNo(order.id)||!fenToYuan(order.cny_fen))throw new Error('ALIPAY_ORDER_INVALID');
  // Keep the provider's payment window inside the 15-minute local order TTL.
  const result=await alipayApi('alipay.trade.precreate',{out_trade_no:alipayOutTradeNo(order.id),total_amount:fenToYuan(order.cny_fen),subject:'Nexus Quant 积分充值',timeout_express:paymentWindow(order)},config,fetchImpl);
  if(result.code!=='10000'||result.out_trade_no!==alipayOutTradeNo(order.id)||typeof result.qr_code!=='string'||
    !result.qr_code.startsWith('https://qr.alipay.com/')||result.qr_code.length>2048)throw new Error('ALIPAY_QR_INVALID');
  return {orderId:order.id,codeUrl:result.qr_code,expiresAt:order.expires_at};
}

export function createAlipayMobileOrder(order,config) {
  if(order?.provider!=='alipay'||order.status!=='pending'||order.expires_at<=Date.now()||!fenToYuan(order.cny_fen))throw new Error('ALIPAY_ORDER_INVALID');
  if(!ALLOWED_GATEWAYS.has(config.gateway)||!config.appId||!config.sellerId||!config.privateKey||!config.publicKey||new URL(config.notifyUrl).protocol!=='https:')throw new Error('ALIPAY_PAYMENT_CONFIG_UNAVAILABLE');
  // Derive the return origin from the administrator-configured notify URL, never the request Host.
  const returnUrl=new URL('/?route=points',config.notifyUrl);
  returnUrl.searchParams.set('rechargeOrder',String(order.id));
  const parameters={app_id:config.appId,method:'alipay.trade.wap.pay',format:'JSON',charset:'utf-8',sign_type:'RSA2',timestamp:shanghaiTimestamp(new Date()),version:'1.0',
    notify_url:config.notifyUrl,return_url:returnUrl.href,biz_content:JSON.stringify({out_trade_no:alipayOutTradeNo(order.id),total_amount:fenToYuan(order.cny_fen),subject:'Nexus Quant 积分充值',product_code:'QUICK_WAP_WAY',timeout_express:paymentWindow(order),quit_url:returnUrl.href})};
  parameters.sign=signAlipayParameters(parameters,config.privateKey);
  return {orderId:order.id,payUrl:`${config.gateway}?${new URLSearchParams(parameters)}`,expiresAt:order.expires_at,paymentMode:'mobile'};
}

export async function queryAlipayOrder(order,config,fetchImpl=fetch) {
  if(order?.provider!=='alipay'||!alipayOutTradeNo(order.id))throw new Error('ALIPAY_ORDER_INVALID');
  const result=await alipayApi('alipay.trade.query',{out_trade_no:alipayOutTradeNo(order.id)},config,fetchImpl);
  if(result.code==='40004'&&result.sub_code==='ACQ.TRADE_NOT_EXIST')return {orderId:order.id,state:'NOT_FOUND'};
  if(result.code!=='10000')throw new Error('ALIPAY_QUERY_FAILED');
  if(!['TRADE_SUCCESS','TRADE_FINISHED'].includes(result.trade_status))return {orderId:order.id,state:result.trade_status};
  return {orderId:order.id,state:result.trade_status,settlement:verifiedAlipayTrade(result,{appId:config.appId,sellerId:config.sellerId,
    outTradeNo:alipayOutTradeNo(order.id),cnyFen:order.cny_fen,orderId:order.id})};
}

export async function queryAlipayRefund(order,refund,config,fetchImpl=fetch) {
  const requestNo=`NQRF${refund.id}`;
  const result=await alipayApi('alipay.trade.fastpay.refund.query',{
    out_trade_no:alipayOutTradeNo(order.id),trade_no:order.provider_trade_no,out_request_no:requestNo},config,fetchImpl);
  if(result.code==='40004'&&['ACQ.REFUND_NOT_EXIST','ACQ.TRADE_NOT_EXIST'].includes(result.sub_code))return {paid:false};
  if(result.code!=='10000')throw Error('ALIPAY_REFUND_QUERY_FAILED');
  if(result.out_trade_no!==alipayOutTradeNo(order.id)||result.trade_no!==order.provider_trade_no||result.out_request_no!==requestNo||
    yuanToFen(result.refund_amount)!==refund.units)throw Error('ALIPAY_REFUND_MISMATCH');
  return {paid:result.refund_status==='REFUND_SUCCESS'};
}

export async function submitAlipayRefund(order,refund,config,fetchImpl=fetch) {
  const result=await alipayApi('alipay.trade.refund',{out_trade_no:alipayOutTradeNo(order.id),trade_no:order.provider_trade_no,
    out_request_no:`NQRF${refund.id}`,refund_amount:fenToYuan(refund.units),refund_reason:'未消费充值积分退款'},config,fetchImpl);
  if(result.code!=='10000')throw Error('ALIPAY_REFUND_SUBMIT_FAILED');
  if(result.out_trade_no!==alipayOutTradeNo(order.id)||result.trade_no!==order.provider_trade_no||yuanToFen(result.refund_fee)!==refund.units)
    throw Error('ALIPAY_REFUND_MISMATCH');
  return {paid:result.fund_change==='Y'};
}
