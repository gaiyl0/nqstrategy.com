import { affectsPoints, notifyPointChange } from './point-refresh.mjs';

export class ApiError extends Error {
  constructor(message,{status=0,code='API_ERROR',requestId=null,retryAfter=null,payload=null,cause}={}){
    super(message,{cause});this.name='ApiError';this.status=status;this.code=code;this.requestId=requestId;this.retryAfter=retryAfter;this.payload=payload;
  }
}

async function responsePayload(response){
  if(response.status===204||response.status===205)return null;
  const copy=response.clone();
  const type=String(copy.headers.get('content-type')||'').toLowerCase();
  if(type.includes('application/json')){try{return await copy.json();}catch{return null;}}
  // Successful downloads can be large binary files. Leave their body untouched;
  // callers still receive the original Response and may consume it as a blob.
  if(response.ok)return null;
  try{const text=(await copy.text()).trim();return text?{message:text.slice(0,500)}:null;}catch{return null;}
}

export async function apiFetch(input,init={},fetchImpl=globalThis.fetch){
  let response;
  try{response=await fetchImpl(input,init);}catch(error){
    if(error?.name==='AbortError')throw error;
    throw new ApiError('网络连接失败，请检查网络后重试',{code:'NETWORK_ERROR',cause:error});
  }
  const payload=await responsePayload(response);
  if(!response.ok||payload?.success===false){
    const status=response.status;
    const fallback=status===401?'登录已失效，请重新登录':status===403?'没有执行此操作的权限':status===409?'数据状态已变化，请刷新后重试':status===422?'提交的数据无法处理':status===429?'操作过于频繁，请稍后再试':status>=500?'服务暂时异常，请稍后重试':'请求失败，请重试';
    throw new ApiError(payload?.message||fallback,{status,code:payload?.code||(response.ok?'API_REJECTED':`HTTP_${status}`),requestId:response.headers.get('x-request-id'),retryAfter:Number(response.headers.get('retry-after'))||null,payload});
  }
  if(payload?.success === true && affectsPoints(input, init, payload)) notifyPointChange();
  return response;
}

export async function apiJson(input,{json,...init}={},fetchImpl=globalThis.fetch){
  const headers=new Headers(init.headers||{});let body=init.body;
  if(json!==undefined){headers.set('Content-Type','application/json');body=JSON.stringify(json);}
  const response=await apiFetch(input,{...init,headers,body},fetchImpl);
  if(response.status===204||response.status===205)return null;
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(!type.includes('application/json'))throw new ApiError('服务器返回了无法识别的数据格式',{status:response.status,code:'INVALID_RESPONSE_TYPE',requestId:response.headers.get('x-request-id')});
  try{return await response.json();}catch(error){throw new ApiError('服务器返回了损坏的 JSON 数据',{status:response.status,code:'INVALID_JSON_RESPONSE',requestId:response.headers.get('x-request-id'),cause:error});}
}

export function apiErrorMessage(error,fallback='操作失败，请重试'){
  return error instanceof ApiError&&error.message?error.message:fallback;
}
