"use client";
import { useEffect, useState } from 'react';
import { apiFetch, apiErrorMessage } from '@/lib/api-client';
import { navigationHref, siteBrandSchema } from '@/lib/site-brand.mjs';
import PageContentEditor from './PageContentEditor';
import HomeConfiguration from './HomeConfiguration';
import BrandConfigurationWorkspace from './BrandConfigurationWorkspace';
const inputClass = 'mt-2 w-full rounded-lg border border-slate-600 bg-transparent px-3 py-2 text-sm';
function Field({ label, value, change, max = 500, multiline = false }) {
  return <label className="block text-sm font-medium">{label}{multiline ? <textarea className={inputClass} rows={5} maxLength={max} value={value} onChange={event=>change(event.target.value)} /> : <input className={inputClass} maxLength={max} value={value} onChange={event=>change(event.target.value)} />}</label>;
}
export default function BrandSettings({products=[],settings={}}) {
  const [workspace,setWorkspace]=useState(null), [config,setConfig]=useState(null), [tab,setTab]=useState('navigation');
  const [busy,setBusy]=useState(false), [message,setMessage]=useState(''), [confirm,setConfirm]=useState(null), [preview,setPreview]=useState(false);
  const dirty=Boolean(config&&workspace&&JSON.stringify(config)!==JSON.stringify(workspace.draft));
  async function load() {setBusy(true);try {const data=await(await apiFetch('/api/site-brand',{cache:'no-store'})).json();setWorkspace(data.workspace);setConfig(data.workspace.draft);setMessage('');}catch(error){setMessage(apiErrorMessage(error,'读取失败'));}finally{setBusy(false);}}
  useEffect(()=>{
    let active=true;
    apiFetch('/api/site-brand',{cache:'no-store'}).then(response=>response.json()).then(data=>{if(active){setWorkspace(data.workspace);setConfig(data.workspace.draft);}}).catch(error=>{if(active)setMessage(apiErrorMessage(error,'读取失败'));});
    return ()=>{active=false;};
  },[]);
  function update(key,value){setConfig(previous=>({...previous,[key]:value}));setConfirm(null);}
  async function save(action){
    if(action==='draft'){const result=siteBrandSchema.safeParse(config);if(!result.success){setMessage(result.error.issues[0].message);return;}}
    setBusy(true);try{const data=await(await apiFetch('/api/site-brand',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,revision:workspace.revision,...(action==='draft'?{config}:{})})})).json();setWorkspace(data.workspace);setConfig(data.workspace.draft);setConfirm(null);setMessage(action==='draft'?'草稿已保存，访客展示未改变。':action==='publish'?'设置已发布，请重新打开前台查看。':'已恢复上一版。');}catch(error){setMessage(apiErrorMessage(error,'操作失败'));}finally{setBusy(false);}
  }
  if(!config)return <div className="p-6">{message||'正在读取品牌配置…'}{message&&<button onClick={load}>重新读取</button>}</div>;
  return <section className="reference-brand-settings space-y-6 rounded-xl border border-slate-700 p-6">
    <p className="text-sm leading-6 text-slate-400">管理站点品牌、导航结构与功能模块。版本 {workspace.revision}{dirty?' · 未保存':''}</p>
    <fieldset disabled={busy} className="space-y-6 disabled:opacity-60">
    <div className="reference-brand-tabs" role="tablist" aria-label="品牌配置分类">{[['brand','品牌资料'],['navigation','导航与页面'],['home','首页模块'],['features','功能开关'],...(tab==='pages'?[['pages','页面编辑']]:[])].map(([key,label])=><button role="tab" aria-selected={tab===key} key={key} onClick={()=>setTab(key)}>{label}</button>)}</div>
    {tab==='home'&&<HomeConfiguration config={config} products={products} settings={settings} onChange={next=>{setConfig(next);setConfirm(null);}}/>}
    {tab==='features'&&<div className="space-y-5"><div className="brand-workspace-switches">{[['catalogEnabled','商城功能','关闭公开商品、分享页与新兑换；已有下载与授权保留。'],['tasksEnabled','积分任务','关闭每日奖励与新任务提交；余额、历史任务审核与提现保留。']].map(([key,label,hint])=><div key={key}><div><strong>{label}</strong><button className="reference-switch" role="switch" aria-label={label} aria-checked={config[key]!==false} onClick={()=>update(key,config[key]===false)}><span/></button></div><p>{hint}</p></div>)}</div><h3 className="font-bold">论坛功能</h3><p className="max-w-3xl text-sm leading-7 text-slate-400">仅隐藏菜单请使用导航设置。停用功能后，论坛入口、首页动态和发帖回帖任务会同步关闭；历史帖子、附件、积分记录不会被删除。</p>{[['enabled','启用论坛','用户可浏览列表、发布帖子、回复与获得有效任务奖励。'],['archived','关闭讨论，保留历史文章阅读','隐藏论坛列表入口，停止发帖、回帖与上传；旧文章链接和站点地图继续保留。'],['disabled','完全停用公开论坛','论坛列表、文章与附件不再公开，文章从站点地图移除；管理员仍可治理历史内容。']].map(([value,title,description])=><label key={value} className={`flex cursor-pointer gap-4 rounded-xl border p-5 ${config.forumMode===value?'border-teal-600':'border-slate-600'}`}><input type="radio" name="forumMode" value={value} checked={config.forumMode===value} onChange={()=>update('forumMode',value)}/><span><strong className="block text-base">{title}</strong><span className="mt-2 block text-sm leading-6 text-slate-400">{description}</span></span></label>)}<p className="text-sm leading-6 text-amber-500">完全停用会使已有文章地址返回404，可能影响搜索收录。需要保留搜索入口时，选择“保留历史文章阅读”。保存草稿不会立即改变公开状态，发布后才生效。</p></div>}
    {tab==='brand'&&<div className="grid grid-cols-2 gap-5">{[['name','品牌名称',100],['description','品牌简介（页脚）',500],['logoUrl','Logo 地址（站内图片或 HTTPS）',500],['faviconUrl','浏览器图标地址（PNG / SVG / ICO）',500],['seoTitle','默认 SEO 标题',160],['seoDescription','默认 SEO 描述',500]].map(([key,label,max])=><Field key={key} label={label} max={max} value={config[key]} change={value=>update(key,value)} multiline={['description','seoDescription'].includes(key)}/>)}</div>}
    {tab==='navigation'&&<BrandConfigurationWorkspace config={config} onChange={next=>{setConfig(next);setConfirm(null)}} onPages={()=>setTab('pages')}/>}
    {tab==='pages'&&<PageContentEditor pages={config.pages} onChange={pages=>update('pages',pages)} dirty={dirty} onBusy={setBusy}/>}
    <div className="flex flex-wrap gap-3 border-t border-slate-700 pt-5"><button onClick={()=>save('draft')} className="rounded-lg border border-teal-600 px-4 py-2">保存草稿</button><button onClick={()=>setPreview(value=>!value)} className="rounded-lg border border-slate-600 px-4 py-2">导航预览</button><button disabled={dirty} onClick={()=>setConfirm('publish')} className="rounded-lg bg-teal-600 px-4 py-2 text-white disabled:opacity-40">发布已保存草稿</button><button disabled={dirty||!workspace.history.length} onClick={()=>setConfirm('restore')} className="rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-40">恢复上一版</button><button onClick={load} className="text-sm">重新载入（放弃未保存编辑）</button></div>
    {confirm&&<div role="alert" className="rounded-xl border border-amber-500/40 p-4"><p>{confirm==='publish'?'将发布已保存草稿。':'将恢复上一公开版本并替换草稿。'}移除页面可能影响已有链接，请先检查。</p>{confirm==='publish'&&(workspace.draft.catalogEnabled!==workspace.published.catalogEnabled||workspace.draft.tasksEnabled!==workspace.published.tasksEnabled)&&<p className="mt-2 text-amber-500">商城和积分任务开关将同步生效。已有订单、授权、积分与待审核任务保留。</p>}{workspace.draft.forumMode!==workspace.published.forumMode&&confirm==='publish'&&<p className="mt-2 text-amber-500">本次将切换论坛状态，并同步改变发布、回复、上传及任务奖励。新状态：{workspace.draft.forumMode==='enabled'?'启用':workspace.draft.forumMode==='archived'?'保留历史阅读':'完全停用'}。</p>}<div className="mt-3 flex gap-4"><button className="text-teal-500" onClick={()=>save(confirm)}>确认{confirm==='publish'?'发布':'恢复'}</button><button onClick={()=>setConfirm(null)}>取消</button></div></div>}
    </fieldset>
    {preview&&<div className="rounded-xl border border-slate-700 p-6"><p className="mb-4 text-sm text-amber-500">编辑中预览 · 尚未发布</p><div className="flex flex-wrap gap-5 rounded-xl bg-[#071b2c] p-5 text-white"><strong>{config.name}</strong>{config.navigation.filter(entry=>entry.visible).map((entry,index)=><span key={index} title={navigationHref(entry)}>{entry.label}</span>)}</div><p className="mt-4 whitespace-pre-wrap text-sm">{config.description}</p></div>}
    {message&&<p role="status" className="rounded-lg border border-slate-600 p-4 text-sm">{message}</p>}
  </section>;
}
