"use client";
import React, { useState, useEffect } from 'react';
import { 
  Activity, Shield, CheckCircle, Upload, Globe, X, Code2, Edit,
  Image as ImageIcon, FileCode, LogOut, User as UserIcon, MessageSquare, Eye, 
  Clock, ArrowLeft, Hash, FolderDown, Download, Box, CheckCircle2, Trash2, Settings, Wallet
} from 'lucide-react';

import HomeView, { FadeInView } from './components/HomeView';
import Footer from './components/Footer';
import MarketView from './components/MarketView';

const emptyMetricsForm = () => ({
  initialDeposit: '', netProfit: '', profitFactor: '', sharpeRatio: '',
  maxDrawdownPercent: '', recoveryFactor: '', winRatePercent: '', totalTrades: '',
  equityCurveText: '', drawdownCurveText: '', monthlyReturnsText: '',
});

const emptyUploadForm = () => ({
  title: '', description: '', price: '', winRate: '', drawdown: '', pairs: 'XAUUSD', eaTypes: [],
  metrics: emptyMetricsForm(), evidenceIds: [], reportId: null,
  version:'1.0.0',releaseNotes:'初始版本',upgradePolicy:'all_existing',trialEnabled:false,trialDays:7,
});

function parseMetricRows(text, valueKey) {
  return String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [period, rawValue, ...extra] = line.split(',').map((item) => item.trim());
    if (!period || rawValue === undefined || extra.length > 0 || rawValue === '') throw new Error(`指标行格式错误：${line}`);
    return { [valueKey === 'percent' && period.length === 7 ? 'month' : 'date']: period, [valueKey]: Number(rawValue) };
  });
}

function metricsPayload(metrics) {
  return {
    initialDeposit: Number(metrics.initialDeposit), netProfit: Number(metrics.netProfit),
    profitFactor: Number(metrics.profitFactor), sharpeRatio: Number(metrics.sharpeRatio),
    maxDrawdownPercent: Number(metrics.maxDrawdownPercent), recoveryFactor: Number(metrics.recoveryFactor),
    winRatePercent: Number(metrics.winRatePercent), totalTrades: Number(metrics.totalTrades),
    equityCurve: parseMetricRows(metrics.equityCurveText, 'value'),
    drawdownCurve: parseMetricRows(metrics.drawdownCurveText, 'percent'),
    monthlyReturns: parseMetricRows(metrics.monthlyReturnsText, 'percent'),
  };
}

export default function App() {
  const [lang, setLang] = useState('zh'); 

  useEffect(() => { const savedLang = localStorage.getItem('nexus_lang'); if (savedLang) setLang(savedLang); }, []);
  const toggleLang = () => { const newLang = lang === 'zh' ? 'en' : 'zh'; setLang(newLang); localStorage.setItem('nexus_lang', newLang); };
  const t = (zh, en) => lang === 'en' ? en : zh;

  const tEaType = (zh) => { const dict = { '马丁格尔': 'Martingale', '网格': 'Grid', '套汇': 'Arbitrage', '锁仓': 'Hedging', '超短线': 'Scalping', '新闻': 'News', '趋势': 'Trend', '等级交易': 'Level Trading', '神经网络': 'Neural Net', '多货币': 'Multi-Currency' }; return lang === 'en' ? (dict[zh] || zh) : zh; };
  const tCat = (zh) => { const dict = { '全部': 'All', 'XAUUSD 策略': 'XAUUSD EAs', 'MQL5 开发': 'MQL5 Dev', 'AI 与深度学习': 'AI & Deep Learning', '官方公告': 'Announcements' }; return lang === 'en' ? (dict[zh] || zh) : zh; };

  const getUserTitle = (postCount, eaCount, role) => {
    if (role === 'admin') return { title: t('👑 最高统治者', '👑 Supreme Admin'), color: 'text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]' };
    if (role === 'user') return { title: t('👤 普通用户', '👤 Standard User'), color: 'text-zinc-400 bg-zinc-800 border-zinc-700' };
    const score = (postCount * 10) + (eaCount * 50);
    if (score >= 500) return { title: t('🏆 Lv.MAX 传奇大牛', '🏆 Legendary Guru'), color: 'text-rose-400 bg-rose-500/10 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.2)]' };
    if (score >= 200) return { title: t('🔮 Lv.4 首席架构师', '🔮 Chief Architect'), color: 'text-purple-400 bg-purple-500/10 border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.2)]' };
    if (score >= 100) return { title: t('⚡ Lv.3 资深算法师', '⚡ Senior Algo Dev'), color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' };
    if (score >= 30)  return { title: t('🚀 Lv.2 独立开发者', '🚀 Indie Quant'), color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    return { title: t('🌱 Lv.1 见习宽客', '🌱 Trainee Quant'), color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  };

  const [route, setRouteInternal] = useState('home'); 
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasMarketState = ['compare', 'q', 'pair', 'type', 'verification', 'maxDrawdown', 'maxPrice', 'page'].some(key => params.has(key));
    const savedRoute = sessionStorage.getItem('nexus_route');
    if (hasMarketState) setRouteInternal('market');
    else if (savedRoute) setRouteInternal(savedRoute);
  }, []);
  const setRoute = (newRoute) => {
    setRouteInternal(newRoute); sessionStorage.setItem('nexus_route', newRoute);
    if (newRoute !== 'market' && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      ['compare', 'q', 'pair', 'type', 'verification', 'maxDrawdown', 'maxPrice', 'page'].forEach(key => params.delete(key));
      const query = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    }
  };

  const [isMounted, setIsMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  const [authModal, setAuthModal] = useState(null); 
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '', code: '' });
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [sentCode, setSentCode] = useState(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  // 找回密码专用状态与函数
  const [resetForm, setResetForm] = useState({ email: '', code: '', newPassword: '' });
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const [isSendingResetCode, setIsSendingResetCode] = useState(false);

  const handleSendResetCode = async () => {
    if(!resetForm.email || !resetForm.email.includes('@')) return showToast(t('请输入有效的注册邮箱', 'Enter valid email'));
    setIsSendingResetCode(true);
    try {
      const res = await fetch('/api/send-code', { method: 'POST', body: JSON.stringify({ toEmail: resetForm.email, type: 'reset' }) });
      const data = await res.json();
      if(data.success) { showToast(t('如果该邮箱绑定了账户，重置验证码将发送到该邮箱', 'If an account exists, a reset code will be sent')); }
      else { showToast('❌ ' + data.message); }
    } catch (e) { showToast(t('发送失败', 'Send failed')); }
    setIsSendingResetCode(false);
  };

  const submitResetPassword = async () => {
    if(!resetForm.email || !resetForm.code || !resetForm.newPassword) {
      return showToast(t('请填写完整重置信息', 'Fill all fields'));
    }
    setIsResetSubmitting(true);
    try {
      const res = await fetch('/api/auth/register/password', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(resetForm) 
      });

      const data = await res.json();
      if(data.success) {
        showToast(t('✅ 密码重置成功，请直接登录！', '✅ Password reset! Please login.'));
        setAuthForm({ ...authForm, email: resetForm.email, password: '' });
        setAuthModal('login');
      } else {
        showToast('❌ ' + (data.message || '重置失败'));
      }
    } catch (e) {
      console.error("重置异常:", e);
      showToast(t('❌ 请求失败，请检查网络或重试', 'Request failed'));
    }
    setIsResetSubmitting(false);
  };

  const [profileModal, setProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ newUsername: '', password: '' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [isProfileUpdating, setIsProfileUpdating] = useState(false);
  
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawAddress, setWithdrawAddress] = useState('');

  const [siteSettings, setSiteSettings] = useState(null);
  const [products, setProducts] = useState([]);
  const [toastMsg, setToastMsg] = useState('');

  const [uploadForm, setUploadForm] = useState(emptyUploadForm);
  const [logoFile, setLogoFile] = useState(null);
  const [ex4File, setEx4File] = useState(null);
  const [evidenceFiles, setEvidenceFiles] = useState({ settings: null, statistics: null, chart: null, analysis: null });
  const [reportInfo, setReportInfo] = useState(null);
  const [isParsingReport, setIsParsingReport] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [versionModal,setVersionModal]=useState(null);
  const [versionForm,setVersionForm]=useState({version:'',releaseNotes:'',upgradePolicy:'all_existing'});
  const [versionFile,setVersionFile]=useState(null);
  const [isVersionSubmitting,setIsVersionSubmitting]=useState(false);

  const [forumPosts, setForumPosts] = useState([]);
  const [forumSort, setForumSort] = useState('latest');
  const [activeCategory, setActiveCategory] = useState('全部');
  const [forumView, setForumView] = useState('list'); 
  const [selectedPost, setSelectedPost] = useState(null);
  const [newPost, setNewPost] = useState({ title: '', category: '官方公告', content: '' });
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  const [myLicenses,setMyLicenses]=useState([]);
  const [mySocial,setMySocial]=useState({favorites:[],follows:[],ratings:[]});

  const dynamicCats = siteSettings?.forumCategories ? siteSettings.forumCategories.split(',').map(c => c.trim()).filter(Boolean) : ['XAUUSD 策略', 'MQL5 开发', 'AI 与深度学习', '官方公告'];
  const categories = ['全部', ...dynamicCats];
  const eaTypeOptions = ['马丁格尔', '网格', '套汇', '锁仓', '超短线', '新闻', '趋势', '等级交易', '神经网络', '多货币'];

  const updateUserSession = (newUserData) => { setUser(current => ({ ...current, ...newUserData })); };
  const handleLogout = async () => {
    try { await fetch('/api/auth/me', { method: 'POST' }); } catch (e) {}
    setUser(null);
    setShowUserMenu(false);
    setRoute('home');
    showToast(t('已安全退出登录', 'Logged out safely'));
  };
  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000); };

  const handleFileUpload = async (file) => { const formData = new FormData(); formData.append('file', file); const res = await fetch('/api/upload', { method: 'POST', body: formData }); const data = await res.json(); if (!res.ok || !data.success) throw new Error(data.message || '文件上传失败'); return data.url; };
  const handleReportUpload = async (file) => {
    if (!file) return;
    setIsParsingReport(true);
    try {
      const formData = new FormData(); formData.append('file', file);
      const response = await fetch('/api/strategy-report', { method: 'POST', body: formData }); const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'MT5 报告解析失败');
      const m = data.report.metrics;
      setUploadForm(prev => ({ ...prev, reportId: data.report.id, metrics: {
        initialDeposit:m.initialDeposit, netProfit:m.netProfit, profitFactor:m.profitFactor, sharpeRatio:m.sharpeRatio,
        maxDrawdownPercent:m.maxDrawdownPercent, recoveryFactor:m.recoveryFactor, winRatePercent:m.winRatePercent, totalTrades:m.totalTrades,
        equityCurveText:m.equityCurve.map(p=>`${p.date},${p.value}`).join('\n'), drawdownCurveText:m.drawdownCurve.map(p=>`${p.date},${p.percent}`).join('\n'),
        monthlyReturnsText:m.monthlyReturns.map(p=>`${p.month},${p.percent}`).join('\n'),
      }}));
      setReportInfo(data.report); showToast(data.resumed ? t('✅ 已恢复并重新载入上次解析的报告', '✅ Previous parsed report restored') : t('✅ MT5 报告解析成功，指标和曲线已自动生成', '✅ MT5 report parsed; metrics and curves generated'));
    } catch (error) { setReportInfo(null); setUploadForm(prev=>({...prev,reportId:null,metrics:emptyMetricsForm()})); showToast('❌ ' + error.message); }
    finally { setIsParsingReport(false); }
  };

  const handleSendAuthCode = async () => {
    if(!authForm.email || !authForm.email.includes('@')) return showToast(t('请输入有效的邮箱地址', 'Invalid email address'));
    setIsSendingCode(true);
    try {
      const res = await fetch('/api/send-code', { method: 'POST', body: JSON.stringify({ toEmail: authForm.email }) });
      const data = await res.json();
      if(data.success) { setSentCode(true); showToast(t('验证码已发送', 'Verification code sent')); } else showToast(data.message);
    } catch (e) { showToast(t('发送异常', 'Send error')); }
    setIsSendingCode(false);
  };

  const submitRegister = async () => {
    if (!authForm.username || !authForm.email || !authForm.password || !authForm.code) return showToast(t('请填写完整信息', 'Please fill all fields'));
    setIsAuthSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authForm) });
      const data = await res.json();
      if (data.success) { updateUserSession(data.user); setAuthModal(null); showToast(t('🎉 注册成功！', '🎉 Registered successfully!')); setAuthForm({ username: '', email: '', password: '', code: '' }); } else showToast(data.message);
    } catch (e) { showToast(t('请求失败', 'Request failed')); }
    setIsAuthSubmitting(false);
  };

  const submitLogin = async () => {
    if (!authForm.email || !authForm.password) return showToast(t('请输入账号密码', 'Enter credentials'));
    setIsAuthSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: authForm.email, password: authForm.password }) });
      const data = await res.json();
      if (data.success) { updateUserSession(data.user); setAuthModal(null); showToast(t(`欢迎回来，${data.user.username}`, `Welcome back, ${data.user.username}`)); } else showToast(data.message);
    } catch (e) {}
    setIsAuthSubmitting(false);
  };

  const submitProfileUpdate = async () => {
    if(!profileForm.newUsername.trim()) return showToast(t('用户名不能为空', 'Username required'));
    setIsProfileUpdating(true);
    let avatar_url = user.avatar_url;
    if (avatarFile) avatar_url = await handleFileUpload(avatarFile);
    try {
      const res = await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newUsername: profileForm.newUsername.trim(), avatar_url, password: profileForm.password }) });
      const data = await res.json();
      if (data.success) { updateUserSession(data.user); setProfileModal(false); showToast(t('✅ 资料更新成功！', '✅ Profile updated!')); fetchProducts(); fetchForumPosts(); fetchMyOrders(); } else showToast('❌ ' + data.message);
    } catch (e) {}
    setIsProfileUpdating(false);
  };

  const submitWithdrawal = async () => {
    if (!withdrawAddress) return showToast(t('请输入有效的收款地址', 'Please enter a valid crypto address'));
    try {
      const res = await fetch('/api/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: withdrawAddress }) });
      const data = await res.json();
      if (data.success) {
         showToast(t('✅ 提现申请已提交，等待审核打款！', '✅ Withdrawal submitted, pending approval!'));
         updateUserSession({ balance: 0 }); 
         setWithdrawModal(false); setWithdrawAddress('');
      } else { showToast('❌ ' + data.message); }
    } catch (e) { showToast(t('请求异常', 'Request error')); }
  };

  const fetchProducts = () => { fetch(`/api/products?t=${Date.now()}`, { cache: 'no-store' }).then(res => res.json()).then(data => { if(data.success) setProducts(data.products); }); };
  const fetchForumPosts = (cat = '全部', sort = forumSort) => { fetch(`/api/posts?category=${encodeURIComponent(cat)}&sort=${sort}&t=${Date.now()}`, { cache: 'no-store' }).then(res => res.json()).then(data => { if(data.success) setForumPosts(data.posts); }); };
  const fetchMyOrders = async () => { if (user) { try { const res = await fetch(`/api/orders?t=${Date.now()}`, { cache: 'no-store' }); const data = await res.json(); if(data.success) setMyOrders(data.orders); } catch (e) {} } };
  const fetchMyLicenses=async()=>{if(user){try{const response=await fetch('/api/licenses',{cache:'no-store'});const data=await response.json();if(data.success)setMyLicenses(data.licenses);}catch{}}};
  const fetchMySocial=async()=>{if(user){try{const response=await fetch('/api/social',{cache:'no-store'});const data=await response.json();if(data.success)setMySocial({favorites:data.favorites,follows:data.follows,ratings:data.ratings});}catch{}}};

  useEffect(() => {
    setIsMounted(true);
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setUser(data.success ? data.user : null))
      .catch(() => setUser(null));
    fetch(`/api/settings?t=${Date.now()}`, { cache: 'no-store' }).then(res => res.json()).then(data => setSiteSettings(data));
    fetchForumPosts(); fetchProducts();
  }, []);

  useEffect(() => { if (isMounted && user) { fetchMyOrders();fetchMyLicenses();fetchMySocial(); } }, [isMounted, user?.username]);

  const toggleEaType = (type) => { setUploadForm(prev => { const tArr = prev.eaTypes || []; return { ...prev, eaTypes: tArr.includes(type) ? tArr.filter(t => t !== type) : [...tArr, type] }; }); };

  const handleEditEA = (ea) => {
    const metrics = ea.metrics;
    setUploadForm({
      id: ea.id, title: ea.title || '', description: ea.description || '', price: ea.price || '',
      winRate: ea.win_rate || '', drawdown: ea.drawdown || '', pairs: ea.pairs || 'XAUUSD',
      eaTypes: ea.ea_type ? ea.ea_type.split(',') : [],
      trialEnabled:Boolean(ea.trial_enabled),trialDays:ea.trial_days||7,
      evidenceIds: (ea.evidence || []).map(item => item.id),
      reportId: ea.report?.id || null,
      metrics: metrics ? {
        initialDeposit: metrics.initialDeposit, netProfit: metrics.netProfit,
        profitFactor: metrics.profitFactor, sharpeRatio: metrics.sharpeRatio,
        maxDrawdownPercent: metrics.maxDrawdownPercent, recoveryFactor: metrics.recoveryFactor,
        winRatePercent: metrics.winRatePercent, totalTrades: metrics.totalTrades,
        equityCurveText: metrics.equityCurve.map(p => `${p.date},${p.value}`).join('\n'),
        drawdownCurveText: metrics.drawdownCurve.map(p => `${p.date},${p.percent}`).join('\n'),
        monthlyReturnsText: metrics.monthlyReturns.map(p => `${p.month},${p.percent}`).join('\n'),
      } : emptyMetricsForm(),
    });
    setLogoFile(null); setEx4File(null); setReportInfo(ea.report ? { ...ea.report, metrics } : null); setEvidenceFiles({ settings: null, statistics: null, chart: null, analysis: null }); setRoute('upload');
  };

  const submitEA = async () => {
    if(!uploadForm.title) return showToast(t('请输入名称', 'Enter title'));
    setIsSubmitting(true);
    try {
      let logo_url = '', file_url = '';
      if (logoFile) logo_url = await handleFileUpload(logoFile);
      if (ex4File) file_url = await handleFileUpload(ex4File);
      const evidenceIds = [...(uploadForm.evidenceIds || [])];
      for (const [evidenceType, file] of Object.entries(evidenceFiles)) {
        if (!file) continue;
        const formData = new FormData(); formData.append('file', file); formData.append('evidenceType', evidenceType);
        const evidenceResponse = await fetch('/api/evidence', { method: 'POST', body: formData });
        const evidenceData = await evidenceResponse.json();
        if (!evidenceResponse.ok || !evidenceData.success) throw new Error(evidenceData.message || '回测证据上传失败');
        const previous = (uploadForm.id && (uploadForm.evidenceIds || []).find(id => (products.find(p=>p.id===uploadForm.id)?.evidence || []).find(item=>item.id===id)?.type === evidenceType));
        if (previous) evidenceIds.splice(evidenceIds.indexOf(previous), 1);
        evidenceIds.push(evidenceData.evidence.id);
      }
      const res = await fetch('/api/products', { method: uploadForm.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...uploadForm, evidenceIds, metrics: metricsPayload(uploadForm.metrics), logo_url, file_url, price: uploadForm.price || 0 }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || '策略保存失败');
      showToast(uploadForm.id ? t('🎉 EA 修改成功！已重新进入审核队列。', '🎉 EA Updated! In review.') : t('🎉 EA 发布成功！已进入审核队列。', '🎉 EA Published! In review.'));
      setUploadForm(emptyUploadForm());
      setEvidenceFiles({ settings: null, statistics: null, chart: null, analysis: null });
      setReportInfo(null);
      setRoute('profile'); fetchProducts();
    } catch (error) {
      showToast('❌ ' + (error.message || t('上传失败', 'Upload failed')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePurchaseProcess = async (product) => {
    if (!user) return setAuthModal('login');
    if (product.price === 0) {
      try {
        const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: product.id }) });
        const data = await res.json();
        if (data.success) { showToast(t('🎉 免费获取成功！已放入您的资产库。', '🎉 Got it for free! Added to your assets.')); await fetchMyOrders(); setRoute('profile'); } else showToast('❌ ' + (data.message || 'Error'));
      } catch (e) { showToast(t('❌ 后端无响应', 'Backend error')); }
    } else {
      showToast(t('付费购买暂未开放，请勿向页面展示的钱包地址转账', 'Paid checkout is unavailable. Do not send funds to displayed wallet addresses.'));
    }
  };
  const handleStartTrial=async(product)=>{if(!user)return setAuthModal('login');try{const response=await fetch('/api/licenses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start_trial',productId:product.id})});const data=await response.json();if(!response.ok||!data.success)throw new Error(data.message||'试用申请失败');showToast(data.replayed?t('ℹ️ 已存在该产品的试用记录','Trial already exists'):t('✅ 试用已开始，请到个人中心绑定账号与设备','Trial started. Bind account and device in Profile'));await fetchMyLicenses();setRoute('profile');}catch(error){showToast('❌ '+error.message);}};
  const handleSocialAction=async(body)=>{if(!user){setAuthModal('login');return null;}try{const response=await fetch('/api/social',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok||!data.success)throw new Error(data.message||'操作失败');showToast(t('✅ 操作已保存','✅ Saved'));await Promise.all([fetchProducts(),fetchMySocial()]);return data;}catch(error){showToast('❌ '+error.message);return null;}};
  const handleLicenseBind=async(license,bindingType)=>{const value=window.prompt(bindingType==='trading_account'?t('输入 MT4/MT5 数字账号','Enter numeric MT4/MT5 account'):t('输入由 EA 客户端生成的设备指纹（至少 16 字符）','Enter device fingerprint generated by the EA client (16+ chars)'));if(!value)return;const response=await fetch('/api/licenses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'bind',licenseId:license.id,bindingType,value})});const data=await response.json();if(!response.ok||!data.success)return showToast('❌ '+(data.message||'绑定失败'));showToast(data.replayed?t('ℹ️ 绑定未变化','Binding unchanged'):t('✅ 绑定已更新，旧令牌已失效','Binding updated; old tokens invalidated'));fetchMyLicenses();};
  const handleLicenseToken=async(license)=>{const tradingAccount=window.prompt(t('输入已绑定的 MT4/MT5 账号','Enter the bound MT4/MT5 account'));if(!tradingAccount)return;const deviceFingerprint=window.prompt(t('输入已绑定的设备指纹','Enter the bound device fingerprint'));if(!deviceFingerprint)return;const response=await fetch('/api/licenses/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({licenseId:license.id,tradingAccount,deviceFingerprint})});const data=await response.json();if(!response.ok||!data.success)return showToast('❌ '+(data.message||'令牌签发失败'));try{await navigator.clipboard.writeText(data.token);showToast(t('✅ 15 分钟授权令牌已复制','15-minute authorization token copied'));}catch{window.prompt(t('复制授权令牌','Copy authorization token'),data.token);}};

  const submitVersion=async()=>{
    if(!versionModal||!versionFile||!versionForm.version||versionForm.releaseNotes.trim().length<3)return showToast(t('请填写版本号、更新日志并选择程序文件','Enter a version, release notes, and program file'));
    setIsVersionSubmitting(true);
    try{const fileUrl=await handleFileUpload(versionFile);const response=await fetch('/api/versions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId:versionModal.id,fileUrl,...versionForm})});const data=await response.json();if(!response.ok||!data.success)throw new Error(data.message||'版本提交失败');showToast(t('✅ 新版本已提交管理员审核','✅ Version submitted for review'));setVersionModal(null);setVersionFile(null);setVersionForm({version:'',releaseNotes:'',upgradePolicy:'all_existing'});fetchProducts();}catch(error){showToast('❌ '+error.message);}finally{setIsVersionSubmitting(false);}
  };

  const handleSecureDownload = async (productId, title, versionId = null) => {
    if (!user) return showToast(t('❌ 身份已过期', 'Session expired'));
    showToast(t('🔒 正在发起防盗版鉴权...', '🔒 Authenticating...'));
    try {
      const res = await fetch(`/api/download?productId=${productId}${versionId?`&versionId=${versionId}`:''}`);
      if (!res.ok) { const text = await res.text(); showToast(`❌ ${t('拦截', 'Blocked')}: ${text}`); return; }
      const disposition = res.headers.get('Content-Disposition');
      let ext = '.ex5'; 
      if (disposition && disposition.match(/filename="?([^"]+)"?/)) ext = '.' + disposition.match(/filename="?([^"]+)"?/)[1].split('.').pop(); 
      const blob = await res.blob(); const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${title.replace(/\s+/g, '_')}_NexusSaaS${ext}`; 
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
      showToast(t('🎉 下载完毕！', '🎉 Downloaded!'));
    } catch (e) { showToast(t('❌ 网络失败', 'Network error')); }
  };

  const handleDeleteMyEA = async (id, title) => {
    if (!window.confirm(t(`确定删除策略 [${title}] 吗？`, `Delete EA [${title}]?`))) return;
    try { await fetch(`/api/products?id=${id}`, { method: 'DELETE' }); showToast(t('✅ 删除成功', '✅ Deleted')); fetchProducts(); await fetchMyOrders(); } catch (e) {}
  };

  const submitPost = async () => {
    if(!newPost.title || !newPost.content) return showToast(t('标题和内容不能为空', 'Required'));
    await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newPost, category: newPost.category || categories[1] }) });
    showToast(t('帖子发布成功！', 'Posted!')); setForumView('list'); fetchForumPosts(activeCategory); setNewPost({ title: '', category: categories[1], content: '' });
  };

  const openPostDetail = async (post) => { 
    setSelectedPost(post); setForumView('detail'); setComments([]); fetch(`/api/posts?viewId=${post.id}&t=${Date.now()}`, { cache: 'no-store' });
    const res = await fetch(`/api/comments?postId=${post.id}&t=${Date.now()}`, { cache: 'no-store' }); const data = await res.json(); if(data.success) setComments(data.comments);
  };

  const submitComment = async () => {
    if (!user) return setAuthModal('login');
    if (!commentInput.trim()) return;
    setIsCommenting(true);
    await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: selectedPost.id, content: commentInput }) });
    showToast(t('回复成功！', 'Replied!')); setCommentInput('');
    const res = await fetch(`/api/comments?postId=${selectedPost.id}&t=${Date.now()}`, { cache: 'no-store' }); const data = await res.json(); if(data.success) setComments(data.comments);
    setIsCommenting(false);
  };

  const handleDeletePost = async (id, e) => { if(e) e.stopPropagation(); if(!window.confirm(t('确定永久删除此贴？', 'Delete this post?'))) return; await fetch(`/api/posts?id=${id}`, { method: 'DELETE' }); showToast(t('✅ 已抹除', '✅ Eradicated')); if(forumView === 'detail') setForumView('list'); fetchForumPosts(activeCategory); };
  const handleDeleteComment = async (id) => { if(!window.confirm(t('确定删除评论？', 'Delete comment?'))) return; await fetch(`/api/comments?id=${id}`, { method: 'DELETE' }); showToast(t('✅ 已摘除', '✅ Removed')); const res = await fetch(`/api/comments?postId=${selectedPost.id}&t=${Date.now()}`, { cache: 'no-store' }); const data = await res.json(); if(data.success) setComments(data.comments); };
  const handlePinPost = async (id, is_pinned, e) => { if(e) e.stopPropagation(); await fetch('/api/posts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_pinned }) }); showToast(t('✅ 置顶状态已更新', '✅ Pin updated')); fetchForumPosts(activeCategory); };
  const handlePinComment = async (id, is_pinned) => { await fetch('/api/comments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_pinned }) }); showToast(t('✅ 置顶状态已更新', '✅ Pin updated')); const res = await fetch(`/api/comments?postId=${selectedPost.id}&t=${Date.now()}`, { cache: 'no-store' }); const data = await res.json(); if(data.success) setComments(data.comments); };
  const handleReport = async (targetType, targetId) => {
    if (!user) return setAuthModal('login');
    const reason = window.prompt(t('举报原因：spam / fraud / abuse / copyright / dangerous / other', 'Reason: spam / fraud / abuse / copyright / dangerous / other'), 'other');
    if (!reason) return;
    const details = window.prompt(t('请补充举报说明（可选，最多 1000 字）', 'Optional details, up to 1000 characters'), '') ?? '';
    const response = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType, targetId, reason: reason.trim().toLowerCase(), details }) });
    const data = await response.json();
    showToast(response.ok && data.success ? (data.report?.replayed ? t('ℹ️ 该举报正在处理中', 'Report already pending') : t('✅ 举报已提交，等待管理员审核', 'Report submitted for review')) : `❌ ${data.message || t('举报失败', 'Report failed')}`);
  };

  if (!isMounted) return null; 
  
  const myEAs = user ? products.filter(p => p.author_user_id === user.id) : [];
  const myPostCount = user ? forumPosts.filter(p => p.author_user_id === user.id).length : 0;
  const myBadge = user ? getUserTitle(myPostCount, myEAs.length, user.role) : null;

  return (
    <div className="min-h-screen flex flex-col justify-between bg-zinc-950 text-zinc-300 font-sans selection:bg-cyan-500/30">
      
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setRoute('home')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.3)]"><Activity className="text-zinc-950 w-5 h-5" /></div>
            <span className="font-extrabold text-xl tracking-tight text-white">{siteSettings?.siteName || 'Nexus Quant'}</span>
          </div>
          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium">
            <button onClick={() => setRoute('home')} className={`transition-colors ${route === 'home' ? 'text-cyan-400' : 'text-zinc-400 hover:text-white'}`}>{t('首页概览', 'Dashboard')}</button>
            <button onClick={() => setRoute('market')} className={`transition-colors ${route === 'market' ? 'text-cyan-400' : 'text-zinc-400 hover:text-white'}`}>{t('策略市场', 'EA Market')}</button>
            <button onClick={() => { setRoute('forum'); setForumView('list'); }} className={`transition-colors ${route === 'forum' ? 'text-cyan-400' : 'text-zinc-400 hover:text-white'}`}>{t('开发者社区', 'Community')}</button>
            <button onClick={() => { if(!user) return setAuthModal('login'); setRoute('profile'); }} className={`transition-colors ${route === 'profile' ? 'text-cyan-400' : 'text-zinc-400 hover:text-white'}`}>{t('个人中心', 'Profile')}</button>
            {user?.role === 'admin' && (<button onClick={() => window.location.href = '/admin'} className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20">{t('后台管理', 'Admin Panel')}</button>)}
          </nav>
          <div className="flex gap-4 items-center relative">
            <button onClick={toggleLang} className="flex items-center gap-1.5 text-xs bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors hidden sm:flex">
              <Globe className="w-3.5 h-3.5" /> {lang === 'zh' ? 'EN' : '中文'}
            </button>
            {user ? (
              <div className="relative">
                <button onClick={() => setShowUserMenu(!showUserMenu)} className="text-sm font-bold text-zinc-300 bg-zinc-900 px-4 py-1.5 rounded-lg border border-zinc-800 flex items-center gap-2 hover:bg-zinc-800 transition-colors">
                  {user.avatar_url ? <img src={user.avatar_url} className="w-5 h-5 rounded-full object-cover" /> : <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"></div>}{user.username}
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 mt-3 w-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                    <button onClick={() => { setRoute('profile'); setShowUserMenu(false); }} className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"><UserIcon className="w-4 h-4" /> {t('个人中心', 'Profile')}</button>
                    <div className="h-px bg-zinc-800"></div>
                    <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-zinc-800 flex items-center gap-2"><LogOut className="w-4 h-4" /> {t('退出登录', 'Logout')}</button>
                  </div>
                )}
              </div>
            ) : (<button onClick={() => { setAuthModal('login'); setAuthForm({ username: '', email: '', password: '', code: '' }); }} className="px-5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-cyan-600/20">{t('登录 / 注册', 'Login / Register')}</button>)}
          </div>
        </div>
      </header>

      <main className="relative z-10 w-full flex-grow">
        {route === 'home' && (<HomeView setRoute={setRoute} setForumView={setForumView} siteSettings={siteSettings} products={products} forumPosts={forumPosts} user={user} setAuthModal={setAuthModal} setActiveCategory={setActiveCategory} openPostDetail={openPostDetail} t={t} tEaType={tEaType} />)}
        {route === 'market' && (<MarketView products={products.filter(p => p.status === 'active')} myOrders={myOrders} user={user} handlePurchaseProcess={handlePurchaseProcess} handleStartTrial={handleStartTrial} handleSocialAction={handleSocialAction} handleReport={handleReport} setRoute={setRoute} setAuthModal={setAuthModal} t={t} tEaType={tEaType} />)}

        {/* 上传发布 */}
        {route === 'upload' && (
          <div className="max-w-4xl mx-auto px-4 py-10 animate-in fade-in zoom-in-95 duration-300">
            <button onClick={() => setRoute('market')} className="text-sm font-bold text-cyan-400 hover:text-cyan-300 mb-6 flex items-center gap-2 transition-colors"><ArrowLeft className="w-4 h-4" /> {t('返回市场', 'Back to Market')}</button>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[80px] pointer-events-none"></div>
              
              {!['developer', 'admin'].includes(user?.role) ? (
                <div className="text-center py-20 relative z-10">
                  <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6"><Code2 className="w-10 h-10 text-blue-400" /></div>
                  <h2 className="text-2xl font-bold text-white mb-4">{t('您当前是普通用户，无法发布策略', 'You are a Standard User, cannot publish EAs')}</h2>
                   <p className="text-zinc-500 mb-3">{t('发布 EA 需要管理员完成开发者身份审核。', 'EA publishing requires administrator approval of your developer account.')}</p>
                   <p className="text-xs text-zinc-600">{t('请联系平台管理员提交认证资料。', 'Contact the platform administrator to submit your verification details.')}</p>
                </div>
              ) : (
                <>
                  <h2 className="text-3xl font-black text-white mb-2 flex items-center gap-3 relative z-10"><Upload className="text-cyan-400 w-8 h-8" /> {uploadForm.id ? t('编辑 EA 策略', 'Edit EA Strategy') : t('部署全新 EA 策略', 'Deploy New EA Strategy')}</h2>
                  <div className="space-y-8 relative z-10 mt-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div><label className="block text-sm font-bold text-zinc-300 mb-2">{t('策略核心名称 *', 'Strategy Core Name *')}</label><input type="text" value={uploadForm.title} onChange={e=>setUploadForm({...uploadForm, title: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white focus:border-cyan-500 focus:outline-none transition-colors" /></div>
                        <div>
                          <label className="block text-sm font-bold text-zinc-300 mb-3">{t('EA 交易类型配置 (多选)', 'EA Trading Types')}</label>
                          <div className="grid grid-cols-2 gap-3 bg-zinc-950 border border-zinc-800/80 p-5 rounded-2xl shadow-inner">
                            {eaTypeOptions.map(type => {
                              const isSelected = (uploadForm.eaTypes || []).includes(type);
                              return (
                                <div key={type} onClick={() => toggleEaType(type)} className="flex items-center gap-3 cursor-pointer group p-2 rounded-xl hover:bg-zinc-900/60 transition-colors">
                                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-cyan-500 border-cyan-500' : 'border-zinc-600 bg-zinc-900'}`}>{isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-zinc-950" />}</div>
                                  <span className={`text-sm ${isSelected ? 'text-cyan-400 font-bold' : 'text-zinc-400'}`}>{tEaType(type)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div><label className="block text-xs font-bold text-zinc-500 mb-2">{t('测试交易品种', 'Tested Symbols')}</label><input type="text" value={uploadForm.pairs} onChange={e=>setUploadForm({...uploadForm, pairs: e.target.value})} placeholder="XAUUSD, EURUSD" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white font-mono focus:border-cyan-500 focus:outline-none" /></div>
                      </div>
                      <div className="space-y-6">
                        <div><label className="block text-sm font-bold text-zinc-300 mb-2">{t('策略详细运行逻辑说明', 'Detailed Logic Description')}</label><textarea value={uploadForm.description} onChange={e=>setUploadForm({...uploadForm, description: e.target.value})} rows="5" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white resize-none focus:border-cyan-500 focus:outline-none transition-colors"></textarea></div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="relative h-36 border-2 border-dashed border-zinc-700 hover:border-cyan-500 rounded-2xl bg-zinc-950 flex flex-col items-center justify-center cursor-pointer overflow-hidden group"><input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer z-10" />{logoFile ? (<div className="text-center z-0"><ImageIcon className="w-8 h-8 text-cyan-400 mx-auto mb-2" /><span className="text-xs text-white bg-zinc-900 px-2 py-1 rounded truncate block">{logoFile.name}</span></div>) : (<div className="text-center z-0 text-zinc-500 group-hover:text-cyan-400"><ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" /><span className="text-xs">{t('策略头像/Logo', 'Avatar')}</span></div>)}</div>
                          {!uploadForm.id?<div className="relative h-36 border-2 border-dashed border-zinc-700 hover:border-emerald-500 rounded-2xl bg-zinc-950 flex flex-col items-center justify-center cursor-pointer overflow-hidden group"><input type="file" accept=".ex4,.ex5" onChange={e => setEx4File(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer z-10" />{ex4File ? (<div className="text-center z-0"><FileCode className="w-8 h-8 text-emerald-400 mx-auto mb-2" /><span className="text-xs text-white bg-zinc-900 px-2 py-1 rounded truncate block">{ex4File.name}</span></div>) : (<div className="text-center z-0 text-zinc-500 group-hover:text-emerald-400"><FileCode className="w-8 h-8 mx-auto mb-2 opacity-50" /><span className="text-xs">{t('主程序 (.ex4/.ex5)', 'Program (.ex4/.ex5)')}</span></div>)}</div>:<div className="h-36 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 text-xs leading-relaxed text-violet-300">{t('已发布程序不能在产品编辑中覆盖。请到“我发布的策略”使用“提交新版本”。','Published files are immutable. Use Submit Version from My Published EAs.')}</div>}
                        </div>
                        {!uploadForm.id&&<div className="grid grid-cols-1 gap-3 md:grid-cols-3"><input value={uploadForm.version} onChange={e=>setUploadForm({...uploadForm,version:e.target.value})} placeholder="1.0.0" className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white"/><input value={uploadForm.releaseNotes} onChange={e=>setUploadForm({...uploadForm,releaseNotes:e.target.value})} placeholder={t('初始版本说明','Initial release notes')} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white"/><select value={uploadForm.upgradePolicy} onChange={e=>setUploadForm({...uploadForm,upgradePolicy:e.target.value})} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white"><option value="all_existing">{t('所有已有买家继承','All existing owners')}</option><option value="new_purchases_only">{t('仅发布后新买家','New purchases only')}</option></select></div>}
                        <div className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4"><label className="flex items-center gap-2 text-xs font-bold text-zinc-300"><input type="checkbox" checked={Boolean(uploadForm.trialEnabled)} onChange={e=>setUploadForm({...uploadForm,trialEnabled:e.target.checked})}/>{t('开放限时试用','Enable timed trial')}</label>{uploadForm.trialEnabled&&<input type="number" min="1" max="30" value={uploadForm.trialDays} onChange={e=>setUploadForm({...uploadForm,trialDays:e.target.value})} className="w-24 rounded-lg border border-zinc-700 bg-black px-3 py-2 text-white"/>}<span className="text-[10px] text-zinc-600">{t('天（服务器计时，最多 30 天）','days, server-timed, max 30')}</span></div>
                      </div>
                    </div>
                    <div className="rounded-3xl border border-violet-500/20 bg-violet-500/5 p-6">
                      <h3 className="font-black text-white">{t('MT5 HTML 原始回测报告 *', 'Original MT5 HTML Report *')}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{t('请在 MT5 策略测试器中导出 HTML 报告。系统将从报告自动提取八项指标，并根据成交明细生成净值、回撤和月度收益；无需手工录入曲线。', 'Export an HTML report from MT5 Strategy Tester. Metrics and curves are generated from the report; manual curve entry is no longer required.')}</p>
                      <input type="file" accept=".htm,.html,text/html" disabled={isParsingReport} onChange={e=>handleReportUpload(e.target.files?.[0])} className="mt-4 block w-full text-xs text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500/10 file:px-3 file:py-2 file:font-bold file:text-violet-300" />
                      {isParsingReport && <p className="mt-3 text-xs font-bold text-violet-300">{t('正在解析和验证报告…', 'Parsing and validating report…')}</p>}
                      {reportInfo && <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300">✅ {reportInfo.originalName || t('已绑定原始报告', 'Original report attached')} · SHA-256 {reportInfo.sha256?.slice(0,16)}… · {reportInfo.metrics?.totalTrades || uploadForm.metrics.totalTrades} {t('笔交易', 'trades')}</div>}
                    </div>
                    <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                      <h3 className="font-black text-white">{t('MT5 原始回测证据 *', 'Original MT5 Backtest Evidence *')}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{t('必须上传设置、统计、净值曲线三张原始截图；后台保存原图哈希并生成去元数据预览。图片识别结果仍须管理员核对，截图审核不等于实盘认证。', 'Upload original Settings, Statistics and Chart screenshots. Originals are hashed and previews are sanitized. Extraction still requires administrator review and is not live-account verification.')}</p>
                      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                        {[[ 'settings', t('设置页截图 *', 'Settings screenshot *') ], [ 'statistics', t('统计页截图 *', 'Statistics screenshot *') ], [ 'chart', t('净值曲线截图 *', 'Chart screenshot *') ], [ 'analysis', t('后台分析截图（可选）', 'Analysis screenshot (optional)') ]].map(([key,label]) => (
                          <label key={key} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-xs font-bold text-zinc-400">
                            <span className="mb-2 block">{label}</span>
                            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setEvidenceFiles(prev=>({...prev,[key]:e.target.files?.[0] || null}))} className="block w-full text-xs text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-500/10 file:px-3 file:py-2 file:font-bold file:text-emerald-400" />
                          </label>
                        ))}
                      </div>
                      {uploadForm.evidenceIds?.length > 0 && <p className="mt-3 text-[11px] text-emerald-400">{t(`已保留 ${uploadForm.evidenceIds.length} 份现有证据；选择新图片会替换相同类型。`, `${uploadForm.evidenceIds.length} existing evidence files retained; selecting a new file replaces that type.`)}</p>}
                    </div>
                    <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-6">
                      <div className="mb-5">
                        <h3 className="font-black text-white">{t('报告自动提取结果', 'Automatically Extracted Results')}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{t('这些字段由 MT5 HTML 报告生成并锁定。若结果不正确，请重新导出报告，不要手工修改。管理员仍会对照截图复核。', 'These locked fields come from the MT5 HTML report. Re-export the report if they are incorrect. An administrator still cross-checks the screenshots.')}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        {[
                          ['initialDeposit', t('初始资金 USD', 'Initial Deposit USD')],
                          ['netProfit', t('净利润 USD', 'Net Profit USD')],
                          ['profitFactor', 'Profit Factor'],
                          ['sharpeRatio', 'Sharpe Ratio'],
                          ['maxDrawdownPercent', t('最大回撤 %', 'Max Drawdown %')],
                          ['recoveryFactor', 'Recovery Factor'],
                          ['winRatePercent', t('胜率 %', 'Win Rate %')],
                          ['totalTrades', t('交易次数', 'Total Trades')],
                        ].map(([key, label]) => (
                          <div key={key}>
                            <label className="mb-2 block text-[11px] font-bold text-zinc-500">{label}</label>
                            <input type="number" readOnly value={uploadForm.metrics[key]} placeholder={t('等待报告', 'Awaiting report')} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 font-mono text-zinc-300 outline-none read-only:cursor-not-allowed" />
                          </div>
                        ))}
                      </div>
                      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"><div className="text-xs font-bold text-zinc-400">{t('净值曲线', 'Equity Curve')}</div><div className="mt-2 text-2xl font-black text-emerald-400">{parseMetricRows(uploadForm.metrics.equityCurveText, 'value').length}</div><div className="text-[10px] text-zinc-600">{t('自动生成数据点', 'generated points')}</div></div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"><div className="text-xs font-bold text-zinc-400">{t('回撤曲线', 'Drawdown Curve')}</div><div className="mt-2 text-2xl font-black text-red-400">{parseMetricRows(uploadForm.metrics.drawdownCurveText, 'percent').length}</div><div className="text-[10px] text-zinc-600">{t('自动生成数据点', 'generated points')}</div></div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"><div className="text-xs font-bold text-zinc-400">{t('月度收益', 'Monthly Returns')}</div><div className="mt-2 text-2xl font-black text-cyan-400">{parseMetricRows(uploadForm.metrics.monthlyReturnsText, 'percent').length}</div><div className="text-[10px] text-zinc-600">{t('自动生成月份', 'generated months')}</div></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 pt-8 border-t border-zinc-800/80">
                      <div className="w-1/3"><label className="block text-xs font-bold text-zinc-500 mb-2">{t('发售价格 (USD)', 'Price (USD)')}</label><input type="number" value={uploadForm.price} onChange={e=>setUploadForm({...uploadForm, price: e.target.value})} placeholder={t('留空免费', 'Blank for Free')} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-emerald-400 font-bold text-lg focus:border-cyan-500 focus:outline-none shadow-inner" /></div>
                      <button onClick={submitEA} disabled={isSubmitting} className="flex-1 h-[76px] mt-6 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-xl text-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                        {isSubmitting ? t('处理中...', 'Processing...') : <><Upload className="w-6 h-6" /> {uploadForm.id ? t('保存修改并重新审核', 'Save & Submit Review') : t('部署上链并提交审核', 'Deploy & Submit')}</>}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 论坛 */}
        {route === 'forum' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-100px)] flex gap-8 animate-in fade-in duration-300">
            <div className="w-64 shrink-0 hidden md:flex flex-col gap-2 border-r border-zinc-800/80 pr-6">
              <div className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 pl-3">{t('版块导航', 'Categories')}</div>
              {categories.map(cat => (
                <button key={cat} onClick={() => { setActiveCategory(cat); setForumView('list'); fetchForumPosts(cat,forumSort); }} className={`text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${activeCategory === cat && forumView === 'list' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300'}`}>
                  <Hash className={`w-4 h-4 ${activeCategory === cat && forumView === 'list' ? 'text-cyan-400' : 'text-zinc-600'}`} /> {tCat(cat)}
                </button>
              ))}
              <div className="mt-auto">
                <button onClick={() => { if (!user) return setAuthModal('login'); setForumView('create'); setNewPost({...newPost, category: dynamicCats[0] || '全部'}) }} className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-bold shadow-[0_0_20px_rgba(8,145,178,0.3)] transition-all">+ {t('发起新讨论', 'New Topic')}</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-20">
              {forumView === 'list' && (
                <div className="space-y-4">
                  <div className="mb-6"><div className="flex flex-wrap justify-between items-center gap-3"><h2 className="text-2xl font-bold text-white flex items-center gap-2">{tCat(activeCategory)}</h2><div className="flex gap-2">{[['latest',t('最新','Latest')],['hot',t('热门','Hot')],['discussed',t('讨论最多','Most discussed')]].map(([value,label])=><button key={value} onClick={()=>{setForumSort(value);fetchForumPosts(activeCategory,value);}} className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${forumSort===value?'border-cyan-500/40 bg-cyan-500/10 text-cyan-300':'border-zinc-800 text-zinc-500'}`}>{label}</button>)}</div></div>{forumSort==='hot'&&<p className="mt-2 text-right text-[10px] text-zinc-600">{t('热度按去重浏览、有效评论、置顶权重和发布时间衰减计算。','Hot score uses deduplicated views, visible comments, pin weight, and time decay.')}</p>}</div>
                  {forumPosts.map(post => (
                    <div key={post.id} onClick={() => openPostDetail(post)} className={`relative border p-6 rounded-3xl transition-all cursor-pointer group shadow-lg ${post.is_pinned ? 'bg-cyan-900/10 border-cyan-500/30' : 'bg-zinc-900/40 border-zinc-800 hover:border-cyan-500/30'}`}>
                      {user?.role === 'admin' && (
                        <div className="absolute top-6 right-6 flex items-center gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => handlePinPost(post.id, !post.is_pinned, e)} className="p-2 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white rounded-lg transition-colors text-xs font-bold">{post.is_pinned ? t('取消置顶', 'Unpin') : t('📌 置顶', '📌 Pin')}</button>
                          <button onClick={(e) => handleDeletePost(post.id, e)} className="p-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                      <div className="flex gap-2 mb-3 items-center">
                        {post.is_pinned && <span className="px-2.5 py-1 rounded-md text-[10px] font-black border border-cyan-500/50 bg-cyan-500 text-zinc-950">{t('📌 置顶', '📌 Pinned')}</span>}
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold border border-zinc-700 bg-zinc-800 text-zinc-300">{tCat(post.category)}</span>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors pr-32">{post.title}</h3>
                      <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed mb-5 pr-32">{post.content}</p>
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1.5">{post.avatar_url ? <img src={post.avatar_url} className="w-4 h-4 rounded-full object-cover border border-zinc-700" /> : <UserIcon className="w-3.5 h-3.5" />} {post.author}</span>
                          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {new Date(post.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-4"><span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> {post.comment_count || 0}</span><span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> {post.views}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {forumView === 'detail' && selectedPost && (
                <div className="animate-in fade-in slide-in-from-right-4">
                  <div className="flex justify-between items-center mb-6">
                    <button onClick={() => setForumView('list')} className="text-sm font-bold text-zinc-500 hover:text-white flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> {t('返回列表', 'Back to List')}</button>
                    {user?.role === 'admin' && (
                      <div className="flex gap-2">
                        <button onClick={(e) => handlePinPost(selectedPost.id, !selectedPost.is_pinned, e)} className="text-sm font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 rounded-lg">{selectedPost.is_pinned ? t('取消置顶', 'Unpin') : t('📌 强制置顶', '📌 Force Pin')}</button>
                        <button onClick={(e) => handleDeletePost(selectedPost.id, e)} className="text-sm font-bold text-red-400 hover:text-red-300 flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 rounded-lg"><Trash2 className="w-4 h-4" /> {t('彻底删帖', 'Delete Post')}</button>
                      </div>
                    )}
                  </div>

                  <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 mb-6 shadow-xl">
                    <div className="flex gap-2 mb-4 items-center">
                      {selectedPost.is_pinned && <span className="px-2.5 py-1 rounded text-[10px] font-black bg-cyan-500 text-zinc-950">{t('📌 置顶', '📌 Pinned')}</span>}
                      <span className="px-2.5 py-1 rounded text-xs font-bold border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">{tCat(selectedPost.category)}</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-6 leading-snug">{selectedPost.title}</h1>
                    <div className="flex items-center gap-4 pb-6 border-b border-zinc-800 mb-6">
                      <div className="w-12 h-12 shrink-0 rounded-full bg-zinc-800 flex items-center justify-center text-xl font-black text-cyan-400 overflow-hidden border border-zinc-700 shadow-inner">
                        {selectedPost.avatar_url ? <img src={selectedPost.avatar_url} className="w-full h-full object-cover" /> : selectedPost.author.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-white text-base flex items-center flex-wrap gap-2">
                          {selectedPost.author} 
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">OP</span>
                          {(() => {
                            const opPCount = forumPosts.filter(p => p.author === selectedPost.author).length;
                            const opECount = products.filter(p => p.author === selectedPost.author).length;
                            const opRole = selectedPost.author_role || 'user'; 
                            const opBadge = getUserTitle(opPCount, opECount, opRole);
                            return <span className={`px-1.5 py-0.5 rounded text-[10px] border ${opBadge.color}`}>{opBadge.title}</span>;
                          })()}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">{new Date(selectedPost.created_at).toLocaleString()} · {selectedPost.views} Views</div>
                      </div>
                    </div>
                    <div className="prose prose-invert max-w-none text-zinc-300 leading-loose whitespace-pre-wrap text-sm md:text-base">{selectedPost.content}</div>
                    {user && user.id !== selectedPost.author_user_id && <button onClick={()=>handleReport('post',selectedPost.id)} className="mt-6 text-xs font-bold text-amber-400 hover:text-amber-300">⚑ {t('举报此帖','Report post')}</button>}
                  </div>
                  <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 shadow-xl">
                    <h3 className="font-bold text-white mb-8 flex items-center gap-2 text-lg"><MessageSquare className="w-5 h-5 text-cyan-400" /> {t('参与讨论', 'Discussions')} ({comments.length})</h3>
                    <div className="space-y-6 mb-10">
                      {comments.length === 0 ? <div className="text-zinc-500 text-sm text-center py-8 border border-dashed border-zinc-800 rounded-2xl">{t('暂无回复，抢个沙发吧！', 'No replies yet, be the first!')}</div> : 
                        comments.map(c => {
                          const cPCount = forumPosts.filter(p => p.author === c.author).length;
                          const cECount = products.filter(p => p.author === c.author).length;
                          const cRole = c.author_role || 'user'; 
                          const cBadge = getUserTitle(cPCount, cECount, cRole);
                          
                          return (
                          <div key={c.id} className={`flex gap-4 pb-6 border-b border-zinc-800/50 last:border-0 last:pb-0 relative group ${c.is_pinned ? 'bg-cyan-900/10 p-4 rounded-xl border border-cyan-500/20' : ''}`}>
                            <div className="w-10 h-10 shrink-0 rounded-full bg-zinc-800 flex items-center justify-center text-cyan-400 font-bold text-sm shadow-inner overflow-hidden border border-zinc-700">
                              {c.avatar_url ? <img src={c.avatar_url} className="w-full h-full object-cover" /> : c.author.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 w-full overflow-hidden">
                              <div className="flex items-center flex-wrap gap-2 mb-1.5 pr-20">
                                {c.is_pinned && <span className="text-[10px] font-black text-cyan-400">{t('📌 置顶', '📌 Pinned')}</span>}
                                <span className="font-bold text-white text-sm">{c.author}</span>
                                {c.author === selectedPost.author && <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">OP</span>}
                                <span className={`px-1.5 py-0.5 rounded text-[10px] border ${cBadge.color}`}>{cBadge.title}</span>
                                <span className="text-xs text-zinc-600 ml-auto hidden sm:block">{new Date(c.created_at).toLocaleString()}</span>
                              </div>
                              <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">{c.content}</div>
                              {user && user.id !== c.author_user_id && <button onClick={()=>handleReport('comment',c.id)} className="mt-2 text-[11px] font-bold text-amber-500 hover:text-amber-300">⚑ {t('举报评论','Report comment')}</button>}
                            </div>
                            
                            {user?.role === 'admin' && (
                              <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handlePinComment(c.id, !c.is_pinned)} className="p-1.5 bg-zinc-800 hover:bg-amber-500/20 text-zinc-500 hover:text-amber-400 rounded text-[10px] font-bold transition-colors">{c.is_pinned ? t('取消置顶', 'Unpin') : t('📌 置顶', '📌 Pin')}</button>
                                <button onClick={() => handleDeleteComment(c.id)} className="p-1.5 bg-zinc-800 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            )}
                          </div>
                        )})}
                    </div>
                    <div className="relative">
                      <textarea value={commentInput} onChange={e => setCommentInput(e.target.value)} placeholder={user ? t("写下你的独到见解...", "Write your insights...") : t("请先登录系统后再发表您的回复", "Please login to reply")} disabled={!user} rows="4" className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-white focus:border-cyan-500 focus:outline-none resize-none mb-4 disabled:opacity-50 disabled:cursor-not-allowed shadow-inner transition-colors"></textarea>
                      <div className="flex justify-end"><button onClick={submitComment} disabled={!user || isCommenting} className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold rounded-xl text-sm transition-all shadow-[0_0_15px_rgba(8,145,178,0.3)]">{isCommenting ? t('同步中...', 'Syncing...') : t('发表回复', 'Reply')}</button></div>
                    </div>
                  </div>
                </div>
              )}
              {forumView === 'create' && (
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 shadow-2xl animate-in fade-in">
                  <h2 className="text-2xl font-bold text-white mb-8">{t('发表新主题', 'Post New Topic')}</h2>
                  <div className="space-y-6">
                    <div><label className="block text-sm font-bold text-zinc-400 mb-2">{t('选择版块', 'Category')}</label><select value={newPost.category} onChange={e => setNewPost({...newPost, category: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none appearance-none">{categories.filter(c => c !== '全部').map(c => <option key={c} value={c}>{tCat(c)}</option>)}</select></div>
                    <div><label className="block text-sm font-bold text-zinc-400 mb-2">{t('帖子标题', 'Title')}</label><input type="text" value={newPost.title} onChange={e => setNewPost({...newPost, title: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-cyan-500 focus:outline-none" /></div>
                    <div><label className="block text-sm font-bold text-zinc-400 mb-2">{t('正文内容', 'Content')}</label><textarea value={newPost.content} onChange={e => setNewPost({...newPost, content: e.target.value})} rows="12" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-cyan-500 focus:outline-none resize-none"></textarea></div>
                    <div className="flex justify-end gap-4"><button onClick={() => setForumView('list')} className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl text-sm transition-colors">{t('取消', 'Cancel')}</button><button onClick={submitPost} className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-sm shadow-[0_0_15px_rgba(8,145,178,0.4)]">{t('发布主题', 'Publish Topic')}</button></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 个人中心 */}
        {route === 'profile' && user && (
          <div className="max-w-5xl mx-auto px-4 py-10 space-y-8 animate-in fade-in duration-300">
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 flex flex-col md:flex-row items-center md:items-start gap-8 shadow-xl relative">
              <div className="w-28 h-28 shrink-0 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 p-1 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                {user.avatar_url ? (
                  <img src={user.avatar_url} className="w-full h-full rounded-full object-cover border border-zinc-800" />
                ) : (
                  <div className="w-full h-full bg-zinc-950 rounded-full flex items-center justify-center text-5xl font-black text-cyan-400">{user.username.charAt(0).toUpperCase()}</div>
                )}
              </div>
              <div className="flex-1 text-center md:text-left mt-2 w-full">
                <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-4">
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-3">{user.username}</h2>
                    <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-4">
                      {myBadge && <span className={`px-4 py-1.5 rounded-xl text-xs font-bold border ${myBadge.color}`}>{myBadge.title}</span>}
                      <span className="px-4 py-1.5 rounded-xl text-xs font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5"/> {t('账户安全: 已实名认证', 'Security: Verified')}</span>
                    </div>
                  </div>
                  <button onClick={() => { setProfileForm({ newUsername: user.username, password: '' }); setProfileModal(true); }} className="px-6 py-2.5 bg-zinc-800 hover:bg-cyan-600 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg border border-zinc-700 hover:border-cyan-500/50">
                    <Settings className="w-4 h-4" /> {t('编辑资料', 'Edit Profile')}
                  </button>
                </div>
              </div>
            </div>

            {/* 创作者财务收入看板 (引入多语言翻译) */}
            {(user.role === 'developer' || user.role === 'admin') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-gradient-to-br from-emerald-900/20 to-zinc-900/40 border border-emerald-500/20 rounded-3xl p-8 flex items-center justify-between shadow-xl">
                  <div>
                    <div className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-2"><Wallet className="w-4 h-4"/> {t('开发者创收余额 (可提现)', 'Developer Balance (Withdrawable)')}</div>
                    <div className="text-4xl font-black text-white">${user.balance || 0}</div>
                  </div>
                  <button 
                    onClick={() => {
                      if((user.balance || 0) < 100) return showToast(t('❌ 提现门槛为 100 USD', '❌ Minimum withdrawal is 100 USD'));
                      setWithdrawModal(true);
                    }}
                    className={`px-6 py-3 rounded-xl font-bold text-sm shadow-lg transition-all ${user.balance >= 100 ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}>
                    {t('申请提现', 'Withdraw')}
                  </button>
                </div>
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 flex flex-col justify-center shadow-xl">
                  <div className="text-sm font-bold text-zinc-400 mb-2">{t('提现规则说明', 'Withdrawal Rules')}</div>
                  <ul className="text-xs text-zinc-500 space-y-1.5 list-disc pl-4">
                    <li>{t('全站 EA 销售收入将 100% 实时结算至您的余额', '100% of EA sales revenue is settled to your balance instantly')}</li>
                    <li>{t('为了降低网络矿工费，最低提现门槛为', 'To reduce network fees, the minimum withdrawal threshold is')} <strong className="text-emerald-400">100 USD</strong></li>
                    <li>{t('提现申请提交后，财务将在 24 小时内打款至您的加密货币地址', 'Finance will transfer funds to your crypto address within 24 hours of request')}</li>
                  </ul>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3"><div className="rounded-3xl border border-rose-500/20 bg-zinc-900/40 p-6"><h2 className="font-bold text-white">{t('我的收藏','My Favorites')} · {mySocial.favorites.length}</h2><div className="mt-4 space-y-2">{mySocial.favorites.length===0?<p className="text-xs text-zinc-600">{t('尚未收藏策略','No favorite strategies')}</p>:mySocial.favorites.map(item=><div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><div className="text-sm font-bold text-white">{item.title}</div><div className="text-[10px] text-zinc-500">by {item.author}</div></div>)}</div></div><div className="rounded-3xl border border-cyan-500/20 bg-zinc-900/40 p-6"><h2 className="font-bold text-white">{t('关注的开发者','Following Developers')} · {mySocial.follows.length}</h2><div className="mt-4 space-y-2">{mySocial.follows.length===0?<p className="text-xs text-zinc-600">{t('尚未关注开发者','No followed developers')}</p>:mySocial.follows.map(item=><div key={item.developerUserId} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><div className="text-sm font-bold text-white">{item.username}</div><div className="text-[10px] text-zinc-500">{item.activeProducts} {t('个在售策略','active strategies')}</div></div>)}</div></div><div className="rounded-3xl border border-amber-500/20 bg-zinc-900/40 p-6"><h2 className="font-bold text-white">{t('我的评分','My Ratings')} · {mySocial.ratings.length}</h2><div className="mt-4 space-y-2">{mySocial.ratings.length===0?<p className="text-xs text-zinc-600">{t('尚未评分','No ratings')}</p>:mySocial.ratings.map(item=><div key={item.productId} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><div className="text-sm font-bold text-white">{item.title}</div><div className="text-xs text-amber-300">{'★'.repeat(item.rating)}</div></div>)}</div></div></div>

            <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/10 border border-cyan-500/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-cyan-500/20 blur-[100px] pointer-events-none"></div>
              <div className="flex justify-between items-center mb-6 relative z-10">
                <h2 className="text-xl font-bold text-white flex items-center gap-2"><FolderDown className="text-cyan-400 w-6 h-6" /> {t('我的数字资产库 (已购)', 'My Digital Assets')}</h2>
              </div>
              {myOrders.length === 0 ? (
                <div className="text-center py-12 bg-zinc-950/50 rounded-2xl border border-cyan-500/10 border-dashed relative z-10"><p className="text-zinc-400 font-bold text-sm mb-2">{t('您的资产库空空如也', 'Your asset library is empty')}</p><button onClick={() => setRoute('market')} className="mt-2 text-cyan-400 text-xs font-bold hover:underline">{t('去策略市场逛逛', 'Explore EA Market')} &rarr;</button></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                  {myOrders.map(order => (
                    <div key={order.order_id || order.id} className="bg-zinc-950/80 backdrop-blur-md border border-cyan-500/20 rounded-2xl p-5 flex justify-between items-center hover:border-cyan-400 transition-colors shadow-lg shadow-cyan-900/20">
                      <div className="flex items-center gap-4">
                        {order.logo_url ? <img src={order.logo_url} className="w-12 h-12 rounded-xl object-cover border border-zinc-800" /> : <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800"><Box className="w-5 h-5 text-cyan-500/50" /></div>}
                        <div><div className="font-bold text-white text-sm w-36 truncate">{order.title}</div><div className="text-[10px] text-zinc-500 mt-1">{t('购于:', 'Date:')} {new Date(order.purchase_date).toLocaleDateString()}</div>{order.currentVersion&&<div className="mt-1 text-[10px] text-violet-400">v{order.currentVersion.version}</div>}</div>
                      </div>
                      
                      {order.latestEligibleVersion ? (
                        <div className="flex max-w-44 flex-wrap justify-end gap-1">{order.eligibleVersions.map(version=><button key={version.id} onClick={() => handleSecureDownload(order.product_id, order.title, version.id)} className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-[10px] font-bold transition-all shadow-lg flex items-center gap-1">v{version.version}<Download className="w-3 h-3"/></button>)}</div>
                      ) : (<button disabled className="px-4 py-2 bg-zinc-800 text-zinc-500 rounded-lg text-xs font-bold cursor-not-allowed">{order.currentVersion?t('该版本不在您的升级权益内','Upgrade not included'):t('暂无已发布版本','No published version')}</button>)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-violet-500/20 bg-zinc-900/40 p-8"><h2 className="text-xl font-bold text-white">{t('EA 运行授权','EA Runtime Licenses')}</h2><p className="mt-2 text-xs text-amber-300/70">{t('网站授权只有在 EA 内接入 Nexus 令牌验证后才能限制实际运行；当前下载控制本身不能阻止复制已下载文件。','Runtime enforcement requires Nexus token verification inside the EA. Download controls alone cannot prevent copying an already downloaded file.')}</p><div className="mt-5 space-y-3">{myLicenses.length===0?<div className="text-sm text-zinc-600">{t('暂无授权记录','No licenses')}</div>:myLicenses.map(license=><div key={license.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><span className="font-bold text-white">{license.productTitle}</span><span className="ml-2 text-xs text-violet-400">{license.type} · {license.status}{license.version?` · v${license.version}`:''}</span></div>{license.expiresAt&&<span className="text-[10px] text-zinc-500">{t('到期','Expires')} {new Date(license.expiresAt).toLocaleString()}</span>}</div><div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>handleLicenseBind(license,'trading_account')} className="rounded bg-zinc-800 px-3 py-2 text-[10px] text-cyan-300">{t('绑定交易账号','Bind account')}</button><button onClick={()=>handleLicenseBind(license,'device')} className="rounded bg-zinc-800 px-3 py-2 text-[10px] text-cyan-300">{t('绑定设备','Bind device')}</button><button onClick={()=>handleLicenseToken(license)} disabled={license.status!=='active'} className="rounded bg-violet-700 px-3 py-2 text-[10px] text-white disabled:opacity-40">{t('获取 15 分钟令牌','Get 15-min token')}</button>{license.type==='trial'&&license.status==='active'&&<button onClick={()=>handleSecureDownload(license.productId,license.productTitle,license.versionId)} className="rounded bg-cyan-700 px-3 py-2 text-[10px] text-white">{t('下载试用版本','Download trial')}</button>}</div><div className="mt-2 text-[10px] text-zinc-600">{license.bindings.map(binding=>`${binding.type}: ${binding.mask}`).join(' · ')||t('尚未绑定账号和设备','No account/device bound')}</div></div>)}</div></div>

            <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 shadow-xl">
              <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-white flex items-center gap-2"><Upload className="text-emerald-400 w-5 h-5" /> {t('我发布的策略 (作品)', 'My Published EAs')}</h2><button onClick={() => setRoute('upload')} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white rounded-xl text-xs font-bold transition-colors">{t('发布新策略', 'Publish New')}</button></div>
              {myEAs.length === 0 ? <div className="text-center py-10 bg-zinc-950 rounded-2xl border border-zinc-800 border-dashed"><p className="text-zinc-500 text-sm">{t('您还没有成为量化创作者', 'You are not a creator yet')}</p></div> : 
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {myEAs.map(p => (
                    <div key={p.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 flex justify-between items-center hover:border-zinc-700 transition-colors">
                      <div className="flex items-center gap-4">
                        {p.logo_url ? <img src={p.logo_url} className="w-12 h-12 rounded-xl object-cover border border-zinc-800" /> : <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800"><Box className="w-5 h-5 text-zinc-600" /></div>}
                        <div><div className="font-bold text-white text-sm w-32 truncate">{p.title}</div><div className="text-xs font-mono text-cyan-400 mt-1">{p.price === 0 ? 'Free' : `$${p.price}`}</div></div>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.status === 'pending' ? <span className="text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md text-[10px] font-bold border border-amber-500/20">{t('审核中', 'Pending')}</span> : <span className="text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md text-[10px] font-bold border border-emerald-500/20">{t('已上架', 'Active')}</span>}
                        <button onClick={() => handleEditEA(p)} className="p-1.5 text-zinc-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-md transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                        {p.status==='active'&&<button onClick={()=>{setVersionModal(p);setVersionForm({version:'',releaseNotes:'',upgradePolicy:'all_existing'});setVersionFile(null);}} className="rounded-md bg-violet-500/10 px-2 py-1 text-[10px] font-bold text-violet-300">{t('提交新版本','New Version')}</button>}
                        <button onClick={() => handleDeleteMyEA(p.id, p.title)} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              }
            </div>
          </div>
        )}
      </main>

      <Footer siteSettings={siteSettings} setRoute={setRoute} setForumView={setForumView} t={t} />

      {versionModal&&<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"><div className="w-full max-w-xl rounded-3xl border border-violet-500/30 bg-zinc-950 p-7 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-xl font-black text-white">{t('提交新版本','Submit New Version')} · {versionModal.title}</h3><button onClick={()=>setVersionModal(null)} className="text-zinc-500 hover:text-white"><X/></button></div><div className="mt-6 space-y-4"><input value={versionForm.version} onChange={e=>setVersionForm({...versionForm,version:e.target.value})} placeholder="1.1.0" className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"/><textarea value={versionForm.releaseNotes} onChange={e=>setVersionForm({...versionForm,releaseNotes:e.target.value})} rows="5" placeholder={t('本版本更新日志','Release notes')} className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"/><select value={versionForm.upgradePolicy} onChange={e=>setVersionForm({...versionForm,upgradePolicy:e.target.value})} className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"><option value="all_existing">{t('所有已有买家免费继承','All existing owners inherit')}</option><option value="new_purchases_only">{t('仅版本发布后的新买家','Only purchases after release')}</option></select><input type="file" accept=".ex4,.ex5" onChange={e=>setVersionFile(e.target.files?.[0]||null)} className="block w-full text-xs text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500/10 file:px-3 file:py-2 file:font-bold file:text-violet-300"/><button onClick={submitVersion} disabled={isVersionSubmitting} className="w-full rounded-xl bg-violet-600 py-3 font-black text-white disabled:opacity-50">{isVersionSubmitting?t('提交中…','Submitting…'):t('提交管理员审核','Submit for Review')}</button></div></div></div>}

      {/* 修改个人资料弹窗 */}
      {profileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in zoom-in-95">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-sm w-full p-8 relative shadow-2xl">
            <button onClick={() => { setProfileModal(false); setAvatarFile(null); }} className="absolute top-5 right-5 text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2"><Settings className="w-5 h-5 text-cyan-400"/> {t('编辑个人资料', 'Edit Profile')}</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-2">{t('个人头像 (可选)', 'Avatar (Optional)')}</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 shrink-0 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center overflow-hidden">
                    {avatarFile ? <img src={URL.createObjectURL(avatarFile)} className="w-full h-full object-cover" /> : (user?.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : <UserIcon className="w-6 h-6 text-zinc-600" />)}
                  </div>
                  <label className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors w-full text-center">
                    {t('上传新头像', 'Upload New')}
                    <input type="file" accept="image/*" className="hidden" onChange={e => setAvatarFile(e.target.files[0])} />
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-2">{t('专属用户名', 'Username')}</label>
                <input type="text" value={profileForm.newUsername} onChange={e => setProfileForm({...profileForm, newUsername: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-2">{t('修改安全密码 (留空则不修改)', 'New Password (leave blank to keep)')}</label>
                <input type="password" value={profileForm.password} onChange={e => setProfileForm({...profileForm, password: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none" placeholder="******" />
              </div>
              <button onClick={submitProfileUpdate} disabled={isProfileUpdating} className="w-full py-4 mt-2 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-xl text-sm shadow-[0_0_20px_rgba(8,145,178,0.3)] transition-all">
                {isProfileUpdating ? t('正在保存...', 'Saving...') : t('保存所有修改', 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 提现弹窗 */}
      {withdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in zoom-in-95">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-sm w-full p-8 relative shadow-2xl">
            <button onClick={() => setWithdrawModal(false)} className="absolute top-5 right-5 text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-black text-white mb-2 flex items-center gap-2"><Wallet className="w-5 h-5 text-emerald-400"/> {t('余额提现申请', 'Withdrawal Request')}</h3>
            <p className="text-xs text-zinc-500 mb-6">{t('您当前可全额提取的余额为', 'Your currently withdrawable balance is')} <strong className="text-emerald-400">${user?.balance}</strong> USD</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-2">{t('您的 USDT (TRC20) 钱包地址', 'Your USDT (TRC20) Wallet Address')}</label>
                <input type="text" value={withdrawAddress} onChange={e => setWithdrawAddress(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none font-mono" placeholder="T..." />
              </div>
              <button onClick={submitWithdrawal} className="w-full py-3.5 mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-sm shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all">
                {t('提交申请', 'Submit Request')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 登录注册 */}
      {/* 登录、注册与找回密码弹窗 */}
      {authModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in zoom-in-95">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-sm w-full p-8 relative shadow-2xl">
            <button onClick={() => { setAuthModal(null); setSentCode(null); }} className="absolute top-5 right-5 text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center border border-cyan-500/20 mb-6 mx-auto"><Shield className="w-6 h-6 text-cyan-400" /></div>
            
            <h3 className="text-2xl font-black text-white mb-6 text-center">
              {authModal === 'login' && t('登入 Nexus Quant', 'Login to Nexus Quant')}
              {authModal === 'register' && t('创建极客账户', 'Create Account')}
              {authModal === 'forgot' && t('找回登录密码', 'Reset Password')}
            </h3>

            {/* 登录与注册面板 */}
            {authModal !== 'forgot' ? (
              <div className="space-y-4">
                {authModal === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 mb-1.5">{t('专属用户名', 'Username')}</label>
                    <input type="text" value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">{authModal === 'login' ? t('账号（用户名或邮箱）', 'Username or Email') : t('真实邮箱 (必填)', 'Valid Email')}</label>
                  {authModal === 'register' ? (
                    <div className="flex gap-2">
                      <input type="email" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none" />
                      <button onClick={handleSendAuthCode} disabled={isSendingCode} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold shrink-0">{isSendingCode ? t('发送中', 'Sending') : t('获取验证码', 'Get Code')}</button>
                    </div>
                  ) : (
                    <input type="text" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none" placeholder="输入用户名或登录邮箱" />
                  )}
                </div>
                {authModal === 'register' && sentCode && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-xs font-bold text-cyan-400 mb-1.5">{t('邮箱验证码', 'Code')}</label>
                    <input type="text" value={authForm.code} onChange={e => setAuthForm({...authForm, code: e.target.value})} className="w-full bg-zinc-950 border border-cyan-500/50 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-400 focus:outline-none shadow-[0_0_10px_rgba(34,211,238,0.1)]" />
                  </div>
                )}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-zinc-400">{t('安全密码', 'Password')}</label>
                    {authModal === 'login' && (
                      <span onClick={() => { setAuthModal('forgot'); setResetForm({ email: authForm.email || '', code: '', newPassword: '' }); }} className="text-xs text-cyan-400 hover:underline cursor-pointer">
                        {t('忘记密码？', 'Forgot password?')}
                      </span>
                    )}
                  </div>
                  <input type="password" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none" />
                </div>
                <button onClick={authModal === 'login' ? submitLogin : submitRegister} disabled={isAuthSubmitting} className="w-full py-4 mt-2 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-xl text-sm shadow-[0_0_20px_rgba(8,145,178,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {isAuthSubmitting ? t('正在验证...', 'Verifying...') : (authModal === 'login' ? t('立即登录', 'Login Now') : t('创建新账户', 'Sign Up'))}
                </button>
              </div>
            ) : (
              /* 专属找回密码面板 */
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">{t('绑定邮箱', 'Email Address')}</label>
                  <div className="flex gap-2">
                    <input type="email" value={resetForm.email} onChange={e => setResetForm({...resetForm, email: e.target.value})} placeholder="输入您注册时使用的邮箱" className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none" />
                    <button onClick={handleSendResetCode} disabled={isSendingResetCode} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold shrink-0">
                      {isSendingResetCode ? t('发送中', 'Sending') : t('获取验证码', 'Get Code')}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-cyan-400 mb-1.5">{t('6位邮件验证码', 'Verification Code')}</label>
                  <input type="text" value={resetForm.code} onChange={e => setResetForm({...resetForm, code: e.target.value})} placeholder="查收邮件输入 6 位数字" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">{t('设定全新密码', 'New Password')}</label>
                  <input type="password" value={resetForm.newPassword} onChange={e => setResetForm({...resetForm, newPassword: e.target.value})} placeholder="输入新的安全登录密码" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none" />
                </div>
                <button onClick={submitResetPassword} disabled={isResetSubmitting} className="w-full py-4 mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-sm shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {isResetSubmitting ? t('正在重置...', 'Resetting...') : t('确认重置密码', 'Confirm Reset')}
                </button>
              </div>
            )}

            <div className="mt-6 text-center text-sm text-zinc-500">
              {authModal === 'login' && (
                <>{t('没有账户？ ', 'No account? ')}<span onClick={() => { setAuthModal('register'); setSentCode(null); }} className="text-cyan-400 font-bold cursor-pointer hover:text-cyan-300">{t('免费注册', 'Register')}</span></>
              )}
              {authModal === 'register' && (
                <>{t('已有账户？ ', 'Have an account? ')}<span onClick={() => { setAuthModal('login'); setSentCode(null); }} className="text-cyan-400 font-bold cursor-pointer hover:text-cyan-300">{t('直接登录', 'Login')}</span></>
              )}
              {authModal === 'forgot' && (
                <span onClick={() => setAuthModal('login')} className="text-cyan-400 font-bold cursor-pointer hover:text-cyan-300">&larr; {t('想起密码？返回登录', 'Back to Login')}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] bg-zinc-800 border border-zinc-700 text-white px-6 py-3.5 rounded-full flex items-center gap-3 text-sm font-bold shadow-2xl animate-bounce">
          <CheckCircle className="w-5 h-5 text-cyan-400"/><span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
