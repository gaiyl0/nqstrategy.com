import {NextResponse} from 'next/server';
import {z} from 'zod';
import { withApiErrors } from '@/lib/api-errors';
import {getSessionUser} from '@/lib/auth';
import {parseJson,validate,validationErrorResponse} from '@/lib/validation';
import {notificationState,readNotification,messageThreads,messageConversation,sendMessage,readConversation,setMessageBlock} from '@/lib/inbox';
import {createSecurityContext,enforceRateLimits,RATE_LIMITS,withAudit} from '@/lib/security';

export const dynamic='force-dynamic';
const id=z.coerce.number().int().positive();
const query=z.object({section:z.enum(['notifications','threads','conversation']),peerId:id.optional(),before:id.optional()}).strict();
const write=z.discriminatedUnion('action',[
  z.object({action:z.literal('send'),recipient:z.string().trim().min(2).max(80),body:z.string().trim().min(1).max(2000)}).strict(),
  z.object({action:z.literal('read_notification'),id}).strict(),
  z.object({action:z.literal('read_conversation'),peerId:id}).strict(),
  z.object({action:z.literal('block'),peerId:id,blocked:z.boolean()}).strict(),
]);
const errorMap={RECIPIENT_UNAVAILABLE:['用户不存在或无法接收私信',404],SELF_MESSAGE:['不能给自己发私信',400],MESSAGE_BLOCKED:['私信已被屏蔽',403],NOTIFICATION_NOT_FOUND:['通知不存在',404]};

async function GETHandler(request){
  const user=await getSessionUser();
  if(!user||user.role==='banned')return NextResponse.json({success:false,message:'请先登录'},{status:401});
  const context=createSecurityContext(request,user);
  const limited=enforceRateLimits(context,'inbox.read',[{policy:RATE_LIMITS.inboxRead,identifier:`user:${user.id}`}]);if(limited)return limited;
  const parsed=validate(query,Object.fromEntries(new URL(request.url).searchParams));
  if(!parsed.success)return validationErrorResponse(parsed.error);
  const {section,peerId,before}=parsed.data;
  if(section==='conversation'&&!peerId)return NextResponse.json({success:false,message:'请选择私信对象'},{status:400});
  try {const data=section==='notifications'?notificationState(user.id,before):section==='threads'?{threads:messageThreads(user.id)}:messageConversation(user.id,peerId,before);
    return NextResponse.json({success:true,...data});}
  catch(error){const [message,status]=errorMap[error.message]||['加载消息失败',500];return NextResponse.json({success:false,message},{status});}
}

async function POSTHandler(request){
  const user=await getSessionUser();
  if(!user||user.role==='banned')return NextResponse.json({success:false,message:'请先登录'},{status:401});
  const context=createSecurityContext(request,user);
  const limited=enforceRateLimits(context,'inbox.write',[{policy:RATE_LIMITS.inboxWrite,identifier:`user:${user.id}`},{policy:RATE_LIMITS.inboxIp,identifier:context.sourceHash}]);if(limited)return limited;
  const parsed=await parseJson(request,write);if(!parsed.success)return parsed.response;
  const body=parsed.data;
  const audited=(response,outcome,reasonCode)=>withAudit(context,response,{eventType:'inbox.write',outcome,reasonCode,metadata:{action:body.action}});
  try {let result={};
    if(body.action==='send')result=sendMessage(user.id,body.recipient,body.body);
    if(body.action==='read_notification')readNotification(user.id,body.id);
    if(body.action==='read_conversation')readConversation(user.id,body.peerId);
    if(body.action==='block')setMessageBlock(user.id,body.peerId,body.blocked);
    return audited(NextResponse.json({success:true,...result}),'success',body.action.toUpperCase());
  }catch(error){const [message,status]=errorMap[error.message]||['消息操作失败',500];return audited(NextResponse.json({success:false,message},{status}),'failure',error.message||'INTERNAL_ERROR');}
}
export const GET = withApiErrors(GETHandler,{route:'/api/inbox'});
export const POST = withApiErrors(POSTHandler,{route:'/api/inbox'});
