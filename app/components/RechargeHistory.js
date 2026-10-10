'use client';

import {useCallback,useEffect,useState} from 'react';
import {apiFetch} from '@/lib/api-client';
import {Button,Panel} from './ui/UiKit';

export default function RechargeHistory({t,onRefresh,setRoute}) {
  const [page,setPage]=useState(1),[data,setData]=useState(null),[loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(null),[error,setError]=useState(''),[message,setMessage]=useState('');
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{const result=await (await apiFetch(`/api/points/recharge?view=history&page=${page}`,{cache:'no-store'})).json();setData(result);}
    catch(e){setError(e.message);}finally{setLoading(false);}
  },[page]);
  // Fetch this owner's history only when the section is opened or paginated.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{load();},[load]);
  const query=async id=>{
    setBusy(id);setError('');setMessage('');
    try{
      const result=await (await apiFetch(`/api/points/recharge?orderId=${id}&reconcile=1`,{cache:'no-store'})).json();
      setMessage(result.order.status==='paid'?t('支付已核验，积分已到账。','Payment verified; points credited.'):result.queryStatus==='unavailable'?t('支付平台暂时无法查询，请稍后重试，不要重复付款。','Payment lookup is unavailable. Retry later; do not pay twice.'):t('尚未查到成功付款。如已付款，请稍后重试或提供订单号联系客服。','No successful payment found. If paid, retry later or contact support with the order number.'));
      if(result.order.status==='paid')onRefresh();await load();
    }catch(e){setError(e.message);}finally{setBusy(null);}
  };
  const status=value=>({pending:t('等待付款','Awaiting payment'),paid:t('已到账','Credited'),expired:t('付款期限已过','Payment window expired'),failed:t('支付失败','Failed')}[value]||value);
  return <Panel className="p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-white">{t('我的充值记录','My recharge history')}</h2><div className="flex gap-2"><Button size="sm" disabled={loading||busy!==null} onClick={load}>{t('刷新','Refresh')}</Button><Button size="sm" onClick={()=>setRoute('points')}>{t('去充值','Buy points')}</Button></div></div>
    <p className="mt-3 text-sm leading-6 text-slate-400">{t('1 元＝1 积分。仅支付平台核验成功后到账；付款期限已过的订单仍可查询之前是否付款成功，请勿重复付款。','CNY 1 = 1 point. Credit requires payment verification. Expired orders can still be checked for an earlier payment; do not pay twice.')}</p>
    {error&&<p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}{message&&<p role="status" className="mt-4 text-sm text-teal-500">{message}</p>}
    {loading?<p className="py-6 text-sm text-slate-400">{t('正在读取…','Loading…')}</p>:data?.orders.length?<div className="mt-4 space-y-3">{data.orders.map(order=><article key={order.id} className="rounded-xl border border-slate-700 p-4"><div className="flex flex-wrap justify-between gap-3"><div><strong className="text-white">#{order.id} · ¥{(order.cnyFen/100).toFixed(2)}</strong><p className="mt-1 text-sm text-slate-400">{order.points} {t('积分','points')} · {order.provider==='alipay'?t('支付宝','Alipay'):t('微信支付','WeChat Pay')}</p></div><span className={`text-sm font-semibold ${order.status==='paid'?'text-teal-500':'text-slate-400'}`}>{status(order.status)}</span></div><p className="mt-2 text-xs text-slate-400">{t('创建时间','Created')}: {new Date(order.createdAt).toLocaleString(t('zh-CN','en-US'))}</p>{order.paidAt&&<p className="mt-1 text-xs text-slate-400">{t('付款时间','Paid')}: {new Date(order.paidAt).toLocaleString(t('zh-CN','en-US'))}</p>}{order.tradeNo&&<p className="mt-1 break-all text-xs text-slate-400">{t('支付交易号','Payment transaction')}: {order.tradeNo}</p>}{order.status!=='paid'&&<Button size="sm" className="mt-3" disabled={busy!==null} onClick={()=>query(order.id)}>{busy===order.id?t('查询中…','Checking…'):t('查询支付结果','Check payment result')}</Button>}</article>)}</div>:data&&<p className="py-6 text-sm text-slate-400">{t('暂无充值订单。','No recharge orders yet.')}</p>}
    {data&&<div className="mt-5 flex items-center justify-end gap-3 text-sm text-slate-400"><span>{t(`共 ${data.pagination.total} 条`,`${data.pagination.total} orders`)} · {data.pagination.page}/{data.pagination.totalPages}</span><Button size="sm" disabled={loading||busy!==null||data.pagination.page<=1} onClick={()=>{setData(null);setPage(data.pagination.page-1);}}>{t('上一页','Previous')}</Button><Button size="sm" disabled={loading||busy!==null||data.pagination.page>=data.pagination.totalPages} onClick={()=>{setData(null);setPage(data.pagination.page+1);}}>{t('下一页','Next')}</Button></div>}
  </Panel>;
}
