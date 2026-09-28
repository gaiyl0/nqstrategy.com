import assert from 'node:assert/strict';
import {ApiError,apiErrorMessage,apiFetch,apiJson} from '../lib/api-client.js';

let assertions=0;const equal=(a,b,m)=>{assert.deepEqual(a,b,m);assertions+=1;};const rejects=async(fn,check)=>{await assert.rejects(fn,error=>{check(error);return true;});assertions+=1;};
const response=(body,{status=200,type='application/json',headers={}}={})=>new Response(type==='application/json'?JSON.stringify(body):body,{status,headers:{'content-type':type,...headers}});
equal(await apiJson('/ok',{},async()=>response({success:true,value:7})),{success:true,value:7});
equal(await apiJson('/settings',{},async()=>response({siteName:'Nexus'})),{siteName:'Nexus'});
equal(await apiJson('/empty',{},async()=>new Response(null,{status:204})),null);
const binary=new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'application/octet-stream'}});equal(await (await apiFetch('/download',{},async()=>binary)).arrayBuffer().then(value=>value.byteLength),3);
await rejects(()=>apiJson('/business',{},async()=>response({success:false,code:'CONFLICT',message:'已经处理'})),error=>{equal(error instanceof ApiError,true);equal(error.code,'CONFLICT');equal(error.message,'已经处理');});
await rejects(()=>apiJson('/forbidden',{},async()=>response({success:false,message:'权限不足'},{status:403,headers:{'x-request-id':'req-1'}})),error=>{equal(error.status,403);equal(error.requestId,'req-1');equal(apiErrorMessage(error),'权限不足');});
await rejects(()=>apiJson('/limited',{},async()=>response({success:false},{status:429,headers:{'retry-after':'30'}})),error=>{equal(error.retryAfter,30);equal(error.message,'操作过于频繁，请稍后再试');});
await rejects(()=>apiJson('/html',{},async()=>response('<html>bad</html>',{type:'text/html'})),error=>equal(error.code,'INVALID_RESPONSE_TYPE'));
await rejects(()=>apiFetch('/network',{},async()=>{throw new TypeError('offline');}),error=>{equal(error.code,'NETWORK_ERROR');equal(error.status,0);});
const abort=new DOMException('aborted','AbortError');await assert.rejects(()=>apiFetch('/abort',{},async()=>{throw abort;}),error=>error===abort);assertions+=1;
let received;await apiJson('/json',{method:'POST',json:{a:1},headers:{'X-Test':'yes'}},async(_url,init)=>{received=init;return response({success:true});});
equal(received.method,'POST');equal(received.headers.get('content-type'),'application/json');equal(received.headers.get('x-test'),'yes');equal(received.body,'{"a":1}');
let successReached=false;try{await apiFetch('/admin-write',{},async()=>response({success:false,message:'拒绝写入'},{status:403}));successReached=true;}catch(error){equal(error.status,403);}equal(successReached,false);
console.log(`API client tests passed: ${assertions} assertions`);
