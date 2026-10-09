"use client";

import { useState } from 'react';
import { apiFetch, apiErrorMessage } from '@/lib/api-client';
import { newPageBlock, pageTemplate, safePageImage } from '@/lib/page-content.mjs';
import CustomPageContent from '@/app/components/CustomPageContent';

const inputClass='mt-2 w-full rounded-lg border border-slate-600 bg-transparent px-3 py-2 text-sm';
const covers=[['/images/editorial/article-gold.webp','黄金研究'],['/images/editorial/article-ai.webp','科技研究'],['/images/editorial/profile-waves.webp','品牌蓝色波纹']];
function Field({label,value,change,max=500,multiline=false}) {
  return <label className="block text-sm font-medium">{label}{multiline?<textarea rows={4} maxLength={max} value={value||''} onChange={event=>change(event.target.value)} className={inputClass}/>:<input maxLength={max} value={value||''} onChange={event=>change(event.target.value)} className={inputClass}/>}</label>;
}
function ImageField({value,change,onBusy,onMessage}) {
  async function upload(event) {
    const file=event.target.files?.[0];
    event.target.value='';
    if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){onMessage('请选择 PNG、JPEG 或 WebP 图片。');return;}
    if(file.size>2*1024*1024){onMessage('图片不能超过2MB。');return;}
    onBusy(true);
    try {
      const form=new FormData();form.append('file',file);
      const response=await apiFetch('/api/upload',{method:'POST',body:form});
      const data=await response.json();
      if(!response.ok||!data.success||!safePageImage(data.url))throw new Error(data.message||'图片上传失败');
      change(data.url);onMessage('图片已上传并填入编辑稿，仍需保存草稿和发布。');
    }catch(error){onMessage(apiErrorMessage(error,'图片上传失败'));}finally{onBusy(false);}
  }
  return <div className="space-y-3"><Field label="图片地址（站内或 HTTPS）" value={value} change={change}/><div className="flex flex-wrap items-end gap-4"><label className="text-sm">选择站内配图<select className={inputClass} value={covers.some(([url])=>url===value)?value:''} onChange={event=>{if(event.target.value)change(event.target.value);}}><option value="">选择配图</option>{covers.map(([url,label])=><option key={url} value={url}>{label}</option>)}</select></label><label className="text-sm">上传图片<input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} className="mt-2 block text-sm"/></label></div><p className="text-xs leading-6 text-slate-400">上传沿用站点图片校验与安全扫描。使用外部图片时，浏览器直接加载 HTTPS 原图；请使用自己的稳定图片地址。</p></div>;
}
export default function PageContentEditor({pages,onChange,dirty,onBusy}) {
  const [index,setIndex]=useState(0),[preview,setPreview]=useState(false),[message,setMessage]=useState('');
  const position=Math.min(index,Math.max(0,pages.length-1));
  const page=pages[position];
  const update=value=>onChange(pages.map((entry,i)=>i===position?{...entry,...value}:entry));
  const blocks=page?.blocks||[];
  const updateBlock=(id,value)=>update({blocks:blocks.map(block=>block.id===id?{...block,...value}:block)});
  const add=type=>update({blocks:[...blocks,newPageBlock(type,crypto.randomUUID())]});
  const move=(i,direction)=>{const next=[...blocks];[next[i],next[i+direction]]=[next[i+direction],next[i]];update({blocks:next});};
  const create=()=>{let count=pages.length+1;while(pages.some(entry=>entry.slug===`page-${count}`))count++;onChange([...pages,{slug:`page-${count}`,title:'新页面',description:'',body:'',enabled:true,heroImageUrl:'',blocks:[]}]);setIndex(pages.length);};
  return <div className="space-y-5"><p className="text-sm leading-6 text-slate-400">页面地址为 /pages/页面标识。文字、图文和操作引导区块按顺序展示；最多30页，每页16个区块。先保存草稿再预览或发布。</p>
    <div className="flex items-end gap-4">{pages.length>0&&<label className="flex-1 text-sm">选择编辑页面<select className={inputClass} value={position} onChange={event=>{setIndex(Number(event.target.value));setMessage('');}}>{pages.map((entry,i)=><option key={i} value={i}>{entry.title} · /pages/{entry.slug}{entry.enabled?'':' · 停用'}</option>)}</select></label>}<button disabled={pages.length>=30} onClick={create} className="rounded-lg border border-teal-600 px-4 py-2">新建页面</button></div>
    {page&&<article className="space-y-5 rounded-xl border border-slate-700 p-5"><div className="grid grid-cols-2 gap-4"><Field label="页面标题" value={page.title} max={120} change={title=>update({title})}/><Field label="地址标识，例如 about-us" value={page.slug} max={80} change={slug=>update({slug})}/></div><Field label="简介 / SEO 描述" value={page.description} change={description=>update({description})}/><details className="rounded-lg border border-slate-700 p-4"><summary className="cursor-pointer text-sm font-semibold">页面封面图片（可选）</summary><div className="mt-4"><ImageField value={page.heroImageUrl} change={heroImageUrl=>update({heroImageUrl})} onBusy={onBusy} onMessage={setMessage}/><button onClick={()=>update({heroImageUrl:''})} className="mt-3 text-sm text-rose-400">清除封面地址</button></div></details><Field label="正文（保留原有文字，可选）" value={page.body} max={20000} multiline change={body=>update({body})}/>
    <div className="flex flex-wrap gap-3"><button disabled={blocks.length>13} onClick={()=>update({blocks:[...blocks,...pageTemplate('brand',crypto.randomUUID())]})} className="rounded-lg border px-3 py-2 text-sm">追加品牌介绍模板</button><button disabled={blocks.length>13} onClick={()=>update({blocks:[...blocks,...pageTemplate('product',crypto.randomUUID())]})} className="rounded-lg border px-3 py-2 text-sm">追加商品说明模板</button><p className="text-xs leading-6 text-slate-400">模板追加区块，不覆盖现有内容；发布前请改为品牌真实信息。</p></div>
    <div className="space-y-4">{blocks.map((block,i)=><section key={block.id} className="space-y-4 rounded-xl border border-slate-600 p-5"><div className="flex items-center justify-between"><h3 className="font-bold">{i+1}. {block.type==='image'?'图文区':block.type==='action'?'操作引导':'文字区'}</h3><div className="flex gap-4 text-sm"><button aria-label={`上移区块 ${i+1}`} disabled={i===0} onClick={()=>move(i,-1)}>↑</button><button aria-label={`下移区块 ${i+1}`} disabled={i===blocks.length-1} onClick={()=>move(i,1)}>↓</button><button className="text-rose-400" onClick={()=>update({blocks:blocks.filter(entry=>entry.id!==block.id)})}>移除区块</button></div></div><Field label="区块标题" value={block.title} max={120} change={title=>updateBlock(block.id,{title})}/><Field label="文字说明" value={block.text} max={4000} multiline change={text=>updateBlock(block.id,{text})}/><label className="block text-sm">背景风格<select className={inputClass} value={block.tone} onChange={event=>updateBlock(block.id,{tone:event.target.value})}><option value="neutral">浅色内容区</option><option value="blue">深蓝重点区</option><option value="gold">浅金说明区</option></select></label>
    {block.type==='image'&&<><ImageField value={block.imageUrl} change={imageUrl=>updateBlock(block.id,{imageUrl})} onBusy={onBusy} onMessage={setMessage}/><Field label="图片说明（用于无障碍与加载失败）" value={block.imageAlt} max={200} change={imageAlt=>updateBlock(block.id,{imageAlt})}/><label className="block text-sm">图文排列<select className={inputClass} value={block.layout} onChange={event=>updateBlock(block.id,{layout:event.target.value})}><option value="left">图片在左</option><option value="right">图片在右</option><option value="top">图片在上</option></select></label></>}
    {block.type==='action'&&<><Field label="按钮文字" value={block.label} max={40} change={label=>updateBlock(block.id,{label})}/><Field label="目标：/?route=market、/?route=points、/pages/about-us 或 HTTPS 链接" value={block.href} change={href=>updateBlock(block.id,{href})}/></>}
    </section>)}</div><div className="flex gap-3">{[['text','添加文字区'],['image','添加图文区'],['action','添加操作引导']].map(([type,label])=><button key={type} disabled={blocks.length>=16} onClick={()=>add(type)} className="rounded-lg border border-teal-600 px-3 py-2 text-sm">{label}</button>)}</div>
    <div className="flex flex-wrap items-center gap-5 border-t border-slate-700 pt-4"><label className="text-sm"><input type="checkbox" checked={page.enabled} onChange={event=>update({enabled:event.target.checked})}/> 发布时启用</label><button onClick={()=>setPreview(value=>!value)} className="text-sm text-teal-500">{preview?'收起编辑预览':'查看编辑中预览'}</button>{!dirty&&<a href={`/pages/${page.slug}?preview=draft`} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-500">已保存草稿预览 ↗</a>}<button className="ml-auto text-sm text-rose-400" onClick={()=>{onChange(pages.filter((_,i)=>i!==position));setIndex(Math.max(0,position-1));}}>从草稿移除页面</button></div>
    {preview&&<div className="page-editor-preview rounded-xl border border-slate-600 p-5"><p className="mb-4 text-sm text-amber-500">编辑中预览，尚未保存；操作链接仅展示。字段校验在保存时执行。</p><CustomPageContent page={page} interactive={false}/></div>}
    </article>}{message&&<p role="status" className="text-sm">{message}</p>}
  </div>;
}
