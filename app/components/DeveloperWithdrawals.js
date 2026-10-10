"use client";

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Button, Panel } from './ui/UiKit';

export default function DeveloperWithdrawals({points,onRefresh,t}) {
  const [withdrawals,setWithdrawals]=useState([]);
  const [amount,setAmount]=useState('');
  const [note,setNote]=useState('');
  const [busy,setBusy]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const refresh=useCallback(async()=>{
    try {
      const response=await apiFetch('/api/points/withdrawals?scope=mine',{cache:'no-store'});
      const data=await response.json();
      if(!response.ok||!data.success)throw new Error(data.message||t('读取提现记录失败','Unable to load withdrawals'));
      setWithdrawals(data.withdrawals||[]);setLoaded(true);setError('');
    } catch(e) {setError(e.message);}
  },[t]);
  // Load the authenticated developer's history after opening this section.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{refresh();},[refresh]);
  const pending=withdrawals.some(item=>item.status==='pending');
  const submit=async event=>{
    event.preventDefault();setBusy(true);setError('');setSuccess('');
    try {
      const response=await apiFetch('/api/points/withdrawals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'request',points:Number(amount),note:note.trim()})});
      const data=await response.json();
      if(!response.ok||!data.success)throw new Error(data.message||t('提交失败','Submission failed'));
      setAmount('');setNote('');setSuccess(t('提现申请已提交，等待管理员审核。','Withdrawal submitted for administrator review.'));
      onRefresh();await refresh();
    } catch(e) {setError(e.message);} finally {setBusy(false);}
  };
  return <div className="space-y-4">
    <Panel className="p-6">
      <h2 className="text-xl font-bold text-white">{t('开发者积分提现','Developer withdrawal')}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">{t('仅用户充值积分购买 EA 产生的开发者销售分成可提现，任务奖励及奖励积分购买产生的分成不可提现。1 个可提现积分＝1 元人民币，管理员审核后线下打款。','Only creator sales revenue funded by customer recharge is withdrawable. Rewards and reward-funded sales are excluded. One withdrawable point equals CNY 1; an administrator reviews and pays manually.')}</p>
      <div className="my-5 rounded-xl border border-teal-500/25 bg-teal-500/10 p-4"><span className="text-sm text-slate-400">{t('当前可提现','Available to withdraw')}</span><strong className="mt-1 block text-2xl text-white">{points?.withdrawable??'—'} <span className="text-sm font-normal">{t('积分','points')}</span></strong></div>
      {error&&<p role="alert" className="mb-4 text-sm text-red-400">{error} <button type="button" onClick={refresh} className="underline">{t('重新读取','Retry')}</button></p>}
      {success&&<p role="status" className="mb-4 text-sm text-teal-500">{success}</p>}
      {pending&&<p className="mb-4 text-sm text-amber-500">{t('已有待审核申请，处理完成后可再次申请。','A withdrawal is pending. You can apply again after it is reviewed.')}</p>}
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-end">
        <label className="space-y-2 text-sm text-slate-400"><span className="block">{t('提现积分数量','Withdrawal amount')}</span><input required type="number" min="100" max={Math.min(1000000,points?.withdrawable??1000000)} step="0.01" value={amount} onChange={event=>setAmount(event.target.value)} placeholder={t('至少 100 积分','At least 100 points')} className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5"/></label>
        <label className="space-y-2 text-sm text-slate-400"><span className="block">{t('收款方式与账号','Payout method and account')}</span><input required minLength={5} maxLength={200} value={note} onChange={event=>setNote(event.target.value)} placeholder={t('例如支付宝账号，请勿填写密码','For example, Alipay account. Never enter a password.')} className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5"/></label>
        <Button type="submit" disabled={busy||!loaded||pending||!points?.canWithdraw||note.trim().length<5||Number(amount)<100||Number(amount)>Number(points?.withdrawable)}>{busy?t('提交中…','Submitting…'):t('提交提现审核','Request withdrawal')}</Button>
      </form>
    </Panel>
    <Panel className="p-6"><h3 className="font-bold text-white">{t('我的提现记录','My withdrawal history')}</h3>{!loaded?<p className="mt-4 text-sm text-slate-400">{t('正在读取…','Loading…')}</p>:withdrawals.length? <div className="mt-4 divide-y divide-slate-700">{withdrawals.map(item=><div key={item.id} className="py-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong className="text-white">#{item.id} · ¥{Number(item.amountCny).toFixed(2)}</strong><span className="text-slate-400">{item.status==='pending'?t('待审核','Pending'):item.status==='completed'?t('已确认打款','Paid'):t('已驳回并退回','Rejected and refunded')}</span></div><p className="mt-1 text-slate-400">{new Date(item.createdAt).toLocaleString()} · {item.applicantNote}</p>{item.reviewerNote&&<p className="mt-1 text-slate-400">{t('审核备注','Review note')}: {item.reviewerNote}</p>}</div>)}</div>:<p className="mt-4 text-sm text-slate-400">{t('暂无提现申请。','No withdrawal requests yet.')}</p>}</Panel>
  </div>;
}
