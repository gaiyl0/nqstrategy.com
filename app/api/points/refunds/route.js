import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSessionUser} from '@/lib/auth';
import {parseJson} from '@/lib/validation';
import { withApiErrors } from '@/lib/api-errors';
import {createSecurityContext,enforceRateLimits,RATE_LIMITS,withAudit} from '@/lib/security';
import {requestRechargeRefund,listRechargeRefunds,rejectRechargeRefund,checkRechargeRefund} from '@/lib/recharge-refunds';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('request'),orderId:z.number().int().positive(),points:z.number().min(0.01).max(1000000).multipleOf(0.01),reason:z.string().trim().min(2).max(300),requestKey:z.uuid()}).strict(),
  z.object({action:z.enum(['approve','query']),id:z.number().int().positive()}).strict(),
  z.object({action:z.literal('reject'),id:z.number().int().positive(),note:z.string().trim().min(2).max(300)}).strict(),
]);
async function GETHandler(request) {
  const user=await getSessionUser();
  if(!user)return NextResponse.json({success:false,message:'请先登录'},{status:401,headers});
  const limited=enforceRateLimits(createSecurityContext(request,user),'points.refund.read',[{policy:RATE_LIMITS.orderRead,identifier:`user:${user.id}`}]);
  if(limited)return limited;
  const page=Number(new URL(request.url).searchParams.get('page')||1);
  if(!Number.isSafeInteger(page)||page<1||page>1000000)return NextResponse.json({success:false,message:'页码无效'},{status:400,headers});
  return NextResponse.json({success:true,...listRechargeRefunds(user,{page})},{headers});
}
async function POSTHandler(request) {
  const user=await getSessionUser();
  if(!user)return NextResponse.json({success:false,message:'请先登录'},{status:401,headers});
  const parsed=await parseJson(request,schema);if(!parsed.success)return parsed.response;
  const body=parsed.data;
  if(body.action!=='request'&&user.role!=='admin')return NextResponse.json({success:false,message:'仅管理员可审核或补查退款'},{status:403,headers});
  const context=createSecurityContext(request,user);
  const limited=enforceRateLimits(context,'points.refund.write',[{policy:RATE_LIMITS.orderCreateShort,identifier:`user:${user.id}`}]);
  if(limited)return limited;
  const audited=(result,outcome,code)=>withAudit(context,result,{eventType:'points.recharge.refund',outcome,reasonCode:code,metadata:{action:body.action,refundId:body.id,orderId:body.orderId}});
  try {
    let result;
    if(body.action==='request'){
      const refund=requestRechargeRefund(user.id,{orderId:body.orderId,units:Math.round(body.points*100),reason:body.reason,requestKey:body.requestKey});
      result={id:refund.id,state:refund.status};
    }else if(body.action==='reject')result=rejectRechargeRefund(user,body.id,body.note);
    else result=await checkRechargeRefund(body.id,{admin:user,submit:body.action==='approve'});
    return audited(NextResponse.json({success:true,result},{headers}),result.errorCode?'failure':'success',result.errorCode||result.state.toUpperCase());
  }catch(error){
    const messages={REFUND_AMOUNT_UNAVAILABLE:'该订单没有足够的未消费人民币充值积分可退',REFUND_ALREADY_OPEN:'该充值订单已有未完成退款，请先处理原申请',REFUND_KEY_CONFLICT:'重复请求内容与原申请不同',REFUND_CANNOT_REJECT:'已向支付平台提交的退款不能直接驳回，请先补查',REFUND_NOT_FOUND:'退款申请不存在',REFUND_NOT_APPROVED:'退款尚未审核',REFUND_REQUEST_INVALID:'退款参数无效'};
    if(!messages[error.message])throw error;
    return audited(NextResponse.json({success:false,message:messages[error.message]},{status:409,headers}),'failure',error.message);
  }
}
export const GET = withApiErrors(GETHandler,{route:'/api/points/refunds'});
export const POST = withApiErrors(POSTHandler,{route:'/api/points/refunds'});
