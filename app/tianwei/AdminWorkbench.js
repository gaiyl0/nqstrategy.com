"use client";

import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Box, Coins, Flag, HandCoins } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Button, Panel } from '@/app/components/ui/UiKit';

const queues = [
  ['策略审核', 'products', Box, '审核程序、描述与验证资料'],
  ['积分任务核验', 'points', Coins, '核验注册入金及其他人工任务'],
  ['积分提现审核', 'pointWithdrawals', HandCoins, '复核可提现来源与实际打款'],
  ['论坛举报处理', 'reports', Flag, '查看举报证据并处理内容'],
];

export default function AdminWorkbench({ onSelect }) {
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch('/api/points/admin?view=summary', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success || !queues.every(([, key]) => Number.isInteger(data.pendingCounts?.[key]))) throw new Error(data.message || '待办读取失败');
      setCounts(data.pendingCounts);
      setUpdatedAt(new Date());
    } catch (failure) { setError(failure.message || '待办读取失败，请重试'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = setTimeout(refresh, 0); return () => clearTimeout(timer); }, [refresh]);
  return <div className="space-y-5" aria-busy={loading}>
    <div className="flex items-center justify-between gap-4"><p className="text-sm text-slate-500">{updatedAt ? `读取于 ${updatedAt.toLocaleTimeString()}；处理后返回工作台将重新读取。` : '正在读取实际待办数量……'}</p><Button onClick={refresh} loading={loading}>刷新待办</Button></div>
    {error && <Panel role="alert" className="p-4 text-sm">{error}。{counts ? '下面保留上次读取结果。' : '尚未取得待办数量。'}</Panel>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{queues.map(([label, target, Icon, hint], index) => <Panel key={`dashboard-metric-${label}-${index}`} className="admin-stat-card p-5"><Icon className="h-5 w-5 text-cyan-500"/><p className="mt-3 text-sm font-semibold">{label}</p><p className="mt-2 text-3xl font-black">{counts ? counts[target] : '—'}</p><p className="mt-3 text-sm text-slate-500">{hint}</p></Panel>)}</section>
    <Panel className="overflow-hidden"><div className="border-b border-slate-700 p-5"><h2 className="font-bold">审核工作台 · 待办队列</h2><p className="mt-2 text-sm text-slate-500">数量来自全量待处理记录，点击进入对应审核页面。</p></div>{queues.map(([label, target, Icon, hint], index) => <button key={`queue-${target}-${index}`} type="button" onClick={() => onSelect(target)} className="flex w-full items-center gap-4 border-b border-slate-700/30 px-5 py-4 text-left transition-colors hover:bg-cyan-500/10 focus-visible:outline-2 focus-visible:outline-cyan-500"><Icon className="h-5 w-5 shrink-0"/><span className="flex-1"><span className="block font-semibold">{label}</span><span className="mt-1 block text-sm text-slate-500">{hint}</span></span><span>{counts ? `${counts[target]} 条` : '待读取'}</span><ArrowUpRight className="h-4 w-4"/></button>)}</Panel>
    <Panel className="p-5"><h2 className="font-bold">常用配置</h2><div className="mt-4 flex flex-wrap gap-3">{[['brandPages','品牌、导航与页面'],['advertising','广告与注册链接'],['featured','首页精选'],['paymentSettings','支付渠道'],['communityCategories','论坛栏目']].map(([target,label]) => <Button key={target} onClick={() => onSelect(target)}>{label}</Button>)}</div><p className="mt-4 text-sm text-slate-500">旧美元钱包、新闻和类型速览配置保留在“系统维护”的历史配置中；支付是否可用以渠道配置与商户资料为准。</p></Panel>
  </div>;
}
