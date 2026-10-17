import { withApiErrors } from '@/lib/api-errors';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSessionUser} from '@/lib/auth';
import {parseJson} from '@/lib/validation';
import {giftPoints,listPointGifts} from '@/lib/admin-point-gifts';
import {createSecurityContext,enforceRateLimits,RATE_LIMITS,withAudit} from '@/lib/security';

export const dynamic='force-dynamic';
async function GETHandler(request) {
  const user=await getSessionUser();
  if(user?.role!=='admin')return NextResponse.json({success:false,message:'仅管理员可查看赠分记录'},{status:user?403:401});
  const context=createSecurityContext(request,user),limited=enforceRateLimits(context,'points.gifts.read',[{policy:RATE_LIMITS.orderRead,identifier:`user:${user.id}`}]);
  if(limited)return limited;
  return NextResponse.json({success:true,items:listPointGifts(user)},{headers:{'Cache-Control':'private, no-store'}});
}
async function POSTHandler(request) {
  const user=await getSessionUser(),context=createSecurityContext(request,user);
  if(user?.role!=='admin')return NextResponse.json({success:false,message:'仅管理员可赠送积分'},{status:user?403:401});
  const limited=enforceRateLimits(context,'points.gifts.write',[{policy:RATE_LIMITS.orderAdmin,identifier:`user:${user.id}`}]);
  if(limited)return limited;
  const parsed=await parseJson(request,z.object({userId:z.number().int().positive(),points:z.number().positive().max(1000000),reason:z.string().trim().min(3).max(300),requestKey:z.string().regex(/^[-a-zA-Z0-9]{16,80}$/)}).strict());
  if(!parsed.success)return parsed.response;
  const body=parsed.data,audit=(response,outcome,reasonCode)=>withAudit(context,response,{eventType:'points.admin.gift',outcome,reasonCode,targetType:'user',targetId:body.userId,metadata:{points:body.points,reason:body.reason}});
  try{return audit(NextResponse.json({success:true,...giftPoints(user,body.userId,body.points,body.reason,body.requestKey)}),'success','GIFTED');}
  catch(error){const known={GIFT_INVALID:['积分最多保留两位小数，请检查填写内容',400],GIFT_KEY_CONFLICT:['重复请求内容发生变化，请刷新后重试',409],GIFT_USER_UNAVAILABLE:['用户不存在或已停用',404],GIFT_FORBIDDEN:['无赠分权限',403]};const [message,status]=known[error.message]||['赠送失败，请稍后重试',500];return audit(NextResponse.json({success:false,message},{status}),'failure',error.message);}
}
export const GET = withApiErrors(GETHandler,{route:'/api/points/gifts'});
export const POST = withApiErrors(POSTHandler,{route:'/api/points/gifts'});
