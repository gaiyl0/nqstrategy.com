'use client';

import {useCallback,useEffect,useState} from 'react';
import {apiFetch} from '@/lib/api-client';
import {Button,Panel} from './ui/UiKit';

export default function InvitationPanel({t,userId}) {
  const [state,setState]=useState(null),[error,setError]=useState(''),[feedback,setFeedback]=useState(''),[busy,setBusy]=useState(false);
  const load=useCallback(async()=>{
    setBusy(true);setError('');
    try{
      await apiFetch('/api/referrals?view=identity',{cache:'no-store'});
      const response=await apiFetch('/api/referrals',{cache:'no-store'}),data=await response.json();
      if(!response.ok||!data.success)throw Error(data.message||t('邀请信息读取失败','Could not load invitations'));
      setState({...data,link:`${window.location.origin}/?invite=${encodeURIComponent(data.code)}&auth=register`});
    }catch(e){setError(e.message);}finally{setBusy(false);}
  },[t]);
  useEffect(()=>{const timer=setTimeout(()=>{void load();},0);return()=>clearTimeout(timer);},[load]);
  const copy=async value=>{try{await navigator.clipboard.writeText(value);setFeedback(t('已复制','Copied'));}catch{setFeedback(t('无法自动复制，请选中下方内容手动复制。','Select the text below to copy it manually.'));}};
  const labels={pending:t('冷静期内／等待核验','Cooling down / awaiting checks'),review:t('需要管理员核验','Administrator review required'),rewarded:t('奖励已到账','Reward credited'),rejected:t('未通过核验','Not approved')};
  return <Panel className="space-y-4 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{t('邀请好友，获得 200 积分','Invite a friend and earn 200 points')}</h2><Button size="sm" onClick={load} loading={busy}>{t('刷新进度','Refresh')}</Button></div>
    <p className="text-sm leading-6 text-slate-400">{t('好友通过邀请码或邀请链接完成新账号注册并验证邮箱后，等待 24 小时。普通邀请通过风控后自动发放；同设备、共享网络、邮箱别名或集中注册等情况转人工核验。奖励仅发给邀请人，属于不可提现的奖励积分。','A friend must register a new account with your invitation and verify their email. A 24-hour cooling period and abuse checks apply. Shared devices, networks, email aliases and unusual registration activity require review. Only the inviter receives the non-withdrawable reward.')}</p>
    {error&&<p role="alert" className="text-sm text-red-400">{error}</p>}{feedback&&<p role="status" className="text-sm text-teal-500">{feedback}</p>}
    {state&&<><div className="grid gap-3 md:grid-cols-[1fr_2fr]"><div><label className="text-sm" htmlFor={`invite-code-${userId}`}>{t('我的邀请码','My invitation code')}</label><div className="mt-2 flex gap-2"><input id={`invite-code-${userId}`} readOnly value={state.code} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-transparent p-3 font-mono text-sm"/><Button size="sm" onClick={()=>copy(state.code)}>{t('复制','Copy')}</Button></div></div><div><label className="text-sm" htmlFor={`invite-link-${userId}`}>{t('邀请链接','Invitation link')}</label><div className="mt-2 flex gap-2"><input id={`invite-link-${userId}`} readOnly value={state.link} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-transparent p-3 text-sm"/><Button size="sm" onClick={()=>copy(state.link)}>{t('复制链接','Copy link')}</Button></div></div></div>
    <p className="text-sm">{t('累计邀请','Invitations')} {state.invited} · {t('已获奖励','Rewarded')} {state.rewarded*200} {t('积分','points')}</p>
    <div className="divide-y divide-slate-700">{state.items.length?state.items.map(item=><div key={item.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{t('邀请记录','Invitation')} #{item.id} · {labels[item.status]}</span><span>{new Date(item.createdAt).toLocaleString(t('zh-CN','en-US'))}</span>{item.reviewNote&&<p className="w-full text-slate-400">{item.reviewNote}</p>}</div>):<p className="py-3 text-sm text-slate-400">{t('暂无邀请记录。请邀请真实的新用户，禁止自邀、多账号和批量注册。','No invitations yet. Invite real new users. Self-invitations, multiple-account farming and bulk registrations are prohibited.')}</p>}</div></>}
  </Panel>;
}
