import {NextResponse} from 'next/server';
import {getSessionUser} from '@/lib/auth';
import {financeOverview} from '@/lib/finance-overview';
import {withApiErrors} from '@/lib/api-errors';
import {createSecurityContext,enforceRateLimits,RATE_LIMITS} from '@/lib/security';

export const dynamic='force-dynamic';
async function GETHandler(request){
  const user=await getSessionUser();
  if(user?.role!=='admin')return NextResponse.json({success:false,message:'仅管理员可查看财务流水'},{status:user?403:401});
  const limited=enforceRateLimits(createSecurityContext(request,user),'points.finance.read',[{policy:RATE_LIMITS.orderRead,identifier:`user:${user.id}`}]);
  if(limited)return limited;
  const params=new URL(request.url).searchParams;
  try{return NextResponse.json({success:true,...financeOverview(user,{view:params.get('view')||'recharges',page:Number(params.get('page')||1),userId:params.get('userId')?Number(params.get('userId')):null})},{headers:{'Cache-Control':'private, no-store'}});}
  catch(error){if(error.message!=='FINANCE_QUERY_INVALID')throw error;return NextResponse.json({success:false,message:'流水筛选参数无效'},{status:400});}
}
export const GET=withApiErrors(GETHandler,{route:'/api/points/finance'});
