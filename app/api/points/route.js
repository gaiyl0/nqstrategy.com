import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiErrors } from '@/lib/api-errors';
import { getSessionUser } from '@/lib/auth';
import { parseJson } from '@/lib/validation';
import { awardDailyAction, pointState, redeemWithPoints, submitPointClaim } from '@/lib/points';
import { createSecurityContext, enforceRateLimits, RATE_LIMITS, withAudit } from '@/lib/security';

export const dynamic='force-dynamic';

const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('checkin')}).strict(),
  z.object({action:z.literal('redeem'),productId:z.number().int().positive()}).strict(),
  z.object({action:z.literal('submit_claim'),taskId:z.number().int().positive(),contactEmail:z.union([z.literal(''),z.email()]).default(''),customerId:z.string().trim().max(80).default(''),proofText:z.string().trim().max(500).default('')}).strict(),
]);

async function GETHandler(request){
  const user=await getSessionUser();
  if(!user)return NextResponse.json({success:false,message:'请先登录'},{status:401});
  const context=createSecurityContext(request,user);
  const limited=enforceRateLimits(context,'points.read',[{policy:RATE_LIMITS.orderRead,identifier:`user:${user.id}`}]);
  if(limited)return limited;
  return NextResponse.json({success:true,...pointState(user.id)});
}

async function POSTHandler(request){
  const user=await getSessionUser();
  if(!user)return NextResponse.json({success:false,message:'请先登录'},{status:401});
  const context=createSecurityContext(request,user);
  const limited=enforceRateLimits(context,'points.write',[{policy:RATE_LIMITS.socialWrite,identifier:`user:${user.id}`}]);
  if(limited)return limited;
  const parsed=await parseJson(request,schema);
  if(!parsed.success)return parsed.response;
  const body=parsed.data;
  const audited=(response,outcome,reasonCode)=>withAudit(context,response,{eventType:'points.write',outcome,reasonCode,metadata:{action:body.action}});
  try{
    const result=body.action==='checkin'?awardDailyAction(user.id,'daily_checkin')
      :body.action==='redeem'?redeemWithPoints(user,body.productId)
      :{claimId:submitPointClaim(user.id,body.taskId,body)};
    return audited(NextResponse.json({success:true,...result},{status:body.action==='checkin'?200:201}),'success',body.action.toUpperCase());
  }catch(error){
    const known={
      INSUFFICIENT_POINTS:['积分不足',409],POINT_PRICE_UNAVAILABLE:['该策略暂未开放积分兑换',409],
      PRODUCT_UNAVAILABLE:['策略不存在或已下架',404],VERSION_UNAVAILABLE:['该策略尚无可下载的已发布版本',409],SELF_PURCHASE:['不能兑换自己发布的策略',409],ALREADY_OWNED:['您已拥有该策略',409],
      TASK_UNAVAILABLE:['任务未开放',404],TASK_LINK_UNAVAILABLE:['任务链接尚未配置',409],BROKER_PROOF_REQUIRED:['请填写 TMGM 注册邮箱和客户 ID',400],PROOF_REQUIRED:['请填写任务证明信息',400],CLAIM_EXISTS:['任务已提交或已完成，请勿重复提交',409],
    };
    const [message,status]=known[error.message]||['积分操作失败',500];
    return audited(NextResponse.json({success:false,message},{status}),'failure',error.message||'INTERNAL_ERROR');
  }
}

export const GET = withApiErrors(GETHandler,{route:'/api/points'});
export const POST = withApiErrors(POSTHandler,{route:'/api/points'});
