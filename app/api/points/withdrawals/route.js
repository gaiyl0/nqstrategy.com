import {NextResponse} from 'next/server';
import {z} from 'zod';
import { withApiErrors } from '@/lib/api-errors';
import {getSessionUser} from '@/lib/auth';
import {parseJson} from '@/lib/validation';
import {listPointWithdrawals,requestPointWithdrawal,reviewPointWithdrawal} from '@/lib/point-assets';
import {notifyUser} from '@/lib/inbox';
import db from '@/lib/db';
import {createSecurityContext,enforceRateLimits,RATE_LIMITS,withAudit} from '@/lib/security';

export const dynamic='force-dynamic';
const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('request'),points:z.number().min(100).max(1000000).multipleOf(0.01),note:z.string().trim().min(5).max(200)}).strict(),
  z.object({action:z.literal('review'),id:z.number().int().positive(),approve:z.boolean(),note:z.string().trim().max(500).default('')}).strict(),
]);
const known={WITHDRAWAL_FORBIDDEN:['仅开发者可申请提现',403],WITHDRAWAL_AMOUNT_INVALID:['提现至少 100 积分，最多保留两位小数',400],WITHDRAWAL_PAYOUT_DETAILS_INVALID:['请填写收款方式和收款账号，勿填写密码',400],WITHDRAWAL_PENDING:['已有待审核申请',409],INSUFFICIENT_WITHDRAWABLE_POINTS:['可提现的充值来源积分不足',409],WITHDRAWAL_NOT_FOUND:['申请不存在',404],WITHDRAWAL_ALREADY_REVIEWED:['申请已处理',409]};

async function GETHandler(request){const user=await getSessionUser();if(!user)return NextResponse.json({success:false,message:'请先登录'},{status:401});const context=createSecurityContext(request,user);const limited=enforceRateLimits(context,'points.withdrawals.read',[{policy:RATE_LIMITS.withdrawalRead,identifier:`user:${user.id}`}]);if(limited)return limited;return NextResponse.json({success:true,withdrawals:listPointWithdrawals(user,{ownOnly:new URL(request.url).searchParams.get('scope')==='mine'})});}

async function POSTHandler(request){const user=await getSessionUser();if(!user)return NextResponse.json({success:false,message:'请先登录'},{status:401});const context=createSecurityContext(request,user);const limited=enforceRateLimits(context,'points.withdrawals.write',[{policy:RATE_LIMITS.withdrawalCreateShort,identifier:`user:${user.id}`}]);if(limited)return limited;const parsed=await parseJson(request,schema);if(!parsed.success)return parsed.response;const body=parsed.data;const audited=(response,outcome,reasonCode)=>withAudit(context,response,{eventType:'points.withdrawal',outcome,reasonCode,metadata:{action:body.action,withdrawalId:body.id}});
  try{let result;
    if(body.action==='request'){
      result=requestPointWithdrawal(user.id,body.points,body.note);
      for(const admin of db.prepare("SELECT id FROM users WHERE role='admin' AND deleted_at IS NULL").all())try{notifyUser(admin.id,'withdrawal','新的积分提现申请',`${user.username} 申请提现 ${result.points} 积分。`,'/tianwei');}catch{ /* Withdrawal is already committed; notification is best effort. */ }
    }else{
      if(user.role!=='admin')return audited(NextResponse.json({success:false,message:'仅管理员可审核'},{status:403}),'failure','FORBIDDEN');
      if(body.approve&&body.note.length<3)return audited(NextResponse.json({success:false,message:'请填写线下打款凭证或交易参考号'},{status:400}),'failure','PAYOUT_REFERENCE_REQUIRED');
      result=reviewPointWithdrawal(user.id,body.id,body.approve,body.note);
      try{notifyUser(result.userId,'withdrawal',body.approve?'积分提现已确认':'积分提现已驳回',body.approve?`已确认打款 ${result.points} 元人民币。`:body.note,'/?route=profile');}catch{ /* Review outcome remains authoritative. */ }
    }
    return audited(NextResponse.json({success:true,...result},{status:body.action==='request'?201:200}),'success',body.action.toUpperCase());
  }catch(error){const [message,status]=known[error.message]||['提现操作失败',500];return audited(NextResponse.json({success:false,message},{status}),'failure',error.message||'INTERNAL_ERROR');}
}
export const GET = withApiErrors(GETHandler,{route:'/api/points/withdrawals'});
export const POST = withApiErrors(POSTHandler,{route:'/api/points/withdrawals'});
