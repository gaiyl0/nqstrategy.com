'use client';
import {useCallback,useEffect,useState} from 'react';
import {apiFetch} from '@/lib/api-client';
import {Button} from './ui/UiKit';

export default function RechargeRefunds({t,order=null,onRefresh}) {
  const [data,setData]=useState(null),[page,setPage]=useState(1),[open,setOpen]=useState(false),[points,setPoints]=useState(''),[reason,setReason]=useState('');
  const [key,setKey]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const load=useCallback(async()=>{try{setData(await (await apiFetch(`/api/points/refunds?page=${page}`,{cache:'no-store'})).json());}catch(e){setError(e.message);}},[page]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{if(!order)void load();},[order,load]);
  const submit=async e=>{
    e.preventDefault();setBusy(true);setError('');
    try {await apiFetch('/api/points/refunds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'request',orderId:order.id,points:Number(points),reason,requestKey:key})});
      setOpen(false);setKey(null);setMessage(t('已提交，申请积分已冻结，等待管理员审核。','Submitted. Requested points are held pending administrator review.'));onRefresh();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const statuses={pending:t('待审核 · 积分已冻结','Pending review · points held'),processing:t('提交中 · 积分已冻结','Processing · points held'),unknown:t('待平台确认 · 积分已冻结','Awaiting provider confirmation · points held'),paid:t('已原路退款','Refund completed'),rejected:t('已驳回 · 积分已退回','Rejected · points restored')};
  if(order)return <div className="mt-3">{order.refundablePoints>0&&<Button size="sm" disabled={busy} onClick={()=>{setOpen(!open);if(!key)setKey(crypto.randomUUID());setPoints(String(order.refundablePoints));}}>{t('申请未消费充值退款','Request unused recharge refund')}</Button>}{open&&<form onSubmit={submit} className="mt-3 space-y-3 rounded-lg border border-slate-700 p-4"><p className="text-sm text-slate-400">{t(`最多可申请 ¥${order.refundablePoints.toFixed(2)}，1 元扣回 1 积分。提交后冻结，审核通过原路退款。奖励和已消费积分不退款。`,`Up to CNY ${order.refundablePoints.toFixed(2)}. One point per CNY will be held. Approved refunds return to the original payment method. Rewards and spent points are excluded.`)}</p><label className="block">{t('退款金额（元）','Refund amount (CNY)')}<input required type="number" min="0.01" max={order.refundablePoints} step="0.01" value={points} onChange={e=>setPoints(e.target.value)} className="ml-3 rounded border border-slate-700 bg-transparent p-2"/></label><label className="block">{t('申请原因','Reason')}<textarea required minLength={2} maxLength={300} value={reason} onChange={e=>setReason(e.target.value)} className="mt-2 block w-full rounded border border-slate-700 bg-transparent p-2"/></label><Button type="submit" disabled={busy}>{busy?t('提交中…','Submitting…'):t('提交并冻结积分','Submit and hold points')}</Button></form>}{error&&<p role="alert" className="mt-2 text-red-400">{error}</p>}{message&&<p role="status" className="mt-2 text-teal-500">{message}</p>}</div>;
  return <section className="mt-6 border-t border-slate-700 pt-5"><div className="flex items-center justify-between"><h3 className="font-bold">{t('充值退款记录','Recharge refunds')}</h3><Button size="sm" onClick={load}>{t('刷新','Refresh')}</Button></div>{error&&<p role="alert">{error}</p>}{data?.items.map(row=><article key={row.id} className="mt-3 rounded-lg border border-slate-700 p-3"><strong>#{row.id} · {t('充值订单','Recharge')} #{row.order_id} · ¥{(row.units/100).toFixed(2)}</strong><p className="mt-1 text-sm">{statuses[row.status]}</p><p className="mt-1 text-sm text-slate-400">{row.reason}</p>{row.reviewer_note&&<p className="text-sm text-slate-400">{row.reviewer_note}</p>}</article>)}{data&&!data.items.length&&<p className="mt-3 text-sm text-slate-400">{t('暂无退款记录','No refund requests')}</p>}{data&&data.pagination.totalPages>1&&<div className="mt-3 flex gap-3"><Button disabled={page<=1} onClick={()=>setPage(page-1)}>{t('上一页','Previous')}</Button><span>{page}/{data.pagination.totalPages}</span><Button disabled={page>=data.pagination.totalPages} onClick={()=>setPage(page+1)}>{t('下一页','Next')}</Button></div>}</section>;
}
