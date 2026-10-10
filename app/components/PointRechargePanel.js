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
  const [querying,setQuerying]=useState(false);
  const [queryMessage,setQueryMessage]=useState('');
  const [mobile,setMobile]=useState(false);
  const requestRef=useRef(null);
  const providers=state?.rechargeProviders||[];
  const points=Number(amount);
  const amountValid=Number.isFinite(points)&&points>=1&&points<=1000000&&Math.abs(points*100-Math.round(points*100))<0.000001;
  const estimate=amountValid?Math.round(points*100):null;

  useEffect(()=>{
    const query=window.matchMedia('(max-width: 767px), (pointer: coarse)');
    const update=()=>setMobile(query.matches);update();query.addEventListener('change',update);
    const orderId=Number(new URLSearchParams(window.location.search).get('rechargeOrder'));
    let active=true;
    if(Number.isSafeInteger(orderId)&&orderId>0){
      apiFetch(`/api/points/recharge?orderId=${orderId}&reconcile=1`,{cache:'no-store'}).then(response=>response.json()).then(data=>{
        if(!active)return;if(!data.success)throw Error(data.message||'订单读取失败');
        setCheckout({...data.order,orderId:data.order.id,paymentMode:'mobile'});setAmount(String(data.order.points));
        if(data.order.status==='paid')void refresh();
      }).catch(cause=>{if(active)setError(cause.message);});
    }
    return()=>{active=false;query.removeEventListener('change',update);};
  },[refresh]);

  const create=async provider=>{
    if(!amountValid||busy)return;
    setBusy(true);setError('');setQueryMessage('');
    const previous=requestRef.current;
    const requestKey=!['expired','failed','paid'].includes(checkout?.status)&&previous?.provider===provider&&previous?.points===points?previous.key:crypto.randomUUID();
    requestRef.current={provider,points,key:requestKey};
    try{
      const response=await apiFetch('/api/points/recharge',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({provider,points,requestKey,paymentMode:provider==='alipay'&&mobile?'mobile':'qr'})});
      const data=await response.json();
      if(!data.success)throw Object.assign(new Error(data.message||'创建充值订单失败'),{code:data.code});
      setCheckout(data.checkout);setQrData('');
      if(data.checkout.payUrl){
        const paymentUrl=new URL(data.checkout.payUrl);
        if(!['https://openapi.alipay.com/gateway.do','https://openapi-sandbox.dl.alipaydev.com/gateway.do'].includes(`${paymentUrl.origin}${paymentUrl.pathname}`))throw Error('支付跳转地址无效');
        window.location.assign(paymentUrl.href);
      }
    }catch(cause){setError(cause.message||'创建充值订单失败');if(cause.code==='RECHARGE_ORDER_NOT_PAYABLE'){requestRef.current=null;setCheckout(previous=>previous?{...previous,status:'expired'}:previous);}}finally{setBusy(false);}
  };

  const queryPayment=async()=>{
    if(!checkout?.orderId||querying)return;
    setQuerying(true);setError('');setQueryMessage('');
    try{
      const data=await (await apiFetch(`/api/points/recharge?orderId=${checkout.orderId}&reconcile=1`,{cache:'no-store'})).json();
      setCheckout(previous=>({...previous,...data.order,orderId:data.order.id}));
      if(data.order.status==='paid'){requestRef.current=null;await refresh();}
      setQueryMessage(data.order.status==='paid'?t('付款已核验，积分已到账。','Payment verified and points credited.'):data.queryStatus==='unavailable'?t('支付平台查询暂不可用，请稍后重试，不要重复付款。','Payment lookup is temporarily unavailable. Retry later; do not pay twice.'):t('暂未查到成功付款。如已付款，请稍后重试或提供订单号联系客服。','No successful payment found yet. If paid, retry later or contact support with the order number.'));
    }catch(cause){setError(cause.message);}finally{setQuerying(false);}
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
    {!state?.rechargeEnabled?<><p className="mt-3 text-sm leading-6 text-slate-400">{t('充值渠道尚未就绪。','Recharge channels are not ready yet.')}</p><button disabled className="mt-4 rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-400">{t('暂未开放','Not available yet')}</button></>:
      <><p className="mt-3 text-sm text-slate-300">{t('人民币充值：1 元＝1 积分，按付款成功的订单金额到账。','RMB recharge: CNY 1 = 1 point. Points are credited after payment verification.')}</p>
        <label className="mt-4 block text-sm text-slate-200">{t('充值金额（人民币／元）','Recharge amount (CNY)')}<input type="number" min="1" max="1000000" step="0.01" value={amount}
          onChange={event=>{setAmount(event.target.value);requestRef.current=null;}} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm"/></label>
        {estimate!=null&&<p className="mt-2 text-sm text-amber-200">{t('支付金额','Payment amount')} ¥{(estimate/100).toFixed(2)}</p>}
        {amountValid&&<p className="mt-1 text-sm text-slate-300">{t('到账积分','Points credited')}：{points.toFixed(2)}</p>}
        <div className="mt-4 flex flex-wrap gap-2">{providers.includes('wechat')&&<button disabled={!amountValid||busy} onClick={()=>create('wechat')} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold disabled:opacity-50">{t('微信扫码充值','Pay with WeChat')}</button>}{providers.includes('alipay')&&<button disabled={!amountValid||busy} onClick={()=>create('alipay')} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold disabled:opacity-50">{mobile?t('支付宝快捷支付','Pay with Alipay app'):t('支付宝扫码充值','Pay with Alipay')}</button>}</div>
        {mobile&&providers.includes('alipay')&&<p className="mt-2 text-xs leading-5 text-slate-400">{t('点击后进入支付宝官方收银台，尝试唤起支付宝 App。微信内置浏览器如无法打开，请选择“在浏览器打开”。','Continue to the official Alipay checkout to open the app. In WeChat, choose Open in browser if needed.')}</p>}
        {error&&<p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
        {checkout&&<div className="mt-5 rounded-xl border border-slate-600 bg-slate-950/70 p-4"><p className="text-sm font-semibold">{checkout.status==='paid'?t('充值已到账','Payment credited'):checkout.status==='pending'?checkout.paymentMode==='mobile'?t('等待支付宝确认付款','Waiting for payment confirmation'):t('请使用对应 App 扫码支付','Scan with the selected payment app'):t('订单已失效，请重新创建','Order expired; create a new one')}</p>
          <p className="mt-1 text-sm text-slate-300">#{checkout.orderId} · {checkout.points} {t('积分','points')} · ¥{(checkout.cnyFen/100).toFixed(2)}</p>
          {checkout.status!=='paid'&&<button type="button" disabled={querying||busy} onClick={queryPayment} className="mt-3 rounded-lg border border-slate-600 px-3 py-2 text-sm disabled:opacity-50">{querying?t('查询中…','Checking…'):t('我已付款，查询结果','I paid — check result')}</button>}
          {queryMessage&&<p role="status" className="mt-2 text-sm text-slate-300">{queryMessage}</p>}
          {checkout.status==='pending'&&qrData&&<Image unoptimized src={qrData} alt={t('充值支付二维码','Recharge payment QR code')} width={240} height={240} className="mt-3 rounded-lg bg-white p-2"/>}
          <p className="mt-2 text-xs text-slate-400">{checkout.status==='paid'?t('积分余额已更新。','Your point balance has been updated.'):checkout.status==='pending'?t('请勿重复支付；支付完成后由平台回调核验并自动更新。','Do not pay twice. The server verifies the payment callback before crediting points.'):t('请勿继续支付此订单。','Do not pay this order.')}</p>
        </div>}
      </>}
  </div>;
}
