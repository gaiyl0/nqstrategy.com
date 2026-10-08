"use client";

import { useId, useState, useSyncExternalStore } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button, Panel } from './ui/UiKit';

const subscribeMobile = callback => {
  const query = window.matchMedia('(max-width: 767px)');
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
};
const mobileSnapshot = () => window.matchMedia('(max-width: 767px)').matches;
const desktopSnapshot = () => false;

function SearchField({ searchQuery, setSearchQuery, setPage, t }) {
  return <div className="relative min-w-0 flex-1 lg:max-w-xl"><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input aria-label={t('搜索策略、作者或关键词', 'Search strategies, authors or keywords')} value={searchQuery} onChange={event => { setSearchQuery(event.target.value.slice(0,100)); setPage(1); }} placeholder={t('搜索策略、作者或关键词', 'Search strategies, authors or keywords')} className="h-11 w-full rounded-lg border border-slate-700/70 bg-slate-900/65 pl-10 pr-3 text-sm text-slate-200 outline-none focus:border-cyan-400/70"/></div>;
}

function FilterFields({ values, change, pairs, t, tEaType }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <label className="market-filter"><span>{t('品种','Pair')}</span><select value={values.pair} onChange={event => change('pair',event.target.value)}><option value="">{t('全部品种','All pairs')}</option>{[...new Set([...pairs, values.pair].filter(Boolean))].map(pair => <option key={pair}>{pair}</option>)}</select></label>
    <label className="market-filter"><span>{t('策略类型','Strategy type')}</span><select value={values.type} onChange={event => change('type',event.target.value)}><option value="">{t('全部类型','All types')}</option>{[...new Set(['马丁格尔','网格','套汇','趋势','神经网络','多货币',values.type].filter(Boolean))].map(type => <option key={type} value={type}>{tEaType(type)}</option>)}</select></label>
    <label className="market-filter"><span>{t('最大回撤','Max drawdown')}</span><select value={values.maxDrawdown ?? ''} onChange={event => change('maxDrawdown',event.target.value === '' ? null : Number(event.target.value))}><option value="">{t('不限','Any')}</option>{[...new Set([10,20,30,values.maxDrawdown].filter(value => value !== null && value !== undefined))].map(value => <option key={value} value={value}>≤ {value}%</option>)}</select></label>
    <label className="market-filter"><span>{t('认证等级','Verification')}</span><select value={values.verification} onChange={event => change('verification',event.target.value)}><option value="">{t('全部等级','All levels')}</option>{[['unverified',t('全部等级（含未认证）','All levels (including unverified)')],['screenshot_reviewed',t('截图审核+','Screenshots reviewed+')],['report_verified',t('报告验证+','Report verified+')],['reproducible_backtest',t('可复现回测+','Reproducible backtest+')],['platform_rerun',t('平台复跑+','Platform rerun+')],['live_verified',t('实盘验证','Live verified')]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
  </div>;
}

function AppliedFilters({ filters, searchQuery, updateFilter, resetFilters, t, tEaType }) {
  const verification = { unverified:t('全部等级（含未认证）','All levels (including unverified)'), screenshot_reviewed:t('截图审核+','Screenshots reviewed+'), report_verified:t('报告验证+','Report verified+'), reproducible_backtest:t('可复现回测+','Reproducible backtest+'), platform_rerun:t('平台复跑+','Platform rerun+'), live_verified:t('实盘验证','Live verified') };
  const chips = [
    ['pair',filters.pair], ['type',filters.type ? tEaType(filters.type) : ''],
    ['maxDrawdown',filters.maxDrawdown === null ? '' : `${t('回撤','Drawdown')} ≤ ${filters.maxDrawdown}%`],
    ['verification',verification[filters.verification] || filters.verification],
    ['maxPrice',filters.maxPrice === null ? '' : `${t('积分价格','Points price')} ≤ ${filters.maxPrice}`],
  ].filter(([,label]) => label);
  if (!chips.length && !searchQuery) return null;
  return <div className="market-applied-filters mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300" aria-label={t('已生效的筛选条件','Applied filters')}>
    <span role="status">{t('已筛选','Filtered')}{searchQuery ? ` · ${t('搜索','Search')}: ${searchQuery}` : ''}</span>
    {chips.map(([key,label]) => <button key={key} onClick={() => updateFilter(key,key === 'maxDrawdown' || key === 'maxPrice' ? null : '')} aria-label={`${t('移除筛选','Remove filter')}: ${label}`} className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1 text-left"><span className="break-words">{label}</span><X aria-hidden="true" className="h-3.5 w-3.5 shrink-0"/></button>)}
    <button onClick={resetFilters} className="min-h-9 px-2 font-bold text-cyan-300">{t('清除全部','Clear all')}</button>
  </div>;
}

function MobileFilters(props) {
  const { filters, applyFilters, resetFilters, t } = props;
  const [open,setOpen] = useState(false);
  const [draft,setDraft] = useState(filters);
  const id = useId();
  const count = Object.values(filters).filter(value => value !== null && value !== '').length;
  return <>
    <div className="mt-5 flex items-center gap-2"><SearchField {...props}/><Button aria-expanded={open} aria-controls={id} onClick={() => { if (!open) setDraft({...filters}); setOpen(!open); }} className="h-11 shrink-0 px-3"><SlidersHorizontal aria-hidden="true" className="h-4 w-4"/>{t('筛选','Filters')}{count ? ` (${count})` : ''}</Button></div>
    <Panel hidden={!open} id={id} aria-label={t('策略筛选面板','Strategy filter panel')} className="mt-3 p-4"><div className="mb-4 flex items-center justify-between"><h2 className="text-base font-bold text-white">{t('筛选策略','Filter strategies')}</h2><button aria-label={t('关闭筛选面板','Close filter panel')} onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center text-slate-300"><X className="h-4 w-4"/></button></div><FilterFields {...props} values={draft} change={(key,value) => setDraft(current => ({...current,[key]:value}))}/><p className="mt-3 text-xs leading-6 text-slate-400">{t('选择条件后点击应用；关闭面板不会应用未保存的选择。','Apply your selections to update results. Closing discards unapplied changes.')}</p><div className="mt-4 grid grid-cols-2 gap-3"><Button onClick={() => { resetFilters(); setOpen(false); }}>{t('重置筛选','Reset filters')}</Button><Button variant="primary" onClick={() => { applyFilters(draft); setOpen(false); }}>{t('应用筛选','Apply filters')}</Button></div></Panel>
    <AppliedFilters {...props}/>
  </>;
}

export default function MarketFilters(props) {
  const mobile = useSyncExternalStore(subscribeMobile,mobileSnapshot,desktopSnapshot);
  if (mobile) return <MobileFilters key={JSON.stringify(props.filters)} {...props}/>;
  return <><div className="mt-5"><SearchField {...props}/></div><Panel className="mt-4 hidden p-4 md:block"><FilterFields {...props} values={props.filters} change={props.updateFilter}/><div className="mt-3 flex justify-end"><Button onClick={props.resetFilters}>{props.t('重置','Reset')}</Button></div></Panel><AppliedFilters {...props}/></>;
}
