"use client";

import { useMemo, useState } from 'react';
import {
  AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileCheck2,
  FileText, Filter, MoreHorizontal, Search, ShieldCheck, ShieldQuestion, SlidersHorizontal,
  X, XCircle,
} from 'lucide-react';
import { AdminLocale } from './admin-locale';

const REQUIRED_EVIDENCE = ['settings', 'statistics', 'chart'];
const EVIDENCE_LABELS = { settings: '设置截图', statistics: '统计截图', chart: '净值曲线', analysis: '后台分析' };
const PAGE_SIZE = 10;

function verificationActive(product) {
  return Boolean(product.verification?.status === 'active' && product.verification?.level && product.verification.level !== 'unverified');
}

function productState(product) {
  const evidence = product.evidence || [];
  const approved = REQUIRED_EVIDENCE.filter(type => evidence.some(item => item.type === type && item.reviewStatus === 'approved'));
  const rejected = evidence.some(item => item.reviewStatus === 'rejected');
  const complete = Boolean(product.metrics && product.report && approved.length === REQUIRED_EVIDENCE.length);
  const hasVerificationMaterials = Boolean(product.metrics || product.report || evidence.length);
  const approvalEligible = !hasVerificationMaterials || complete;
  const reviewed = product.status === 'active';
  const certified = verificationActive(product);
  const reviewState = rejected ? 'rejected' : reviewed ? 'approved' : hasVerificationMaterials && !complete ? 'incomplete' : 'pending';
  return { approvedCount: approved.length, complete, hasVerificationMaterials, approvalEligible, reviewed, certified, reviewState };
}

function StatusBadge({ tone, children }) {
  const tones = {
    cyan: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-300', green: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    amber: 'border-amber-400/25 bg-amber-400/10 text-amber-300', purple: 'border-violet-400/25 bg-violet-400/10 text-violet-300',
    red: 'border-red-400/25 bg-red-400/10 text-red-300', slate: 'border-slate-700 bg-slate-800/70 text-slate-400',
  };
  return <span data-tone={tone} className={`admin-review-badge inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold ${tones[tone] || tones.slate}`}>{children}</span>;
}

function SummaryCard({ label, count, tone, icon: Icon, active, onClick }) {
  const tones = {
    amber: 'border-amber-400/20 bg-amber-400/[.07] text-amber-300', cyan: 'border-cyan-400/20 bg-cyan-400/[.07] text-cyan-300',
    purple: 'border-violet-400/20 bg-violet-400/[.07] text-violet-300', green: 'border-emerald-400/20 bg-emerald-400/[.07] text-emerald-300',
    orange: 'border-orange-400/20 bg-orange-400/[.07] text-orange-300', red: 'border-red-400/20 bg-red-400/[.07] text-red-300',
  };
  return <button type="button" onClick={onClick} aria-pressed={active} data-tone={tone} className={`admin-review-summary flex min-w-0 items-center gap-3 rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-current ${tones[tone]} ${active ? 'ring-1 ring-current' : ''}`}><span className="rounded-lg bg-black/20 p-2.5"><Icon className="h-5 w-5" /></span><span><span className="block text-xs text-slate-400">{label}</span><span className="nq-number mt-1 block text-2xl font-black">{count}</span></span></button>;
}

export default function ProductReviewWorkspace({ lang, products, onProductStatus, onDelete, onEvidenceReview, onVerification, onRevokeVerification, onVersionReview }) {
  const [mode, setMode] = useState('review');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [author, setAuthor] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [page, setPage] = useState(1);

  const rows = useMemo(() => products.map(product => ({ product, state: productState(product) })), [products]);
  const counts = useMemo(() => ({
    pending: rows.filter(row => row.state.reviewState === 'pending').length,
    approved: rows.filter(row => row.state.reviewed).length,
    certificationPending: rows.filter(row => row.state.reviewed && !row.state.certified).length,
    certified: rows.filter(row => row.state.certified).length,
    incomplete: rows.filter(row => row.state.reviewState === 'incomplete').length,
    rejected: rows.filter(row => row.state.reviewState === 'rejected').length,
  }), [rows]);
  const authors = useMemo(() => [...new Set(products.map(product => product.author).filter(Boolean))].sort(), [products]);
  const filtered = useMemo(() => rows.filter(({ product, state }) => {
    const textMatches = !query.trim() || `${product.title} ${product.author}`.toLowerCase().includes(query.trim().toLowerCase());
    if (!textMatches || (author !== 'all' && product.author !== author)) return false;
    if (filter === 'all') return true;
    if (filter === 'pending') return state.reviewState === 'pending';
    if (filter === 'approved') return state.reviewed;
    if (filter === 'incomplete') return state.reviewState === 'incomplete';
    if (filter === 'rejected') return state.reviewState === 'rejected';
    if (filter === 'certificationPending') return state.reviewed && !state.certified;
    if (filter === 'certified') return state.certified;
    if (filter === 'unverified') return !state.certified;
    return true;
  }), [rows, query, author, filter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = products.find(product => product.id === selectedId) || null;


  const chooseSummary = value => {
    if (value === 'certificationPending' || value === 'certified') setMode('verification');
    else setMode('review');
    setFilter(value);
    setPage(1);
  };
  const filters = mode === 'review'
    ? [['all', '全部'], ['pending', '待审核'], ['approved', '已通过'], ['incomplete', '资料不完整'], ['rejected', '已驳回']]
    : [['all', '全部'], ['certificationPending', '待认证'], ['certified', '已认证'], ['unverified', '未认证']];

  return <AdminLocale lang={lang}><section className="nq-readable relative space-y-5 pb-20 animate-in fade-in duration-300">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
      <SummaryCard label="待审核" count={counts.pending} tone="amber" icon={Clock3} active={filter === 'pending'} onClick={() => chooseSummary('pending')} />
      <SummaryCard label="已审核" count={counts.approved} tone="cyan" icon={CheckCircle2} active={filter === 'approved'} onClick={() => chooseSummary('approved')} />
      <SummaryCard label="待认证" count={counts.certificationPending} tone="purple" icon={ShieldQuestion} active={filter === 'certificationPending'} onClick={() => chooseSummary('certificationPending')} />
      <SummaryCard label="已认证" count={counts.certified} tone="green" icon={ShieldCheck} active={filter === 'certified'} onClick={() => chooseSummary('certified')} />
      <SummaryCard label="资料不完整" count={counts.incomplete} tone="orange" icon={AlertTriangle} active={filter === 'incomplete'} onClick={() => chooseSummary('incomplete')} />
      <SummaryCard label="已驳回" count={counts.rejected} tone="red" icon={XCircle} active={filter === 'rejected'} onClick={() => chooseSummary('rejected')} />
    </div>

    <div className="border-b border-slate-800"><div className="flex gap-7">
      {[['review', '策略审核'], ['verification', '证据认证']].map(([value, label]) => <button key={value} type="button" onClick={() => { setMode(value); setFilter('all'); setPage(1); }} className={`border-b-2 px-1 pb-3 text-sm font-bold ${mode === value ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-white'}`}>{label}</button>)}
    </div></div>

    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">{filters.map(([value, label]) => <button key={value} type="button" onClick={() => { setFilter(value); setPage(1); }} data-active={filter === value} className={`admin-review-filter rounded-lg border px-3 py-2 text-xs font-bold ${filter === value ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-300' : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:text-white'}`}>{label}</button>)}</div>
      <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_180px]">
        <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/70 px-3"><Search className="h-4 w-4 text-slate-400" /><input aria-label="搜索策略名称或开发者" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="搜索策略名称、开发者…" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none" /></label>
        <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/70 px-3"><Filter className="h-4 w-4 text-slate-400" /><select aria-label="按开发者筛选" value={author} onChange={event => { setAuthor(event.target.value); setPage(1); }} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-slate-300 outline-none"><option value="all">全部开发者</option>{authors.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 text-xs text-slate-400"><SlidersHorizontal className="h-4 w-4" />最新提交优先</div>
      </div>
    </div>

    <div className={`overflow-hidden rounded-2xl border border-slate-800 bg-[#09121c]/80 ${selected ? 'xl:mr-[430px]' : ''}`}>
      <div className="space-y-3 p-3 lg:hidden" aria-label="策略审核卡片列表">{pageRows.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">当前分类没有策略</p> : pageRows.map(({product, state}) => {
        const reviewBadge = state.reviewState === 'approved' ? ['green', '已通过'] : state.reviewState === 'pending' ? ['amber', '待审核'] : state.reviewState === 'rejected' ? ['red', '已驳回'] : ['amber', '资料不完整'];
        return <article key={product.id} className={`admin-review-card min-w-0 space-y-3 rounded-xl border bg-slate-950/50 p-4 ${selectedId === product.id ? 'border-cyan-400/60' : 'border-slate-800'}`}>
          <h2 className="break-words text-base font-bold text-white">{product.title}</h2>
          <p className="break-words text-xs text-slate-400">开发者：{product.author || '—'}</p>
          <div className="flex flex-wrap gap-2"><StatusBadge tone={reviewBadge[0]}>审核：{reviewBadge[1]}</StatusBadge><StatusBadge tone={state.certified ? 'green' : state.reviewed ? 'purple' : 'slate'}>认证：{state.certified ? '已认证' : state.reviewed ? '待认证' : '未认证'}</StatusBadge></div>
          <p className="text-xs leading-5 text-slate-400">{state.hasVerificationMaterials ? `资料完整度：${state.approvedCount}/${REQUIRED_EVIDENCE.length} 必需证据通过；${product.report ? 'MT5 报告已解析' : '未提供 MT5 报告'}` : '未提供验证资料 · 可进行基础审核'}</p>
          <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400"><span>版本：v{product.currentVersion?.version || product.versions?.[0]?.version || '—'}</span><span>价格：${product.price}</span></div>
          <p className="text-xs text-slate-400">提交时间：{product.created_at ? new Date(product.created_at).toLocaleString() : '—'}</p>
          <button type="button" aria-label={`查看 ${product.title}`} onClick={() => setSelectedId(product.id)} className="min-h-11 w-full rounded-lg border border-cyan-400/30 px-3 py-2 text-sm font-bold text-cyan-300 hover:bg-cyan-400/10">查看详情与审核操作</button>
        </article>;
      })}</div>
      <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[940px] text-left text-sm"><thead><tr className="border-b border-slate-800 bg-slate-950/60 text-xs uppercase tracking-wide text-slate-400"><th className="px-4 py-3">策略</th><th className="px-4 py-3">开发者</th><th className="px-4 py-3">资料完整度</th><th className="px-4 py-3">审核状态</th><th className="px-4 py-3">认证状态</th><th className="px-4 py-3">提交时间</th><th className="px-4 py-3 text-right">操作</th></tr></thead>
        <tbody>{pageRows.length === 0 ? <tr><td colSpan="7" className="px-5 py-16 text-center text-slate-400">当前分类没有策略</td></tr> : pageRows.map(({ product, state }) => {
          const completion = Math.round((state.approvedCount / REQUIRED_EVIDENCE.length) * 100);
          const reviewBadge = state.reviewState === 'approved' ? ['green', '已通过'] : state.reviewState === 'pending' ? ['amber', '待审核'] : state.reviewState === 'rejected' ? ['red', '已驳回'] : ['amber', '资料不完整'];
          return <tr key={product.id} data-selected={selectedId === product.id} onClick={() => setSelectedId(product.id)} className={`admin-review-row cursor-pointer border-b border-slate-800/70 transition hover:bg-cyan-400/[.04] ${selectedId === product.id ? 'bg-cyan-400/[.07] ring-1 ring-inset ring-cyan-400/60' : ''}`}>
            <td className="px-4 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-400/15 bg-cyan-400/10 font-black text-cyan-300">{product.title?.slice(0, 1)?.toUpperCase()}</span><div><p className="font-bold text-white">{product.title}</p><p className="mt-1 text-xs text-slate-400">{product.report ? `MT5 已解析 · Parser v${product.report.parserVersion}` : '缺少 MT5 HTML 原始报告'}</p><p className="mt-0.5 text-xs text-slate-400">v{product.currentVersion?.version || product.versions?.[0]?.version || '—'}</p></div></div></td>
            <td className="px-4 py-4 text-slate-300">{product.author}</td>
            <td className="px-4 py-4">{state.hasVerificationMaterials ? <div className="flex items-center gap-2"><span className="nq-number text-xs font-bold text-slate-300">{state.approvedCount}/{REQUIRED_EVIDENCE.length}</span><span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800"><span className={`block h-full rounded-full ${completion === 100 && product.report && product.metrics ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${completion}%` }} /></span></div> : <StatusBadge tone="orange">未提供验证资料</StatusBadge>}</td>
            <td className="px-4 py-4"><StatusBadge tone={reviewBadge[0]}>{reviewBadge[1]}</StatusBadge></td>
            <td className="px-4 py-4"><StatusBadge tone={state.certified ? 'green' : state.reviewed ? 'purple' : 'slate'}>{state.certified ? '已认证' : state.reviewed ? '待认证' : '未认证'}</StatusBadge></td>
            <td className="px-4 py-4 text-xs text-slate-400">{product.created_at ? new Date(product.created_at).toLocaleString() : '—'}</td>
            <td className="px-4 py-4 text-right"><button type="button" aria-label={`查看 ${product.title}`} onClick={event => { event.stopPropagation(); setSelectedId(product.id); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-cyan-300"><MoreHorizontal className="h-5 w-5" /></button></td>
          </tr>;
        })}</tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-4 py-3 text-xs text-slate-400"><span>共 {filtered.length} 条记录</span><div className="flex items-center gap-2"><button type="button" aria-label="上一页审核记录" disabled={page === 1} onClick={() => setPage(value => value - 1)} className="min-h-11 min-w-11 rounded border border-slate-800 p-2 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button><span className="rounded border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 font-bold text-cyan-300">{page}</span><button type="button" aria-label="下一页审核记录" disabled={page === totalPages} onClick={() => setPage(value => value + 1)} className="min-h-11 min-w-11 rounded border border-slate-800 p-2 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button><span>共 {totalPages} 页</span></div></div>
    </div>

    {selected && <ReviewDrawer product={selected} state={productState(selected)} onClose={() => setSelectedId(null)} onProductStatus={onProductStatus} onDelete={onDelete} onEvidenceReview={onEvidenceReview} onVerification={onVerification} onRevokeVerification={onRevokeVerification} onVersionReview={onVersionReview} />}
  </section></AdminLocale>;
}

function ReviewDrawer({ product, state, onClose, onProductStatus, onDelete, onEvidenceReview, onVerification, onRevokeVerification, onVersionReview }) {
  const evidenceByType = Object.fromEntries((product.evidence || []).map(item => [item.type, item]));
  const metrics = product.metrics;
  return <aside className="nq-readable fixed bottom-0 top-16 right-0 z-20 w-full overflow-y-auto border-l border-slate-800 bg-[#08111a] shadow-2xl shadow-black/50 sm:w-[430px]">
    <div className="sticky top-0 z-10 border-b border-slate-800 bg-[#08111a]/95 p-5 backdrop-blur"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-xl font-black text-white">{product.title}</h2><StatusBadge tone={state.reviewed ? 'cyan' : 'amber'}>{state.reviewed ? '已审核' : '待审核'}</StatusBadge><StatusBadge tone={state.certified ? 'green' : 'slate'}>{state.certified ? '已认证' : '未认证'}</StatusBadge></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400"><span>开发者 <b className="text-slate-200">{product.author}</b></span><span>价格 <b className="text-cyan-300">${product.price}</b></span><span>版本 <b className="text-slate-200">v{product.currentVersion?.version || product.versions?.[0]?.version || '—'}</b></span></div></div><button onClick={onClose} aria-label="关闭审核详情" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button></div></div>
    <div className="space-y-6 p-5">
      <section><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-white">审核清单 · 验证资料</h3><span className={`text-xs font-bold ${state.complete ? 'text-emerald-300' : 'text-slate-400'}`}>{state.hasVerificationMaterials ? `${state.approvedCount}/${REQUIRED_EVIDENCE.length} 必需证据通过` : '未提供（允许基础审核）'}</span></div><div className="overflow-hidden rounded-xl border border-slate-800">{['settings', 'statistics', 'chart', 'analysis'].map(type => {
        const item = evidenceByType[type];
        const approved = item?.reviewStatus === 'approved';
        return <div key={type} className="flex items-center gap-3 border-b border-slate-800 px-3 py-3 last:border-0"><FileText className="h-4 w-4 text-slate-400" /><span className="flex-1 text-sm text-slate-300">{EVIDENCE_LABELS[type]}</span>{item ? <><span className={`flex items-center gap-1 text-xs ${approved ? 'text-emerald-300' : item.reviewStatus === 'rejected' ? 'text-red-300' : 'text-amber-300'}`}>{approved ? <Check className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}{approved ? '已通过' : item.reviewStatus === 'rejected' ? '已拒绝' : '待审核'}</span><a href={item.previewUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-cyan-300 hover:text-cyan-200">查看</a></> : <span className="text-xs text-slate-400">未提供</span>}</div>;
      })}</div></section>

      <section><h3 className="mb-3 font-bold text-white">MT5 报告</h3><div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs">{product.report ? <div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-emerald-300" /><span className="font-bold text-emerald-300">已解析</span><span className="min-w-0 truncate text-slate-400">SHA {product.report.sha256.slice(0, 14)}… · Parser v{product.report.parserVersion}</span></div> : <div className="flex items-center gap-2 text-amber-300"><AlertTriangle className="h-4 w-4" />未提供验证资料：可进行基础审核并上架，市场将明确提示未验证表现。</div>}</div></section>

      <section><h3 className="mb-3 font-bold text-white">风险摘要</h3><div className="grid grid-cols-2 gap-2">{[
        ['PF', metrics?.profitFactor], ['Sharpe', metrics?.sharpeRatio], ['最大回撤', metrics ? `${metrics.maxDrawdownPercent}%` : null], ['交易', metrics?.totalTrades],
      ].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><p className="text-xs text-slate-400">{label}</p><p className="nq-number mt-1 font-black text-white">{value ?? '—'}</p></div>)}</div></section>

      {(product.evidence || []).some(item => item.reviewStatus === 'pending') && <section><h3 className="mb-3 font-bold text-white">待审证据</h3><div className="space-y-2">{(product.evidence || []).filter(item => item.reviewStatus === 'pending').map(item => <div key={item.id} className="flex items-center gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[.04] p-3"><span className="flex-1 text-xs text-slate-300">{EVIDENCE_LABELS[item.type] || item.type}<span className="ml-2 text-slate-400">OCR {item.extractionStatus}</span></span><button onClick={() => onEvidenceReview(item, 'rejected', product.report)} className="rounded-md border border-red-400/20 px-2 py-1 text-xs font-bold text-red-300">拒绝</button><button onClick={() => onEvidenceReview(item, 'approved', product.report)} className="rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-bold text-emerald-300">证据通过</button></div>)}</div></section>}

      {(product.versions || []).length > 0 && <section><h3 className="mb-3 font-bold text-white">版本审核</h3><div className="space-y-2">{product.versions.map(version => <div key={version.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><div className="flex items-center gap-2"><span className="font-bold text-violet-300">v{version.version}</span>{version.isCurrent && <StatusBadge tone="cyan">当前</StatusBadge>}<span className="ml-auto text-xs text-slate-400">{version.status}</span></div><p className="mt-2 line-clamp-2 text-xs text-slate-400">{version.releaseNotes}</p>{version.status === 'pending' && <div className="mt-3 flex gap-2"><button onClick={() => onVersionReview(version, 'reject')} className="rounded-md border border-red-400/20 px-2 py-1 text-xs text-red-300">拒绝版本</button><button onClick={() => onVersionReview(version, 'approve')} className="rounded-md bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300">发布版本</button></div>}{version.status === 'published' && <button onClick={() => onVersionReview(version, 'retire')} className="mt-3 rounded-md border border-amber-400/20 px-2 py-1 text-xs text-amber-300">下架版本</button>}</div>)}</div></section>}

      <section className="border-t border-slate-800 pt-5"><h3 className="mb-3 font-bold text-white">审核操作</h3>{product.status === 'pending' ? <div className="grid grid-cols-2 gap-2"><button onClick={() => onDelete(product.id, product.title)} className="rounded-lg border border-red-400/30 px-3 py-2.5 text-xs font-bold text-red-300 hover:bg-red-400/10">永久删除</button><button disabled={!state.approvalEligible} onClick={() => onProductStatus(product.id, 'active')} className="rounded-lg bg-cyan-400 px-3 py-2.5 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600">确认通过</button>{!state.approvalEligible && <p className="col-span-2 text-xs text-amber-300">已提交部分验证资料时，必须完成 MT5 报告、结构化指标和三类必需证据审核；未提交任何资料时可按基础审核通过。</p>}{!state.hasVerificationMaterials && <p className="col-span-2 text-xs text-amber-300">将以“未提供验证资料”状态上架，市场不会展示任何未经报告验证的收益、回撤或初始资金。</p>}</div> : <div className="grid grid-cols-2 gap-2"><button onClick={() => onProductStatus(product.id, 'pending')} className="rounded-lg border border-amber-400/30 px-3 py-2.5 text-xs font-bold text-amber-300">下架策略</button><button onClick={() => onDelete(product.id, product.title)} className="rounded-lg border border-red-400/30 px-3 py-2.5 text-xs font-bold text-red-300">永久删除</button></div>}</section>

      {product.status === 'active' && <section className="border-t border-slate-800 pt-5"><div className="flex items-center justify-between"><div><h3 className="font-bold text-white">认证管理</h3><p className="mt-1 text-xs text-slate-400">{state.certified ? `当前等级：${product.verification.level}` : '当前策略尚未获得认证'}</p></div>{state.certified ? <button onClick={() => onRevokeVerification(product)} className="rounded-lg border border-red-400/30 px-3 py-2 text-xs font-bold text-red-300">撤销认证</button> : <button onClick={() => onVerification(product)} className="rounded-lg bg-violet-500/15 px-3 py-2 text-xs font-bold text-violet-300">授予认证</button>}</div></section>}
    </div>
  </aside>;
}
