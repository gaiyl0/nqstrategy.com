"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mt5DownloadLink } from './Mt5Download';
import { Activity, Mail, FileText, Shield, Lock, CircleHelp, Send } from 'lucide-react';

function FooterGroup({ title, children }) {
  const [desktop, setDesktop] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const update = () => { setDesktop(media.matches); setExpanded(false); };
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return <details className="footer-group" open={desktop || expanded} onToggle={event => { if (!desktop) setExpanded(event.currentTarget.open); }}><summary onClick={event => { if (desktop) event.preventDefault(); }}>{title}<span aria-hidden="true">＋</span></summary>{children}</details>;
}

function SocialLinks({ siteSettings, t }) {
  const links = [
    ['socialXUrl', 'X', <svg key="x" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-5-7.6L5.2 22H2l7.4-8.5L.8 2h6.5l4.6 7zM17.9 20h1.7L6.4 4H4.6z" /></svg>],
    ['telegramGroupUrl', t('Telegram 群组', 'Telegram group'), <Send key="telegram" className="h-4 w-4" aria-hidden="true" />],
  ];
  return <div className="mt-5 flex flex-wrap gap-3">{links.filter(([key]) => siteSettings?.[key]).map(([key, label, icon]) => <a key={key} href={siteSettings[key]} target="_blank" rel="noopener noreferrer" aria-label={label} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-700 px-3 text-sm text-zinc-300 hover:text-cyan-400">{icon}<span>{label}</span></a>)}</div>;
}

export default function Footer({ siteSettings, setRoute, setForumView, t }) {
  const risk = t('高风险警告：外汇保证金与差价合约 (CFD) 交易具有极高的风险，可能导致您损失全部投资本金。历史数据不代表未来收益。', 'High Risk Warning: Margin trading in Forex and CFDs carries a high level of risk and may result in the loss of all your investment principal. Historical data does not represent future returns.');
  return (
    <footer className="editorial-footer nq-readable w-full border-t border-zinc-900 bg-zinc-950 pt-16 pb-8 mt-auto z-10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="footer-columns grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center"><Activity className="text-zinc-950 w-4 h-4" /></div>
              <span className="font-extrabold text-xl text-white tracking-tight">{siteSettings?.siteName || 'Nexus Quant'}</span>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-sm">
              {t('面向 MT5 EA、XAUUSD 黄金与外汇自动交易的策略研究和开发者社区。查看资料披露、比较策略风险，交流使用与开发经验。', 'A strategy research and developer community for MT5 EAs, XAUUSD gold and forex automation. Review disclosed evidence, compare risks and exchange experience.')}
            </p>
            <SocialLinks siteSettings={siteSettings} t={t} />
          </div>
          <FooterGroup title={t('平台生态', 'Ecosystem')}>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li><button onClick={() => setRoute('market')} className="hover:text-cyan-400 transition-colors">{t('EA 策略市场', 'EA Strategy Market')}</button></li>
              <li><button onClick={() => { setRoute('forum'); setForumView('list'); }} className="hover:text-cyan-400 transition-colors">{t('量化策略论坛', 'Quant Forum')}</button></li>
              <li><span>{t('机构版 API 接入', 'Institutional API Access')} <span className="footer-coming-soon">{t('筹备中', 'Coming soon')}</span></span></li>
              <li><span>{t('MQL5 深度学习实验室', 'MQL5 Deep Learning Lab')} <span className="footer-coming-soon">{t('筹备中', 'Coming soon')}</span></span></li>
            </ul>
          </FooterGroup>
          <FooterGroup title={t('支持与服务', 'Support & Services')}>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li><a href={`mailto:${siteSettings?.contactEmail || 'admin@nexusquant.com'}`} className="flex items-center gap-2 break-all hover:text-cyan-400"><Mail className="h-4 w-4 shrink-0" />{siteSettings?.contactEmail || 'admin@nexusquant.com'}</a></li>
              <li><Mt5DownloadLink settings={siteSettings} t={t}/></li>
              <li><Link href="/help" className="flex items-center gap-2 hover:text-cyan-400"><CircleHelp className="h-4 w-4 shrink-0" />{t('帮助中心', 'Help Center')}</Link></li>
              <li><Link href="/privacy" className="flex items-center gap-2 hover:text-cyan-400"><FileText className="h-4 w-4 shrink-0" />{t('隐私政策说明', 'Privacy information')}</Link></li>
              <li><Link href="/terms" className="flex items-center gap-2 hover:text-cyan-400"><Shield className="h-4 w-4 shrink-0" />{t('服务条款说明', 'Service terms information')}</Link></li>
              <li><Link href="/risk-disclosure" className="flex items-center gap-2 hover:text-cyan-400"><Lock className="h-4 w-4 shrink-0" />{t('资金安全与风险披露', 'Funds Security & Risk Disclosure')}</Link></li>
            </ul>
          </FooterGroup>
        </div>
        <nav className="footer-quick-links" aria-label={t('必要支持入口','Essential support links')}><Link href="/help">{t('帮助中心','Help Center')}</Link><Link href="/risk-disclosure">{t('风险披露','Risk disclosure')}</Link></nav>
        <div className="footer-bottom pt-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-zinc-400">
          <p className="footer-desktop-risk">{risk}</p><details className="footer-mobile-risk"><summary>{t('交易风险说明','Trading risk information')}<span aria-hidden="true">＋</span></summary><p>{risk}</p></details>
          <p className="shrink-0">&copy; {new Date().getFullYear()} {siteSettings?.siteName || 'Nexus Quant'}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
