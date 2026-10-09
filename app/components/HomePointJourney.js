"use client";
import { useEffect,useState } from 'react';
import { ArrowRight,CheckCircle2,ClipboardCheck,Coins,Download,Gift } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { journeyQuote,ownJourneySummary } from '@/lib/point-journey.mjs';
import { Button,Panel } from './ui/UiKit';

export default function HomePointJourney({settings,products,user,setRoute,setAuthModal,t,compact=false}) {
  const [result,setResult]=useState(null),[failed,setFailed]=useState(null);
  const userId=user?.id;
  useEffect(()=>{
    if(!userId)return;
    const controller=new AbortController();
    apiFetch('/api/points?view=summary',{cache:'no-store',signal:controller.signal}).then(response=>response.json()).then(data=>{if(data.success)setResult({userId,data});else setFailed(userId);}).catch(()=>{if(!controller.signal.aborted)setFailed(userId);});
    return ()=>controller.abort();
  },[userId]);
  const summary=ownJourneySummary(result,userId);
  const task=settings?.brokerReward;
  if(!settings?.home?.showJourney||!task?.enabled)return null;
  const quote=journeyQuote(products,summary?.balance,task.rewardPoints,summary?.brokerClaimStatus);
  const openTasks=()=>user?setRoute('points'):setAuthModal('login');
  const status={pending:t('资料审核中，奖励尚未到账','Submission under review; reward not credited'),approved:t('任务已通过，奖励按积分明细记录','Task approved; check your point history'),rejected:t('资料需补充，请查看审核说明','More information needed; check the review note')}[summary?.brokerClaimStatus];
  if(compact)return <Panel className="reference-reward-strip reward-task-card" data-testid="home-point-journey">
    <div className="reward-task-intro">
      <div className="reward-task-icon"><Gift size={28} aria-hidden="true"/></div>
      <div className="reward-task-copy"><p className="reward-task-eyebrow">{t('TMGM 专属积分任务','TMGM points task')}</p><h2>{t('完成注册与入金，解锁 EA 积分','Register and deposit to earn EA points')}</h2><p>{t('按任务要求完成，管理员核验通过后发放奖励。','Complete the task requirements. Rewards are credited after administrator verification.')}</p></div>
      <div className="reward-task-prize"><span>{t('审核通过可获','Reward after approval')}</span><strong>{task.rewardPoints}<small>{t('积分','points')}</small></strong></div>
      <Button variant="primary" className="reward-task-action" onClick={openTasks}>{t('查看任务','View task')}<ArrowRight size={16}/></Button>
    </div>
    <ol>{[[t('注册 TMGM 交易账户','Register a TMGM account'),t('通过专属链接完成注册','Register through the designated link')],[t('完成入金交易','Deposit and trade'),t('按任务要求完成入金与交易','Follow the task deposit and trading requirements')],[t('提交资料，等待审核','Submit details for review'),t('提交邮箱和客户 ID 后等待核验','Submit your email and customer ID for verification')]].map(([label,description],index)=><li key={label}><span>{index+1}</span><div><strong>{label}</strong><p>{description}</p></div></li>)}</ol>
    {user&&<p className="reference-reward-status">{t('我的积分','My points')}：{summary?.balance??'—'}{status&&` · ${status}`}{!summary&&failed===userId&&` · ${t('读取失败，请进入任务中心重试','Could not load; retry in the task center')}`}{summary&&quote.gap>0&&` · ${t(`距离最低价 EA 还差 ${quote.gap} 积分`,`You need ${quote.gap} more points for the lowest-priced EA`)}`}</p>}
  </Panel>;
  return <Panel className="home-point-journey p-7" data-testid="home-point-journey">
    <div className="flex items-start justify-between gap-6"><div><p className="text-sm font-semibold text-teal-500">{t('TMGM 注册与入金任务','TMGM registration and deposit task')}</p><h2 className="mt-2 text-2xl font-bold">{t(`核验通过后获得 ${task.rewardPoints} 积分`,`Earn ${task.rewardPoints} points after verification`)}</h2><p className="mt-3 text-sm leading-7 text-slate-400">{t('注册并完成入金后，在任务中心提交注册邮箱和客户 ID。管理员核验通过后发放奖励；仅注册不会自动获得积分。','After registration and deposit, submit your email and customer ID in the task center. Rewards require administrator approval; registration alone does not earn points.')}</p></div><Coins className="h-9 w-9 shrink-0 text-teal-500"/></div>
    <ol className="mt-6 grid grid-cols-4 gap-4">{[[Coins,t('注册并完成入金','Register and deposit')],[ClipboardCheck,t('提交邮箱与客户 ID','Submit email and customer ID')],[CheckCircle2,t('核验通过，积分到账','Approval and point credit')],[Download,t('兑换 EA，下载使用','Redeem and download an EA')]].map(([Icon,label],index)=><li key={index} className="rounded-xl border border-slate-700 p-4"><span className="flex items-center justify-between text-sm text-slate-400">0{index+1}<Icon className="h-5 w-5 text-teal-500"/></span><p className="mt-3 text-sm font-semibold leading-6">{label}</p></li>)}</ol>
    <div className="mt-6 flex items-center justify-between gap-6 rounded-xl border border-slate-700 p-5"><div className="text-sm leading-7">
      {user?<><p>{t('我的积分','My points')}：<strong className="text-lg">{summary?.balance??'—'}</strong>{summary&&quote.affordable>0&&<span className="ml-3">{t(`当前可兑换 ${quote.affordable} 款 EA`,`Currently enough for ${quote.affordable} EAs`)}</span>}</p>{!summary&&<p className="text-slate-400">{failed===userId?t('积分读取失败，可进入任务中心重新查看。','Points could not load. Open the task center to retry.'):t('正在读取积分…','Loading points…')}</p>}{status&&<p className="text-teal-500">{status}</p>}{summary&&quote.gap>0&&<p className="text-slate-400">{t(`距离最低 ${quote.minimum} 积分的 EA 还差 ${quote.gap} 积分。`,`You need ${quote.gap} more points for an EA priced at ${quote.minimum} points.`)}</p>}</>:<p>{t('登录后查看你的积分、任务审核状态与可兑换策略。','Sign in to view points, task review status and affordable strategies.')}</p>}
      {(!user||summary)&&quote.minimum!==null&&summary?.brokerClaimStatus!=='approved'&&<p className="text-slate-400">{quote.afterRewardGap>0?t(`奖励发放后，兑换当前最低积分价 EA 仍需补足 ${quote.afterRewardGap} 积分。`,`After reward credit, ${quote.afterRewardGap} more points are needed for the lowest point-priced EA.`):t('奖励发放后，可按实际余额选择兑换；价格与可用版本以策略详情为准。','After reward credit, choose an EA using your actual balance. Check the strategy details for price and available versions.')}</p>}
    </div><div className="flex shrink-0 gap-3"><Button variant="primary" onClick={openTasks}>{t('进入任务中心','Open task center')}<ArrowRight className="h-4 w-4"/></Button><Button onClick={()=>setRoute('market')}>{t('查看 EA','Browse EAs')}</Button></div></div>
    <p className="mt-4 text-xs leading-6 text-slate-400">{t('交易存在风险，请独立判断平台与策略是否适合自己。任务条件以任务中心说明及审核结果为准。','Trading involves risk. Assess whether the platform and strategy suit you. Task conditions and administrator review determine eligibility.')}</p>
  </Panel>;
}
