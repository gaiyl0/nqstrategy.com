"use client";
import React from 'react';
import { Activity, Mail, FileText, Shield, Lock } from 'lucide-react';

export default function Footer({ siteSettings, setRoute, setForumView, t }) {
  return (
    <footer className="w-full border-t border-zinc-900 bg-zinc-950 pt-16 pb-8 mt-auto z-10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center"><Activity className="text-zinc-950 w-4 h-4" /></div>
              <span className="font-extrabold text-xl text-white tracking-tight">{siteSettings?.siteName || 'Nexus Quant'}</span>
            </div>
            <p className="text-sm text-zinc-500 leading-relaxed max-w-sm">
              {t('全球顶尖的量化算法交易与极客开发者平台。融合 MQL5 底层架构与 ONNX AI 推理模型，致力于为机构级交易员提供安全、透明、高效的自动化盈利解决方案。', 'The world\'s leading quantitative algorithmic trading and geek developer platform. Integrating MQL5 architecture with ONNX AI inference models to provide institutional traders with secure, transparent, and efficient automated profitability solutions.')}
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">{t('平台生态', 'Ecosystem')}</h4>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li><button onClick={() => setRoute('market')} className="hover:text-cyan-400 transition-colors">{t('EA 策略市场', 'EA Strategy Market')}</button></li>
              <li><button onClick={() => { setRoute('forum'); setForumView('list'); }} className="hover:text-cyan-400 transition-colors">{t('极客开发者社区', 'Geek Developer Community')}</button></li>
              <li><button className="hover:text-cyan-400 transition-colors">{t('机构版 API 接入', 'Institutional API Access')}</button></li>
              <li><button className="hover:text-cyan-400 transition-colors">{t('MQL5 深度学习实验室', 'MQL5 Deep Learning Lab')}</button></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">{t('支持与服务', 'Support & Services')}</h4>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li className="flex items-center gap-2 hover:text-cyan-400 cursor-pointer"><Mail className="w-4 h-4" /> {siteSettings?.contactEmail || 'admin@nexusquant.com'}</li>
              <li className="flex items-center gap-2 hover:text-cyan-400 cursor-pointer"><FileText className="w-4 h-4" /> {t('隐私政策 (Privacy Policy)', 'Privacy Policy')}</li>
              <li className="flex items-center gap-2 hover:text-cyan-400 cursor-pointer"><Shield className="w-4 h-4" /> {t('服务条款 (Terms of Service)', 'Terms of Service')}</li>
              <li className="flex items-center gap-2 hover:text-cyan-400 cursor-pointer"><Lock className="w-4 h-4" /> {t('资金安全与风险披露', 'Funds Security & Risk Disclosure')}</li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-zinc-600">
          <p>{t('高风险警告：外汇保证金与差价合约 (CFD) 交易具有极高的风险，可能导致您损失全部投资本金。历史数据不代表未来收益。', 'High Risk Warning: Margin trading in Forex and CFDs carries a high level of risk and may result in the loss of all your investment principal. Historical data does not represent future returns.')}</p>
          <p className="shrink-0">&copy; {new Date().getFullYear()} {siteSettings?.siteName || 'Nexus Quant'}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}