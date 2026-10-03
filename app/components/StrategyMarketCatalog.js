"use client";

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import MarketFilters from './MarketFilters';
import {
  Activity, ArrowRight, BarChart3, BriefcaseBusiness, Check, ChevronRight,
  CircleHelp, Cpu, Database, FileCheck2, Heart, Home, LayoutGrid, LineChart,
  MessageSquareText, Plus, ShieldCheck, SlidersHorizontal,
  Star, UploadCloud, UserRound, UsersRound, X,
} from 'lucide-react';
import { Badge, Button, EmptyState, Panel, Skeleton } from './ui/UiKit';

const number = value => Number.isFinite(Number(value))
  ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—';

const curvePath = points => {
  if (!Array.isArray(points) || points.length < 2) return '';
  const values = points.map(point => Number(point.value)).filter(Number.isFinite);
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  return values.map((value, index) => `${index ? 'L' : 'M'} ${(index / (values.length - 1) * 240).toFixed(1)} ${(64 - ((value - min) / range * 52) - 6).toFixed(1)}`).join(' ');
};

const verifiedLabel = (level, t) => ({
  live_verified: t('实盘验证', 'Live verified'),
  platform_rerun: t('平台复跑', 'Platform rerun'),
  reproducible_backtest: t('可复现回测', 'Reproducible'),
  report_verified: t('MT5 报告已验证', 'MT5 report verified'),
  screenshot_reviewed: t('截图已审核', 'Screenshots reviewed'),
  unverified: t('未认证', 'Unverified'),
}[level || 'unverified']);

function MarketCurve({ product, compact = false, t }) {
  const reviewed = Boolean(product.metrics?.reviewedAt && product.report);
  const path = reviewed ? curvePath(product.metrics?.equityCurve) : '';
  if (!path) return <div className={`${compact ? 'h-12' : 'h-20'} flex items-center justify-center text-xs text-slate-400`}>{t('暂无已审核曲线', 'No reviewed curve')}</div>;
  const returnPercent = Number(product.metrics.initialDeposit) > 0
    ? Number(product.metrics.netProfit) / Number(product.metrics.initialDeposit) * 100 : null;
  return <div className="relative">
    <svg viewBox="0 0 240 64" className={compact ? 'h-12 w-full' : 'h-20 w-full'} role="img" aria-label={t('已审核净值曲线', 'Reviewed equity curve')}>
      <defs><linearGradient id={`market-curve-${product.id}-${compact?'small':'card'}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2dd4bf" stopOpacity=".35"/><stop offset="1" stopColor="#2dd4bf" stopOpacity="0"/></linearGradient></defs>
      <path d={`${path} L 240 64 L 0 64 Z`} fill={`url(#market-curve-${product.id}-${compact?'small':'card'})`}/>
      <path d={path} fill="none" stroke="#2dd4bf" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
    </svg>
    {!compact && <div className="absolute right-1 top-2 text-right"><div className="text-xl font-black text-emerald-300 nq-number">{returnPercent===null?'—':`${number(returnPercent)}%`}</div><div className="text-xs text-slate-400">{t('报告期收益','Report return')}</div></div>}
  </div>;
}

function SideNavigation({ user, setRoute, setAuthModal, t }) {
  const router = useRouter();
  const requireLogin = destination => { if (!user) setAuthModal('login'); else setRoute(destination); };
  const items = [
    [Home, t('首页','Home'), () => setRoute('home')],
    [ShieldCheck, t('策略市场','Strategy Market'), null, true],
    [BriefcaseBusiness, t('我的策略','My Strategies'), () => requireLogin('profile')],
    [UploadCloud, t('发布策略','Publish Strategy'), () => user ? setRoute('upload') : setAuthModal('login')],
    [Database, t('资产与授权','Assets & Licenses'), () => requireLogin('assets')],
    [MessageSquareText, t('开发者社区','Community'), () => setRoute('forum')],
    [CircleHelp, t('帮助中心','Help Center'), () => router.push('/help')],
  ];
  return <aside className="editorial-market-sidebar hidden min-h-[calc(100vh-4rem)] border-r border-slate-800/80 bg-[#07111c]/95 xl:flex xl:w-[194px] xl:flex-col xl:justify-between">
    <nav className="py-5">{items.map(([Icon,label,action,active])=><button key={label} onClick={action||undefined} aria-current={active?'page':undefined} className={`relative flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm transition ${active?'bg-cyan-400/10 font-bold text-cyan-300 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-cyan-300':'text-slate-400 hover:bg-slate-800/45 hover:text-white'}`}><Icon className="h-[18px] w-[18px]"/>{label}</button>)}</nav>
    <div className="m-4 rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/8 to-blue-500/5 p-4"><div className="text-xs font-black text-cyan-300">Nexus Quant</div><p className="mt-2 text-xs leading-5 text-slate-400">{t('专业验证、风险透明的量化策略市场。','A verified, risk-transparent strategy marketplace.')}</p><button onClick={()=>user?setRoute('upload'):setAuthModal('login')} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-400/60 py-2 text-xs font-bold text-cyan-300">{t('发布策略','Publish')}<ArrowRight className="h-3 w-3"/></button></div>
  </aside>;
}

function ComparisonRail({ comparedProducts, compareIds, toggleComparison, setShowComparison, t }) {
  return <aside className="hidden min-h-[calc(100vh-4rem)] border-l border-slate-800/80 bg-[#07111c]/95 2xl:block 2xl:w-[250px] 2xl:p-4">
    <div className="flex items-center justify-between"><h3 className="font-black text-white">{t('策略对比','Strategy Compare')} <span className="text-cyan-300">({compareIds.length}/4)</span></h3>{compareIds.length>0&&<button onClick={()=>compareIds.forEach(toggleComparison)} className="text-xs text-cyan-400">{t('清空','Clear')}</button>}</div>
    <div className="mt-4 space-y-2">{comparedProducts.map(product=><div key={product.id} className="rounded-xl border border-slate-700/70 bg-slate-900/75 p-3"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-950">{product.logo_url?<Image src={product.logo_url} width={32} height={32} alt="" className="h-full w-full object-cover"/>:<Cpu className="h-4 w-4 text-cyan-400"/>}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold text-slate-200">{product.title}</div><div className="truncate text-xs text-slate-400">{product.author}</div></div><button onClick={()=>toggleComparison(product.id)} aria-label={t('移出对比','Remove from compare')}><X className="h-4 w-4 text-slate-400"/></button></div><MarketCurve product={product} compact t={t}/></div>)}</div>
    {compareIds.length<4&&<div className="mt-3 flex min-h-24 items-center justify-center rounded-xl border border-dashed border-slate-600 text-center text-xs leading-5 text-slate-400"><span><Plus className="mx-auto mb-1 h-4 w-4"/>{t('添加策略进行对比','Add a strategy to compare')}<br/>{t('最多 4 个','Up to 4')}</span></div>}
    <Button className="mt-4 w-full" disabled={compareIds.length<2} onClick={()=>setShowComparison(true)}>{t('开始对比','Compare now')}<ArrowRight className="h-4 w-4"/></Button>
    <div className="mt-6 border-t border-slate-800 pt-5"><p className="mb-3 text-xs text-slate-400">{t('对比将分析：','Comparison includes:')}</p>{[t('收益表现','Returns'),t('风险指标','Risk metrics'),t('交易特征','Trading profile'),t('回测分析','Backtest analysis')].map(label=><div key={label} className="mb-2 flex items-center gap-2 text-xs text-slate-400"><Check className="h-3.5 w-3.5 rounded-full bg-emerald-500/20 p-0.5 text-emerald-300"/>{label}</div>)}</div>
  </aside>;
}

function StrategyCard({ product, owned, selected, compareFull, toggleComparison, openDetail, t, tEaType }) {
  const reviewed = Boolean(product.metrics?.reviewedAt && product.report);
  const tags = String(product.ea_type||'').split(',').map(tag=>tag.trim()).filter(Boolean).slice(0,2);
  return <article onClick={()=>openDetail(product)} className="nq-readable group flex min-h-[330px] cursor-pointer flex-col rounded-xl border border-slate-700/55 bg-gradient-to-b from-[#101c2a] to-[#0b1520] p-4 shadow-[0_18px_50px_rgba(0,0,0,.18)] transition hover:-translate-y-0.5 hover:border-cyan-400/45">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="min-w-0 flex-1 text-base font-black leading-6 text-white"><button title={product.title} onClick={event=>{event.stopPropagation();openDetail(product);}} className="market-strategy-title line-clamp-2 w-full break-words text-left">{product.title}</button></h3>{product.verification?.level&&product.verification.level!=='unverified'&&<ShieldCheck className="h-4 w-4 shrink-0 fill-blue-500 text-blue-300"/>}</div><p className="mt-1 line-clamp-2 min-h-12 text-sm leading-6 text-slate-400">{product.description||t('开发者尚未提供策略简介。','No strategy summary provided.')}</p></div><button onClick={event=>{event.stopPropagation();toggleComparison(product.id);}} disabled={!selected&&compareFull} aria-label={selected?t('移出对比','Remove from compare'):t('加入对比','Add to compare')} className={`rounded-lg p-1.5 ${selected?'bg-violet-500/20 text-violet-300':'text-slate-400 hover:bg-slate-800 hover:text-cyan-300'} disabled:opacity-30`}><LayoutGrid className="h-4 w-4"/></button></div>
    <div className="mt-3 flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-950">{product.logo_url?<Image src={product.logo_url} width={32} height={32} alt={`${product.title} logo`} className="h-full w-full object-cover"/>:<UserRound className="h-4 w-4 text-slate-400"/>}</div><span className="min-w-0 flex-1 break-words text-xs text-slate-300">{product.author}</span><span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-amber-300"><Star className="h-3 w-3 fill-amber-300"/>{product.social?.ratingAverage??'—'} <span className="text-slate-400">({product.social?.ratingCount||0})</span></span></div>
    <div className="mt-2"><MarketCurve product={product} t={t}/></div>
    <div className="grid grid-cols-4 gap-y-2 divide-x divide-slate-800 border-y border-slate-800 py-2.5 text-center"><div><strong className="block text-xs text-slate-100 nq-number">{reviewed?number(product.metrics.profitFactor):'—'}</strong><span className="text-xs text-slate-400">Profit Factor</span></div><div><strong className="block text-xs text-slate-100 nq-number">{reviewed?number(product.metrics.sharpeRatio):'—'}</strong><span className="text-xs text-slate-400">Sharpe</span></div><div><strong className="block text-xs text-slate-100 nq-number">{reviewed?`${number(product.metrics.maxDrawdownPercent)}%`:'—'}</strong><span className="text-xs text-slate-400">{t('最大回撤','Max DD')}</span></div><div><strong className="block text-xs text-slate-100 nq-number">{reviewed?number(product.metrics.totalTrades):'—'}</strong><span className="text-xs text-slate-400">{t('交易次数','Trades')}</span></div></div>
    <div className="mt-3 flex flex-wrap gap-1.5"><Badge variant={product.verification?.level&&product.verification.level!=='unverified'?'primary':'neutral'}>{verifiedLabel(product.verification?.level,t)}</Badge>{tags.map(tag=><Badge key={tag} variant="success">{tEaType(tag)}</Badge>)}{owned&&<Badge variant="success">{t('已入库','Owned')}</Badge>}</div>
    <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4"><div><strong className={`text-xl font-black ${product.price>0?'text-rose-300':'text-emerald-300'}`}>{product.price>0?`$${product.price}`:t('免费','Free')}</strong>{product.price>0&&<div className="text-xs text-amber-300">{t('付费暂未开放','Paid checkout unavailable')}</div>}</div><button className="flex items-center gap-2 rounded-lg border border-cyan-400/70 px-4 py-2 text-xs font-bold text-cyan-300 transition group-hover:bg-cyan-400 group-hover:text-slate-950">{t('查看详情','Details')}<ArrowRight className="h-3.5 w-3.5"/></button></div>
  </article>;
}

export default function StrategyMarketCatalog({ products, filteredProducts, myOrders, user, filters, updateFilter, applyFilters, searchQuery, setSearchQuery, page, setPage, pagination, catalogStatus, retry, resetFilters, compareIds, comparedProducts, toggleComparison, showComparison, setShowComparison, comparison, openDetail, setRoute, setAuthModal, pairs, t, tEaType }) {
  const verifiedCount = products.filter(product=>product.verification?.level&&product.verification.level!=='unverified').length;
  const authors = new Set(products.map(product=>product.author_user_id||product.author).filter(Boolean)).size;
  const verifiedRate = products.length ? verifiedCount/products.length*100 : 0;
  return <div className="nq-readable nq-grid-surface min-h-[calc(100vh-4rem)] bg-[#07101a]">
    <div className="mx-auto flex max-w-[1720px]">
      <SideNavigation {...{user,setRoute,setAuthModal,t}}/>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
        <div className="editorial-market-heading flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div><h1 className="text-3xl font-black tracking-tight text-white">{t('策略市场','Strategy Market')}</h1><p className="mt-1 text-sm text-slate-400">{t('汇聚经过专业验证的量化策略，按报告、风险和认证等级筛选。','Discover professionally reviewed strategies by report, risk and verification level.')}</p></div><div className="editorial-stat-grid grid grid-cols-2 gap-2 sm:grid-cols-4">{[[BarChart3,pagination.total,t('策略','Strategies')],[UserRound,authors,t('开发者','Developers')],[UsersRound,products.reduce((sum,p)=>sum+(p.social?.followerCount||0),0),t('关注','Followers')],[FileCheck2,`${number(verifiedRate)}%`,t('已认证','Verified')]].map(([Icon,value,label])=><div key={label} className="flex min-w-28 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2"><div className="rounded-lg bg-slate-800 p-2"><Icon className="h-4 w-4 text-cyan-300"/></div><div><strong className="block text-sm text-white nq-number">{value}</strong><span className="text-xs text-slate-400">{label}</span></div></div>)}</div></div>
        <MarketFilters {...{filters,updateFilter,applyFilters,searchQuery,setSearchQuery,setPage,resetFilters,pairs,t,tEaType}}/>
        {showComparison&&comparison}
        {catalogStatus==='loading'&&<div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{[1,2,3,4,5,6].map(item=><Panel key={item} className="space-y-4 p-4"><Skeleton className="h-10 w-3/4"/><Skeleton className="h-24 w-full"/><Skeleton className="h-12 w-full"/></Panel>)}</div>}
        {catalogStatus==='error'?<div className="mt-5"><EmptyState icon={SlidersHorizontal} title={t('市场查询失败','Market query failed')} description={t('当前筛选已保留，请重试。','Your filters are preserved. Please retry.')} action={<Button onClick={retry}>{t('重试','Retry')}</Button>}/></div>:catalogStatus!=='loading'&&filteredProducts.length===0?<div className="mt-5"><EmptyState icon={LineChart} title={t('没有匹配的策略','No matching strategies')} description={t('调整搜索、回撤或认证条件。','Adjust search, drawdown or verification filters.')} action={<Button onClick={resetFilters}>{t('清除筛选','Clear filters')}</Button>}/></div>:catalogStatus!=='loading'&&<div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{filteredProducts.map(product=><StrategyCard key={product.id} product={product} owned={myOrders.some(order=>order.product_id===product.id)} selected={compareIds.includes(product.id)} compareFull={compareIds.length>=4} {...{toggleComparison,openDetail,t,tEaType}}/>)}</div>}
        {catalogStatus!=='error'&&pagination.totalPages>1&&<div className="mt-7 flex items-center justify-center gap-4"><Button variant="secondary" disabled={pagination.page<=1||catalogStatus==='loading'} onClick={()=>setPage(value=>Math.max(1,value-1))}>{t('上一页','Previous')}</Button><span className="text-xs text-slate-400 nq-number">{pagination.page} / {pagination.totalPages}</span><Button variant="secondary" disabled={pagination.page>=pagination.totalPages||catalogStatus==='loading'} onClick={()=>setPage(value=>value+1)}>{t('下一页','Next')}</Button></div>}
      </main>
      <ComparisonRail {...{comparedProducts,compareIds,toggleComparison,setShowComparison,t}}/>
    </div>
    {compareIds.length>0&&<div className="sticky bottom-3 z-30 mx-4 mt-4 flex items-center justify-between rounded-xl border border-violet-500/30 bg-slate-950/95 p-3 shadow-2xl backdrop-blur 2xl:hidden"><span className="text-xs text-slate-300"><strong className="text-violet-300">{compareIds.length}/4</strong> {t('已选择','selected')}</span><Button size="sm" disabled={compareIds.length<2} onClick={()=>setShowComparison(true)}>{t('开始对比','Compare')}</Button></div>}
  </div>;
}
