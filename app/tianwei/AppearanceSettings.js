"use client";

import { Check } from 'lucide-react';
import { Panel } from '@/app/components/ui/UiKit';

export default function AppearanceSettings({ settings, setSettings, products, tab }) {
  const update = (key,value) => setSettings(previous => ({ ...previous, [key]:value }));
  if (tab === 'appearance') return <div className="grid gap-5 lg:grid-cols-2">{[['frontendDesign','前台展示设计'],['adminDesign','管理后台展示设计']].map(([key,title]) => <Panel key={key} className="p-6"><h2 className="mb-5 text-lg font-bold">{title}</h2><div className="space-y-4">{[['classic','经典深色','保留现有深色界面与布局。'],['editorial','清爽内容','深海蓝导航、浅色卡片、青绿操作与黄金专题。']].map(([value,label,description]) => <label key={value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 p-4"><input type="radio" name={key} value={value} checked={(settings[key] || 'classic') === value} onChange={() => update(key,value)} className="mt-1"/><div><strong>{label}</strong><p className="mt-2 text-xs leading-6 text-slate-500">{description}</p><div style={{backgroundColor:value === 'classic' ? '#07101a' : '#f4f6f8'}} className={`mt-3 h-12 w-48 rounded-lg border ${value === 'classic' ? 'bg-slate-950' : 'bg-slate-100'}`}><div style={{backgroundColor:'#101c2c'}} className="h-3 rounded-t-lg"/><span className="m-2 block h-4 w-12 rounded bg-teal-500"/></div></div>{(settings[key] || 'classic') === value && <Check className="ml-auto h-5 w-5 text-teal-500"/>}</label>)}</div><p className="mt-4 text-xs leading-6 text-slate-500">由管理员统一指定。保存配置后应用，用户端不提供主题切换按钮。</p></Panel>)}</div>;
  return null;
}
