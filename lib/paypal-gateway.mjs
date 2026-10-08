const bases={sandbox:'https://api-m.sandbox.paypal.com',live:'https://api-m.paypal.com'};
const orderIdPattern=/^[A-Z0-9]{10,30}$/;

function usd(cents){
  if(!Number.isSafeInteger(cents)||cents<100||cents>100000000)throw new Error('PAYPAL_AMOUNT_INVALID');
  return (cents/100).toFixed(2);
}

async function readJson(response){
  if(!response.ok||Number(response.headers.get('content-length')||0)>200000)throw new Error('PAYPAL_GATEWAY_UNAVAILABLE');
  const text=await response.text();
  if(text.length>200000)throw new Error('PAYPAL_GATEWAY_UNAVAILABLE');
  try{return JSON.parse(text);}catch{throw new Error('PAYPAL_GATEWAY_INVALID_RESPONSE');}
}

async function token(config,fetchImpl){
  const response=await fetchImpl(`${bases[config.mode]}/v1/oauth2/token`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
    headers:{Authorization:`Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:'grant_type=client_credentials'});
  const data=await readJson(response);
  if(typeof data.access_token!=='string'||data.access_token.length<20)throw new Error('PAYPAL_GATEWAY_INVALID_RESPONSE');
  return data.access_token;
}

async function request(config,path,{method='GET',body,idempotencyKey}={},fetchImpl=fetch){
  if(!bases[config.mode])throw new Error('PAYPAL_CONFIG_INVALID');
  const accessToken=await token(config,fetchImpl);
  const headers={Authorization:`Bearer ${accessToken}`,Accept:'application/json','Content-Type':'application/json',Prefer:'return=representation'};
  if(idempotencyKey)headers['PayPal-Request-Id']=idempotencyKey;
  const response=await fetchImpl(`${bases[config.mode]}${path}`,{method,headers,body:body?JSON.stringify(body):undefined,
    redirect:'error',signal:AbortSignal.timeout(10000)});
  return readJson(response);
}

export async function createPayPalOrder(order,config,fetchImpl=fetch){
  const data=await request(config,'/v2/checkout/orders',{method:'POST',idempotencyKey:`NQPP-CREATE-${order.id}`,
    body:{intent:'CAPTURE',purchase_units:[{reference_id:`NQPP${order.id}`,custom_id:`NQPP${order.id}`,
      payee:{merchant_id:config.merchantId},description:'Nexus Quant points recharge',
      amount:{currency_code:'USD',value:usd(order.usd_cents)}}]}},fetchImpl);
  if(!orderIdPattern.test(data.id||'')||!['CREATED','PAYER_ACTION_REQUIRED','APPROVED'].includes(data.status))throw new Error('PAYPAL_GATEWAY_INVALID_RESPONSE');
  return data.id;
}

export async function getPayPalOrder(paypalOrderId,config,fetchImpl=fetch){
  if(!orderIdPattern.test(paypalOrderId||''))throw new Error('PAYPAL_ORDER_INVALID');
  return request(config,`/v2/checkout/orders/${paypalOrderId}`,{},fetchImpl);
}

export async function capturePayPalOrder(paypalOrderId,localOrderId,config,fetchImpl=fetch){
  if(!orderIdPattern.test(paypalOrderId||''))throw new Error('PAYPAL_ORDER_INVALID');
  return request(config,`/v2/checkout/orders/${paypalOrderId}/capture`,
    {method:'POST',idempotencyKey:`NQPP-CAPTURE-${localOrderId}`,body:{}},fetchImpl);
}

export function verifiedPayPalCapture(data,order,merchantId){
  if(data?.id!==order.paypal_order_id||data?.status!=='COMPLETED'||!Array.isArray(data.purchase_units)||data.purchase_units.length!==1)
    throw new Error('PAYPAL_CAPTURE_NOT_VERIFIED');
  const unit=data.purchase_units[0];
  const captures=unit?.payments?.captures;
  // PayPal may omit purchase-unit metadata from a capture response. The order ID was
  // created by our authenticated server and is bound to this local order already.
  if((unit.custom_id&&unit.custom_id!==`NQPP${order.id}`)||
    (unit.reference_id&&unit.reference_id!==`NQPP${order.id}`)||
    !Array.isArray(captures)||captures.length!==1)throw new Error('PAYPAL_CAPTURE_NOT_VERIFIED');
  const capture=captures[0];
  const amount=usd(order.usd_cents);
  const paidAt=Date.parse(capture?.create_time||'');
  if(capture?.status!=='COMPLETED'||!orderIdPattern.test(capture.id||'')||
    capture.amount?.currency_code!=='USD'||capture.amount?.value!==amount||
    (unit.amount&&(unit.amount.currency_code!=='USD'||unit.amount.value!==amount))||
    (unit.payee?.merchant_id&&unit.payee.merchant_id!==merchantId)||
    (capture.payee?.merchant_id&&capture.payee.merchant_id!==merchantId)||
    !Number.isSafeInteger(paidAt)||paidAt<order.created_at-1000||paidAt>order.expires_at)
    throw new Error('PAYPAL_CAPTURE_NOT_VERIFIED');
  return {captureId:capture.id,paidAt,usdCents:order.usd_cents};
}
