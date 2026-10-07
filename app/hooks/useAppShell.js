"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ApiError, apiErrorMessage } from '@/lib/api-client';

const LANGUAGE_EVENT = 'nexus-language-change';
const MARKET_QUERY_KEYS = ['compare', 'q', 'pair', 'type', 'verification', 'maxDrawdown', 'maxPrice', 'page'];
const APP_ROUTES = ['home', 'market', 'forum', 'profile', 'assets', 'upload', 'points', 'inbox'];

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
  const [route, setRouteInternal] = useState('home');

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      const hasMarketState = MARKET_QUERY_KEYS.some((key) => params.has(key));
      const savedRoute = sessionStorage.getItem('nexus_route');
      const destination = APP_ROUTES.includes(params.get('route')) ? params.get('route')
        : hasMarketState ? 'market' : APP_ROUTES.includes(savedRoute) ? savedRoute : 'home';
      setRouteInternal(destination);
      sessionStorage.setItem('nexus_route', destination);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const setRoute = useCallback((newRoute) => {
    setRouteInternal(newRoute);
    sessionStorage.setItem('nexus_route', newRoute);
    {
      const params = new URLSearchParams(window.location.search);
      if (params.has('route')) params.set('route', newRoute);
      if (newRoute !== 'forum') params.delete('post');
      if (newRoute !== 'market') MARKET_QUERY_KEYS.forEach((key) => params.delete(key));
      const query = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
      window.dispatchEvent(new Event('nexus-route-change'));
    }
  }, []);

  return { route, setRoute };
}

export function useTopicEntry({ route, forumPosts, openPostDetail, setAuthModal, authReady, user, setRoute }) {
  const openedPost = useRef(null);
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
    const id = new URLSearchParams(window.location.search).get('post');
    if (!id || !/^[1-9]\d*$/.test(id) || openedPost.current === id) return;
    const post = forumPosts.find(item => String(item.id) === id) || { id: Number(id) };
    const frame = requestAnimationFrame(() => { openedPost.current = id; void openPostDetail(post); });
    return () => cancelAnimationFrame(frame);
  }, [route, forumPosts, openPostDetail]);
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
