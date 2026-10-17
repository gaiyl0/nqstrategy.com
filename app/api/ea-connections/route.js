import { withApiErrors } from '@/lib/api-errors';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSessionUser} from '@/lib/auth';
import {parseJson} from '@/lib/validation';
import {createEaConnection,listEaConnections,revokeEaConnection,regenerateEaSetup} from '@/lib/ea-runtime';
import {createSecurityContext,enforceRateLimits,RATE_LIMITS,withAudit} from '@/lib/security';

export const dynamic='force-dynamic';
async function GETHandler(request) {
  const user=await getSessionUser();
  if(!user)return NextResponse.json({success:false,message:'请先登录'},{status:401});
  const context=createSecurityContext(request,user),limited=enforceRateLimits(context,'ea.connections.read',[{policy:RATE_LIMITS.orderRead,identifier:`user:${user.id}`}]);
  if(limited)return limited;
  return NextResponse.json({success:true,items:listEaConnections(user.id)},{headers:{'Cache-Control':'private, no-store'}});
}
async function POSTHandler(request) {
  const user=await getSessionUser(),context=createSecurityContext(request,user);
  if(!user)return NextResponse.json({success:false,message:'请先登录'},{status:401});
  const limited=enforceRateLimits(context,'ea.connections.write',[{policy:RATE_LIMITS.licenseWrite,identifier:`user:${user.id}`}]);
  if(limited)return limited;
  const parsed=await parseJson(request,z.discriminatedUnion('action',[
    z.object({action:z.literal('create'),licenseId:z.number().int().positive(),label:z.string().trim().min(1).max(60),consent:z.literal(true)}).strict(),
    z.object({action:z.literal('revoke'),id:z.number().int().positive()}).strict(),
    z.object({action:z.literal('reset_setup'),id:z.number().int().positive()}).strict(),
  ]));
  if(!parsed.success)return parsed.response;
  const body=parsed.data,audit=(response,outcome,reasonCode)=>withAudit(context,response,{eventType:'ea.connection.manage',outcome,reasonCode,targetType:'ea_connection',targetId:body.id,metadata:{action:body.action,licenseId:body.licenseId}});
  try{
    const result=body.action==='create'?createEaConnection(user,body):body.action==='reset_setup'?regenerateEaSetup(user.id,body.id):(revokeEaConnection(user.id,body.id),{});
    return audit(NextResponse.json({success:true,...result},{headers:{'Cache-Control':'private, no-store'}}),'success',body.action.toUpperCase());
  }catch(error){const known={EA_CONSENT_REQUIRED:['请确认数据上报范围',400],EA_LICENSE_REQUIRED:['需要有效的 EA 兑换授权',403],EA_CONNECTION_LIMIT:['最多保留 5 个连接，请先撤销不用的连接',409],EA_CONNECTION_NOT_FOUND:['连接不存在',404]};const [message,status]=known[error.message]||['账户连接操作失败',500];return audit(NextResponse.json({success:false,message},{status}),'failure',error.message);}
}
export const GET = withApiErrors(GETHandler,{route:'/api/ea-connections'});
export const POST = withApiErrors(POSTHandler,{route:'/api/ea-connections'});
