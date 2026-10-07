import {NextResponse} from 'next/server';
import {z} from 'zod';
import { withApiErrors } from '@/lib/api-errors';
import {getSessionUser} from '@/lib/auth';
import {parseJson} from '@/lib/validation';
import {createSecurityContext,enforceRateLimits,RATE_LIMITS,withAudit} from '@/lib/security';
import {createPointCheckout,pointRechargeOrder} from '@/lib/point-payment-service';
import {pointCheckoutEnabled} from '@/lib/point-payment-config';

export const dynamic='force-dynamic';
const schema=z.object({provider:z.enum(['wechat','alipay']),points:z.number().min(1).max(1000000).multipleOf(0.01),requestKey:z.uuid()}).strict();
const noStore={'Cache-Control':'no-store'};

async function GETHandler(request){
  const user=await getSessionUser();
  if(!user)return NextResponse.json({success:false,message:'请先登录'},{status:401,headers:noStore});
  const orderId=Number(new URL(request.url).searchParams.get('orderId'));
  if(!Number.isSafeInteger(orderId)||orderId<=0)return NextResponse.json({success:false,message:'订单号无效'},{status:400,headers:noStore});
  const context=createSecurityContext(request,user);
  const limited=enforceRateLimits(context,'points.recharge.read',[{policy:RATE_LIMITS.orderRead,identifier:`user:${user.id}`}]);
  if(limited)return limited;
  try{
    const order=pointRechargeOrder(orderId,user.id);
    return NextResponse.json({success:true,order:{id:order.id,provider:order.provider,points:order.points_units/100,cnyFen:order.cny_fen,
      cnyFenPerUsd:order.cny_fen_per_usd,status:order.status,createdAt:order.created_at,expiresAt:order.expires_at}},{headers:noStore});
  }catch{return NextResponse.json({success:false,message:'充值订单不存在'},{status:404,headers:noStore});}
}

async function POSTHandler(request){
  const user=await getSessionUser();
  if(!user)return NextResponse.json({success:false,message:'请先登录'},{status:401,headers:noStore});
  if(!pointCheckoutEnabled(user.id))return NextResponse.json({success:false,message:'积分充值尚未开放'},{status:503,headers:noStore});
  const context=createSecurityContext(request,user);
  const limited=enforceRateLimits(context,'points.recharge.create',[{policy:RATE_LIMITS.orderCreateShort,identifier:`user:${user.id}`},
    {policy:RATE_LIMITS.orderCreateDaily,identifier:`user:${user.id}`}]);
  if(limited)return limited;
  const parsed=await parseJson(request,schema);
  if(!parsed.success)return parsed.response;
  const audited=(response,outcome,reasonCode)=>withAudit(context,response,{eventType:'points.recharge',outcome,reasonCode,
    metadata:{provider:parsed.data.provider}});
  try{
    const result=await createPointCheckout(user.id,parsed.data.points,parsed.data.provider,parsed.data.requestKey);
    return audited(NextResponse.json({success:true,checkout:result},{status:201,headers:noStore}),'success','CHECKOUT_CREATED');
  }catch(error){
    const known={RECHARGE_RATE_UNSET:['管理员尚未设置人民币充值汇率',409],RECHARGE_ORDER_NOT_PAYABLE:['订单已过期，请重新下单',409],
      RECHARGE_KEY_CONFLICT:['重复请求的内容与原订单不同',409],WECHAT_PAYMENT_CONFIG_UNAVAILABLE:['微信支付尚未配置完成',503],
      ALIPAY_PAYMENT_CONFIG_UNAVAILABLE:['支付宝尚未配置完成',503]};
    const [message,status]=known[error.message]||['支付平台暂不可用，请稍后重试',503];
    return audited(NextResponse.json({success:false,message},{status,headers:noStore}),'failure',error.message||'CHECKOUT_FAILED');
  }
}

export const GET = withApiErrors(GETHandler,{route:'/api/points/recharge'});
export const POST = withApiErrors(POSTHandler,{route:'/api/points/recharge'});
