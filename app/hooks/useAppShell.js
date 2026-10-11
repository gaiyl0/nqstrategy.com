"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import useNavigationLocation from './useNavigationLocation';
import { appRoute,writeNavigation } from '@/lib/app-navigation.mjs';
import { ApiError, apiErrorMessage } from '@/lib/api-client';

const LANGUAGE_EVENT = 'nexus-language-change';

const subscribeLanguage = (callback) => {
  window.addEventListener('storage', callback);
  window.addEventListener(LANGUAGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(LANGUAGE_EVENT, callback);
  };
};

const getLanguageSnapshot = () => localStorage.getItem('nexus_lang') === 'en' ? 'en' : 'zh';
const getServerLanguageSnapshot = () => 'zh';

export function useLanguage() {
  const lang = useSyncExternalStore(subscribeLanguage, getLanguageSnapshot, getServerLanguageSnapshot);
  const toggleLang = useCallback(() => {
    const nextLanguage = lang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('nexus_lang', nextLanguage);
    window.dispatchEvent(new Event(LANGUAGE_EVENT));
  }, [lang]);
  const t = useCallback((zh, en) => lang === 'en' ? en : zh, [lang]);
  return { lang, toggleLang, t };
}

export function useAppRoute() {
  const search=useNavigationLocation();
  const route=appRoute(search||'');
  const setRoute=useCallback(newRoute=>{writeNavigation(newRoute);},[]);
  return {route,setRoute,search};
}

export function useTopicEntry({ route, forumPosts, openPostDetail, setAuthModal, authReady, user, setRoute }) {
  const openedPost = useRef(null);
  const search=useNavigationLocation();
  useEffect(() => {
    if (!authReady || user || !['profile', 'assets', 'inbox'].includes(route)) return;
    const frame = requestAnimationFrame(() => { setRoute('home'); setAuthModal('login'); });
    return () => cancelAnimationFrame(frame);
  }, [authReady, user, route, setRoute, setAuthModal]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('auth') !== 'login') return;
    const frame = requestAnimationFrame(() => setAuthModal('login'));
    return () => cancelAnimationFrame(frame);
  }, [setAuthModal]);
  useEffect(() => {
    if (route !== 'forum') return;
    const id = new URLSearchParams(search||'').get('post');
    if(!id){openedPost.current=null;return;}
    if (!id || !/^[1-9]\d*$/.test(id) || openedPost.current === id) return;
    const post = forumPosts.find(item => String(item.id) === id) || { id: Number(id) };
    const frame = requestAnimationFrame(() => { openedPost.current = id; void openPostDetail(post); });
    return () => cancelAnimationFrame(frame);
  }, [route, forumPosts, openPostDetail,search]);
}

export function useToast() {
  const [toastMsg, setToastMsg] = useState('');
  const showToast = useCallback((message) => {
    setToastMsg(message);
    window.setTimeout(() => setToastMsg(''), 3000);
  }, []);

  useEffect(() => {
    const handleApiFailure = (event) => {
      if (!(event.reason instanceof ApiError)) return;
      event.preventDefault();
      showToast(`❌ ${apiErrorMessage(event.reason)}`);
    };
    window.addEventListener('unhandledrejection', handleApiFailure);
    return () => window.removeEventListener('unhandledrejection', handleApiFailure);
  }, [showToast]);

  return { toastMsg, showToast };
}
