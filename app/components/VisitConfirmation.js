"use client";
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
// Confirms a visible browser page; this does not prove automation is impossible.
export default function VisitConfirmation() {
  const pathname=usePathname();
  useEffect(()=>{
    let stop=()=>{};
    const start=async()=>{
      stop();
      const controller=new AbortController();let timer,visibleMs=0,sending=false;
      stop=()=>{controller.abort();clearInterval(timer);};
      if(navigator.webdriver || /bot|headless|playwright|curl|lighthouse/i.test(navigator.userAgent))return;
      let path=pathname;
      if(path==='/') {
        const route=new URLSearchParams(location.search).get('route')||sessionStorage.getItem('nexus_route')||'home';
        if(!['home','market','forum'].includes(route))return;
        path=route==='home'?'/':'/?route='+route;
      }
      if(path.startsWith('/tianwei'))return;
      try {
        const response=await fetch('/api/analytics/visit?path='+encodeURIComponent(path),{signal:controller.signal,cache:'no-store'});
        if(!response.ok)return;
        const {proof}=await response.json();if(!proof||controller.signal.aborted)return;
        let previous=performance.now();
        timer=setInterval(()=>{
          const now=performance.now(),elapsed=now-previous;previous=now;
          if(document.visibilityState==='visible')visibleMs+=Math.min(elapsed,500);
          if(visibleMs<5500||sending)return;
          sending=true;clearInterval(timer);
          void fetch('/api/analytics/visit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({proof,visible:true,webdriver:false}),signal:controller.signal,keepalive:true}).then(response=>response.json()).catch(()=>{});
        },250);
      } catch { /* Analytics must not interfere with the page. */ }
    };
    void start();window.addEventListener('nexus-route-change',start);
    return ()=>{stop();window.removeEventListener('nexus-route-change',start);};
  },[pathname]);
  return null;
}
