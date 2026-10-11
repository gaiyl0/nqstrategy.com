"use client";
import React, { useState, useEffect, useRef } from 'react';

import { ArrowLeft, Heart, UserPlus, ExternalLink } from 'lucide-react';
import StrategyDetail from './StrategyDetail';
import StrategyAcquisition from './StrategyAcquisition';
import StrategyComparison from './StrategyComparison';
import StrategyMarketCatalog from './StrategyMarketCatalog';
import { COMPARISON_MIN, parseComparisonState, selectComparison, serializeComparisonState } from '@/lib/strategy-comparison.mjs';
import useNavigationLocation from '../hooks/useNavigationLocation';
import {appRoute,writeNavigation,NAVIGATION_EVENT,MARKET_KEYS} from '@/lib/app-navigation.mjs';
import { apiFetch } from '@/lib/api-client';
import { useInteraction } from './ui/UiKit';

export default function MarketView({ products, myOrders, user, handlePurchaseProcess, handlePointsRedeem, handleSocialAction, handleReport, setRoute, setAuthModal, t, tEaType }) {
  const { requestInput } = useInteraction();
  const navigationSearch=useNavigationLocation();
  const eaId=Number(new URLSearchParams(navigationSearch||'').get('ea'));
  const view=Number.isSafeInteger(eaId)&&eaId>0?'detail':'list';
  const [selectedEAOverride,setSelectedEAInternal]=useState(null);
  const selectedEA=selectedEAOverride?.id===eaId?selectedEAOverride:products.find(product=>product.id===eaId);

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
    const restoreQuery = () => {
      lastQuery.current = window.location.search;
      const urlState = parseComparisonState(window.location.search);
      setFilters({ pair: urlState.pair, type: urlState.type, verification: urlState.verification, maxDrawdown: urlState.maxDrawdown, maxPrice: urlState.maxPrice });
      setSearchQuery(urlState.q); setPage(urlState.page); setCompareIds(urlState.ids);
      setShowComparison(urlState.ids.length >= COMPARISON_MIN);
    };
    restoreQuery();
    const restoreHistory=()=>{if(appRoute(window.location.search)==='market'&&window.location.search!==lastQuery.current)restoreQuery();};
    window.addEventListener('popstate',restoreHistory);
    window.addEventListener(NAVIGATION_EVENT,restoreHistory);
    // Hydration restores the external URL before enabling catalog reads.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrlReady(true);
    return () => {window.removeEventListener('popstate',restoreHistory);window.removeEventListener(NAVIGATION_EVENT,restoreHistory);};
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const query = serializeComparisonState({ ids: compareIds, q:searchQuery, page, ...filters });
    if(appRoute(window.location.search)!=='market')return;
    const params=new URLSearchParams(query), patch={};
    for(const key of MARKET_KEYS)if(key!=='ea')patch[key]=params.get(key);
    const before=parseComparisonState(window.location.search);
    const qOnly=before.q!==searchQuery&&JSON.stringify({...before,q:searchQuery})===JSON.stringify({ids:compareIds,q:searchQuery,...filters,page});
    writeNavigation('market',patch,{replace:qOnly});
    lastQuery.current = window.location.search;
  }, [compareIds, filters, searchQuery, page, urlReady]);

  useEffect(()=>{if(!urlReady)return;const controller=new AbortController();const params=new URLSearchParams({market:'1',page:String(page),pageSize:'12'});if(searchQuery)params.set('q',searchQuery);for(const [key,value] of Object.entries(filters))if(value!==null&&value!=='')params.set(key,String(value));/* eslint-disable react-hooks/set-state-in-effect */setCatalogStatus('loading');apiFetch(`/api/products?${params}`,{cache:'no-store',signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok||!data.success)throw new Error(data.message||'加载失败');setCatalogProducts(data.products);setPagination(data.pagination);if(data.pagination.page!==page)setPage(data.pagination.page);setCatalogStatus('ready');}).catch(error=>{if(error.name!=='AbortError')setCatalogStatus('error');});return()=>controller.abort();},[filters,searchQuery,page,urlReady,retryKey]);


  const setView = value => { if(value==='list')writeNavigation('market',{ea:null}); };
  const setSelectedEA = ea => setSelectedEAInternal(ea);
  const openDetail = ea => { setSelectedEA(ea);writeNavigation('market',{ea:ea.id}); };

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
    const isPurchased = myOrders.some(order => order.product_id === selectedEA.id && order.status === 'completed' && (Number(order.price) === 0 || Number(order.payment_verified) === 1));
    return <StrategyDetail product={selectedEA} t={t} tEaType={tEaType}
      back={<div className="flex w-full flex-wrap items-center justify-between gap-3"><button onClick={() => setView('list')} className="text-sm font-bold text-zinc-400 hover:text-white flex items-center gap-2 transition-colors"><ArrowLeft className="w-4 h-4" /> {t('返回市场列表', 'Back to Market')}</button>{selectedEA.slug&&<a href={`/market/${encodeURIComponent(selectedEA.slug)}`} className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-300"><ExternalLink className="h-3.5 w-3.5"/>{t('打开可分享页面','Open shareable page')}</a>}</div>}
      actions={<div className="flex w-full flex-col gap-2"><StrategyAcquisition product={selectedEA} user={user} owned={isPurchased} t={t} onLogin={()=>setAuthModal('login')} onTasks={()=>user?setRoute('points'):setAuthModal('login')} onProfile={()=>setRoute('profile')} onRedeem={handlePointsRedeem} onFree={handlePurchaseProcess}/>
              {user && user.id !== selectedEA.author_user_id && <button onClick={()=>handleReport('product',selectedEA.id)} className="mt-3 w-full rounded-xl border border-amber-500/20 py-2 text-xs font-bold text-amber-400">⚑ {t('举报此策略','Report strategy')}</button>}
              <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>socialAction({action:'favorite',productId:selectedEA.id,enabled:!selectedEA.social?.viewer?.favorite},social=>({favoriteCount:Math.max(0,(social.favoriteCount||0)+(social.viewer?.favorite?-1:1)),viewer:{...social.viewer,favorite:!social.viewer?.favorite}}))} className={`rounded-xl border py-2 text-xs font-bold ${selectedEA.social?.viewer?.favorite?'border-rose-500/40 bg-rose-500/10 text-rose-300':'border-zinc-700 text-zinc-400'}`}><Heart className="mr-1 inline h-4 w-4" />{selectedEA.social?.viewer?.favorite?t('已收藏','Favorited'):t('收藏','Favorite')}</button><button disabled={selectedEA.author_user_id===user?.id} onClick={()=>socialAction({action:'follow',developerUserId:selectedEA.author_user_id,enabled:!selectedEA.social?.viewer?.followingAuthor},social=>({followerCount:Math.max(0,(social.followerCount||0)+(social.viewer?.followingAuthor?-1:1)),viewer:{...social.viewer,followingAuthor:!social.viewer?.followingAuthor}}))} className="rounded-xl border border-zinc-700 py-2 text-xs font-bold text-zinc-400 disabled:opacity-30"><UserPlus className="mr-1 inline h-4 w-4" />{selectedEA.social?.viewer?.followingAuthor?t('已关注','Following'):t('关注作者','Follow')}</button></div></div>}
      ratingAction={<button onClick={async()=>{const score=await requestInput({title:t('评分策略','Rate strategy'),description:selectedEA.title,label:t('星级','Rating'),initialValue:String(selectedEA.social?.viewer?.rating?.rating||5),options:[1,2,3,4,5].map(value=>({value:String(value),label:`${value} ${t('星','stars')}`})),required:true,confirmLabel:t('下一步','Continue')});if(!score)return;const review=await requestInput({title:t('评分策略','Rate strategy'),label:t('评价','Review'),hint:t('可选，请基于真实使用体验。','Optional. Base the review on your actual experience.'),initialValue:selectedEA.social?.viewer?.rating?.reviewText||'',multiline:true,rows:4,maxLength:500,confirmLabel:t('提交评分','Submit rating')});if(review===null)return;await socialAction({action:'rate',productId:selectedEA.id,rating:Number(score),reviewText:review},social=>({ratingAverage:social.ratingAverage,ratingCount:social.ratingCount||1,viewer:{...social.viewer,rating:{rating:Number(score),reviewText:review}}}));}} className="mt-3 w-full rounded-xl border border-amber-500/30 bg-amber-500/10 py-2 text-xs font-bold text-amber-300">{selectedEA.social?.viewer?.rating?t('修改我的评分','Edit my rating'):t('提交评分','Rate strategy')}</button>}
    />;
  }
  return <div role="status" className="mx-auto max-w-5xl p-8"><p>{products.length?t('策略不存在或已下架。','This strategy is unavailable.'):t('正在读取策略…','Loading strategy…')}</p><button onClick={()=>setView('list')} className="mt-4 rounded-lg border px-4 py-2">{t('返回市场列表','Back to market')}</button></div>;
}
