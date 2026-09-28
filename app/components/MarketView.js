"use client";
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Box, Download, FolderDown, ArrowLeft, CheckCircle2, TrendingUp, ShieldAlert, Cpu, ChevronRight, Filter, Columns3, Heart, Star, UserPlus } from 'lucide-react';
import { FadeInView } from './HomeView'; 
import StrategyMetrics from './StrategyMetrics';
import StrategyComparison from './StrategyComparison';
import { COMPARISON_MAX, COMPARISON_MIN, parseComparisonState, selectComparison, serializeComparisonState } from '@/lib/strategy-comparison.mjs';

export default function MarketView({ products, myOrders, user, handlePurchaseProcess, handleStartTrial, handleSocialAction, handleReport, setRoute, setAuthModal, t, tEaType }) {
  const [view, setViewInternal] = useState('list'); 
  const [selectedEA, setSelectedEAInternal] = useState(null);
  
  const [filters, setFilters] = useState({ pair: '', type: '', verification: '', maxDrawdown: null, maxPrice: null });
  const [searchQuery,setSearchQuery]=useState('');
  const [page,setPage]=useState(1);
  const [catalogProducts,setCatalogProducts]=useState(products);
  const [pagination,setPagination]=useState({page:1,pageSize:12,total:products.length,totalPages:1});
  const [catalogStatus,setCatalogStatus]=useState('idle');
  const [compareIds, setCompareIds] = useState([]);
  const [showComparison, setShowComparison] = useState(false);
  const [urlReady, setUrlReady] = useState(false);

  useEffect(() => {
    const savedView = sessionStorage.getItem('market_view');
    const savedEA = sessionStorage.getItem('market_ea');
    // Browser storage and the shareable URL are external state restored after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedView) setViewInternal(savedView);
    if (savedEA) setSelectedEAInternal(JSON.parse(savedEA));
    const urlState = parseComparisonState(window.location.search);
    setFilters({ pair: urlState.pair, type: urlState.type, verification: urlState.verification, maxDrawdown: urlState.maxDrawdown, maxPrice: urlState.maxPrice });
    setSearchQuery(urlState.q);setPage(urlState.page);
    setCompareIds(urlState.ids);
    if (urlState.ids.length >= COMPARISON_MIN) setShowComparison(true);
    setUrlReady(true);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const query = serializeComparisonState({ ids: compareIds, q:searchQuery, page, ...filters });
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);
  }, [compareIds, filters, searchQuery, page, urlReady]);

  useEffect(()=>{if(!urlReady)return;const controller=new AbortController();const params=new URLSearchParams({market:'1',page:String(page),pageSize:'12'});if(searchQuery)params.set('q',searchQuery);for(const [key,value] of Object.entries(filters))if(value!==null&&value!=='')params.set(key,String(value));/* eslint-disable react-hooks/set-state-in-effect */setCatalogStatus('loading');fetch(`/api/products?${params}`,{cache:'no-store',signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok||!data.success)throw new Error(data.message||'加载失败');setCatalogProducts(data.products);setPagination(data.pagination);if(data.pagination.page!==page)setPage(data.pagination.page);setCatalogStatus('ready');}).catch(error=>{if(error.name!=='AbortError')setCatalogStatus('error');});return()=>controller.abort();},[filters,searchQuery,page,urlReady]);

  const setView = (v) => {
    setViewInternal(v);
    sessionStorage.setItem('market_view', v);
  };

  const setSelectedEA = (ea) => {
    setSelectedEAInternal(ea);
    if (ea) sessionStorage.setItem('market_ea', JSON.stringify(ea));
    else sessionStorage.removeItem('market_ea');
  };

  const openDetail = (ea) => { setSelectedEA(ea); setView('detail'); };

  const filterOptions = ['全部', '马丁格尔', '网格', '套汇', '锁仓', '超短线', '新闻', '趋势', '等级交易', '神经网络', '多货币'];
  const pairs = [...new Set(products.flatMap(product => String(product.pairs || '').split(',').map(item => item.trim()).filter(Boolean)))].sort();
  const filteredProducts = catalogProducts;
  const comparedProducts = compareIds.map(id => products.find(product => product.id === id)).filter(Boolean);
  const updateFilter = (key, value) => {setPage(1);setFilters(current => ({ ...current, [key]: value }));};
  const toggleComparison = (productId) => setCompareIds(current => selectComparison(current, productId));
  const socialAction=async(body,update)=>{const saved=await handleSocialAction(body);if(saved&&selectedEA){const nextSocial=saved.social||{...selectedEA.social,viewer:{...selectedEA.social?.viewer},...update(selectedEA.social||{})};setSelectedEA({...selectedEA,social:nextSocial});}};

  if (view === 'list') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-extrabold text-white flex items-center gap-3"><Box className="w-8 h-8 text-cyan-400" /> {t('EA 策略市场', 'EA Strategy Market')}</h2>
            <p className="text-zinc-500 mt-2 text-sm">{t('发现、回测并部署全球顶级开发者的高性能算法', 'Discover, backtest, and deploy high-performance algorithms from top developers')}</p>
          </div>
          <button onClick={() => { if (!user) return setAuthModal('login'); setRoute('upload'); }} className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-2 text-sm shadow-[0_0_15px_rgba(8,145,178,0.4)] transition-all shrink-0">
             {t('发布我的策略', 'Publish My EA')}
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 md:grid-cols-6">
          <input value={searchQuery} onChange={event=>{setSearchQuery(event.target.value.slice(0,100));setPage(1);}} placeholder={t('搜索名称、作者、品种、类型','Search name, author, pair, type')} aria-label={t('搜索策略','Search strategies')} className="col-span-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 md:col-span-2" />
          <select value={filters.pair} onChange={event => updateFilter('pair', event.target.value)} aria-label={t('交易品种筛选', 'Pair filter')} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300"><option value="">{t('全部品种', 'All pairs')}</option>{pairs.map(pair => <option key={pair} value={pair}>{pair}</option>)}</select>
          <select value={filters.verification} onChange={event => updateFilter('verification', event.target.value)} aria-label={t('最低认证筛选', 'Minimum verification filter')} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300"><option value="">{t('全部认证', 'All verification')}</option><option value="report_verified">{t('至少报告验证', 'Report verified+')}</option><option value="platform_rerun">{t('至少平台复跑', 'Platform rerun+')}</option><option value="live_verified">{t('仅实盘验证', 'Live verified')}</option></select>
          <input type="number" min="0" max="100" value={filters.maxDrawdown ?? ''} onChange={event => updateFilter('maxDrawdown', event.target.value === '' ? null : Number(event.target.value))} placeholder={t('最大回撤上限 %', 'Max DD %')} aria-label={t('最大回撤上限', 'Maximum drawdown')} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300" />
          <input type="number" min="0" value={filters.maxPrice ?? ''} onChange={event => updateFilter('maxPrice', event.target.value === '' ? null : Number(event.target.value))} placeholder={t('最高价格 USD', 'Max price USD')} aria-label={t('最高价格', 'Maximum price')} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300" />
          <button onClick={() => { setSearchQuery('');setPage(1);setFilters({ pair: '', type: '', verification: '', maxDrawdown: null, maxPrice: null }); setCompareIds([]); setShowComparison(false); }} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white">{t('重置筛选', 'Reset filters')}</button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-5 mb-8 border-b border-zinc-800/80">
          <div className="flex items-center gap-1.5 text-zinc-500 mr-2 shrink-0">
            <Filter className="w-4 h-4" /> 
            <span className="text-xs font-bold uppercase tracking-widest">{t('分类过滤:', 'Filters:')}</span>
          </div>
          {filterOptions.map(option => (
            <button
              key={option}
              onClick={() => updateFilter('type', option === '全部' ? '' : option)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                filters.type === (option === '全部' ? '' : option)
                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]' 
                  : 'bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-300'
              }`}
            >
              {option === '全部' ? t('全部策略', 'All EAs') : tEaType(option)}
            </button>
          ))}
        </div>

        {compareIds.length > 0 && <div className="sticky top-20 z-30 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-500/30 bg-zinc-950/95 p-4 shadow-xl backdrop-blur"><div className="text-sm text-zinc-300"><span className="font-black text-violet-300">{compareIds.length}/{COMPARISON_MAX}</span> {t('项已加入对比；请选择 2–4 项', 'selected; choose 2–4 items')}</div><button disabled={compareIds.length < COMPARISON_MIN} onClick={() => setShowComparison(true)} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Columns3 className="h-4 w-4" />{t('打开对比表', 'Open comparison')}</button></div>}

        {showComparison && comparedProducts.length >= COMPARISON_MIN && <div className="mb-8"><StrategyComparison products={comparedProducts} onRemove={toggleComparison} onClose={() => setShowComparison(false)} t={t} /></div>}

        {catalogStatus==='loading'&&<div className="mb-6 text-center text-xs text-cyan-400">{t('正在查询策略…','Searching strategies…')}</div>}
        {catalogStatus==='error'?<div className="text-center py-20 text-red-400 bg-red-500/5 rounded-3xl border border-red-500/20">{t('市场查询失败，请重试','Market query failed. Please retry.')}</div>:filteredProducts.length === 0 ? <div className="text-center py-32 text-zinc-500 bg-zinc-900/30 rounded-3xl border border-zinc-800 border-dashed">{t('没有符合当前搜索与筛选条件的策略', 'No strategies match the current search and filters.')}</div> : 
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map(p => {
              const isPurchased = myOrders.some(order => order.product_id === p.id);
              return (
              <FadeInView key={p.id} delay={50}>
                <div onClick={() => openDetail(p)} className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between hover:border-cyan-500/50 transition-all group h-full relative overflow-hidden cursor-pointer shadow-lg hover:shadow-cyan-900/20">
                  {isPurchased && <div className="absolute top-0 right-0 bg-cyan-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-lg z-10">{t('已入库', 'Owned')}</div>}
                  <button onClick={event => { event.stopPropagation(); toggleComparison(p.id); }} disabled={!compareIds.includes(p.id) && compareIds.length >= COMPARISON_MAX} className={`absolute left-4 top-4 z-10 rounded-lg border px-2.5 py-1 text-[10px] font-black ${compareIds.includes(p.id) ? 'border-violet-400 bg-violet-600 text-white' : 'border-zinc-700 bg-zinc-950/90 text-zinc-400'} disabled:opacity-30`}>{compareIds.includes(p.id) ? t('已选择', 'Selected') : t('加入对比', 'Compare')}</button>
                  <div>
                    <div className="flex items-center gap-4 mb-5 mt-7">
                      {p.logo_url ? <Image src={p.logo_url} alt={p.title} width={56} height={56} unoptimized className="w-14 h-14 rounded-2xl object-cover bg-zinc-950 border border-zinc-800" /> : <div className="w-14 h-14 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center"><Cpu className="w-6 h-6 text-cyan-400/50" /></div>}
                      <div><h3 className="text-base font-bold text-white truncate w-36 group-hover:text-cyan-400 transition-colors">{p.title}</h3><p className="text-xs text-zinc-500 mt-0.5">by {p.author}</p></div>
                    </div>
                    {p.ea_type && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {p.ea_type.split(',').slice(0, 3).map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] rounded border border-zinc-700">{tEaType(tag)}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-4 text-xs bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800 mb-5">
                      <div><span className="text-zinc-500 block mb-1">{t('胜率', 'Win Rate')}</span><span className="text-emerald-400 font-bold text-sm">{p.win_rate}</span></div><div className="w-px bg-zinc-800"></div>
                      <div><span className="text-zinc-500 block mb-1">{t('回撤', 'Drawdown')}</span><span className="text-red-400 font-bold text-sm">{p.drawdown}</span></div>
                    </div>
                    <div className="mb-4 flex items-center justify-between text-[10px] text-zinc-500"><span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-400" />{p.social?.ratingAverage ?? '—'} ({p.social?.ratingCount || 0})</span><span><Heart className="mr-1 inline h-3 w-3" />{p.social?.favoriteCount || 0}</span></div>
                  </div>
                  <div className="flex justify-between items-center pt-5 border-t border-zinc-800">
                    <span className="text-2xl font-black text-white">{p.price === 0 ? <span className="text-emerald-400 text-lg">{t('免费', 'Free')}</span> : `$${p.price}`}</span>
                    <span className="text-xs font-bold text-zinc-500 group-hover:text-cyan-400 flex items-center gap-1">{t('查看详情', 'Details')} <ChevronRight className="w-3 h-3" /></span>
                  </div>
                </div>
              </FadeInView>
            )})}
          </div>
        }
        {catalogStatus!=='error'&&pagination.totalPages>1&&<div className="mt-8 flex items-center justify-center gap-4"><button disabled={pagination.page<=1||catalogStatus==='loading'} onClick={()=>setPage(value=>Math.max(1,value-1))} className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-bold text-zinc-300 disabled:opacity-30">{t('上一页','Previous')}</button><span className="text-xs text-zinc-500">{pagination.page} / {pagination.totalPages} · {pagination.total} {t('项','items')}</span><button disabled={pagination.page>=pagination.totalPages||catalogStatus==='loading'} onClick={()=>setPage(value=>value+1)} className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-bold text-zinc-300 disabled:opacity-30">{t('下一页','Next')}</button></div>}
      </div>
    );
  }

  if (view === 'detail' && selectedEA) {
    const isPurchased = myOrders.some(order => order.product_id === selectedEA.id);
    const tags = selectedEA.ea_type ? selectedEA.ea_type.split(',') : [];

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in slide-in-from-right-8 duration-500">
        <button onClick={() => setView('list')} className="text-sm font-bold text-zinc-500 hover:text-white mb-6 flex items-center gap-2 transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t('返回市场列表', 'Back to Market')}
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden">
              {selectedEA.logo_url ? 
                <Image src={selectedEA.logo_url} alt={selectedEA.title} width={128} height={128} unoptimized className="w-32 h-32 mx-auto rounded-3xl object-cover border-4 border-zinc-950 shadow-xl mb-6" /> : 
                <div className="w-32 h-32 mx-auto rounded-3xl bg-zinc-950 border-4 border-zinc-900 flex items-center justify-center shadow-xl mb-6"><Cpu className="w-12 h-12 text-zinc-600" /></div>
              }
              <h2 className="text-3xl font-black text-white mb-2">{selectedEA.price === 0 ? t('免费', 'Free') : `$${selectedEA.price}`}</h2>
              <div className="text-xs text-zinc-500 mb-6">{t('永久授权 · 包含无限制更新', 'Lifetime License · Unlimited Updates')}</div>
              
              {isPurchased ? (
                <button onClick={() => setRoute('profile')} className="w-full py-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black flex items-center justify-center gap-2 transition-all">
                  <FolderDown className="w-5 h-5" /> {t('已入库，前往下载', 'Owned, Go to Download')}
                </button>
              ) : (
                <button
                  disabled={selectedEA.price > 0}
                  onClick={(e) => { e.stopPropagation(); handlePurchaseProcess(selectedEA); }}
                  className={`w-full py-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all ${selectedEA.price === 0 ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_20px_rgba(8,145,178,0.4)]' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'}`}
                >
                  <Download className="w-5 h-5" /> {selectedEA.price === 0 ? t('免费获取', 'Get for Free') : t('付费购买维护中', 'Paid Checkout Unavailable')}
                </button>
              )}
              {!isPurchased&&Boolean(selectedEA.trial_enabled)&&<button onClick={()=>handleStartTrial(selectedEA)} className="mt-3 w-full rounded-xl border border-violet-500/30 bg-violet-500/10 py-3 text-sm font-black text-violet-300">{t(`免费试用 ${selectedEA.trial_days} 天`,`Try free for ${selectedEA.trial_days} days`)}</button>}
              {user && user.id !== selectedEA.author_user_id && <button onClick={()=>handleReport('product',selectedEA.id)} className="mt-3 w-full rounded-xl border border-amber-500/20 py-2 text-xs font-bold text-amber-400">⚑ {t('举报此策略','Report strategy')}</button>}
              <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>socialAction({action:'favorite',productId:selectedEA.id,enabled:!selectedEA.social?.viewer?.favorite},social=>({favoriteCount:Math.max(0,(social.favoriteCount||0)+(social.viewer?.favorite?-1:1)),viewer:{...social.viewer,favorite:!social.viewer?.favorite}}))} className={`rounded-xl border py-2 text-xs font-bold ${selectedEA.social?.viewer?.favorite?'border-rose-500/40 bg-rose-500/10 text-rose-300':'border-zinc-700 text-zinc-400'}`}><Heart className="mr-1 inline h-4 w-4" />{selectedEA.social?.viewer?.favorite?t('已收藏','Favorited'):t('收藏','Favorite')}</button><button disabled={selectedEA.author_user_id===user?.id} onClick={()=>socialAction({action:'follow',developerUserId:selectedEA.author_user_id,enabled:!selectedEA.social?.viewer?.followingAuthor},social=>({followerCount:Math.max(0,(social.followerCount||0)+(social.viewer?.followingAuthor?-1:1)),viewer:{...social.viewer,followingAuthor:!social.viewer?.followingAuthor}}))} className="rounded-xl border border-zinc-700 py-2 text-xs font-bold text-zinc-400 disabled:opacity-30"><UserPlus className="mr-1 inline h-4 w-4" />{selectedEA.social?.viewer?.followingAuthor?t('已关注','Following'):t('关注作者','Follow')}</button></div>
            </div>

            <div className="rounded-3xl border border-amber-500/20 bg-zinc-900/40 p-6"><h4 className="font-bold text-white">{t('永久授权用户评分','Permanent owner rating')}</h4><div className="mt-2 text-sm text-amber-300"><Star className="mr-1 inline h-4 w-4" />{selectedEA.social?.ratingAverage ?? '—'} / 5 · {selectedEA.social?.ratingCount || 0} {t('条评分','ratings')}</div><button onClick={async()=>{const raw=window.prompt(t('请输入 1–5 星评分，可在数字后添加评价，例如：5,运行稳定','Enter 1–5 stars and optional review, e.g. 5,Stable'),selectedEA.social?.viewer?.rating?`${selectedEA.social.viewer.rating.rating},${selectedEA.social.viewer.rating.reviewText||''}`:'5,');if(!raw)return;const [score,...review]=raw.split(',');await socialAction({action:'rate',productId:selectedEA.id,rating:Number(score),reviewText:review.join(',').trim()},social=>({ratingAverage:social.ratingAverage,ratingCount:social.ratingCount||1,viewer:{...social.viewer,rating:{rating:Number(score),reviewText:review.join(',').trim()}}}));}} className="mt-3 w-full rounded-xl border border-amber-500/30 bg-amber-500/10 py-2 text-xs font-bold text-amber-300">{selectedEA.social?.viewer?.rating?t('修改我的评分','Edit my rating'):t('提交评分','Rate strategy')}</button><p className="mt-2 text-[10px] leading-relaxed text-zinc-600">{t('只有持有有效永久授权的用户可评分；试用用户和开发者本人不可评分。','Only active permanent owners may rate; trial users and the developer cannot rate.')}</p></div>

            <div className="bg-zinc-900/30 border border-zinc-800 rounded-3xl p-6">
               <h4 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-4">{t('硬核回测指标', 'Backtest Metrics')}</h4>
               <div className="space-y-4">
                 <div className="flex justify-between items-center"><span className="text-zinc-500 text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-400"/> {t('历史胜率', 'Win Rate')}</span><span className="font-bold text-white">{selectedEA.win_rate}</span></div>
                 <div className="w-full h-px bg-zinc-800/50"></div>
                 <div className="flex justify-between items-center"><span className="text-zinc-500 text-sm flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-red-400"/> {t('最大回撤', 'Max Drawdown')}</span><span className="font-bold text-white">{selectedEA.drawdown}</span></div>
               </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 lg:p-10 shadow-xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[80px] pointer-events-none"></div>
               <h1 className="text-3xl lg:text-4xl font-extrabold text-white mb-4 relative z-10">{selectedEA.title}</h1>
               <div className="flex items-center gap-2 text-sm text-zinc-500 mb-8 relative z-10">
                 By <span className="font-bold text-cyan-400">{selectedEA.author}</span> · {t('发表于', 'Published on')} {new Date(selectedEA.created_at).toLocaleDateString()}
               </div>

               <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 mb-8 relative z-10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                    <div className="flex border-b border-zinc-800/50 pb-2"><span className="text-zinc-500 w-24 shrink-0">{t('运行平台:', 'Platform:')}</span><span className="font-bold text-white">MetaTrader 5</span></div>
                    <div className="flex border-b border-zinc-800/50 pb-2"><span className="text-zinc-500 w-24 shrink-0">{t('产品类型:', 'Product Type:')}</span><span className="font-bold text-white">{t('专家 (EA)', 'Expert (EA)')}</span></div>
                    <div className="flex border-b border-zinc-800/50 pb-2"><span className="text-zinc-500 w-24 shrink-0">{t('适用周期:', 'Timeframe:')}</span><span className="font-bold text-white">{t('任何', 'Any')}</span></div>
                    <div className="flex border-b border-zinc-800/50 pb-2"><span className="text-zinc-500 w-24 shrink-0">{t('测试对:', 'Pairs:')}</span><span className="font-bold text-white">{selectedEA.pairs}</span></div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-zinc-800">
                    <span className="text-zinc-500 text-sm block mb-3 font-bold">{t('EA 交易类型配置:', 'EA Trading Types:')}</span>
                    {tags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {tags.map(tag => (
                          <span key={tag} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold rounded-lg shadow-inner">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {tEaType(tag)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-600">{t('开发者未提供类型标签', 'No tags provided by developer')}</span>
                    )}
                  </div>
               </div>

               <h3 className="text-xl font-bold text-white mb-4 relative z-10">{t('策略详解', 'Strategy Details')}</h3>
               <div className="prose prose-invert max-w-none text-zinc-300 leading-loose whitespace-pre-wrap text-sm relative z-10">
                 {selectedEA.description || t('该开发者很神秘，没有留下详细的策略说明。', 'This developer is mysterious and left no detailed description.')}
               </div>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 lg:p-8 shadow-xl">
              <h3 className="text-xl font-bold text-white mb-5">{t('策略回测矩阵', 'Strategy Backtest Matrix')}</h3>
              <StrategyMetrics metrics={selectedEA.metrics} evidence={selectedEA.evidence || []} report={selectedEA.report} verification={selectedEA.verification} versions={selectedEA.versions || []} t={t} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
