'use client';
import {useEffect,useRef} from 'react';
import {apiFetch} from '@/lib/api-client';

export default function useRegistrationInvitation({authModal,setAuthModal,setAuthForm,authReady,user}) {
  const handled=useRef(false);
  useEffect(()=>{
    if(!authReady||user||handled.current)return;
    const params=new URLSearchParams(window.location.search),code=String(params.get('invite')||'').trim().toUpperCase();
    if(!/^[A-F0-9]{16}$/.test(code)){handled.current=true;return;}
    try{window.localStorage.setItem('nexus-invitation',JSON.stringify({code,at:Date.now()}));}catch{}
    const timer=setTimeout(()=>{handled.current=true;setAuthForm(previous=>({...previous,invitationCode:code}));setAuthModal('register');},0);
    return()=>clearTimeout(timer);
  },[authReady,user,setAuthForm,setAuthModal]);
  useEffect(()=>{
    if(!authModal||user)return;
    void apiFetch('/api/referrals?view=identity',{cache:'no-store'}).catch(()=>{});
    if(authModal!=='register')return;
    let saved;
    try{saved=JSON.parse(window.localStorage.getItem('nexus-invitation')||'null');}catch{}
    if(!saved||!/^[A-F0-9]{16}$/.test(saved.code)||!Number.isFinite(saved.at)||Date.now()-saved.at>30*86400000)return;
    const timer=setTimeout(()=>setAuthForm(previous=>previous.invitationCode?previous:{...previous,invitationCode:saved.code}),0);
    return()=>clearTimeout(timer);
  },[authModal,user,setAuthForm]);
}
