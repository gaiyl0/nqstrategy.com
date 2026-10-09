import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiErrors } from '@/lib/api-errors';
import { getSessionUser } from '@/lib/auth';
import { parseJson } from '@/lib/validation';
import { adminPendingCounts, adminPointOverview, configurePointTask, createCustomPointTask, reviewPointClaim } from '@/lib/points';
import { createSecurityContext, enforceRateLimits, RATE_LIMITS, withAudit } from '@/lib/security';

export const dynamic='force-dynamic';

const targetUrl=z.union([z.literal(''),z.url().refine(value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}},'任务链接必须为 HTTPS 地址')]);
const taskFields={title:z.string().trim().min(2).max(100),description:z.string().trim().max(500),rewardPoints:z.number().int().min(0).max(1000000),targetUrl,proofLabel:z.string().trim().max(100),enabled:z.boolean()};
const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('update_task'),taskId:z.number().int().positive(),...taskFields}).strict(),
  z.object({action:z.literal('create_task'),...taskFields}).strict(),
  z.object({action:z.literal('review_claim'),claimId:z.number().int().positive(),approve:z.boolean(),note:z.string().trim().max(500).default('')}).strict(),
]);

async function GETHandler(request){
  const user=await getSessionUser();
  if(user?.role!=='admin')return NextResponse.json({success:false,message:'仅管理员可查看'},{status:user?403:401});
  const context=createSecurityContext(request,user);
  const limited=enforceRateLimits(context,'points.admin.read',[{policy:RATE_LIMITS.orderRead,identifier:`user:${user.id}`}]);
  if(limited)return limited;
  const summary=new URL(request.url).searchParams.get('view')==='summary';
  return NextResponse.json({success:true,...(summary?{pendingCounts:adminPendingCounts()}:adminPointOverview())},{headers:{'Cache-Control':'private, no-store'}});
}

async function POSTHandler(request){
  const user=await getSessionUser();
  if(user?.role!=='admin')return NextResponse.json({success:false,message:'仅管理员可操作'},{status:user?403:401});
  const context=createSecurityContext(request,user);
  const limited=enforceRateLimits(context,'points.admin.write',[{policy:RATE_LIMITS.orderAdmin,identifier:`user:${user.id}`}]);
  if(limited)return limited;
  const parsed=await parseJson(request,schema);
  if(!parsed.success)return parsed.response;
  const body=parsed.data;
  const audited=(response,outcome,reasonCode)=>withAudit(context,response,{eventType:'points.admin.write',outcome,reasonCode,metadata:{action:body.action,taskId:body.taskId,claimId:body.claimId,productId:body.productId}});
  try{
    let result={};
    if(body.action==='update_task')configurePointTask(body.taskId,body);
    if(body.action==='create_task')result={taskId:createCustomPointTask(body)};
    if(body.action==='review_claim')result=reviewPointClaim(user.id,body.claimId,body.approve,body.note);
    return audited(NextResponse.json({success:true,...result}),'success',body.action.toUpperCase());
  }catch(error){
    const known={TASK_NOT_FOUND:['任务不存在',404],CLAIM_NOT_FOUND:['提交记录不存在',404],CLAIM_ALREADY_REVIEWED:['该提交已处理，请刷新列表',409],BROKER_PROOF_REQUIRED:['缺少 TMGM 入金核验资料',409]};
    const [message,status]=known[error.message]||['积分后台操作失败',500];
    return audited(NextResponse.json({success:false,message},{status}),'failure',error.message||'INTERNAL_ERROR');
  }
}

export const GET = withApiErrors(GETHandler,{route:'/api/points/admin'});
export const POST = withApiErrors(POSTHandler,{route:'/api/points/admin'});
