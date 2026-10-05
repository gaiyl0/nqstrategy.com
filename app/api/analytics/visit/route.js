import { withApiErrors } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { confirmBrowserVisit, issueVisitProof } from '@/lib/site-analytics';
import { ANALYTICS_COOKIE, cookieVisitor, newVisitor, readSigned } from '@/lib/analytics-confidence.mjs';
import { createSecurityContext, enforceRateLimits } from '@/lib/security';
export const dynamic = 'force-dynamic';
const headers = { 'cache-control':'private, no-store', vary:'Cookie' };
async function GETHandler(request) {
  if((await getSessionUser())?.role==='admin')return NextResponse.json({success:true,excluded:true},{headers});
  const limited=enforceRateLimits(createSecurityContext(request),'analytics.proof',[{policy:{scope:'analytics.proof',limit:120,windowMs:60000}}]);
  if(limited)return limited;
  let visitor=cookieVisitor(request),fresh;
  if(!visitor){fresh=newVisitor();visitor=readSigned(fresh);}
  const proof=issueVisitProof(request,new URL(request.url).searchParams.get('path'),visitor);
  const response=NextResponse.json({success:true,proof},{headers});
  if(proof&&fresh)response.cookies.set(ANALYTICS_COOKIE,fresh,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:86400});
  return response;
}
async function POSTHandler(request) {
  if((await getSessionUser())?.role==='admin')return NextResponse.json({success:true,counted:false},{headers});
  const limited=enforceRateLimits(createSecurityContext(request),'analytics.confirm',[{policy:{scope:'analytics.confirm',limit:120,windowMs:60000}}]);
  if(limited)return limited;
  const raw=await request.text();
  if(raw.length>4096)return NextResponse.json({success:false},{status:413,headers});
  let input;
  try { input=JSON.parse(raw); } catch { return NextResponse.json({success:false},{status:400,headers}); }
  return NextResponse.json({success:true,counted:confirmBrowserVisit(request,input)},{headers});
}
export const GET = withApiErrors(GETHandler, { route:'/api/analytics/visit' });
export const POST = withApiErrors(POSTHandler, { route:'/api/analytics/visit' });
