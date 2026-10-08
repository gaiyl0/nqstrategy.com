'use client';

import {useEffect,useRef,useState} from 'react';
import {apiFetch} from '@/lib/api-client';

const sdkBase='https://www.paypal.com/sdk/js';

export default function PayPalRechargeButton({points,amountValid,refresh,t}){
  const container=useRef(null);
  const orderRef=useRef(null);
  const tRef=useRef(t);
  const [config,setConfig]=useState(null);
  const [sdkReady,setSdkReady]=useState(false);
  const [error,setError]=useState('');
  const [paid,setPaid]=useState(false);
  const [testPaid,setTestPaid]=useState(false);

  useEffect(()=>{tRef.current=t;},[t]);

  useEffect(()=>{
    let active=true;
    apiFetch('/api/points/paypal',{cache:'no-store'}).then(response=>response.json()).then(data=>{
      if(!data.success)throw new Error(data.message||'PayPal 暂不可用');
      if(active)setConfig(data);
    }).catch(cause=>{if(active)setError(cause.message||'PayPal 暂不可用');});
    return()=>{active=false;};
  },[]);

  useEffect(()=>{
    if(!config?.clientId)return;
    const src=`${sdkBase}?client-id=${encodeURIComponent(config.clientId)}&currency=USD&intent=capture&components=buttons`;
    const existing=document.querySelector('script[data-nq-paypal-sdk]');
    if(existing){
      if(existing.src===src&&window.paypal){queueMicrotask(()=>setSdkReady(true));return;}
      existing.remove();
      delete window.paypal;
    }
    let active=true;
    const script=document.createElement('script');
    script.src=src;script.async=true;script.dataset.nqPaypalSdk='1';
    script.onload=()=>{if(active)setSdkReady(Boolean(window.paypal?.Buttons));};
    script.onerror=()=>{if(active)setError('PayPal 结账组件加载失败');};
    document.head.appendChild(script);
    return()=>{active=false;};
  },[config?.clientId]);

  useEffect(()=>{
    if(!sdkReady||!amountValid||!container.current||!window.paypal?.Buttons)return;
    let active=true;
    const node=container.current;
    node.replaceChildren();
    const buttons=window.paypal.Buttons({
      style:{layout:'horizontal',height:45,label:'paypal'},
      createOrder:async()=>{
        setError('');setPaid(false);setTestPaid(false);
        const previous=orderRef.current;
        const requestKey=previous?.points===points&&previous.expiresAt>Date.now()?previous.requestKey:crypto.randomUUID();
        const response=await apiFetch('/api/points/paypal',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({action:'create',points,requestKey})});
        const data=await response.json();
        if(!response.ok||!data.success)throw new Error(data.message||'无法创建 PayPal 订单');
        orderRef.current={...data.checkout,requestKey};
        return data.checkout.paypalOrderId;
      },
      onApprove:async data=>{
        const order=orderRef.current;
        if(!order||data.orderID!==order.paypalOrderId)throw new Error('PayPal 订单与充值申请不一致');
        const response=await apiFetch('/api/points/paypal',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({action:'capture',orderId:order.orderId,paypalOrderId:data.orderID})});
        const result=await response.json();
        if(!response.ok||!result.success)throw new Error(result.message||'付款核验尚未完成');
        orderRef.current=null;
        if(active){setTestPaid(Boolean(result.settlement?.testMode));setPaid(true);await refresh();}
      },
      onError:cause=>{if(active)setError(cause?.message||'PayPal 支付未完成，请稍后重试');},
      onCancel:()=>{if(active)setError(tRef.current('已取消 PayPal 支付','PayPal checkout canceled'));},
    });
    buttons.render(node).catch(cause=>{if(active)setError(cause?.message||'PayPal 按钮加载失败');});
    return()=>{active=false;buttons.close?.();node.replaceChildren();};
  },[sdkReady,amountValid,points,refresh]);
  return <div className="mt-4 rounded-xl border border-slate-600 bg-slate-950/50 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-white">{t('PayPal 美元充值','PayPal USD recharge')}</strong>
      {config?.mode==='sandbox'&&<span className="rounded border border-amber-400/40 px-2 py-0.5 text-xs text-amber-200">Sandbox</span>}</div>
    {config?.mode==='sandbox'&&<p className="mt-2 text-sm text-amber-200">{t('沙箱测试付款：不增加真实积分或可提现余额。','Sandbox test payment: no real points or withdrawable balance will be credited.')}</p>}
    <p className="mt-1 text-xs leading-5 text-slate-400">{t('1 积分 = 1 美元。付款由 PayPal 处理，本站在服务器核验后发放积分。','1 point = USD 1. PayPal handles checkout; points are credited after server verification.')}</p>
    {amountValid?<p className="mt-2 text-sm text-slate-200">{t('本次应付','Amount due')}：${points.toFixed(2)} USD</p>:<p className="mt-2 text-sm text-slate-400">{t('先输入充值积分数量','Enter the number of points first')}</p>}
    <div ref={container} className="mt-3 min-h-11"/>
    {paid&&<p role="status" className="mt-2 text-sm text-emerald-300">{testPaid?
      t('沙箱付款已核验，未记入真实积分余额。','Sandbox payment verified; real point balance unchanged.'):
      t('PayPal 付款已核验，积分已到账。','PayPal payment verified; points credited.')}</p>}
    {error&&<p role="alert" className="mt-2 text-sm text-amber-200">{error}</p>}
  </div>;
}
