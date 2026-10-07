'use client';

import {useEffect,useState} from 'react';
import {apiFetch} from '@/lib/api-client';

export default function PointExchangeRateAdmin(){
  const [rate,setRate]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  // Load the current quote setting after mount.
  useEffect(()=>{apiFetch('/api/points/exchange-rate',{cache:'no-store'}).then(r=>r.json()).then(data=>{if(data.success&&data.cnyFenPerUsd!=null)setRate(String(data.cnyFenPerUsd/100));}).catch(()=>setNotice('汇率加载失败'));},[]);
  const save=async()=>{const cnyFenPerUsd=Math.round(Number(rate)*100);if(!Number.isInteger(cnyFenPerUsd)||cnyFenPerUsd<100||cnyFenPerUsd>2000){setNotice('汇率须在 1.00 至 20.00 元之间');return;}setBusy(true);try{const response=await apiFetch('/api/points/exchange-rate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cnyFenPerUsd})});const data=await response.json();if(!response.ok||!data.success)throw new Error(data.message||'保存失败');setNotice('汇率已保存；未来创建的充值订单将锁定创建时的报价');}catch(error){setNotice(error.message)}finally{setBusy(false)}};
  return <section className="rounded-xl border border-cyan-400/20 bg-slate-900/60 p-5"><h2 className="font-bold text-white">积分充值汇率</h2><p className="mt-2 text-sm text-slate-400">1 积分按 1 USD 计价。设置 1 USD 对应的人民币金额；报价会在未来的充值订单创建时锁定。真实支付仍未开放。</p><div className="mt-4 flex flex-wrap items-center gap-3"><label className="text-sm text-slate-300">1 USD = <input type="number" min="1" max="20" step="0.01" value={rate} onChange={event=>setRate(event.target.value)} className="ml-2 w-28 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"/> CNY</label><button disabled={busy} onClick={save} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">保存汇率</button></div>{notice&&<p role="status" className="mt-3 text-sm text-slate-300">{notice}</p>}</section>;
}
