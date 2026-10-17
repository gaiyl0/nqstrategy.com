import { withApiErrors } from '@/lib/api-errors';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSessionUser} from '@/lib/auth';
import {parseJson} from '@/lib/validation';
import {attachReferralDevice,readReferralDevice,referralState,listReferralReviews,reviewReferral} from '@/lib/referrals';
import {createSecurityContext,enforceRateLimits,RATE_LIMITS,withAudit} from '@/lib/security';

export const dynamic='force-dynamic';
async function GETHandler(request) {
  const user=await getSessionUser(),context=createSecurityContext(request,user);
  const limited=enforceRateLimits(context,'referrals.read',[{policy:RATE_LIMITS.orderRead,identifier:user?`user:${user.id}`:context.sourceHash}]);
  if(limited)return limited;
  const url=new URL(request.url);
  if(url.searchParams.get('view')==='identity')return attachReferralDevice(NextResponse.json({success:true}),request);
  if(!user)return NextResponse.json({success:false,message:'请先登录'},{status:401});
  if(url.searchParams.get('scope')==='admin'){
    if(user.role!=='admin')return NextResponse.json({success:false,message:'仅管理员可查看'},{status:403});
    const page=Math.max(1,Math.min(100000,parseInt(url.searchParams.get('page')||'1',10)||1));
    return NextResponse.json({success:true,...listReferralReviews(user,{page})},{headers:{'Cache-Control':'private, no-store'}});
  }
  const state=referralState(user.id,{deviceHash:readReferralDevice(request),sourceHash:context.sourceHash,sourceTrusted:context.sourceTrusted});
  return attachReferralDevice(NextResponse.json({success:true,...state}),request);
}
async function POSTHandler(request) {
  const user=await getSessionUser(),context=createSecurityContext(request,user);
  if(user?.role!=='admin')return NextResponse.json({success:false,message:'仅管理员可核验邀请'},{status:user?403:401});
  const limited=enforceRateLimits(context,'referrals.review',[{policy:RATE_LIMITS.orderAdmin,identifier:`user:${user.id}`}]);
  if(limited)return limited;
  const parsed=await parseJson(request,z.object({id:z.number().int().positive(),approve:z.boolean(),note:z.string().trim().min(3).max(300)}).strict());
  if(!parsed.success)return parsed.response;
  const audit=(response,outcome,reasonCode)=>withAudit(context,response,{eventType:'referral.review',outcome,reasonCode,targetType:'referral',targetId:parsed.data.id});
  try{return audit(NextResponse.json({success:true,...reviewReferral(user,parsed.data.id,parsed.data.approve,parsed.data.note)}),'success','REVIEWED');}
  catch(error){const known={REFERRAL_NOT_FOUND:['邀请记录不存在',404],REFERRAL_ALREADY_REVIEWED:['邀请已处理，请刷新',409],REFERRAL_COOLDOWN:['24 小时冷静期尚未结束',409],REFERRAL_ACCOUNT_UNAVAILABLE:['双方账号和邮箱必须有效',409]};const [message,status]=known[error.message]||['邀请审核失败',500];return audit(NextResponse.json({success:false,message},{status}),'failure',error.message);}
}
export const GET = withApiErrors(GETHandler,{route:'/api/referrals'});
export const POST = withApiErrors(POSTHandler,{route:'/api/referrals'});
