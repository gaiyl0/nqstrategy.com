"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ApiError, apiErrorMessage } from '@/lib/api-client';

const LANGUAGE_EVENT = 'nexus-language-change';
const MARKET_QUERY_KEYS = ['compare', 'q', 'pair', 'type', 'verification', 'maxDrawdown', 'maxPrice', 'page'];

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
      if (hasMarketState) setRouteInternal('market');
      else if (savedRoute) setRouteInternal(savedRoute);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const setRoute = useCallback((newRoute) => {
    setRouteInternal(newRoute);
    sessionStorage.setItem('nexus_route', newRoute);
    if (newRoute !== 'market') {
      const params = new URLSearchParams(window.location.search);
      MARKET_QUERY_KEYS.forEach((key) => params.delete(key));
      const query = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    }
  }, []);

  return { route, setRoute };
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
