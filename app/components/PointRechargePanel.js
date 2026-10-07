"use client";

import {useEffect,useRef,useState} from 'react';
import Image from 'next/image';
import {apiFetch} from '@/lib/api-client';

export default function PointRechargePanel({state,refresh,t}){
  const [amount,setAmount]=useState('');
  const [checkout,setCheckout]=useState(null);
  const [qrData,setQrData]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const requestRef=useRef(null);
  const providers=state?.rechargeProviders||[];
  const points=Number(amount);
  const amountValid=Number.isFinite(points)&&points>=1&&points<=1000000&&Math.abs(points*100-Math.round(points*100))<0.000001;
  const estimate=amountValid&&state?.rechargeRateCnyFen?Math.ceil(Math.round(points*100)*state.rechargeRateCnyFen/100):null;

  const create=async provider=>{
    if(!amountValid||busy)return;
    setBusy(true);setError('');
    const previous=requestRef.current;
    const requestKey=checkout?.status!=='expired'&&previous?.provider===provider&&previous?.points===points?previous.key:crypto.randomUUID();
    requestRef.current={provider,points,key:requestKey};
    try{
      const response=await apiFetch('/api/points/recharge',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({provider,points,requestKey})});
      const data=await response.json();
      if(!data.success)throw new Error(data.message||'创建充值订单失败');
      setCheckout(data.checkout);setQrData('');
    }catch(cause){setError(cause.message||'创建充值订单失败');}finally{setBusy(false);}
  };

  useEffect(()=>{
    if(!checkout?.codeUrl||checkout.status!=='pending')return;
    let active=true;
    import('qrcode').then(module=>(module.default||module).toDataURL(checkout.codeUrl,{errorCorrectionLevel:'M',width:240,margin:2}))
      .then(data=>{if(active)setQrData(data);}).catch(()=>{if(active)setError('二维码生成失败，请重新创建订单。');});
    return()=>{active=false;};
  },[checkout?.codeUrl,checkout?.status]);

  useEffect(()=>{
    if(!checkout?.orderId||checkout.status!=='pending')return;
    let active=true;
    const poll=async()=>{
      if(Date.now()>checkout.expiresAt){if(active)setCheckout(previous=>previous?{...previous,status:'expired'}:previous);return;}
      try{
        const response=await apiFetch(`/api/points/recharge?orderId=${checkout.orderId}`,{cache:'no-store'});
        const data=await response.json();
        if(active&&data.order?.status==='paid'){
          setCheckout(previous=>previous?{...previous,status:'paid'}:previous);
          requestRef.current=null;
          await refresh();
        }else if(active&&['failed','expired'].includes(data.order?.status)){
          setCheckout(previous=>previous?{...previous,status:data.order.status}:previous);
        }
      }catch{ /* The signed provider callback remains authoritative; poll again. */ }
    };
    const timer=setInterval(poll,5000);
    poll();
    return()=>{active=false;clearInterval(timer);};
  },[checkout?.orderId,checkout?.expiresAt,checkout?.status,refresh]);

  return <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
    <h2 className="font-bold">{t('积分充值','Buy points')}</h2>
    {!state?.rechargeEnabled?<><p className="mt-3 text-sm leading-6 text-slate-400">{t('充值渠道或有效汇率尚未就绪；人民币报价会在创建订单时锁定。','Recharge channels or a valid exchange rate are not ready. The CNY quote is locked when the order is created.')}</p><button disabled className="mt-4 rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-400">{t('暂未开放','Not available yet')}</button></>:
      <><p className="mt-3 text-sm text-slate-300">{t('每 1 积分按 1 美元计价。支付金额以订单创建时锁定的人民币报价为准。','One point is valued at USD 1. The CNY amount is locked when the order is created.')}</p>
        {state.rechargeRateMode==='auto'&&state.rechargeRateDate&&<p className="mt-1 text-xs text-slate-400">{t('汇率参考数据发布日期','Exchange-rate reference date')}：{state.rechargeRateDate}</p>}
        <label className="mt-4 block text-sm text-slate-200">{t('充值积分数量','Points to buy')}<input type="number" min="1" max="1000000" step="0.01" value={amount}
          onChange={event=>{setAmount(event.target.value);requestRef.current=null;}} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm"/></label>
        {estimate!=null&&<p className="mt-2 text-sm text-amber-200">{t('预计支付','Estimated CNY payment')} ¥{(estimate/100).toFixed(2)}</p>}
        <div className="mt-4 flex flex-wrap gap-2">{providers.includes('wechat')&&<button disabled={!amountValid||busy} onClick={()=>create('wechat')} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold disabled:opacity-50">{t('微信扫码充值','Pay with WeChat')}</button>}{providers.includes('alipay')&&<button disabled={!amountValid||busy} onClick={()=>create('alipay')} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold disabled:opacity-50">{t('支付宝扫码充值','Pay with Alipay')}</button>}</div>
        {error&&<p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
        {checkout&&<div className="mt-5 rounded-xl border border-slate-600 bg-slate-950/70 p-4"><p className="text-sm font-semibold">{checkout.status==='paid'?t('充值已到账','Payment credited'):checkout.status==='pending'?t('请使用对应 App 扫码支付','Scan with the selected payment app'):t('订单已失效，请重新创建','Order expired; create a new one')}</p>
          <p className="mt-1 text-sm text-slate-300">#{checkout.orderId} · {checkout.points} {t('积分','points')} · ¥{(checkout.cnyFen/100).toFixed(2)}</p>
          {checkout.status==='pending'&&qrData&&<Image unoptimized src={qrData} alt={t('充值支付二维码','Recharge payment QR code')} width={240} height={240} className="mt-3 rounded-lg bg-white p-2"/>}
          <p className="mt-2 text-xs text-slate-400">{checkout.status==='paid'?t('积分余额已更新。','Your point balance has been updated.'):checkout.status==='pending'?t('请勿重复支付；支付完成后由平台回调核验并自动更新。','Do not pay twice. The server verifies the payment callback before crediting points.'):t('请勿继续支付此订单。','Do not pay this order.')}</p>
        </div>}
      </>}
  </div>;
}
