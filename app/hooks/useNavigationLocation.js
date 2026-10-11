"use client";
import { useSyncExternalStore } from 'react';
import { NAVIGATION_EVENT } from '@/lib/app-navigation.mjs';
const subscribe=callback=>{
  window.addEventListener('popstate',callback);window.addEventListener(NAVIGATION_EVENT,callback);
  return()=>{window.removeEventListener('popstate',callback);window.removeEventListener(NAVIGATION_EVENT,callback);};
};
export default function useNavigationLocation(){
  return useSyncExternalStore(subscribe,()=>window.location.search,()=>null);
}
