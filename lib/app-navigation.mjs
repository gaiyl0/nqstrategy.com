export const APP_ROUTES = ['home','market','forum','profile','assets','upload','points','inbox'];
export const MARKET_KEYS = ['compare','q','pair','type','verification','maxDrawdown','maxPrice','page','ea'];
const keys = {market:MARKET_KEYS,forum:['category','sort','forumPage','forumQ','post','compose'],profile:['tab'],assets:['tab']};
export const NAVIGATION_EVENT = 'nexus-route-change';
export function appRoute(search) {
  const params=new URLSearchParams(search);
  const route=params.get('route');
  if(APP_ROUTES.includes(route))return route;
  if(params.has('post'))return 'forum';
  return MARKET_KEYS.some(key=>params.has(key))?'market':'home';
}
export function forumLocation(search) {
  const params=new URLSearchParams(search);
  return {category:(params.get('category')||'全部').slice(0,100),sort:['latest','hot','discussed','replied','unanswered'].includes(params.get('sort'))?params.get('sort'):'latest',page:Math.max(1,Math.min(100000,parseInt(params.get('forumPage')||'1',10)||1)),query:(params.get('forumQ')||'').slice(0,100),post:/^[1-9]\d*$/.test(params.get('post')||'')?Number(params.get('post')):null,compose:params.get('compose')==='1'};
}
export function profileTab(search, assetOnly=false) {
  const tab=new URLSearchParams(search).get('tab');
  return (assetOnly?['assets','licenses']:['assets','strategies','licenses','social','security','recharges','withdrawals']).includes(tab)?tab:'assets';
}
function remember(target) {
  const current=new URLSearchParams(target.location.search), route=appRoute(target.location.search), saved=new URLSearchParams();
  for(const key of keys[route]||[])if(!['ea','post','compose'].includes(key)&&current.has(key))saved.set(key,current.get(key));
  try{target.sessionStorage.setItem(`nexus-view:${route}`,saved.toString());}catch{/* Storage is optional. */}
}
export function writeNavigation(route, patch={}, {replace=false,target=window}={}) {
  if(!APP_ROUTES.includes(route))return false;
  const previous=appRoute(target.location.search);
  remember(target);
  let params=new URLSearchParams(target.location.search);
  if(previous!==route){
    for(const key of Object.values(keys).flat())params.delete(key);
    let saved='';try{saved=target.sessionStorage.getItem(`nexus-view:${route}`)||'';}catch{}
    const cached=new URLSearchParams(saved);
    for(const key of keys[route]||[])if(cached.has(key))params.set(key,cached.get(key));
    params.delete('auth');params.delete('rechargeOrder');
  }
  params.set('route',route);
  for(const [key,value] of Object.entries(patch)){
    if(!(keys[route]||[]).includes(key))continue;
    if(value===null||value===undefined||value==='')params.delete(key);else params.set(key,String(value));
  }
  const query=params.toString(), next=`${target.location.pathname}?${query}`;
  const current=`${target.location.pathname}${target.location.search}`;
  if(next===current)return false;
  target.history[replace?'replaceState':'pushState'](null,'',next);
  remember(target);
  target.dispatchEvent(new Event(NAVIGATION_EVENT));
  return true;
}
