import {NextResponse} from 'next/server';
import {z} from 'zod';
import { withApiErrors } from '@/lib/api-errors';
import {getSessionUser} from '@/lib/auth';
import {parseJson} from '@/lib/validation';
import {createSecurityContext,enforceRateLimits,RATE_LIMITS,withAudit} from '@/lib/security';
import {pointCheckoutEnabled,paypalPaymentConfig} from '@/lib/point-payment-config';
import {capturePayPalPointCheckout,createPayPalPointCheckout,paypalPointOrder} from '@/lib/paypal-point-service';

export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store'};
const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('create'),points:z.number().min(1).max(1000000).multipleOf(0.01),requestKey:z.uuid()}).strict(),
  z.object({action:z.literal('capture'),orderId:z.number().int().positive(),paypalOrderId:z.string().regex(/^[A-Z0-9]{10,30}$/)}).strict(),
]);

async function GETHandler(request){
  const user=await getSessionUser();
  if(!user)return NextResponse.json({success:false,message:'请先登录'},{status:401,headers:noStore});
  if(!pointCheckoutEnabled(user.id))return NextResponse.json({success:false,message:'PayPal 积分充值尚未开放'},{status:503,headers:noStore});
  let config;
  try{config=paypalPaymentConfig();}catch{return NextResponse.json({success:false,message:'PayPal 商户资料尚未配置'},{status:503,headers:noStore});}
  const orderId=new URL(request.url).searchParams.get('orderId');
  if(!orderId)return NextResponse.json({success:true,clientId:config.clientId,mode:config.mode,currency:'USD'},{headers:noStore});
  const context=createSecurityContext(request,user);
  const limited=enforceRateLimits(context,'points.paypal.read',[{policy:RATE_LIMITS.orderRead,identifier:`user:${user.id}`}]);
  if(limited)return limited;
  try{
    const order=paypalPointOrder(Number(orderId),user.id);
    return NextResponse.json({success:true,order:{id:order.id,points:order.points_units/100,usdCents:order.usd_cents,
      status:order.status,expiresAt:order.expires_at}},{headers:noStore});
  }catch{return NextResponse.json({success:false,message:'充值订单不存在'},{status:404,headers:noStore});}
}

async function POSTHandler(request){
  const user=await getSessionUser();
  if(!user)return NextResponse.json({success:false,message:'请先登录'},{status:401,headers:noStore});
  if(!pointCheckoutEnabled(user.id))return NextResponse.json({success:false,message:'PayPal 积分充值尚未开放'},{status:503,headers:noStore});
  const context=createSecurityContext(request,user);
  const parsed=await parseJson(request,schema);
  if(!parsed.success)return parsed.response;
  const limits=parsed.data.action==='create'?
    [{policy:RATE_LIMITS.orderCreateShort,identifier:`user:${user.id}`},
      {policy:RATE_LIMITS.orderCreateDaily,identifier:`user:${user.id}`}]:
    [{policy:RATE_LIMITS.orderRead,identifier:`user:${user.id}`}];
  const limited=enforceRateLimits(context,`points.paypal.${parsed.data.action}`,limits);
  if(limited)return limited;
  const audited=(response,outcome,reasonCode)=>withAudit(context,response,{eventType:'points.paypal',outcome,reasonCode,
    metadata:{action:parsed.data.action}});
  try{
    if(parsed.data.action==='create'){
      const checkout=await createPayPalPointCheckout(user.id,parsed.data.points,parsed.data.requestKey);
      return audited(NextResponse.json({success:true,checkout},{status:201,headers:noStore}),'success','PAYPAL_CHECKOUT_CREATED');
    }
    const settlement=await capturePayPalPointCheckout(user.id,parsed.data.orderId,parsed.data.paypalOrderId);
    return audited(NextResponse.json({success:true,settlement},{headers:noStore}),'success','PAYPAL_CAPTURE_VERIFIED');
  }catch(error){
    const known={PAYPAL_CNY_RECHARGE_UNAVAILABLE:['人民币积分充值暂不使用旧版美元 PayPal 通道',503],PAYPAL_PAYMENT_CONFIG_UNAVAILABLE:['PayPal 商户资料尚未配置',503],RECHARGE_KEY_CONFLICT:['重复请求的内容与原订单不同',409],
      PAYPAL_ORDER_NOT_FOUND:['充值订单不存在',404],PAYPAL_ORDER_MISMATCH:['PayPal 订单与本站订单不匹配',409],
      PAYPAL_ORDER_NOT_PAYABLE:['订单已过期，请重新下单',409],PAYPAL_CAPTURE_NOT_VERIFIED:['PayPal 支付尚未核验通过',409]};
    const [message,status]=known[error.message]||['PayPal 暂不可用，请稍后重试',503];
    return audited(NextResponse.json({success:false,message},{status,headers:noStore}),'failure',error.message||'PAYPAL_REQUEST_FAILED');
  }
}

export const GET = withApiErrors(GETHandler,{route:'/api/points/paypal'});
export const POST = withApiErrors(POSTHandler,{route:'/api/points/paypal'});
