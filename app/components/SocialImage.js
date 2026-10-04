/* eslint-disable @next/next/no-img-element -- next/og renders this image server-side, not as a browser image. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { ImageResponse } from 'next/og';
import { storedPostAttachmentPath } from '@/lib/upload-security';
import { verificationDisplay, displayNumber } from '@/lib/strategy-display.mjs';
import { articleSummary } from '@/lib/share-content.mjs';

let font;
const backgrounds = new Map();
async function background(file) {
  if (!backgrounds.has(file)) backgrounds.set(file, fs.readFile(path.join(process.cwd(),'public',file)).then(bytes=>sharp(bytes).resize(1200,630,{fit:'cover'}).jpeg({quality:85}).toBuffer()));
  return backgrounds.get(file);
}
export async function socialImage(type, data) {
  font ||= fs.readFile(path.join(process.cwd(),'public/fonts/NexusShareSans.ttf'));
  let cover = await background(type==='article' ? data.fallbackCoverUrl.slice(1) : 'images/editorial/hero-mountains.webp');
  if (type==='article' && data.cover) {
    try { cover = await sharp(await fs.readFile(storedPostAttachmentPath(data.cover.stored_name))).resize(1200,630,{fit:'cover'}).jpeg({quality:85}).toBuffer(); } catch { /* A missing attachment uses the category illustration. */ }
  }
  const verified = type==='strategy' ? verificationDisplay(data.verification).label : data.category;
  const reviewed = type==='strategy' && data.report && data.metrics?.reviewedAt;
  const title = data.title.length>60?`${data.title.slice(0,59)}…`:data.title;
  const subtitle = type==='strategy' ? `MT5 · ${data.pairs || '交易品种未披露'}` : articleSummary(data.content,58);
  const metrics = reviewed ? [['Profit Factor',displayNumber(data.metrics.profitFactor)],['Sharpe',displayNumber(data.metrics.sharpeRatio)],['最大回撤',`${displayNumber(data.metrics.maxDrawdownPercent)}%`],['交易次数',displayNumber(data.metrics.totalTrades,0)]] : null;
  return new ImageResponse(<div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',backgroundColor:'#081b2e',fontFamily:'NexusShareSans',color:'#fff',padding:54}}><img src={`data:image/jpeg;base64,${cover.toString('base64')}`} alt="" width={1200} height={630} style={{position:'absolute',top:0,left:0}}/><div style={{position:'absolute',top:0,left:0,width:1200,height:630,background:'linear-gradient(90deg,rgba(4,19,34,.98),rgba(4,19,34,.83) 60%,rgba(4,19,34,.4))'}}/><div style={{display:'flex',alignItems:'center',gap:18,color:'#62e4da',fontSize:29}}><svg width="42" height="42" viewBox="0 0 42 42"><path d="M2 23h8l5-15 7 27 6-18 4 6h8" stroke="#3de0d1" fill="none" strokeWidth="4"/></svg>Nexus Quant<span style={{marginLeft:'auto',fontSize:22,color:'#c4d4e3'}}>nqstrategy.com</span></div><div style={{display:'flex',marginTop:32,fontSize:24,color:'#74e4d8'}}>{verified}</div><div style={{display:'flex',fontSize:title.length>22?46:56,lineHeight:1.35,marginTop:14,maxWidth:960}}>{title}</div><div style={{display:'flex',fontSize:25,marginTop:16,color:'#c7d6e5'}}>{subtitle}</div><div style={{display:'flex',marginTop:'auto',gap:16}}>{metrics ? metrics.map(([label,value])=><div key={label} style={{display:'flex',flexDirection:'column',width:250,padding:16,background:'#143044',borderRadius:12}}><span style={{color:'#bfd0de',fontSize:20}}>{label}</span><span style={{fontSize:30,marginTop:8}}>{value}</span></div>) : <div style={{display:'flex',fontSize:23,color:'#d6e3ed'}}>{type==='article'?`作者：${data.author} · 论坛研究与交流` : data.report?'查看报告资料与策略风险':'未提供验证资料 · 收益与回撤未披露'}</div>}</div><div style={{display:'flex',fontSize:20,color:'#c4d4df',marginTop:24}}>{type==='article'?'研究资料不构成收益承诺或投资建议':'历史表现不代表未来收益 · 上架审核不等于实盘验证'}</div></div>,{width:1200,height:630,fonts:[{name:'NexusShareSans',data:await font,weight:600,style:'normal'}],headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}



