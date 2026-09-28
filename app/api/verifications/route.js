import { withApiErrors } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { parseJson, idSchema, validate, validationErrorResponse, verificationReviewSchema } from '@/lib/validation';
import { approveVerification, getVerification, getVerificationHistory, revokeVerification } from '@/lib/strategy-verification';
import { createSecurityContext, withAudit } from '@/lib/security';

export const dynamic='force-dynamic';

async function GETHandler(request) {
  const parsed=validate(idSchema,new URL(request.url).searchParams.get('productId')); if(!parsed.success) return validationErrorResponse(parsed.error);
  const product=db.prepare('SELECT id,status FROM products WHERE id=?').get(parsed.data); if(!product) return NextResponse.json({success:false,message:'策略不存在'},{status:404});
  const user=await getSessionUser(); const admin=user?.role==='admin';
  if(product.status!=='active'&&!admin) return NextResponse.json({success:false,message:'策略不存在'},{status:404});
  return NextResponse.json({success:true,verification:getVerification(product.id,{includePrivate:admin}),...(admin?{history:getVerificationHistory(product.id)}:{})});
}

async function PATCHHandler(request) {
  const user=await getSessionUser(); const context=createSecurityContext(request,user);
  const audited=(response,outcome,reasonCode,metadata={})=>withAudit(context,response,{eventType:'verification.review',outcome,reasonCode,metadata});
  if(user?.role!=='admin') return audited(NextResponse.json({success:false,message:'仅管理员可管理认证等级'},{status:user?403:401}),'failure','FORBIDDEN');
  const parsed=await parseJson(request,verificationReviewSchema); if(!parsed.success) return audited(parsed.response,'failure','VALIDATION_ERROR');
  const body=parsed.data; const product=db.prepare('SELECT id,status FROM products WHERE id=?').get(body.productId); if(!product) return audited(NextResponse.json({success:false,message:'策略不存在'},{status:404}),'failure','NOT_FOUND');
  if(body.action==='approve'&&product.status!=='active') return audited(NextResponse.json({success:false,message:'策略必须先审核上架，才能授予更高认证等级'},{status:409}),'failure','PRODUCT_NOT_ACTIVE');
  try {
    const verification=body.action==='revoke'?revokeVerification(body.productId,body.reason,user.id):approveVerification(body.productId,body.level,body.evidence,user.id);
    return audited(NextResponse.json({success:true,verification}),'success',body.action==='revoke'?'REVOKED':'APPROVED',{productId:body.productId,level:verification.level});
  } catch(error) {
    const messages={REPORT_VERIFICATION_REQUIRED:'必须先完成截图和 MT5 HTML 报告验证',VERIFICATION_NOT_FOUND:'该策略尚无可撤销认证',MANUAL_LEVEL_INVALID:'该认证等级不能手工授予'};
    if(messages[error.message]) return audited(NextResponse.json({success:false,message:messages[error.message]},{status:409}),'failure',error.message); return audited(NextResponse.json({success:false,message:'认证审核失败'},{status:500}),'failure','INTERNAL_ERROR');
  }
}

export const GET = withApiErrors(GETHandler, { route: '/api/verifications' });
export const PATCH = withApiErrors(PATCHHandler, { route: '/api/verifications' });
