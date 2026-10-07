'use client';

import {useCallback,useEffect,useState} from 'react';
import {apiFetch} from '@/lib/api-client';
import {useInteraction} from '@/app/components/ui/UiKit';

export default function PointWithdrawalsAdmin(){
  const {confirmAction,requestInput}=useInteraction();
  const [items,setItems]=useState([]);
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{const response=await apiFetch('/api/points/withdrawals',{cache:'no-store'});const result=await response.json();if(!response.ok||!result.success)throw new Error(result.message||'载入失败');setItems(result.withdrawals);},[]);
  // Load the review queue after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{void load().catch(error=>setNotice(error.message));},[load]);
  const review=async(item,approve)=>{let note='';if(approve){if(!await confirmAction({title:'确认已完成线下打款',description:`${item.username} · ${item.points} 积分 = ${item.points} USD`,noticeTitle:'必须先独立核实收款人及实际付款',notice:'此操作只记录审批结果，不会自动转账。奖励来源积分已在申请时剔除。',confirmLabel:'已打款，确认结算'}))return;note=await requestInput({title:'记录线下打款凭证',description:`${item.username} · ${item.points} USD`,label:'银行或支付平台流水号 / 交易参考号',required:true,minLength:3,maxLength:500,confirmLabel:'保存打款凭证'});if(!note)return;}else{note=await requestInput({title:'驳回积分提现',description:`${item.username} · ${item.points} 积分`,label:'驳回原因',required:true,minLength:3,maxLength:500,multiline:true,confirmLabel:'驳回并退回积分'});if(!note)return;}setBusy(true);try{const response=await apiFetch('/api/points/withdrawals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'review',id:item.id,approve,note})});const result=await response.json();if(!response.ok||!result.success)throw new Error(result.message||'审核失败');setNotice('审核已保存');await load();}catch(error){setNotice(error.message);}finally{setBusy(false);}};
  return <section className="space-y-4"><div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4 text-sm leading-6">仅销售中买家充值来源的开发者分成可提现；奖励来源及任务积分不计入可提现金额。管理员须完成线下付款后再点“已打款”。</div>{notice&&<p role="status" className="rounded-lg border border-slate-700 p-3 text-sm">{notice}</p>}<div className="grid gap-3">{items.map(item=><article key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><strong className="text-white">#{item.id} · {item.username}</strong><p className="mt-1 text-sm text-slate-400">申请 {item.points} 积分＝{item.points} USD · {new Date(item.createdAt).toLocaleString()}</p>{item.applicantNote&&<p className="mt-2 text-sm text-slate-400">说明：{item.applicantNote}</p>}</div><span className={item.status==='pending'?'text-amber-300':item.status==='completed'?'text-emerald-300':'text-red-300'}>{item.status==='pending'?'待审核':item.status==='completed'?'已完成':'已驳回'}</span></div>{item.status==='pending'&&<div className="mt-4 flex gap-2"><button disabled={busy} onClick={()=>review(item,false)} className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300">驳回并退回</button><button disabled={busy} onClick={()=>review(item,true)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">已线下打款</button></div>}{item.reviewerNote&&<p className="mt-3 text-sm text-slate-400">审核备注：{item.reviewerNote}</p>}</article>)}{!items.length&&<p className="rounded-xl border border-slate-800 p-8 text-center text-slate-500">暂无积分提现申请</p>}</div></section>;
}
