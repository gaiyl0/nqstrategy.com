import { withApiErrors } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { createVersionSchema,idSchema,parseJson,reviewVersionSchema,validate,validationErrorResponse } from '@/lib/validation';
import { listVersions,reviewVersion,submitVersion } from '@/lib/product-versions';
import { createSecurityContext,enforceRateLimits,RATE_LIMITS,withAudit } from '@/lib/security';

export const dynamic='force-dynamic';

function ownedUpload(fileUrl,userId){return db.prepare(`SELECT id,url,content_sha256 FROM uploads WHERE url=? AND owner_user_id=? AND kind='ea'
  AND attached_product_id IS NULL AND deleted_at IS NULL AND status IN ('clean','content_validated')`).get(fileUrl,userId);}

async function GETHandler(request){
  const user=await getSessionUser();
  const parsed=validate(idSchema,new URL(request.url).searchParams.get('productId')); if(!parsed.success)return validationErrorResponse(parsed.error);
  const product=db.prepare('SELECT id,status,author_user_id FROM products WHERE id=?').get(parsed.data); if(!product)return NextResponse.json({success:false,message:'策略不存在'},{status:404});
  const privileged=user?.role==='admin'||user?.id===product.author_user_id;
  if(product.status!=='active'&&!privileged)return NextResponse.json({success:false,message:'策略不存在'},{status:404});
  return NextResponse.json({success:true,versions:listVersions(product.id,{includePrivate:privileged})});
}

async function POSTHandler(request){
  const user=await getSessionUser(); const context=createSecurityContext(request,user);
  const audited=(response,outcome,reasonCode,metadata={})=>withAudit(context,response,{eventType:'version.submit',outcome,reasonCode,targetType:'product',targetId:metadata.productId,metadata});
  const limited=enforceRateLimits(context,'version.submit',[{policy:RATE_LIMITS.versionWrite,identifier:user?`user:${user.id}`:context.sourceHash}]);if(limited)return limited;
  if(!user)return audited(NextResponse.json({success:false,message:'请先登录'},{status:401}),'failure','UNAUTHENTICATED');
  if(!['developer','admin'].includes(user.role))return audited(NextResponse.json({success:false,message:'仅开发者可提交版本'},{status:403}),'failure','FORBIDDEN_ROLE');
  const parsed=await parseJson(request,createVersionSchema);if(!parsed.success)return audited(parsed.response,'failure','VALIDATION_ERROR');
  const upload=ownedUpload(parsed.data.fileUrl,user.id);if(!upload)return audited(NextResponse.json({success:false,message:'程序文件无效、不属于当前账户或已被使用'},{status:409}),'failure','UPLOAD_INVALID',{productId:parsed.data.productId});
  try{const version=submitVersion(parsed.data.productId,user.id,upload,parsed.data);return audited(NextResponse.json({success:true,version},{status:201}),'success','SUBMITTED',{productId:parsed.data.productId,versionId:version.id});}
  catch(error){const known={PRODUCT_NOT_FOUND:['策略不存在',404],FORBIDDEN:['无权更新该策略',403],PRODUCT_NOT_ACTIVE:['策略必须处于上架状态才能提交新版本',409],UPLOAD_ALREADY_USED:['程序文件已被使用',409]};if(known[error.message]){const [message,status]=known[error.message];return audited(NextResponse.json({success:false,message},{status}),'failure',error.message,{productId:parsed.data.productId});}if(error.code==='SQLITE_CONSTRAINT_UNIQUE')return audited(NextResponse.json({success:false,message:'该版本号或文件已经提交'},{status:409}),'failure','DUPLICATE_VERSION',{productId:parsed.data.productId});return audited(NextResponse.json({success:false,message:'版本提交失败'},{status:500}),'failure','INTERNAL_ERROR',{productId:parsed.data.productId});}
}

async function PATCHHandler(request){
  const user=await getSessionUser();const context=createSecurityContext(request,user);
  const audited=(response,outcome,reasonCode,metadata={})=>withAudit(context,response,{eventType:'version.review',outcome,reasonCode,targetType:'product_version',targetId:metadata.versionId,metadata});
  const limited=enforceRateLimits(context,'version.review',[{policy:RATE_LIMITS.versionReview,identifier:user?`user:${user.id}`:context.sourceHash}]);if(limited)return limited;
  if(user?.role!=='admin')return audited(NextResponse.json({success:false,message:'仅管理员可审核版本'},{status:user?403:401}),'failure','FORBIDDEN');
  const parsed=await parseJson(request,reviewVersionSchema);if(!parsed.success)return audited(parsed.response,'failure','VALIDATION_ERROR');
  try{const version=reviewVersion(parsed.data.id,parsed.data.decision,parsed.data.reason||'',user.id);return audited(NextResponse.json({success:true,version,replayed:Boolean(version.replayed)}),'success',version.replayed?'REPLAYED':parsed.data.decision.toUpperCase(),{versionId:parsed.data.id,productId:version.productId});}
  catch(error){const known={VERSION_NOT_FOUND:['版本不存在',404],VERSION_NOT_PUBLISHED:['只有已发布版本可以下架',409],VERSION_ALREADY_REVIEWED:['版本已经完成审核，不能改变结论',409],VERSION_RACE_LOST:['版本已被其他管理员处理',409]};if(known[error.message]){const [message,status]=known[error.message];return audited(NextResponse.json({success:false,message},{status}),'failure',error.message,{versionId:parsed.data.id});}return audited(NextResponse.json({success:false,message:'版本审核失败'},{status:500}),'failure','INTERNAL_ERROR',{versionId:parsed.data.id});}
}

export const GET = withApiErrors(GETHandler, { route: '/api/versions' });
export const POST = withApiErrors(POSTHandler, { route: '/api/versions' });
export const PATCH = withApiErrors(PATCHHandler, { route: '/api/versions' });
