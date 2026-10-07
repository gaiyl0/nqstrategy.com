"use client";
import React, { useState, useEffect, useRef } from 'react';

import { Download, FolderDown, ArrowLeft, Heart, UserPlus, ExternalLink } from 'lucide-react';
import StrategyDetail from './StrategyDetail';
import StrategyComparison from './StrategyComparison';
import StrategyMarketCatalog from './StrategyMarketCatalog';
import { COMPARISON_MIN, parseComparisonState, selectComparison, serializeComparisonState } from '@/lib/strategy-comparison.mjs';
import { apiFetch } from '@/lib/api-client';
import { useInteraction } from './ui/UiKit';

export default function MarketView({ products, myOrders, user, handlePurchaseProcess, handlePointsRedeem, handleSocialAction, handleReport, setRoute, setAuthModal, t, tEaType }) {
  const { requestInput } = useInteraction();
  const [view, setViewInternal] = useState('list');
  const [selectedEA, setSelectedEAInternal] = useState(null);

  const [filters, setFilters] = useState({ pair: '', type: '', verification: '', maxDrawdown: null, maxPrice: null });
  const [searchQuery,setSearchQuery]=useState('');
  const [page,setPage]=useState(1);
  const [catalogProducts,setCatalogProducts]=useState(products);
  const [pagination,setPagination]=useState({page:1,pageSize:12,total:products.length,totalPages:1});
  const [catalogStatus,setCatalogStatus]=useState('idle');
  const [retryKey,setRetryKey]=useState(0);
  const [compareIds, setCompareIds] = useState([]);
  const [showComparison, setShowComparison] = useState(false);
  const [urlReady, setUrlReady] = useState(false);
  const lastQuery = useRef(null);

  useEffect(() => {
    const savedView = sessionStorage.getItem('market_view');
    const savedEA = sessionStorage.getItem('market_ea');
    // Browser storage and the shareable URL are external state restored after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedView) setViewInternal(savedView);
    if (savedEA) setSelectedEAInternal(JSON.parse(savedEA));
    const restoreQuery = () => {
      lastQuery.current = window.location.search;
      const urlState = parseComparisonState(window.location.search);
      setFilters({ pair: urlState.pair, type: urlState.type, verification: urlState.verification, maxDrawdown: urlState.maxDrawdown, maxPrice: urlState.maxPrice });
      setSearchQuery(urlState.q); setPage(urlState.page); setCompareIds(urlState.ids);
      setShowComparison(urlState.ids.length >= COMPARISON_MIN);
    };
    restoreQuery();
    const params = new URLSearchParams(window.location.search);
    if (['q','pair','type','verification','maxDrawdown','maxPrice','page','compare'].some(key => params.has(key)) || params.get('route') === 'market') {
      setViewInternal('list'); sessionStorage.setItem('market_view','list');
    }
    const restoreHistory = () => {
      // Hash-only section navigation must not replace a detail view with the catalog.
      if (window.location.search === lastQuery.current) return;
      restoreQuery(); setViewInternal('list'); sessionStorage.setItem('market_view','list');
    };
    window.addEventListener('popstate',restoreHistory);
    setUrlReady(true);
    return () => window.removeEventListener('popstate',restoreHistory);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const query = serializeComparisonState({ ids: compareIds, q:searchQuery, page, ...filters });
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);
    lastQuery.current = window.location.search;
  }, [compareIds, filters, searchQuery, page, urlReady]);

  useEffect(()=>{if(!urlReady)return;const controller=new AbortController();const params=new URLSearchParams({market:'1',page:String(page),pageSize:'12'});if(searchQuery)params.set('q',searchQuery);for(const [key,value] of Object.entries(filters))if(value!==null&&value!=='')params.set(key,String(value));/* eslint-disable react-hooks/set-state-in-effect */setCatalogStatus('loading');apiFetch(`/api/products?${params}`,{cache:'no-store',signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok||!data.success)throw new Error(data.message||'加载失败');setCatalogProducts(data.products);setPagination(data.pagination);if(data.pagination.page!==page)setPage(data.pagination.page);setCatalogStatus('ready');}).catch(error=>{if(error.name!=='AbortError')setCatalogStatus('error');});return()=>controller.abort();},[filters,searchQuery,page,urlReady,retryKey]);

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
  const applyFilters = nextFilters => { setPage(1); setFilters({...nextFilters}); };
  const toggleComparison = (productId) => setCompareIds(current => selectComparison(current, productId));
  const socialAction=async(body,update)=>{const saved=await handleSocialAction(body);if(saved&&selectedEA){const nextSocial=saved.social||{...selectedEA.social,viewer:{...selectedEA.social?.viewer},...update(selectedEA.social||{})};setSelectedEA({...selectedEA,social:nextSocial});}};

  if (view === 'list') {
    return <StrategyMarketCatalog
      {...{ products, filteredProducts, myOrders, user, filters, updateFilter, applyFilters, searchQuery, setSearchQuery, page, setPage, pagination, catalogStatus, compareIds, comparedProducts, toggleComparison, showComparison, setShowComparison, openDetail, setRoute, setAuthModal, pairs, t, tEaType }}
      retry={() => setRetryKey(value => value + 1)}
      resetFilters={() => { setSearchQuery(''); setPage(1); setFilters({ pair:'', type:'', verification:'', maxDrawdown:null, maxPrice:null }); }}
      comparison={showComparison && comparedProducts.length >= COMPARISON_MIN ? <StrategyComparison products={comparedProducts} onRemove={toggleComparison} onClose={() => setShowComparison(false)} t={t} /> : null}
    />;
  }
  if (view === 'detail' && selectedEA) {
    const isPurchased = myOrders.some(order => order.product_id === selectedEA.id);
    return <StrategyDetail product={selectedEA} t={t} tEaType={tEaType}
      back={<div className="flex w-full flex-wrap items-center justify-between gap-3"><button onClick={() => setView('list')} className="text-sm font-bold text-zinc-400 hover:text-white flex items-center gap-2 transition-colors"><ArrowLeft className="w-4 h-4" /> {t('返回市场列表', 'Back to Market')}</button>{selectedEA.slug&&<a href={`/market/${encodeURIComponent(selectedEA.slug)}`} className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-300"><ExternalLink className="h-3.5 w-3.5"/>{t('打开可分享页面','Open shareable page')}</a>}</div>}
      actions={<div className="flex w-full flex-col gap-2">              {isPurchased ? (
                <button onClick={() => setRoute('profile')} className="w-full py-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black flex items-center justify-center gap-2 transition-all">
                  <FolderDown className="w-5 h-5" /> {t('已入库，前往下载', 'Owned, Go to Download')}
                </button>
              ) : (
                <button
                  disabled={selectedEA.price > 0}
                  onClick={(e) => { e.stopPropagation(); handlePurchaseProcess(selectedEA); }}
                  className={`w-full py-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all ${selectedEA.price === 0 ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_20px_rgba(8,145,178,0.4)]' : 'bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-700'}`}
                >
                  <Download className="w-5 h-5" /> {selectedEA.price === 0 ? t('免费获取', 'Get for Free') : t('付费购买维护中', 'Paid Checkout Unavailable')}
                </button>
              )}
              {!isPurchased&&selectedEA.price>0&&Number.isInteger(selectedEA.points_price)&&selectedEA.points_price>0&&<button onClick={()=>handlePointsRedeem(selectedEA)} className="w-full rounded-xl border border-amber-400/40 bg-amber-400/10 py-3 text-sm font-bold text-amber-200 hover:bg-amber-400/20">{t(`使用 ${selectedEA.points_price} 积分获取并下载`,`Redeem for ${selectedEA.points_price} points`)}</button>}
              {user && user.id !== selectedEA.author_user_id && <button onClick={()=>handleReport('product',selectedEA.id)} className="mt-3 w-full rounded-xl border border-amber-500/20 py-2 text-xs font-bold text-amber-400">⚑ {t('举报此策略','Report strategy')}</button>}
              <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>socialAction({action:'favorite',productId:selectedEA.id,enabled:!selectedEA.social?.viewer?.favorite},social=>({favoriteCount:Math.max(0,(social.favoriteCount||0)+(social.viewer?.favorite?-1:1)),viewer:{...social.viewer,favorite:!social.viewer?.favorite}}))} className={`rounded-xl border py-2 text-xs font-bold ${selectedEA.social?.viewer?.favorite?'border-rose-500/40 bg-rose-500/10 text-rose-300':'border-zinc-700 text-zinc-400'}`}><Heart className="mr-1 inline h-4 w-4" />{selectedEA.social?.viewer?.favorite?t('已收藏','Favorited'):t('收藏','Favorite')}</button><button disabled={selectedEA.author_user_id===user?.id} onClick={()=>socialAction({action:'follow',developerUserId:selectedEA.author_user_id,enabled:!selectedEA.social?.viewer?.followingAuthor},social=>({followerCount:Math.max(0,(social.followerCount||0)+(social.viewer?.followingAuthor?-1:1)),viewer:{...social.viewer,followingAuthor:!social.viewer?.followingAuthor}}))} className="rounded-xl border border-zinc-700 py-2 text-xs font-bold text-zinc-400 disabled:opacity-30"><UserPlus className="mr-1 inline h-4 w-4" />{selectedEA.social?.viewer?.followingAuthor?t('已关注','Following'):t('关注作者','Follow')}</button></div></div>}
      ratingAction={<button onClick={async()=>{const score=await requestInput({title:t('评分策略','Rate strategy'),description:selectedEA.title,label:t('星级','Rating'),initialValue:String(selectedEA.social?.viewer?.rating?.rating||5),options:[1,2,3,4,5].map(value=>({value:String(value),label:`${value} ${t('星','stars')}`})),required:true,confirmLabel:t('下一步','Continue')});if(!score)return;const review=await requestInput({title:t('评分策略','Rate strategy'),label:t('评价','Review'),hint:t('可选，请基于真实使用体验。','Optional. Base the review on your actual experience.'),initialValue:selectedEA.social?.viewer?.rating?.reviewText||'',multiline:true,rows:4,maxLength:500,confirmLabel:t('提交评分','Submit rating')});if(review===null)return;await socialAction({action:'rate',productId:selectedEA.id,rating:Number(score),reviewText:review},social=>({ratingAverage:social.ratingAverage,ratingCount:social.ratingCount||1,viewer:{...social.viewer,rating:{rating:Number(score),reviewText:review}}}));}} className="mt-3 w-full rounded-xl border border-amber-500/30 bg-amber-500/10 py-2 text-xs font-bold text-amber-300">{selectedEA.social?.viewer?.rating?t('修改我的评分','Edit my rating'):t('提交评分','Rate strategy')}</button>}
    />;
  }
  return null;
}
