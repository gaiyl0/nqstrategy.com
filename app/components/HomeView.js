"use client";
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { 
  ChevronRight, Terminal, BarChart3, Users, Box, Award, Crown, ArrowUpRight, 
  Globe, Code2, Cpu, Shield, PlayCircle, HelpCircle, ArrowRight, Zap, Bot, Network 
} from 'lucide-react';

export const FadeInView = ({ children, delay = 0, className = "" }) => {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef();
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { setIsVisible(true); observer.unobserve(entry.target); } });
    }, { threshold: 0.1 });
    if (domRef.current) observer.observe(domRef.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={domRef} style={{ transitionDelay: `${delay}ms` }} className={`transition-all duration-1000 ease-out transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'} ${className}`}>{children}</div>;
};

export default function HomeView({ setRoute, setForumView, siteSettings, products, forumPosts, user, setAuthModal, setActiveCategory, openPostDetail, t, tEaType }) {
  return (
    <div className="pb-12 overflow-hidden relative">
      
      {/* ================= 全局动画 Keyframes ================= */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes infiniteScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-infinite-scroll { display: flex; width: max-content; animation: infiniteScroll 25s linear infinite; }
        .animate-infinite-scroll:hover { animation-play-state: paused; }
        
        @keyframes spinY { from { transform: rotateX(15deg) rotateY(0deg); } to { transform: rotateX(15deg) rotateY(360deg); } }
        .animate-spin-y { animation: spinY 25s linear infinite; transform-style: preserve-3d; }
        
        @keyframes floatUp { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-20px); } }
        .animate-float { animation: floatUp 4s ease-in-out infinite; }
      `}} />

      {/* ================= 高度优化版：科技感首屏 ================= */}
      <div className="relative w-full min-h-[500px] md:h-[580px] flex items-center mb-6 pt-6 md:pt-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.03)_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_60%,transparent_100%)] pointer-events-none -z-20"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col md:flex-row items-center justify-between relative z-10">
          
          {/* 左侧：文字介绍区 (高度压缩，字号适配) */}
          <div className="w-full md:w-1/2 pt-6 md:pt-0 text-center md:text-left z-20">
            <FadeInView delay={0}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold mb-6 shadow-[0_0_20px_rgba(34,211,238,0.2)] backdrop-blur-md cursor-default mx-auto md:mx-0">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span> {t('专为 XAUUSD 打造的机构级量化网络', 'Institutional Quant Network Built for XAUUSD')}
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-7 tracking-tight leading-[1.15] drop-shadow-2xl">
                <div className="block mb-2 md:mb-4">
                  {t('全球顶尖', 'World-Class')} 
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 ml-3 md:ml-5">
                    {t('算法模型', 'Algorithmic')}
                  </span>
                </div>
                <div className="block">
                  {t('量化交易平台', 'Quant Trading Platform')}
                </div>
              </h1>
              <p className="text-base md:text-lg text-zinc-400 mb-8 max-w-xl mx-auto md:mx-0 leading-relaxed drop-shadow-lg">
                {t('发现、回测并部署支持 MT5 的高性能 EA 软件。融合 MQL5 底层架构与 ONNX 深度学习模型，通过严苛的回撤控制机制，彻底革新您的外汇与黄金交易体验。', 'Discover, backtest, and deploy high-performance EAs for MT5. Integrating MQL5 architecture with ONNX deep learning models to revolutionize your Forex and Gold trading experience.')}
              </p>
              <div className="flex flex-col sm:flex-row justify-center md:justify-start gap-4">
                <button onClick={() => setRoute('market')} className="px-6 py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-black shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:shadow-[0_0_40px_rgba(34,211,238,0.6)] transition-all flex items-center justify-center gap-2">
                  {t('进入策略市场', 'Enter EA Market')} <ChevronRight className="w-5 h-5" />
                </button>
                <button onClick={() => { setRoute('forum'); setForumView('list'); }} className="px-6 py-3.5 rounded-xl bg-zinc-900/80 backdrop-blur-md border border-zinc-700 hover:bg-zinc-800 text-white font-bold transition-all flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                  <Terminal className="w-5 h-5" /> {t('访问极客社区', 'Visit Geek Community')}
                </button>
              </div>
            </FadeInView>
          </div>

          {/* 右侧：3D 科技动态球体区 (整体 Scale 缩小，完美自适应) */}
          <div className="w-full md:w-1/2 h-[350px] md:h-[480px] flex items-center justify-center relative mt-8 md:mt-0 z-10">
             <div className="absolute w-[250px] h-[250px] md:w-[350px] md:h-[350px] bg-cyan-500/10 blur-[80px] rounded-full mix-blend-screen animate-pulse" style={{ animationDuration: '5s' }}></div>
             
             {/* 缩小了 3D 容器的 scale 值 */}
             <div className="relative w-full max-w-[500px] aspect-square flex items-center justify-center [perspective:1000px] opacity-80 md:opacity-100 scale-[0.55] md:scale-[0.75]">
                <div className="absolute z-20 flex flex-col items-center justify-center animate-float">
                  <div className="absolute w-32 h-32 bg-blue-600/60 blur-[40px] rounded-full animate-pulse" style={{animationDuration: '3s'}}></div>
                  <Bot className="w-24 h-24 md:w-32 md:h-32 text-cyan-300 drop-shadow-[0_0_35px_rgba(34,211,238,1)] relative z-10" />
                  <Network className="w-10 h-10 md:w-14 md:h-14 text-blue-400 absolute -bottom-6 md:-bottom-8 animate-pulse drop-shadow-[0_0_15px_rgba(59,130,246,1)]" style={{animationDuration: '2s'}} />
                </div>
                <div className="absolute inset-0 flex items-center justify-center animate-spin-y">
                  <div className="absolute w-full h-full border border-cyan-500/40 rounded-full [transform:rotateY(0deg)]"></div>
                  <div className="absolute w-full h-full border border-blue-500/30 rounded-full [transform:rotateY(36deg)] border-dashed"></div>
                  <div className="absolute w-full h-full border border-cyan-500/40 rounded-full [transform:rotateY(72deg)]"></div>
                  <div className="absolute w-full h-full border border-blue-500/30 rounded-full [transform:rotateY(108deg)] border-dashed"></div>
                  <div className="absolute w-full h-full border border-cyan-500/40 rounded-full [transform:rotateY(144deg)]"></div>
                  <div className="absolute w-full h-full border-2 border-cyan-400/20 rounded-full [transform:rotateX(90deg)] shadow-[0_0_60px_rgba(34,211,238,0.15)_inset]"></div>
                  <div className="absolute w-[85%] h-[85%] border border-cyan-500/30 rounded-full [transform:translateZ(100px)_rotateX(90deg)] md:[transform:translateZ(130px)_rotateX(90deg)]"></div>
                  <div className="absolute w-[85%] h-[85%] border border-cyan-500/30 rounded-full [transform:translateZ(-100px)_rotateX(90deg)] md:[transform:translateZ(-130px)_rotateX(90deg)]"></div>
                  <div className="absolute w-4 h-4 md:w-5 md:h-5 bg-cyan-400 rounded-full shadow-[0_0_20px_#22d3ee] [transform:rotateY(45deg)_translateZ(180px)] md:[transform:rotateY(45deg)_translateZ(250px)] animate-pulse"></div>
                  <div className="absolute w-2 h-2 md:w-3 md:h-3 bg-blue-400 rounded-full shadow-[0_0_15px_#3b82f6] [transform:rotateY(180deg)_translateZ(180px)] md:[transform:rotateY(180deg)_translateZ(250px)]"></div>
                  <div className="absolute w-3 h-3 md:w-4 md:h-4 bg-emerald-400 rounded-full shadow-[0_0_20px_#34d399] [transform:rotateY(300deg)_translateZ(180px)] md:[transform:rotateY(300deg)_translateZ(250px)] opacity-80"></div>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* ================= 无缝左右滚动标签横幅 ================= */}
      <div className="w-full border-y border-zinc-800/60 bg-zinc-900/40 py-3.5 overflow-hidden relative mb-12 shadow-[0_0_30px_rgba(0,0,0,0.3)] backdrop-blur-md z-10">
         <div className="animate-infinite-scroll text-sm font-bold text-zinc-400 tracking-widest uppercase items-center cursor-default">
            {[1, 2].map((group) => (
              <div key={group} className="flex items-center pr-12 shrink-0">
                <span className="flex items-center gap-2 mx-8"><Cpu className="w-5 h-5 text-cyan-500"/> ONNX AI Integration</span>
                <span className="text-cyan-400 flex items-center gap-2 mx-8"><Globe className="w-5 h-5"/> XAUUSD Ready</span>
                <span className="flex items-center gap-2 mx-8"><Code2 className="w-5 h-5 text-blue-500"/> Support MQL5</span>
                <span className="text-emerald-500 flex items-center gap-2 mx-8"><Shield className="w-5 h-5"/> Prop Firm Passing</span>
                <span className="flex items-center gap-2 mx-8"><Zap className="w-5 h-5 text-amber-500"/> Ultra Low Latency</span>
                <span className="flex items-center gap-2 mx-8"><BarChart3 className="w-5 h-5 text-rose-500"/> Smart Risk Control</span>
              </div>
            ))}
         </div>
      </div>

      <FadeInView delay={100}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-zinc-900/60 border border-zinc-800/80 p-6 md:p-10 rounded-3xl backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px] pointer-events-none"></div>
            <div className="text-center md:text-left z-10"><div className="flex items-center justify-center md:justify-start gap-2 text-zinc-400 mb-2"><BarChart3 className="w-4 h-4"/> {t('累计交易量', 'Total Volume')}</div><div className="text-3xl font-black text-white">$2.4B+</div></div>
            <div className="text-center md:text-left z-10"><div className="flex items-center justify-center md:justify-start gap-2 text-zinc-400 mb-2"><Users className="w-4 h-4"/> {t('活跃交易员', 'Active Traders')}</div><div className="text-3xl font-black text-white">15,000+</div></div>
            <div className="text-center md:text-left z-10"><div className="flex items-center justify-center md:justify-start gap-2 text-zinc-400 mb-2"><Box className="w-4 h-4"/> {t('已上架策略', 'Listed EAs')}</div><div className="text-3xl font-black text-cyan-400">{products.length * 12 + 142}</div></div>
            <div className="text-center md:text-left z-10"><div className="flex items-center justify-center md:justify-start gap-2 text-zinc-400 mb-2"><Award className="w-4 h-4"/> {t('系统可用性', 'System Uptime')}</div><div className="text-3xl font-black text-emerald-400">99.99%</div></div>
          </div>
        </div>
      </FadeInView>

      <FadeInView delay={150}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">{t('4 步开启您的自动化盈利之旅', '4 Steps to Start Automated Trading')}</h2>
            <p className="text-zinc-500">{t('无需复杂的编程基础，开箱即用的专业量化生态', 'No complex programming needed, an out-of-the-box professional quant ecosystem')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-0.5 bg-zinc-800 z-0"></div>
            {[
              { step: '01', title: t('注册并认证', 'Register & Verify'), desc: t('创建安全账户，获取全球市场准入权限', 'Create a secure account for global market access'), icon: <Shield className="w-6 h-6 text-zinc-400"/> },
              { step: '02', title: t('选择策略', 'Select EA'), desc: t('在市场中挑选经过严格实盘测试的顶级 EA', 'Pick top EAs tested in strict live environments'), icon: <Box className="w-6 h-6 text-cyan-400"/> },
              { step: '03', title: t('绑定环境', 'Bind Broker'), desc: t('通过官方推荐的低延迟券商极速开户', 'Open an account with our recommended low-latency brokers'), icon: <Globe className="w-6 h-6 text-blue-400"/> },
              { step: '04', title: t('部署运行', 'Deploy & Run'), desc: t('将 .ex5 拖入 MT5，开启 24x7 无休止交易', 'Drag .ex5 into MT5 and start 24x7 non-stop trading'), icon: <PlayCircle className="w-6 h-6 text-emerald-400"/> }
            ].map((s, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center mb-6 shadow-xl relative group hover:border-cyan-500 transition-colors">
                  {s.icon}
                  <div className="absolute -bottom-3 px-3 py-0.5 bg-zinc-800 text-xs font-black rounded-full border border-zinc-700">{s.step}</div>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-zinc-500 px-4">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </FadeInView>

      <FadeInView delay={200}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-zinc-900">
          <div className="flex justify-between items-end mb-8">
            <div><h2 className="text-3xl font-bold text-white">{t('底层核心技术架构', 'Core Technical Architecture')}</h2><p className="text-sm text-zinc-500 mt-2">{t('为什么专业自营交易员都选择 Nexus Quant', 'Why professional prop traders choose Nexus Quant')}</p></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-3xl hover:border-zinc-600 transition-colors">
              <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6"><Code2 className="w-6 h-6 text-blue-400" /></div>
              <h3 className="text-xl font-bold text-white mb-3">{t('MQL5 深度集成', 'MQL5 Deep Integration')}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{t('完美适配 MetaTrader 5 架构，支持复杂的订单遍历、滑点控制与极速历史数据回溯测试。', 'Perfectly adapted to MetaTrader 5, supporting complex order traversal, slippage control, and blazing-fast backtesting.')}</p>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-3xl hover:border-cyan-600 transition-colors">
              <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-6"><Cpu className="w-6 h-6 text-cyan-400" /></div>
              <h3 className="text-xl font-bold text-white mb-3">{t('ONNX AI 模型推理', 'ONNX AI Inference')}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{t('首创支持将神经网络模型转换为 ONNX 格式，并在本地 EA 中进行行情趋势侦测与信号过滤。', 'Pioneering support for ONNX neural networks for local market trend detection and signal filtering inside the EA.')}</p>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-3xl hover:border-emerald-600 transition-colors">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6"><Shield className="w-6 h-6 text-emerald-400" /></div>
              <h3 className="text-xl font-bold text-white mb-3">{t('极致风控模块', 'Ultimate Risk Control')}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{t('针对资金盘 (Prop Firm) 挑战定制的风控引擎，精准控制单笔亏损与日内最大回撤限制。', 'Custom risk engine tailored for Prop Firm challenges, strictly limiting single loss and daily max drawdown.')}</p>
            </div>
          </div>
        </div>
      </FadeInView>

      <FadeInView delay={100}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-zinc-900">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white">🏆 {t('官方推荐交易平台', 'Recommended Brokers')}</h2>
              <p className="text-sm text-zinc-500 mt-2">{t('经过底层网络延迟与点差压力测试，我们仅推荐以下完美适配高频 EA 的顶级环境', 'Tested for latency and spread, we only recommend the following top environments optimized for HFT EAs.')}</p>
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <div className="relative w-full bg-gradient-to-r from-cyan-900/40 via-blue-900/20 to-zinc-950 border border-cyan-500/30 p-8 md:p-12 rounded-3xl overflow-hidden group hover:border-cyan-400 transition-colors flex flex-col md:flex-row items-center justify-between gap-8 shadow-[0_0_40px_rgba(34,211,238,0.1)]">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/20 blur-[80px] rounded-full pointer-events-none"></div>
              <div className="flex items-center gap-6 z-10 w-full md:w-auto">
                <div className="w-16 h-16 shrink-0 bg-cyan-500/20 rounded-2xl flex items-center justify-center border border-cyan-500/30"><Crown className="w-8 h-8 text-cyan-400" /></div>
                <div>
                  <div className="inline-block px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-black uppercase tracking-widest border border-cyan-500/20 mb-2">{t('顶级战略合作伙伴', 'Top Strategic Partner')}</div>
                  <h3 className="text-3xl md:text-4xl font-black text-white mb-2">{siteSettings?.broker1Name || 'Exness'}</h3>
                  <p className="text-zinc-400 text-sm md:text-base max-w-2xl leading-relaxed">{siteSettings?.broker1Desc || t('全球交易量第一，无限杠杆，支持出金秒到账，XAUUSD 点差极低。', 'World #1 by volume, unlimited leverage, instant withdrawal, ultra-low XAUUSD spread.')}</p>
                </div>
              </div>
              <a href={siteSettings?.broker1Link || '#'} target="_blank" rel="noreferrer" className="shrink-0 w-full md:w-auto px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-black rounded-xl text-center transition-colors flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30 z-10">
                {t('立即开户注册', 'Open Account')} <ArrowUpRight className="w-5 h-5" />
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 p-8 rounded-3xl hover:border-blue-500/50 transition-all group flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-5"><Globe className="w-6 h-6 text-blue-400" /></div>
                  <h3 className="text-2xl font-black text-white mb-2">{siteSettings?.broker2Name || 'TMGM'}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed mb-8">{siteSettings?.broker2Desc || t('顶级流动性供应商，极低点差，完美适配高频交易与刷单EA。', 'Top liquidity provider, ultra-low spread, perfect for HFT and scalping EAs.')}</p>
                </div>
                <a href={siteSettings?.broker2Link || '#'} target="_blank" rel="noreferrer" className="w-full py-3.5 bg-zinc-800 group-hover:bg-blue-600 text-white font-bold rounded-xl text-center transition-colors flex items-center justify-center gap-2">
                  {t('前往开户注册', 'Open Account')} <ArrowUpRight className="w-4 h-4" />
                </a>
              </div>
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 p-8 rounded-3xl hover:border-emerald-500/50 transition-all group flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-5"><Globe className="w-6 h-6 text-emerald-400" /></div>
                  <h3 className="text-2xl font-black text-white mb-2">{siteSettings?.broker3Name || 'XM'}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed mb-8">{siteSettings?.broker3Desc || t('老牌安全平台，新人注册即送30美元赠金，入金门槛极低。', 'Veteran safe platform, $30 welcome bonus for new users, low deposit threshold.')}</p>
                </div>
                <a href={siteSettings?.broker3Link || '#'} target="_blank" rel="noreferrer" className="w-full py-3.5 bg-zinc-800 group-hover:bg-emerald-600 text-white font-bold rounded-xl text-center transition-colors flex items-center justify-center gap-2">
                  {t('前往开户注册', 'Open Account')} <ArrowUpRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </FadeInView>

      <FadeInView delay={100}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 bg-zinc-900/20 rounded-[3rem] my-8 border border-zinc-800/50">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white">🔥 {t('热门实盘策略', 'Top Live Strategies')}</h2>
              <p className="text-sm text-zinc-500 mt-2">{t('基于近期真实胜率与资金增长率综合排名的精品策略', 'Premium strategies ranked by recent real win rates and capital growth')}</p>
            </div>
            <button onClick={() => setRoute('market')} className="text-sm font-bold text-cyan-400 hover:text-cyan-300 hidden md:flex items-center gap-1 bg-cyan-500/10 px-4 py-2 rounded-full">{t('查看完整市场', 'View Full Market')} <ChevronRight className="w-4 h-4"/></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {products.filter(p => p.status === 'active').slice(0, 3).map(p => (
              <div key={p.id} className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between hover:border-cyan-500/50 transition-all group cursor-pointer shadow-lg" onClick={() => setRoute('market')}>
                <div>
                  <div className="flex items-center gap-4 mb-5">
                    {p.logo_url ? <Image src={p.logo_url} width={56} height={56} alt={`${p.title} logo`} className="w-14 h-14 rounded-2xl object-cover border border-zinc-800" /> : <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center"><Box className="w-6 h-6 text-cyan-400/50" /></div>}
                    <div><h3 className="text-base font-bold text-white truncate w-36 group-hover:text-cyan-400 transition-colors">{p.title}</h3><p className="text-xs text-zinc-500 mt-0.5">by {p.author}</p></div>
                  </div>
                  <div className="flex gap-4 text-xs bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800 mb-2">
                    <div className="flex-1"><span className="text-zinc-500 block mb-1">{t('近期胜率', 'Win Rate')}</span><span className="text-emerald-400 font-bold text-base">{p.win_rate}</span></div>
                    <div className="w-px bg-zinc-800"></div>
                    <div className="flex-1"><span className="text-zinc-500 block mb-1">{t('最大回撤控制', 'Max Drawdown')}</span><span className="text-red-400 font-bold text-base">{p.drawdown}</span></div>
                  </div>
                </div>
              </div>
            ))}
            {products.filter(p => p.status === 'active').length === 0 && (
              <div className="col-span-3 text-center py-10 text-zinc-500 border border-dashed border-zinc-800 rounded-3xl">{t('当前榜单正在统计中...', 'Leaderboard is currently calculating...')}</div>
            )}
          </div>
        </div>
      </FadeInView>

      <FadeInView delay={100}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-zinc-900">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-4">{t('常见问题解答 (FAQ)', 'Frequently Asked Questions')}</h2>
            <p className="text-zinc-500">{t('了解更多关于 EA 部署与资金安全的信息', 'Learn more about EA deployment and fund security')}</p>
          </div>
          <div className="space-y-4">
            {[
              { q: t('我没有任何编程基础，可以使用这些 EA 吗？', 'Can I use these EAs without any programming knowledge?'), a: t('完全可以。市场内所有的 EA 都经过封装，您只需要将下载的 .ex5 文件拖入您的 MT5 软件对应窗口即可。', 'Absolutely. All EAs are compiled, you just need to drag and drop the downloaded .ex5 file into your MT5 chart.') },
              { q: t('支持哪些虚拟币支付？', 'Which cryptocurrencies are supported?'), a: t('平台目前内置收银台支持 USDT (TRC20)、BTC 和 ETH 付款。支付确认后页面会立刻下发。', 'We support USDT (TRC20), BTC, and ETH. Downloads are instantly unlocked after block confirmation.') },
              { q: t('我的交易资金存放在哪里？安全吗？', 'Where are my funds stored? Is it safe?'), a: t('Nexus Quant 不接触您的任何交易本金。您的资金完全存放在您自己选择的独立券商账户中。', 'Nexus Quant never touches your trading capital. Your funds are safely held in your own broker account.') }
            ].map((faq, i) => (
              <div key={i} className="bg-zinc-900/30 border border-zinc-800 p-6 rounded-2xl hover:bg-zinc-900/60 transition-colors">
                <h4 className="text-base font-bold text-white flex items-start gap-3"><HelpCircle className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" /> {faq.q}</h4>
                <p className="text-sm text-zinc-400 mt-3 pl-8 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </FadeInView>

      <FadeInView delay={200}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 pt-8 text-center">
          <div className="bg-gradient-to-r from-blue-900/20 via-cyan-900/20 to-emerald-900/20 border border-cyan-500/20 rounded-3xl p-10 md:p-16 relative overflow-hidden">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 relative z-10">{t('准备好提升您的交易胜率了吗？', 'Ready to boost your trading win rate?')}</h2>
            <p className="text-zinc-400 mb-8 max-w-xl mx-auto relative z-10">{t('注册账户，探索实盘验证过的高级策略，或上传您的创新算法，获取独立的商业变现网关。', 'Create an account to explore verified premium strategies, or upload your algorithm to monetize.')}</p>
            <button onClick={() => { if(!user) return setAuthModal('register'); setRoute('market'); }} className="relative z-10 px-8 py-4 bg-white hover:bg-zinc-200 text-zinc-950 font-black rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all flex items-center justify-center gap-2 mx-auto">
              {t('免费创建账户', 'Create Free Account')} <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </FadeInView>
    </div>
  );
}
