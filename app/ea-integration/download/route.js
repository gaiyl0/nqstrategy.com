import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {integrationFiles,integrationPackage} from '@/lib/ea-integration-files.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const allowed=new Set([...integrationFiles.map(item=>item.file),integrationPackage]);
export async function GET(request){
  const file=new URL(request.url).searchParams.get('file');
  if(!allowed.has(file))return Response.json({success:false,message:'下载文件不存在 / Download not found'},{status:404});
  try{
    const bytes=await readFile(path.join(process.cwd(),'public','ea-integration',file));
    return new Response(bytes,{headers:{
      'Content-Type':file.endsWith('.zip')?'application/zip':'application/octet-stream',
      'Content-Disposition':`attachment; filename="${file}"`,
      'Content-Length':String(bytes.length),
      'Cache-Control':'public, max-age=0, must-revalidate',
      'X-Content-Type-Options':'nosniff',
      'X-Robots-Tag':'noindex, nofollow',
    }});
  }catch(error){
    if(error.code!=='ENOENT')console.error('EA integration download unavailable:',error.code);
    return Response.json({success:false,message:'文件暂不可下载，请稍后重试 / Download temporarily unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
