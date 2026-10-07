'use client';

import {useEffect,useState} from 'react';
import {apiFetch} from '@/lib/api-client';

export default function PointExchangeRateAdmin(){
  const [mode,setMode]=useState('auto');
  const [rate,setRate]=useState('');
  const [referenceDate,setReferenceDate]=useState(null);
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{apiFetch('/api/points/exchange-rate',{cache:'no-store'}).then(r=>r.json()).then(data=>{
    if(!data.success)throw new Error(data.message||'汇率加载失败');
    setMode(data.mode||'auto');
    setRate(data.cnyFenPerUsd!=null?String(data.cnyFenPerUsd/100):'');
    setReferenceDate(data.referenceDate||null);
    if(data.feedUnavailable)setNotice('汇率来源暂不可用；旧报价仅在有效期内使用。');
  }).catch(error=>setNotice(error.message));},[]);
  const save=async()=>{
    const cnyFenPerUsd=Math.round(Number(rate)*100);
    if(mode==='manual'&&(!Number.isInteger(cnyFenPerUsd)||cnyFenPerUsd<100||cnyFenPerUsd>2000)){
      setNotice('手动汇率须在 1.00 至 20.00 元之间');return;
    }
    setBusy(true);setNotice('');
    try{
      const response=await apiFetch('/api/points/exchange-rate',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(mode==='auto'?{mode:'auto'}:{mode:'manual',cnyFenPerUsd})});
      const data=await response.json();
      if(!response.ok||!data.success)throw new Error(data.message||'保存失败');
      setRate(data.cnyFenPerUsd!=null?String(data.cnyFenPerUsd/100):'');
      setReferenceDate(data.referenceDate||null);
      setNotice(mode==='auto'?(data.cnyFenPerUsd!=null?'自动汇率已启用；新充值订单将锁定创建时的报价。':'已启用自动汇率，但当前数据不可用，充值报价暂停。'):
        '手动汇率已保存；新充值订单将锁定创建时的报价。');
    }catch(error){setNotice(error.message);}finally{setBusy(false);}
  };
  return <section className="rounded-xl border border-cyan-400/20 bg-slate-900/60 p-5">
    <h2 className="font-bold text-white">积分充值汇率</h2>
    <p className="mt-2 text-sm text-slate-400">1 积分按 1 USD 计价。自动模式根据欧洲央行公布的 EUR/USD 与 EUR/CNY 参考值换算；仅使用五日内发布的数据。新订单创建时锁定人民币报价，已有订单不受汇率变化影响。</p>
    <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-200">
      <label className="flex items-center gap-2"><input type="radio" name="point-rate-mode" checked={mode==='auto'} onChange={()=>setMode('auto')}/>每日自动更新</label>
      <label className="flex items-center gap-2"><input type="radio" name="point-rate-mode" checked={mode==='manual'} onChange={()=>setMode('manual')}/>手动覆盖</label>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3"><label className="text-sm text-slate-300">1 USD = <input type="number" min="1" max="20" step="0.01" value={rate} disabled={mode==='auto'} onChange={event=>setRate(event.target.value)} className="ml-2 w-28 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-60"/> CNY</label>
      <button disabled={busy} onClick={save} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy?'处理中…':mode==='auto'?'启用并刷新':'保存手动汇率'}</button>
    </div>
    {mode==='auto'&&<p className="mt-3 text-xs text-slate-400">{referenceDate?`参考汇率发布日期：${referenceDate}`:'暂无有效参考汇率'} · <a href="https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">查看欧洲央行原始数据</a>。休市日沿用最近有效发布值；来源过期时暂停新报价。</p>}
    {notice&&<p role="status" className="mt-3 text-sm text-slate-300">{notice}</p>}
  </section>;
}
