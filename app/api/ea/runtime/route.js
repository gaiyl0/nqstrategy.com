import { withApiErrors } from '@/lib/api-errors';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {parseJson} from '@/lib/validation';
import {authorizeRuntime,receiveEaHeartbeat} from '@/lib/ea-runtime';
import {createSecurityContext,enforceRateLimits,RATE_LIMITS,withAudit,hashSecurityValue} from '@/lib/security';

export const dynamic='force-dynamic';
const identity={productId:z.number().int().positive(),account:z.string().regex(/^[1-9][0-9]{0,23}$/),server:z.string().trim().min(1).max(100),device:z.string().regex(/^[a-f0-9]{64}$/i)};
const amount=z.number().finite().min(-1e12).max(1e12);
const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('authorize'),code:z.string().trim().regex(/^NQ-[A-Fa-f0-9]{40}$/),...identity}).strict(),
  z.object({action:z.literal('heartbeat'),token:z.string().regex(/^NQT-[a-f0-9]{64}$/),...identity,sequence:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),currency:z.string().regex(/^[A-Z0-9]{3,10}$/),balance:amount,equity:amount,floatingProfit:amount,freeMargin:amount,positionsCount:z.number().int().min(0).max(10000),eaPositionsCount:z.number().int().min(0).max(10000),eaFloatingProfit:amount}).strict(),
]);
async function POSTHandler(request) {
  // This endpoint never uses browser cookies. The authorization code or per-connection credential is mandatory.
  const context=createSecurityContext(request,null),limited=enforceRateLimits(context,'ea.runtime.ip',[{policy:RATE_LIMITS.licenseVerify,identifier:context.sourceHash}]);
  if(limited)return limited;
  const parsed=await parseJson(request,schema);
  if(!parsed.success)return parsed.response;
  const body=parsed.data,credentialHash=hashSecurityValue('ea-runtime',body.code||body.token);
  const credentialLimited=enforceRateLimits(context,'ea.runtime.credential',[{policy:{scope:'ea.runtime.credential',limit:10,windowMs:60000},identifier:credentialHash}]);
  if(credentialLimited)return credentialLimited;
  try{
    const result=body.action==='authorize'?authorizeRuntime(body):receiveEaHeartbeat(body);
    return NextResponse.json({success:true,...result},{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    const status=error.message==='EA_TOO_FREQUENT'?429:error.message==='EA_REPLAYED'?409:401;
    return withAudit(context,NextResponse.json({success:false,valid:false,code:status===429?'SLOW_DOWN':status===409?'REPLAYED':'RUNTIME_DENIED',message:'授权或连接无效、过期、绑定不匹配或上报过于频繁'},{status,headers:{'Cache-Control':'no-store',...(status===429?{'Retry-After':'30'}:{})}}),{eventType:'ea.runtime.denied',outcome:'blocked',reasonCode:error.message,targetType:'product',targetId:body.productId});
  }
}
export const POST = withApiErrors(POSTHandler,{route:'/api/ea/runtime'});
