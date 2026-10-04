"use client";

import { useState } from 'react';
import { Copy, Send, Share2 } from 'lucide-react';
import { shareLinks } from '@/lib/share-content.mjs';

export default function ShareActions({ title, path, origin = 'https://nqstrategy.com', t = zh => zh }) {
  const [notice, setNotice] = useState('');
  const [manual, setManual] = useState(false);
  const url = new URL(path, origin).toString();
  const links = shareLinks(url, title);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setNotice(t('链接已复制','Link copied')); setManual(false); }
    catch { setManual(true); setNotice(t('请选中下方链接后复制','Select and copy the link below')); }
  };
  const nativeShare = async () => {
    if (!navigator.share) return copy();
    try { await navigator.share({ title, url }); setNotice(t('分享已打开','Share opened')); }
    catch (error) { if (error.name !== 'AbortError') { setManual(true); setNotice(t('未能打开系统分享，可复制链接','System sharing unavailable; copy the link')); } }
  };
  return <div className="share-actions"><div className="share-action-buttons"><a href={links.x} target="_blank" rel="noopener noreferrer"><span aria-hidden="true" className="share-x-icon">𝕏</span>{t('分享到 X','Share to X')}</a><a href={links.telegram} target="_blank" rel="noopener noreferrer"><Send size={17}/>{t('分享到 Telegram','Share to Telegram')}</a><button type="button" onClick={copy}><Copy size={17}/>{t('复制链接','Copy link')}</button><button type="button" onClick={nativeShare}><Share2 size={17}/>{t('更多分享','More sharing')}</button></div><p role="status" className="share-notice">{notice}</p>{manual && <input aria-label={t('分享链接','Share link')} readOnly value={url} onFocus={event => event.target.select()} className="share-manual-link"/>}</div>;
}
