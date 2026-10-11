import {NextResponse} from 'next/server';
import {getSessionUser} from '@/lib/auth';
import {financeOverview,financeCsv} from '@/lib/finance-overview';
import { withApiErrors } from '@/lib/api-errors';
import {createSecurityContext,enforceRateLimits,RATE_LIMITS,withAudit} from '@/lib/security';
import {checkPointRecharge} from '@/lib/recharge-reconciliation';
import {parseJson} from '@/lib/validation';
import {z} from 'zod';

export const dynamic='force-dynamic';
async function GETHandler(request){
  const user=await getSessionUser();
  if(user?.role!=='admin')return NextResponse.json({success:false,message:'仅管理员可查看财务流水'},{status:user?403:401});
  const limited=enforceRateLimits(createSecurityContext(request,user),'points.finance.read',[{policy:RATE_LIMITS.orderRead,identifier:`user:${user.id}`}]);
  if(limited)return limited;
  const params=new URL(request.url).searchParams;
  const options={view:params.get('view')||'recharges',page:params.has('page')?Number(params.get('page')):1,
    userId:params.has('userId')?Number(params.get('userId')):null,orderId:params.has('orderId')?Number(params.get('orderId')):null,
    from:params.get('from')||'',to:params.get('to')||'',status:params.get('status')||'',provider:params.get('provider')||''};
  try{
    if(params.get('format')==='csv'){
      const csv=financeCsv(user,options);
      return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="nexus-finance-${options.view}.csv"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
    }
    if(params.has('format'))throw Error('FINANCE_QUERY_INVALID');
    return NextResponse.json({success:true,...financeOverview(user,options)},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    if(error.message==='FINANCE_EXPORT_TOO_LARGE')return NextResponse.json({success:false,message:'导出超过 10000 条，请缩小日期或其他筛选范围'},{status:422});
    if(error.message!=='FINANCE_QUERY_INVALID')throw error;
    return NextResponse.json({success:false,message:'流水筛选参数无效'},{status:400});
  }
}
export const GET = withApiErrors(GETHandler,{route:'/api/points/finance'});

async function POSTHandler(request) {
  const user=await getSessionUser();
  if(user?.role!=='admin')return NextResponse.json({success:false,message:'仅管理员可补查充值订单'},{status:user?403:401});
  const context=createSecurityContext(request,user);
  const limited=enforceRateLimits(context,'points.finance.query',[{policy:RATE_LIMITS.rechargeQuery,identifier:`admin:${user.id}`}]);
  if(limited)return limited;
  const parsed=await parseJson(request,z.object({orderId:z.number().int().positive()}).strict());
  if(!parsed.success)return parsed.response;
  try {
    const result=await checkPointRecharge(parsed.data.orderId,{manual:true});
    return withAudit(context,NextResponse.json({success:true,result},{headers:{'Cache-Control':'private, no-store'}}),
      {eventType:'points.recharge.admin_query',outcome:result.errorCode?'failure':'success',reasonCode:result.errorCode||result.state.toUpperCase(),metadata:{orderId:parsed.data.orderId}});
  } catch(error) {
    if(error.message!=='RECHARGE_ORDER_NOT_FOUND')throw error;
    return NextResponse.json({success:false,message:'充值订单不存在'},{status:404});
  }
}
export const POST = withApiErrors(POSTHandler,{route:'/api/points/finance'});
