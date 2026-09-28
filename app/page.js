"use client";
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { 
  Activity, Shield, CheckCircle, Upload, Globe, X, Code2, Edit,
  Image as ImageIcon, FileCode, LogOut, User as UserIcon, MessageSquare, Eye, 
  Clock, ArrowLeft, Hash, FolderDown, Download, Box, CheckCircle2, Trash2, Settings, Wallet
} from 'lucide-react';

import HomeView, { FadeInView } from './components/HomeView';
import Footer from './components/Footer';
import MarketView from './components/MarketView';
import AppHeader from './components/AppHeader';
import UploadView from './components/UploadView';
import ForumView from './components/ForumView';
import ProfileView from './components/ProfileView';
import AppOverlays from './components/AppOverlays';
import { useAppRoute, useLanguage, useToast } from './hooks/useAppShell';

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
  const router = useRouter();
  const { lang, toggleLang, t } = useLanguage();
  const { route, setRoute } = useAppRoute();
  const { toastMsg, showToast } = useToast();

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
      const res = await apiFetch('/api/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toEmail: resetForm.email, type: 'reset' }) });
      const data = await res.json();
      if(data.success) { showToast(t('如果该邮箱绑定了账户，重置验证码将发送到该邮箱', 'If an account exists, a reset code will be sent')); }
      else { showToast('❌ ' + data.message); }
    } catch (error) { showToast(`❌ ${apiErrorMessage(error, t('发送失败', 'Send failed'))}`); }
    finally { setIsSendingResetCode(false); }
  };

  const submitResetPassword = async () => {
    if(!resetForm.email || !resetForm.code || !resetForm.newPassword) {
      return showToast(t('请填写完整重置信息', 'Fill all fields'));
    }
    setIsResetSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/register/password', {
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
    } catch (error) {
      showToast(`❌ ${apiErrorMessage(error, t('请求失败，请检查网络或重试', 'Request failed'))}`);
    } finally { setIsResetSubmitting(false); }
  };

  const [profileModal, setProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ newUsername: '', password: '', currentPassword: '' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [isProfileUpdating, setIsProfileUpdating] = useState(false);
  
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawAddress, setWithdrawAddress] = useState('');

  const [siteSettings, setSiteSettings] = useState(null);
  const [products, setProducts] = useState([]);

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
    try { await apiFetch('/api/auth/me', { method: 'POST' }); } catch (e) {}
    setUser(null);
    setShowUserMenu(false);
    setRoute('home');
    showToast(t('已安全退出登录', 'Logged out safely'));
  };
  const handleFileUpload = async (file) => { const formData = new FormData(); formData.append('file', file); const res = await apiFetch('/api/upload', { method: 'POST', body: formData }); const data = await res.json(); if (!res.ok || !data.success) throw new Error(data.message || '文件上传失败'); return data.url; };
  const handleReportUpload = async (file) => {
    if (!file) return;
    setIsParsingReport(true);
    try {
      const formData = new FormData(); formData.append('file', file);
      const response = await apiFetch('/api/strategy-report', { method: 'POST', body: formData }); const data = await response.json();
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
      const res = await apiFetch('/api/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toEmail: authForm.email }) });
      const data = await res.json();
      if(data.success) { setSentCode(true); showToast(t('验证码已发送', 'Verification code sent')); } else showToast(data.message);
    } catch (error) { showToast(`❌ ${apiErrorMessage(error, t('发送异常', 'Send error'))}`); }
    finally { setIsSendingCode(false); }
  };

  const submitRegister = async () => {
    if (!authForm.username || !authForm.email || !authForm.password || !authForm.code) return showToast(t('请填写完整信息', 'Please fill all fields'));
    setIsAuthSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authForm) });
      const data = await res.json();
      if (data.success) { updateUserSession(data.user); setAuthModal(null); showToast(t('🎉 注册成功！', '🎉 Registered successfully!')); setAuthForm({ username: '', email: '', password: '', code: '' }); } else showToast(data.message);
    } catch (error) { showToast(`❌ ${apiErrorMessage(error, t('请求失败', 'Request failed'))}`); }
    finally { setIsAuthSubmitting(false); }
  };

  const submitLogin = async () => {
    if (!authForm.email || !authForm.password) return showToast(t('请输入账号密码', 'Enter credentials'));
    setIsAuthSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: authForm.email, password: authForm.password }) });
      const data = await res.json();
      if (data.success) { updateUserSession(data.user); setAuthModal(null); showToast(t(`欢迎回来，${data.user.username}`, `Welcome back, ${data.user.username}`)); } else showToast(data.message);
    } catch (error) { showToast(`❌ ${apiErrorMessage(error, t('登录失败', 'Login failed'))}`); }
    finally { setIsAuthSubmitting(false); }
  };

  const submitProfileUpdate = async () => {
    if(!profileForm.newUsername.trim()) return showToast(t('用户名不能为空', 'Username required'));
    setIsProfileUpdating(true);
    try {
      let avatar_url = user.avatar_url;
      if (avatarFile) avatar_url = await handleFileUpload(avatarFile);
      const res = await apiFetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newUsername: profileForm.newUsername.trim(), avatar_url, password: profileForm.password, ...(profileForm.password?{currentPassword:profileForm.currentPassword}:{}) }) });
      const data = await res.json();
      if (data.success) { updateUserSession(data.user); setProfileForm({newUsername:data.user.username,password:'',currentPassword:''}); setProfileModal(false); showToast(t('✅ 资料更新成功！', '✅ Profile updated!')); fetchProducts(); fetchForumPosts(); fetchMyOrders(); } else showToast('❌ ' + data.message);
    } catch (error) { showToast(`❌ ${apiErrorMessage(error, t('资料更新失败', 'Profile update failed'))}`); }
    finally { setIsProfileUpdating(false); }
  };

  const submitWithdrawal = async () => {
    if (!withdrawAddress) return showToast(t('请输入有效的收款地址', 'Please enter a valid crypto address'));
    try {
      const res = await apiFetch('/api/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: withdrawAddress }) });
      const data = await res.json();
      if (data.success) {
         showToast(t('✅ 提现申请已提交，等待审核打款！', '✅ Withdrawal submitted, pending approval!'));
         updateUserSession({ balance: 0 }); 
         setWithdrawModal(false); setWithdrawAddress('');
      } else { showToast('❌ ' + data.message); }
    } catch (error) { showToast(`❌ ${apiErrorMessage(error, t('请求异常', 'Request error'))}`); }
  };

  const fetchProducts = () => { apiFetch(`/api/products`, { cache: 'no-store' }).then(res => res.json()).then(data => { if(data.success) setProducts(data.products); }); };
  const fetchForumPosts = (cat = '全部', sort = forumSort) => { apiFetch(`/api/posts?category=${encodeURIComponent(cat)}&sort=${sort}`, { cache: 'no-store' }).then(res => res.json()).then(data => { if(data.success) setForumPosts(data.posts); }); };
  const fetchMyOrders = async () => { if (user) { try { const res = await apiFetch(`/api/orders`, { cache: 'no-store' }); const data = await res.json(); if(data.success) setMyOrders(data.orders); } catch (error) { showToast(`❌ ${apiErrorMessage(error)}`); } } };
  const fetchMyLicenses=async()=>{if(user){try{const response=await apiFetch('/api/licenses',{cache:'no-store'});const data=await response.json();if(data.success)setMyLicenses(data.licenses);}catch(error){showToast(`❌ ${apiErrorMessage(error)}`);}}};
  const fetchMySocial=async()=>{if(user){try{const response=await apiFetch('/api/social',{cache:'no-store'});const data=await response.json();if(data.success)setMySocial({favorites:data.favorites,follows:data.follows,ratings:data.ratings});}catch(error){showToast(`❌ ${apiErrorMessage(error)}`);}}};

  useEffect(() => {
    apiFetch('/api/auth/me', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setUser(data.success ? data.user : null))
      .catch(() => setUser(null));
    apiFetch(`/api/settings`, { cache: 'no-store' }).then(res => res.json()).then(data => setSiteSettings(data));
    apiFetch(`/api/posts?category=${encodeURIComponent('全部')}&sort=latest`, { cache: 'no-store' }).then(res => res.json()).then(data => { if(data.success) setForumPosts(data.posts); });
    apiFetch(`/api/products`, { cache: 'no-store' }).then(res => res.json()).then(data => { if(data.success) setProducts(data.products); });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      apiFetch(`/api/orders`, { cache: 'no-store' }).then(response => response.json()),
      apiFetch('/api/licenses', { cache: 'no-store' }).then(response => response.json()),
      apiFetch('/api/social', { cache: 'no-store' }).then(response => response.json()),
    ]).then(([orders, licenses, social]) => {
      if (orders.success) setMyOrders(orders.orders);
      if (licenses.success) setMyLicenses(licenses.licenses);
      if (social.success) setMySocial({ favorites: social.favorites, follows: social.follows, ratings: social.ratings });
    }).catch(error => {
      setToastMsg(`❌ ${apiErrorMessage(error)}`);
      setTimeout(() => setToastMsg(''), 3000);
    });
  }, [user?.id]);

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
        const evidenceResponse = await apiFetch('/api/evidence', { method: 'POST', body: formData });
        const evidenceData = await evidenceResponse.json();
        if (!evidenceResponse.ok || !evidenceData.success) throw new Error(evidenceData.message || '回测证据上传失败');
        const previous = (uploadForm.id && (uploadForm.evidenceIds || []).find(id => (products.find(p=>p.id===uploadForm.id)?.evidence || []).find(item=>item.id===id)?.type === evidenceType));
        if (previous) evidenceIds.splice(evidenceIds.indexOf(previous), 1);
        evidenceIds.push(evidenceData.evidence.id);
      }
      const res = await apiFetch('/api/products', { method: uploadForm.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...uploadForm, evidenceIds, metrics: metricsPayload(uploadForm.metrics), logo_url, file_url, price: uploadForm.price || 0 }) });
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
        const res = await apiFetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: product.id }) });
        const data = await res.json();
        if (data.success) { showToast(t('🎉 免费获取成功！已放入您的资产库。', '🎉 Got it for free! Added to your assets.')); await fetchMyOrders(); setRoute('profile'); } else showToast('❌ ' + (data.message || 'Error'));
      } catch (e) { showToast(t('❌ 后端无响应', 'Backend error')); }
    } else {
      showToast(t('付费购买暂未开放，请勿向页面展示的钱包地址转账', 'Paid checkout is unavailable. Do not send funds to displayed wallet addresses.'));
    }
  };
  const handleStartTrial=async(product)=>{if(!user)return setAuthModal('login');try{const response=await apiFetch('/api/licenses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start_trial',productId:product.id})});const data=await response.json();if(!response.ok||!data.success)throw new Error(data.message||'试用申请失败');showToast(data.replayed?t('ℹ️ 已存在该产品的试用记录','Trial already exists'):t('✅ 试用已开始，请到个人中心绑定账号与设备','Trial started. Bind account and device in Profile'));await fetchMyLicenses();setRoute('profile');}catch(error){showToast('❌ '+error.message);}};
  const handleSocialAction=async(body)=>{if(!user){setAuthModal('login');return null;}try{const response=await apiFetch('/api/social',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok||!data.success)throw new Error(data.message||'操作失败');showToast(t('✅ 操作已保存','✅ Saved'));await Promise.all([fetchProducts(),fetchMySocial()]);return data;}catch(error){showToast('❌ '+error.message);return null;}};
  const handleLicenseBind=async(license,bindingType)=>{const value=window.prompt(bindingType==='trading_account'?t('输入 MT4/MT5 数字账号','Enter numeric MT4/MT5 account'):t('输入由 EA 客户端生成的设备指纹（至少 16 字符）','Enter device fingerprint generated by the EA client (16+ chars)'));if(!value)return;const response=await apiFetch('/api/licenses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'bind',licenseId:license.id,bindingType,value})});const data=await response.json();if(!response.ok||!data.success)return showToast('❌ '+(data.message||'绑定失败'));showToast(data.replayed?t('ℹ️ 绑定未变化','Binding unchanged'):t('✅ 绑定已更新，旧令牌已失效','Binding updated; old tokens invalidated'));fetchMyLicenses();};
  const handleLicenseToken=async(license)=>{const tradingAccount=window.prompt(t('输入已绑定的 MT4/MT5 账号','Enter the bound MT4/MT5 account'));if(!tradingAccount)return;const deviceFingerprint=window.prompt(t('输入已绑定的设备指纹','Enter the bound device fingerprint'));if(!deviceFingerprint)return;const response=await apiFetch('/api/licenses/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({licenseId:license.id,tradingAccount,deviceFingerprint})});const data=await response.json();if(!response.ok||!data.success)return showToast('❌ '+(data.message||'令牌签发失败'));try{await navigator.clipboard.writeText(data.token);showToast(t('✅ 15 分钟授权令牌已复制','15-minute authorization token copied'));}catch{window.prompt(t('复制授权令牌','Copy authorization token'),data.token);}};

  const submitVersion=async()=>{
    if(!versionModal||!versionFile||!versionForm.version||versionForm.releaseNotes.trim().length<3)return showToast(t('请填写版本号、更新日志并选择程序文件','Enter a version, release notes, and program file'));
    setIsVersionSubmitting(true);
    try{const fileUrl=await handleFileUpload(versionFile);const response=await apiFetch('/api/versions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId:versionModal.id,fileUrl,...versionForm})});const data=await response.json();if(!response.ok||!data.success)throw new Error(data.message||'版本提交失败');showToast(t('✅ 新版本已提交管理员审核','✅ Version submitted for review'));setVersionModal(null);setVersionFile(null);setVersionForm({version:'',releaseNotes:'',upgradePolicy:'all_existing'});fetchProducts();}catch(error){showToast('❌ '+error.message);}finally{setIsVersionSubmitting(false);}
  };

  const handleSecureDownload = async (productId, title, versionId = null) => {
    if (!user) return showToast(t('❌ 身份已过期', 'Session expired'));
    showToast(t('🔒 正在发起防盗版鉴权...', '🔒 Authenticating...'));
    try {
      const res = await apiFetch(`/api/download?productId=${productId}${versionId?`&versionId=${versionId}`:''}`);
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
    try { await apiFetch(`/api/products?id=${id}`, { method: 'DELETE' }); showToast(t('✅ 删除成功', '✅ Deleted')); fetchProducts(); await fetchMyOrders(); } catch (error) { showToast(`❌ ${apiErrorMessage(error, t('删除失败', 'Delete failed'))}`); }
  };

  const submitPost = async () => {
    if(!newPost.title || !newPost.content) return showToast(t('标题和内容不能为空', 'Required'));
    await apiFetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newPost, category: newPost.category || categories[1] }) });
    showToast(t('帖子发布成功！', 'Posted!')); setForumView('list'); fetchForumPosts(activeCategory); setNewPost({ title: '', category: categories[1], content: '' });
  };

  const openPostDetail = async (post) => { 
    setSelectedPost(post); setForumView('detail'); setComments([]); apiFetch(`/api/posts?viewId=${post.id}`, { cache: 'no-store' });
    const res = await apiFetch(`/api/comments?postId=${post.id}`, { cache: 'no-store' }); const data = await res.json(); if(data.success) setComments(data.comments);
  };

  const submitComment = async () => {
    if (!user) return setAuthModal('login');
    if (!commentInput.trim()) return;
    setIsCommenting(true);
    await apiFetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: selectedPost.id, content: commentInput }) });
    showToast(t('回复成功！', 'Replied!')); setCommentInput('');
    const res = await apiFetch(`/api/comments?postId=${selectedPost.id}`, { cache: 'no-store' }); const data = await res.json(); if(data.success) setComments(data.comments);
    setIsCommenting(false);
  };

  const handleDeletePost = async (id, e) => { if(e) e.stopPropagation(); if(!window.confirm(t('确定永久删除此贴？', 'Delete this post?'))) return; await apiFetch(`/api/posts?id=${id}`, { method: 'DELETE' }); showToast(t('✅ 已抹除', '✅ Eradicated')); if(forumView === 'detail') setForumView('list'); fetchForumPosts(activeCategory); };
  const handleDeleteComment = async (id) => { if(!window.confirm(t('确定删除评论？', 'Delete comment?'))) return; await apiFetch(`/api/comments?id=${id}`, { method: 'DELETE' }); showToast(t('✅ 已摘除', '✅ Removed')); const res = await apiFetch(`/api/comments?postId=${selectedPost.id}`, { cache: 'no-store' }); const data = await res.json(); if(data.success) setComments(data.comments); };
  const handlePinPost = async (id, is_pinned, e) => { if(e) e.stopPropagation(); await apiFetch('/api/posts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_pinned }) }); showToast(t('✅ 置顶状态已更新', '✅ Pin updated')); fetchForumPosts(activeCategory); };
  const handlePinComment = async (id, is_pinned) => { await apiFetch('/api/comments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_pinned }) }); showToast(t('✅ 置顶状态已更新', '✅ Pin updated')); const res = await apiFetch(`/api/comments?postId=${selectedPost.id}`, { cache: 'no-store' }); const data = await res.json(); if(data.success) setComments(data.comments); };
  const handleReport = async (targetType, targetId) => {
    if (!user) return setAuthModal('login');
    const reason = window.prompt(t('举报原因：spam / fraud / abuse / copyright / dangerous / other', 'Reason: spam / fraud / abuse / copyright / dangerous / other'), 'other');
    if (!reason) return;
    const details = window.prompt(t('请补充举报说明（可选，最多 1000 字）', 'Optional details, up to 1000 characters'), '') ?? '';
    const response = await apiFetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType, targetId, reason: reason.trim().toLowerCase(), details }) });
    const data = await response.json();
    showToast(response.ok && data.success ? (data.report?.replayed ? t('ℹ️ 该举报正在处理中', 'Report already pending') : t('✅ 举报已提交，等待管理员审核', 'Report submitted for review')) : `❌ ${data.message || t('举报失败', 'Report failed')}`);
  };

  const myEAs = user ? products.filter(p => p.author_user_id === user.id) : [];
  const myPostCount = user ? forumPosts.filter(p => p.author_user_id === user.id).length : 0;
  const myBadge = user ? getUserTitle(myPostCount, myEAs.length, user.role) : null;

  return (
    <div className="min-h-screen flex flex-col justify-between bg-zinc-950 text-zinc-300 font-sans selection:bg-cyan-500/30">
      
      <AppHeader {...{ router, siteSettings, setRoute, route, t, user, setAuthModal, toggleLang, lang, showUserMenu, setShowUserMenu, handleLogout, setAuthForm, setForumView }} />

      <main className="relative z-10 w-full flex-grow">
        {route === 'home' && (<HomeView setRoute={setRoute} setForumView={setForumView} siteSettings={siteSettings} products={products} forumPosts={forumPosts} user={user} setAuthModal={setAuthModal} setActiveCategory={setActiveCategory} openPostDetail={openPostDetail} t={t} tEaType={tEaType} />)}
        {route === 'market' && (<MarketView products={products.filter(p => p.status === 'active')} myOrders={myOrders} user={user} handlePurchaseProcess={handlePurchaseProcess} handleStartTrial={handleStartTrial} handleSocialAction={handleSocialAction} handleReport={handleReport} setRoute={setRoute} setAuthModal={setAuthModal} t={t} tEaType={tEaType} />)}
        {route === 'upload' && <UploadView {...{ setRoute, t, user, uploadForm, setUploadForm, eaTypeOptions, toggleEaType, tEaType, setLogoFile, logoFile, setEx4File, ex4File, isParsingReport, handleReportUpload, reportInfo, setEvidenceFiles, parseMetricRows, submitEA, isSubmitting }} />}
        {route === 'forum' && <ForumView {...{ categories, setActiveCategory, setForumView, fetchForumPosts, forumSort, activeCategory, forumView, tCat, user, setAuthModal, setNewPost, newPost, dynamicCats, setForumSort, forumPosts, openPostDetail, getUserTitle, handleDeletePost, selectedPost, setRoute, comments, handleDeleteComment, commentInput, setCommentInput, isCommenting, submitComment, submitPost, t }} />}
        {route === 'profile' && user && <ProfileView {...{ user, myBadge, setProfileForm, setProfileModal, t, myOrders, handleDownload, myLicenses, setWithdrawModal, mySocial, setRoute, myEAs, handleEditEA, setVersionModal, setVersionForm, setVersionFile, handleDeleteMyEA }} />}
      </main>

      <Footer siteSettings={siteSettings} setRoute={setRoute} setForumView={setForumView} t={t} />

      <AppOverlays {...{ versionModal, setVersionModal, versionForm, setVersionForm, setVersionFile, submitVersion, isVersionSubmitting, profileModal, setProfileModal, setAvatarFile, setProfileForm, user, profileForm, submitProfileUpdate, isProfileUpdating, withdrawModal, setWithdrawModal, withdrawAddress, setWithdrawAddress, submitWithdrawal, authModal, setAuthModal, setSentCode, authForm, setAuthForm, handleSendAuthCode, isSendingCode, sentCode, resetForm, setResetForm, isAuthSubmitting, submitLogin, submitRegister, handleSendResetCode, isSendingResetCode, isResetSubmitting, submitResetPassword, toastMsg, t }} />
    </div>
  );
}
