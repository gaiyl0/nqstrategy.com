import { withApiErrors } from '@/lib/api-errors';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import db from '@/lib/db';
import {getSessionUser} from '@/lib/auth';
import {isSystemOwner} from '@/lib/system-owner';
import {parseJson} from '@/lib/validation';
import {issueRuntimeAuthorization,listRuntimeAuthorizations,manageRuntimeAuthorization} from '@/lib/ea-runtime';
import {createSecurityContext,enforceRateLimits,RATE_LIMITS,withAudit} from '@/lib/security';

export const dynamic='force-dynamic';
const duration=z.union([z.literal(30),z.literal(90),z.literal(365)]);
async function GETHandler(request) {
  const user=await getSessionUser();
  if(!user)return NextResponse.json({success:false,message:'请先登录'},{status:401});
  const context=createSecurityContext(request,user),limited=enforceRateLimits(context,'runtime.read',[{policy:RATE_LIMITS.orderRead,identifier:`user:${user.id}`}]);
  if(limited)return limited;
  const url=new URL(request.url),admin=url.searchParams.get('scope')==='admin';
  if(admin&&!isSystemOwner(user))return NextResponse.json({success:false,message:'独立授权系统仅总管理员可管理'},{status:403});
  const page=Math.max(1,Math.min(100000,parseInt(url.searchParams.get('page')||'1',10)||1));
  return NextResponse.json({success:true,...listRuntimeAuthorizations(user,{admin,page}),...(admin?{users:db.prepare("SELECT id,username FROM users WHERE deleted_at IS NULL AND role<>'banned' ORDER BY id DESC LIMIT 500").all(),products:db.prepare("SELECT id,title FROM products WHERE deleted_at IS NULL AND status='active' ORDER BY id DESC LIMIT 500").all()}: {})},{headers:{'Cache-Control':'private, no-store'}});
}
async function POSTHandler(request) {
  const user=await getSessionUser(),context=createSecurityContext(request,user);
  if(!isSystemOwner(user))return NextResponse.json({success:false,message:'独立授权系统仅总管理员可管理'},{status:user?403:401});
  const limited=enforceRateLimits(context,'runtime.manage',[{policy:RATE_LIMITS.orderAdmin,identifier:`user:${user.id}`}]);
  if(limited)return limited;
  const parsed=await parseJson(request,z.discriminatedUnion('action',[
    z.object({action:z.literal('issue'),userId:z.number().int().positive(),productId:z.number().int().positive(),durationDays:duration,note:z.string().trim().max(300).default('')}).strict(),
    z.object({action:z.enum(['revoke','renew','reset_binding']),id:z.number().int().positive(),durationDays:duration.optional(),note:z.string().trim().min(3).max(300)}).strict(),
  ]));
  if(!parsed.success)return parsed.response;
  const body=parsed.data,audit=(response,outcome,reasonCode)=>withAudit(context,response,{eventType:'runtime.authorization.manage',outcome,reasonCode,targetType:'runtime_authorization',targetId:body.id,metadata:{action:body.action,userId:body.userId,productId:body.productId,durationDays:body.durationDays,note:body.note}});
  try{
    const result=body.action==='issue'?issueRuntimeAuthorization(user,body):{authorization:manageRuntimeAuthorization(user,body)};
    return audit(NextResponse.json({success:true,...result},{headers:{'Cache-Control':'private, no-store'}}),'success',body.action.toUpperCase());
  }catch(error){const known={RUNTIME_PRINCIPAL_UNAVAILABLE:['用户或 EA 不可用',409],RUNTIME_NOT_FOUND:['授权不存在',404],RUNTIME_REVOKED:['已撤销授权不能恢复，请重新签发',409],RUNTIME_INPUT_INVALID:['授权参数不正确',400]};const [message,status]=known[error.message]||['授权管理失败',500];return audit(NextResponse.json({success:false,message},{status}),'failure',error.message);}
}
export const GET = withApiErrors(GETHandler,{route:'/api/runtime-authorizations'});
export const POST = withApiErrors(POSTHandler,{route:'/api/runtime-authorizations'});
