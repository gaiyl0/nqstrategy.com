"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from './AppHeader';
import Footer from './Footer';
import { useLanguage } from '../hooks/useAppShell';
import { apiFetch } from '@/lib/api-client';

export default function TopicPageFrame({ settings, children }) {
  const router = useRouter();
  const { t, lang, toggleLang } = useLanguage();
  const [user, setUser] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  useEffect(() => {
    let active = true;
    apiFetch('/api/auth/me').then(response => response.json()).then(data => { if (active && data.success) setUser(data.user); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const setRoute = route => router.push(`/?route=${encodeURIComponent(route)}`);
  const setAuthModal = () => router.push('/?route=home&auth=login');
  const handleLogout = async () => { await apiFetch('/api/auth/me', { method: 'POST' }); setUser(null); setShowUserMenu(false); };
  return <div className="topic-page-shell editorial-app-shell flex min-h-screen flex-col pb-14 lg:pb-0">
    <AppHeader siteSettings={settings} {...{ setRoute, t, user, setAuthModal, toggleLang, lang, showUserMenu, setShowUserMenu, handleLogout }} route="topics" setAuthForm={() => {}} setForumView={() => {}} />
    {children}
    <Footer siteSettings={settings} {...{ setRoute, t }} setForumView={() => {}} />
  </div>;
}
