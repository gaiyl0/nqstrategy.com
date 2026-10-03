import { withApiErrors } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { idSchema, parseJson } from '@/lib/validation';
import { ORPHAN_TTL_MS, storedPath } from '@/lib/upload-security';
import { createSecurityContext, enforceRateLimits, RATE_LIMITS, withAudit } from '@/lib/security';

export const dynamic = 'force-dynamic';
const audit = (context,response,outcome,reasonCode,metadata={}) => withAudit(context,response,{eventType:'admin.program_reuse',outcome,reasonCode,metadata});

async function GETHandler(request) {
  const user=await getSessionUser(), context=createSecurityContext(request,user);
  if(user?.role!=='admin') return audit(context,NextResponse.json({success:false,message:'仅管理员可复用已审核程序文件'},{status:user?403:401}),'failure','FORBIDDEN');
  const programs=db.prepare(`SELECT u.id AS uploadId,u.original_name AS originalName,u.content_sha256 AS sha256,p.id AS productId,p.title AS productTitle,pv.id AS versionId,pv.version
    FROM uploads u JOIN product_versions pv ON pv.upload_id=u.id AND pv.status='published'
    JOIN products p ON p.id=pv.product_id AND p.status='active' AND p.deleted_at IS NULL
    WHERE u.kind='ea' AND u.deleted_at IS NULL AND u.status='attached'
    ORDER BY p.title COLLATE NOCASE ASC,pv.released_at DESC,u.id DESC`).all();
  return audit(context,NextResponse.json({success:true,programs}),'success','LISTED',{count:programs.length});
}

async function POSTHandler(request) {
  const user=await getSessionUser(), context=createSecurityContext(request,user);
  const limited=enforceRateLimits(context,'admin.program_reuse',[{policy:RATE_LIMITS.uploadIp},{policy:RATE_LIMITS.uploadUserShort,identifier:`user:${user?.id||'anonymous'}`}]);
  if(limited)return limited;
  if(user?.role!=='admin')return audit(context,NextResponse.json({success:false,message:'仅管理员可复用已审核程序文件'},{status:user?403:401}),'failure','FORBIDDEN');
  const parsed=await parseJson(request,idSchema.transform(sourceUploadId=>({sourceUploadId})));
  if(!parsed.success)return audit(context,parsed.response,'failure','VALIDATION_ERROR');
  const source=db.prepare(`SELECT u.*,p.id AS product_id,p.title AS product_title,pv.id AS version_id,pv.version FROM uploads u
    JOIN product_versions pv ON pv.upload_id=u.id AND pv.status='published'
    JOIN products p ON p.id=pv.product_id AND p.status='active' AND p.deleted_at IS NULL
    WHERE u.id=? AND u.kind='ea' AND u.deleted_at IS NULL AND u.status='attached'`).get(parsed.data.sourceUploadId);
  if(!source)return audit(context,NextResponse.json({success:false,message:'该程序不是可复用的已审核版本'},{status:404}),'failure','SOURCE_NOT_AVAILABLE');
  const sourcePath=storedPath('ea',source.stored_name);
  if(!fs.existsSync(sourcePath))return audit(context,NextResponse.json({success:false,message:'源程序文件在安全存储中不存在'},{status:410}),'failure','SOURCE_FILE_MISSING',{sourceUploadId:source.id});
  const extension=path.extname(source.stored_name||source.original_name).toLowerCase(), storedName=`${Date.now()}_${crypto.randomBytes(16).toString('hex')}${extension}`, targetPath=storedPath('ea',storedName);
  fs.mkdirSync(path.dirname(targetPath),{recursive:true});fs.copyFileSync(sourcePath,targetPath,fs.constants.COPYFILE_EXCL);
  try { const result=db.prepare(`INSERT INTO uploads(owner_user_id,url,kind,original_name,size,stored_name,content_sha256,mime_type,status,expires_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,NULL)`).run(user.id,`/private/eas/${storedName}`,'ea',source.original_name,source.size,storedName,source.content_sha256,source.mime_type||'application/octet-stream','clean',Date.now()+ORPHAN_TTL_MS); const uploadId=Number(result.lastInsertRowid);return audit(context,NextResponse.json({success:true,upload:{id:uploadId,url:`/private/eas/${storedName}`,originalName:source.original_name,sourceProductTitle:source.product_title}},{status:201}),'success','REUSED',{sourceUploadId:source.id,sourceProductId:source.product_id,uploadId,sha256:source.content_sha256}); }
  catch(error){fs.rmSync(targetPath,{force:true});throw error;}
}
export const GET = withApiErrors(GETHandler,{route:'/api/admin/program-reuse'});
export const POST = withApiErrors(POSTHandler,{route:'/api/admin/program-reuse'});