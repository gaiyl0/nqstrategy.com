"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ApiError, apiErrorMessage, apiFetch } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import { Settings, Wallet, Mail, ShieldCheck, Users, Box, CheckCircle, Key, Trash2, BadgeDollarSign, CreditCard, Hash, HandCoins, Flag, LayoutDashboard, Activity, AlertTriangle, ArrowUpRight, FileCheck2, LogOut, Newspaper, BookOpen, TrendingUp, Bot, Globe2, MousePointerClick } from 'lucide-react';
import { Badge, Button, Dialog, Field, Panel, useInteraction } from '@/app/components/ui/UiKit';
import { AdminLocale, localizeAdminValue } from './admin-locale';
import { DEFAULT_COMMUNITY_CONTENT } from '@/lib/community-content';
import ProductReviewWorkspace from './ProductReviewWorkspace';

const COMMUNITY_EDITOR_SECTIONS = [
  { tab: 'communityContent', key: 'news', title: '社区内容管理', max: 6, icon: Newspaper, fields: [['region', '分类 / 地区', 60], ['regionEn', '分类英文', 60], ['date', '日期 YYYY-MM-DD', 10], ['title', '标题', 140], ['titleEn', '英文标题', 180], ['summary', '摘要', 600, true], ['summaryEn', '英文摘要', 600, true], ['url', '来源 URL', 500], ['source', '来源名称', 120], ['sourceEn', '来源英文名称', 120]] },
  { tab: 'communityDocs', key: 'documents', title: '文档与资料链接', max: 12, icon: BookOpen, fields: [['title', '标题', 120], ['titleEn', '英文标题', 160], ['description', '说明', 500, true], ['descriptionEn', '英文说明', 500, true], ['url', '资料 URL', 500]] },
  { tab: 'communityStrategies', key: 'strategies', title: '策略类型速览', max: 8, icon: TrendingUp, fields: [['title', '标题', 80], ['titleEn', '英文标题', 100], ['detail', '说明', 500, true], ['detailEn', '英文说明', 500, true]] },
];

export default function AdminDashboard() {
  const { confirmAction, requestInput } = useInteraction();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [lang, setLang] = useState('zh');
  // 完整补齐所有设置字段，修复界面残缺
  const [settings, setSettings] = useState({ 
    siteName: '', primaryColor: '#22d3ee', contactEmail: '', 
    usdtAddress: '', btcAddress: '', ethAddress: '', 
    smtpHost: '', smtpUser: '', smtpPass: '',
    broker1Name: '', broker1Desc: '', broker1Link: '', 
    broker2Name: '', broker2Desc: '', broker2Link: '', 
    broker3Name: '', broker3Desc: '', broker3Link: '', 
    exchangeAdEnabled: false, exchangeAdTitle: '', exchangeAdDescription: '', exchangeAdCta: '', exchangeAdUrl: '', featuredProductIds: [],
    wechatPaySetupEnabled: false, wechatPayMchId: '', wechatPayAppId: '', wechatPayNotifyUrl: '', wechatPayCertificateSerial: '',
    alipaySetupEnabled: false, alipayAppId: '', alipaySellerId: '', alipayNotifyUrl: '', alipayGateway: 'https://openapi.alipay.com/gateway.do',
    wechatPayApiV3KeyConfigured: false, wechatPayMerchantPrivateKeyConfigured: false, wechatPayPlatformCertificateConfigured: false,
    alipayAppPrivateKeyConfigured: false, alipayPublicKeyConfigured: false,
    forumCategories: 'XAUUSD 策略,MQL5 开发,AI 与深度学习,官方公告',
    communityContent: DEFAULT_COMMUNITY_CONTENT,
  });
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [userList, setUserList] = useState([]);
  const [productList, setProductList] = useState([]);
  const [orderList, setOrderList] = useState([]); 
  const [withdrawals, setWithdrawals] = useState([]);
  const [licenses,setLicenses]=useState([]);
  const [reports,setReports]=useState([]);
  const [analytics,setAnalytics]=useState(null);
  const [analyticsDays,setAnalyticsDays]=useState(30);
  const [analyticsVisitPage,setAnalyticsVisitPage]=useState(1);
  const [analyticsClickPage,setAnalyticsClickPage]=useState(1);
  
  const [pwdModal, setPwdModal] = useState({ isOpen: false, userId: null, username: '', newPwd: '' });
  const [balanceModal, setBalanceModal] = useState({ isOpen: false, userId: null, username: '', balance: 0 });

  const localizeConfig = value => {
    if (typeof value === 'string') return localizeAdminValue(value, lang);
    if (Array.isArray(value)) return value.map(localizeConfig);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localizeConfig(item)]));
    return value;
  };
  const request = config => requestInput(localizeConfig(config));
  const adminConfirm = config => confirmAction(localizeConfig(config));

  const fetchUsers = () => apiFetch(`/api/users`, { cache: 'no-store' }).then(res => res.json()).then(data => { if (data.success) setUserList(data.users); });
  const fetchProducts = () => apiFetch(`/api/products?role=admin`, { cache: 'no-store' }).then(res => res.json()).then(data => { if (data.success) setProductList(data.products); });
  const fetchOrders = () => apiFetch(`/api/orders?role=admin`, { cache: 'no-store' }).then(res => res.json()).then(data => { if(data.success) setOrderList(data.orders); });
  const fetchWithdrawals = () => apiFetch(`/api/withdraw`, { cache: 'no-store' }).then(res => res.json()).then(data => { if(data.success) setWithdrawals(data.withdrawals); });
  const fetchLicenses=()=>apiFetch('/api/licenses?scope=admin',{cache:'no-store'}).then(response=>response.json()).then(data=>{if(data.success)setLicenses(data.licenses);});
  const fetchReports=()=>apiFetch('/api/reports?status=pending',{cache:'no-store'}).then(response=>response.json()).then(data=>{if(data.success)setReports(data.reports);});
  const fetchAnalytics=(days=analyticsDays,visitPage=analyticsVisitPage,clickPage=analyticsClickPage)=>apiFetch('/api/analytics?days='+days+'&limit=20&visitPage='+visitPage+'&clickPage='+clickPage,{cache:'no-store'}).then(response=>response.json()).then(data=>{if(data.success)setAnalytics(data.analytics);});

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const authResponse = await apiFetch('/api/auth/me', { cache: 'no-store' });
        const authData = await authResponse.json();
        if (!authData.success || authData.user?.role !== 'admin') {
          router.replace('/');
          return;
        }
        setAuthChecked(true);
        apiFetch(`/api/settings`, { cache: 'no-store' }).then(res => res.json()).then(data => setSettings(prev => ({ ...prev, ...data })));
        await Promise.allSettled([fetchUsers(), fetchProducts(), fetchOrders(), fetchWithdrawals(), fetchLicenses(), fetchReports()]);
      } catch {
        router.replace('/');
      }
    };
    bootstrap();
  }, [router]);

  useEffect(() => { 
    if (!authChecked) return;
    if (activeTab === 'products') fetchProducts(); 
    if (activeTab === 'orders') fetchOrders(); 
    if (activeTab === 'withdrawals') fetchWithdrawals(); 
    if (activeTab === 'licenses') fetchLicenses();
    if (activeTab === 'reports') fetchReports();
    if (activeTab === 'analytics') fetchAnalytics(analyticsDays);
    // fetch helpers intentionally remain stable local functions; tab and page state drive this refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, authChecked, analyticsDays, analyticsVisitPage, analyticsClickPage]);

  const showStatus = (msg) => { setStatus(msg); setTimeout(() => setStatus(''), 3000); };
  const updateCommunityItem = (section, index, field, value) => setSettings(previous => ({
    ...previous,
    communityContent: { ...previous.communityContent, [section]: previous.communityContent[section].map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) },
  }));
  const removeCommunityItem = (section, index) => setSettings(previous => ({
    ...previous,
    communityContent: { ...previous.communityContent, [section]: previous.communityContent[section].filter((_, itemIndex) => itemIndex !== index) },
  }));
  const addCommunityItem = (section) => {
    const blank = section === 'news'
      ? { region: '', regionEn: '', date: new Date().toISOString().slice(0, 10), title: '', titleEn: '', summary: '', summaryEn: '', url: '', source: '', sourceEn: '' }
      : section === 'documents'
        ? { title: '', titleEn: '', description: '', descriptionEn: '', url: '' }
        : { title: '', titleEn: '', detail: '', detailEn: '' };
    setSettings(previous => ({ ...previous, communityContent: { ...previous.communityContent, [section]: [...previous.communityContent[section], blank] } }));
  };

  useEffect(() => {
    const handleApiFailure = (event) => {
      if (!(event.reason instanceof ApiError)) return;
      event.preventDefault();
      setStatus(`❌ ${apiErrorMessage(event.reason)}`);
      setTimeout(() => setStatus(''), 3000);
    };
    window.addEventListener('unhandledrejection', handleApiFailure);
    return () => window.removeEventListener('unhandledrejection', handleApiFailure);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const {
        wechatPayApiV3KeyConfigured,
        wechatPayMerchantPrivateKeyConfigured,
        wechatPayPlatformCertificateConfigured,
        alipayAppPrivateKeyConfigured,
        alipayPublicKeyConfigured,
        ...persistedSettings
      } = settings;
      await apiFetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(persistedSettings) });
      showStatus('✅ 所有配置已永久保存生效！');
    } catch (error) {
      showStatus(`❌ ${apiErrorMessage(error, '配置保存失败')}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveEA = async (id, newStatus) => {
    const response = await apiFetch('/api/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: newStatus }) });
    const data = await response.json();
    if (!response.ok || !data.success) return showStatus(`❌ ${data.message || '策略状态更新失败'}`);
    fetchProducts(); showStatus('✅ 策略状态已更新');
  };
  const handleEvidenceReview = async (item, statusAction, report = null) => {
    const rejectionReason = statusAction === 'rejected' ? (await request({title:'拒绝证据',description:`${item.type || '证据'} #${item.id}`,label:'拒绝原因',required:true,minLength:3,maxLength:500,multiline:true,confirmLabel:'确认拒绝'}) || '') : '';
    if (statusAction === 'rejected' && !rejectionReason) return;
    let correctedExtraction;
    if (statusAction === 'approved' && item.type === 'statistics' && !item.extraction && !report) {
      const entered = await request({title:'校正 OCR 统计数据',description:'OCR 未提取到可用结果。校正数据将进入审核记录。',label:'结构化 JSON',hint:'必须包含初始资金、净利润、Profit Factor、最大回撤、胜率和交易次数。',initialValue:'{"initialDeposit":1000,"netProfit":100,"profitFactor":1.5,"maxDrawdownPercent":10,"winRatePercent":55,"totalTrades":100}',required:true,multiline:true,rows:8,confirmLabel:'应用校正',validate:value=>{try{JSON.parse(value);return '';}catch{return 'JSON 格式无效';}}});
      if (!entered) return;
      try { correctedExtraction = JSON.parse(entered); } catch { return showStatus('❌ 校正数据必须是合法 JSON'); }
    }
    const response = await apiFetch('/api/evidence', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, status: statusAction, rejectionReason, ...(correctedExtraction ? { correctedExtraction } : {}) }) });
    const data = await response.json();
    if (!response.ok || !data.success) return showStatus(`❌ ${data.message || '证据审核失败'}`);
    fetchProducts(); showStatus('✅ 证据审核状态已更新');
  };
  const handleVerification = async (product) => {
    const level = await request({title:'授予策略认证',description:product.title,label:'认证等级',initialValue:'reproducible_backtest',options:[{value:'reproducible_backtest',label:'可复现回测'},{value:'platform_rerun',label:'平台复跑'},{value:'live_verified',label:'实盘验证'}],required:true,confirmLabel:'下一步'});
    if (!level) return;
    const examples = {
      reproducible_backtest: '{"parameterFileSha256":"64位SHA256","dataset":"数据集名称","terminalBuild":"MT5 build","testRange":"2026-01-01 至 2026-09-22"}',
      platform_rerun: '{"parameterFileSha256":"64位SHA256","dataset":"数据集名称","terminalBuild":"MT5 build","testRange":"区间","runId":"NEXUS-RUN-编号","resultSha256":"64位SHA256","environment":"复跑环境","rerunAt":"2026-09-27T00:00:00.000Z"}',
      live_verified: '{"provider":"提供方","accountMasked":"****1234","accessMode":"read_only","observedDays":30,"lastCheckedDate":"2026-09-27","maxDrawdownPercent":10}',
    };
    if (!examples[level]) return showStatus('❌ 认证等级不合法');
    const entered = await request({title:'填写认证证据',description:`认证等级：${level}`,label:'证据 JSON',initialValue:examples[level],required:true,multiline:true,rows:9,confirmLabel:'批准认证',validate:value=>{try{JSON.parse(value);return '';}catch{return 'JSON 格式无效';}}}); if (!entered) return;
    let evidence; try { evidence=JSON.parse(entered); } catch { return showStatus('❌ 证据必须是合法 JSON'); }
    const response=await apiFetch('/api/verifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'approve',productId:product.id,level,evidence})}); const data=await response.json();
    if(!response.ok||!data.success)return showStatus(`❌ ${data.message||'认证失败'}`); fetchProducts();showStatus('✅ 认证等级已更新');
  };
  const handleRevokeVerification=async(product)=>{const reason=await request({title:'撤销策略认证',description:product.title,label:'撤销原因',required:true,minLength:5,maxLength:500,multiline:true,confirmLabel:'撤销认证'});if(!reason)return;const response=await apiFetch('/api/verifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'revoke',productId:product.id,reason})});const data=await response.json();if(!response.ok||!data.success)return showStatus(`❌ ${data.message||'撤销失败'}`);fetchProducts();showStatus('✅ 认证已撤销');};
  const handleVersionReview=async(version,decision)=>{const needsReason=['reject','retire'].includes(decision);const reason=needsReason?(await request({title:`版本${decision==='retire'?'下架':'拒绝'}`,description:version.version||`#${version.id}`,label:'操作原因',required:true,minLength:5,maxLength:500,multiline:true,confirmLabel:decision==='retire'?'确认下架':'确认拒绝'})||''):'';if(needsReason&&!reason)return;const response=await apiFetch('/api/versions',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:version.id,decision,...(reason?{reason}:{})})});const data=await response.json();if(!response.ok||!data.success)return showStatus(`❌ ${data.message||'版本审核失败'}`);fetchProducts();showStatus(data.replayed?'ℹ️ 该版本已经处理':'✅ 版本审核完成');};
  const handleRevokeLicense=async(license)=>{const reason=await request({title:'撤销授权',description:`许可证 #${license.id}`,label:'撤销原因',hint:'撤销后现有令牌立即失效。',required:true,minLength:5,maxLength:500,multiline:true,confirmLabel:'撤销授权'});if(!reason)return;const response=await apiFetch('/api/licenses',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({licenseId:license.id,reason})});const data=await response.json();if(!response.ok||!data.success)return showStatus(`❌ ${data.message||'授权撤销失败'}`);fetchLicenses();showStatus(data.replayed?'ℹ️ 授权已撤销':'✅ 授权已撤销，现有令牌失效');};
  const handleReportResolution=async(report,decision)=>{const note=await request({title:decision==='confirm'?'确认违规':'驳回举报',description:`举报 #${report.id}`,label:decision==='confirm'?'违规确认依据':'驳回说明',required:true,minLength:5,maxLength:1000,multiline:true,confirmLabel:'提交处理'});if(!note)return;const response=await apiFetch('/api/reports',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:report.id,decision,note})});const data=await response.json();if(!response.ok||!data.success)return showStatus(`❌ ${data.message||'举报处理失败'}`);fetchReports();showStatus(data.result?.replayed?'ℹ️ 该举报已处理':'✅ 举报处理完成');};
  const handleDeleteEA = async (id, title) => { if (!await adminConfirm({title:'强制删除策略',description:title,noticeTitle:'订单与授权将被撤销',notice:'策略将从全站隐藏；订单和审计记录会保留，现有下载授权立即失效。',confirmLabel:'强制删除'})) return; const params=new URLSearchParams({id:String(id),force:'1',reason:'管理员强制删除测试或无效策略'}); const res = await apiFetch(`/api/products?${params}`, { method: 'DELETE' }); const data = await res.json(); if (data.success) { showStatus(`🗑️ 已强制删除；保留 ${data.archivedOrders||0} 条订单审计记录`); fetchProducts(); } else showStatus(`❌ ${data.message||'删除失败'}`); };

  const submitResetPwd = async () => { if (!pwdModal.newPwd) return showStatus('❌ 密码不能为空'); await apiFetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pwdModal.userId, newPassword: pwdModal.newPwd }) }); setPwdModal({ isOpen: false, userId: null, username: '', newPwd: '' }); showStatus('✅ 密码重置成功！'); };
  
  const submitUpdateBalance = async () => {
    const response = await apiFetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `admin-balance:${balanceModal.userId}:${crypto.randomUUID()}` }, body: JSON.stringify({ id: balanceModal.userId, manualBalance: Number(balanceModal.balance) }) });
    const data = await response.json();
    if (!response.ok || !data.success) return showStatus(`❌ ${data.message || '余额修改失败'}`);
    setBalanceModal({ isOpen: false }); fetchUsers(); showStatus(data.replayed ? 'ℹ️ 余额操作已处理' : '💰 余额修改成功并已记录账本！');
  };

  const handleChangeRole = async (id, newRole) => { if (!await adminConfirm({title:'调整用户权限',description:`用户 #${id} → ${newRole}`,tone:'warning',noticeTitle:'权限变更会立即生效',notice:'请确认新角色与用户的实际职责一致。',confirmLabel:'确认更改'})) return; await apiFetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, newRole }) }); fetchUsers(); showStatus('👑 用户权限已更新'); };
  const handleDeleteUser = async (id, username) => { if (!await adminConfirm({title:'注销用户',description:username,noticeTitle:'历史资产将保留原 user_id 关联',notice:'账户会被匿名化并停用，同名重新注册不会继承旧订单、产品或收入。',confirmLabel:'确认注销'})) return; await apiFetch(`/api/users?id=${id}`, { method: 'DELETE' }); fetchUsers(); showStatus('🗑️ 用户已删除'); };

  const handleWithdrawAction = async (id, statusAction) => {
    if (!await adminConfirm({title:statusAction === 'completed' ? '批准提现' : '驳回提现',description:`提现申请 #${id}`,tone:statusAction === 'completed'?'warning':'danger',noticeTitle:statusAction === 'completed'?'请确认链下打款已完成':'冻结余额将原子退回',notice:statusAction === 'completed'?'状态更新具有幂等保护，重复操作不会重复结算。':'驳回退款只会执行一次并写入账本。',confirmLabel:statusAction === 'completed'?'确认已打款':'驳回并退回余额'})) return;
    const response = await apiFetch('/api/withdraw', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `withdraw:${id}:${statusAction}:v1` },
      body: JSON.stringify({ id, status: statusAction }),
    });
    const data = await response.json();
    fetchWithdrawals(); fetchUsers();
    showStatus(data.success ? '✅ 提现状态已更新' : `❌ ${data.message || '操作失败'}`);
  };

  const getUserTitle = (postCount, eaCount, role) => {
    if (role === 'admin') return { title: '👑 最高统治者', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    if (role === 'user') return { title: '👤 普通用户', color: 'text-zinc-400 bg-zinc-800 border-zinc-700' };
    const score = (postCount * 10) + (eaCount * 50);
    if (score >= 500) return { title: '🏆 Lv.MAX 传奇大牛', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
    if (score >= 200) return { title: '🔮 Lv.4 首席架构师', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
    if (score >= 100) return { title: '⚡ Lv.3 资深算法师', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' };
    if (score >= 30)  return { title: '🚀 Lv.2 独立开发者', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    return { title: '🌱 Lv.1 见习宽客', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  };

  const handleOrderAction = async (orderId, action) => {
    if (!await adminConfirm({title:'驳回无效订单',description:`订单 #${orderId}`,noticeTitle:'订单将进入拒绝状态',notice:'未经服务端确认的付款不会发放资产或触发创作者结算。',confirmLabel:'确认驳回'})) return;
    try {
      const res = await apiFetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `order:${orderId}:${action}:v1` },
        body: JSON.stringify({ orderId, action })
      });
      const data = await res.json();
      showStatus(data.message);
      fetchOrders();
      fetchUsers();
    } catch (e) {
      showStatus('❌ 审核操作失败');
    }
  };
  if (!authChecked) {
    return <main className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">正在验证管理员身份…</main>;
  }

  const pendingProducts = productList.filter(product => product.status === 'pending');
  const pendingWithdrawals = withdrawals.filter(withdrawal => withdrawal.status === 'pending');
  const pendingOrders = orderList.filter(order => order.status === 'pending');
  const completedRevenue = orderList.filter(order => order.status === 'completed' && (Number(order.price) === 0 || order.payment_verified === 1)).reduce((sum, order) => sum + (Number(order.price) || 0), 0);
  const currentCommunitySection = COMMUNITY_EDITOR_SECTIONS.find(section => section.tab === activeTab);
  const CommunitySectionIcon = currentCommunitySection?.icon || Newspaper;
  const navigation = [
    ['dashboard', '仪表盘', LayoutDashboard], ['users', '用户与角色', Users], ['products', '策略与证据审核', Box],
    ['orders', '订单与支付', BadgeDollarSign], ['paymentSettings', '支付渠道配置', CreditCard], ['analytics', '访问与广告统计', Activity], ['withdrawals', '提现管理', HandCoins], ['licenses', '授权管理', Key],
    ['reports', '社区治理', Flag],
    ['communityContent', `社区内容管理 (${settings.communityContent?.news?.length || 0}/6)`, Newspaper],
    ['communityDocs', `文档与资料链接 (${settings.communityContent?.documents?.length || 0}/12)`, BookOpen],
    ['communityStrategies', `策略类型速览 (${settings.communityContent?.strategies?.length || 0}/8)`, TrendingUp],
    ['settings', '系统设置', Settings],
  ];

  return (
    <AdminLocale lang={lang}><div className="min-h-screen bg-[#060c13] text-zinc-300 relative">
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-800/80 bg-[#08111a]/95 px-5 backdrop-blur-xl">
        <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/25 bg-cyan-400/10"><Activity className="h-5 w-5 text-cyan-300" /></div><div><p className="font-black tracking-[0.14em] text-white">NEXUS QUANT</p><p className="text-[10px] text-slate-600">运营控制台</p></div></div>
        <div className="ml-auto flex items-center gap-3"><Badge variant="success">{lang === 'zh' ? '生产环境' : 'Production'}</Badge><span className="hidden items-center gap-2 text-xs text-slate-500 md:flex"><span className="h-2 w-2 rounded-full bg-emerald-400" />{lang === 'zh' ? '管理员会话已验证' : 'Administrator session verified'}</span><Button variant="ghost" size="sm" onClick={() => setLang(current => current === 'zh' ? 'en' : 'zh')} aria-label={lang === 'zh' ? 'Switch language' : '切换语言'}>{lang === 'zh' ? 'EN' : '中文'}</Button><Button variant="ghost" size="sm" icon={LogOut} onClick={() => router.push('/')}>{lang === 'zh' ? '返回网站' : 'Back to website'}</Button></div>
      </header>
      <div className="flex min-h-[calc(100vh-64px)]">
        <aside className="hidden w-60 shrink-0 border-r border-slate-800/80 bg-[#08111a]/70 p-3 lg:flex lg:flex-col"><nav className="space-y-1">{navigation.map(([value, label, Icon], index) => <button key={`navigation-${value}-${index}`} type="button" onClick={() => setActiveTab(value)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition-colors ${activeTab === value ? 'bg-cyan-400/10 text-cyan-300 ring-1 ring-inset ring-cyan-400/20' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'}`}><Icon className="h-4 w-4" /><span className="flex-1">{label}</span>{value === 'products' && pendingProducts.length > 0 && <Badge variant="warning">{pendingProducts.length}</Badge>}{value === 'withdrawals' && pendingWithdrawals.length > 0 && <Badge variant="danger">{pendingWithdrawals.length}</Badge>}{value === 'reports' && reports.length > 0 && <Badge variant="danger">{reports.length}</Badge>}</button>)}</nav><Panel className="mt-auto p-4"><ShieldCheck className="h-5 w-5 text-cyan-300" /><p className="mt-3 text-sm font-bold text-white">安全边界已启用</p><p className="mt-2 text-xs leading-5 text-slate-500">管理员 RBAC、会话校验、幂等操作与审计日志继续由服务端执行。</p></Panel></aside>
        <main className="min-w-0 flex-1 p-4 md:p-6 xl:p-8"><div className="mx-auto max-w-[1500px]">
        <div className="mb-7 flex flex-col justify-between gap-4 border-b border-slate-800/80 pb-6 md:flex-row md:items-end"><div><p className="text-sm font-semibold text-cyan-300">Nexus Quant Operations</p><h1 className="mt-2 text-3xl font-black text-white">{activeTab === 'dashboard' ? '运营仪表盘' : navigation.find(item => item[0] === activeTab)?.[1]}</h1><p className="mt-2 text-sm text-slate-500">真实业务数据、审核队列与风险操作集中管理。</p></div>{(['settings', 'paymentSettings', 'communityContent', 'communityDocs', 'communityStrategies'].includes(activeTab)) && <Button variant="primary" loading={isSaving} onClick={handleSave}>保存配置</Button>}<div className="flex gap-2 overflow-x-auto lg:hidden">{navigation.map(([value, label], index) => <Button key={`mobile-navigation-${value}-${index}`} size="sm" variant={activeTab === value ? 'primary' : 'secondary'} onClick={() => setActiveTab(value)}>{label}</Button>)}</div></div>

        {activeTab === 'dashboard' && <div className="space-y-5">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
            ['待审策略', pendingProducts.length, '进入策略审核队列', Box, 'primary'],
            ['待处理提现', pendingWithdrawals.length, '真实打款前必须人工复核', HandCoins, 'warning'],
            ['风险事件', reports.length, '当前待处理内容举报', AlertTriangle, 'danger'],
            ['历史订单', orderList.length, '付费能力仍处于关闭状态', CreditCard, 'neutral'],
          ].map(([label, value, hint, Icon, tone], index) => <Panel key={`dashboard-metric-${label}-${index}`} className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm text-slate-400">{label}</p><p className="nq-number mt-2 text-3xl font-black text-white">{value}</p></div><div className="rounded-lg border border-slate-700/50 bg-slate-800/70 p-3"><Icon className="h-5 w-5 text-cyan-300" /></div></div><div className="mt-4"><Badge variant={tone}>{hint}</Badge></div></Panel>)}</section>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,.7fr)]"><Panel className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><h2 className="font-bold text-white">待办队列</h2><p className="mt-1 text-xs text-slate-600">来自当前数据库的真实待处理记录</p></div><FileCheck2 className="h-5 w-5 text-cyan-300" /></div><div className="divide-y divide-slate-800/70">{[
            ['策略审核', pendingProducts.length, 'products'], ['提现复核', pendingWithdrawals.length, 'withdrawals'], ['订单异常', pendingOrders.length, 'orders'], ['内容举报', reports.length, 'reports'],
          ].map(([label, count, target], index) => <button key={`queue-${target}-${index}`} type="button" onClick={() => setActiveTab(target)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-800/35"><span className={`h-2.5 w-2.5 rounded-full ${count ? 'bg-amber-400' : 'bg-emerald-400'}`} /><div className="flex-1"><p className="font-semibold text-slate-200">{label}</p><p className="mt-1 text-xs text-slate-600">{count ? `${count} 条等待处理` : '当前没有待处理记录'}</p></div><ArrowUpRight className="h-4 w-4 text-slate-600" /></button>)}</div></Panel><div className="space-y-5"><Panel className="p-5"><h2 className="font-bold text-white">系统状态</h2><div className="mt-5 space-y-4">{[['管理员身份','已验证'],['付费能力','保持关闭'],['API 操作','服务端鉴权'],['审计边界','已启用']].map(([label,value], index) => <div key={`system-status-${label}-${index}`} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-400" />{label}</span><span className="font-semibold text-emerald-300">{value}</span></div>)}</div></Panel><Panel className="p-5"><h2 className="font-bold text-white">业务快照</h2><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-lg bg-slate-950/50 p-3"><p className="nq-number text-xl font-black text-white">{userList.length}</p><p className="mt-1 text-xs text-slate-600">用户</p></div><div className="rounded-lg bg-slate-950/50 p-3"><p className="nq-number text-xl font-black text-white">{productList.length}</p><p className="mt-1 text-xs text-slate-600">策略</p></div><div className="col-span-2 rounded-lg bg-slate-950/50 p-3"><p className="nq-number text-xl font-black text-emerald-300">${completedRevenue.toLocaleString()}</p><p className="mt-1 text-xs text-slate-600">已核验完成订单金额</p></div></div></Panel></div></div>
        </div>}
        
        {activeTab === 'analytics' && (
          <section className="space-y-6 pb-20 animate-in fade-in duration-300">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-4"><div><h2 className="font-bold text-white">访问流量与广告效果</h2><p className="mt-1 text-xs leading-5 text-slate-500">蜘蛛依据 User-Agent 识别，属于疑似分类；访客只保存不可逆哈希，不保存完整 IP。</p></div><div className="flex items-center gap-2"><select value={analyticsDays} onChange={event=>{setAnalyticsDays(Number(event.target.value));setAnalyticsVisitPage(1);setAnalyticsClickPage(1);}} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value={7}>最近 7 天</option><option value={30}>最近 30 天</option><option value={90}>最近 90 天</option><option value={365}>最近 365 天</option></select><Button size="sm" onClick={()=>fetchAnalytics(analyticsDays)}>刷新</Button></div></div>

            {!analytics ? <Panel className="p-10 text-center text-sm text-slate-500">正在读取访问统计……</Panel> : <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
                ['总页面访问',analytics.visitSummary?.totalVisits||0,Globe2,'含用户与疑似蜘蛛','primary'],
                ['用户访问',analytics.visitSummary?.humanVisits||0,Users,`约 ${analytics.visitSummary?.uniqueHumanVisitors||0} 位匿名访客`,'success'],
                ['蜘蛛访问',analytics.visitSummary?.botVisits||0,Bot,'依据 User-Agent 分类','warning'],
                ['广告有效点击',analytics.adSummary?.humanClicks||0,MousePointerClick,`${analytics.adSummary?.uniqueHumanClickers||0} 位匿名点击者`,'primary'],
              ].map(([label,value,Icon,hint,tone],index)=><Panel key={`analytics-metric-${label}-${index}`} className="p-5"><div className="flex items-start justify-between"><div><p className="text-xs text-slate-500">{label}</p><p className="nq-number mt-2 text-3xl font-black text-white">{Number(value).toLocaleString()}</p></div><span className="rounded-lg border border-slate-700 bg-slate-800/70 p-3"><Icon className="h-5 w-5 text-cyan-300"/></span></div><div className="mt-4"><Badge variant={tone}>{hint}</Badge></div></Panel>)}</div>

              <div className="grid gap-6 xl:grid-cols-2"><Panel className="overflow-hidden"><div className="border-b border-slate-800 px-5 py-4"><h2 className="font-bold text-white">热门访问路径</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b border-slate-800 text-xs text-slate-500"><th className="p-4">路径</th><th className="p-4 text-right">总访问</th><th className="p-4 text-right">蜘蛛</th></tr></thead><tbody>{(analytics.topPaths||[]).map((item,index)=><tr key={`analytics-path-${item.path}-${index}`} className="border-b border-slate-800/60"><td className="p-4 font-mono text-cyan-200">{item.path}</td><td className="p-4 text-right text-white">{item.visits}</td><td className="p-4 text-right text-amber-300">{item.botVisits}</td></tr>)}{!analytics.topPaths?.length&&<tr><td colSpan="3" className="p-8 text-center text-slate-500">暂无访问记录</td></tr>}</tbody></table></div></Panel>
              <Panel className="overflow-hidden"><div className="border-b border-slate-800 px-5 py-4"><h2 className="font-bold text-white">蜘蛛类型</h2></div><div className="divide-y divide-slate-800/60">{(analytics.botBreakdown||[]).map((item,index)=><div key={`analytics-bot-${item.name}-${index}`} className="flex items-center justify-between px-5 py-4 text-sm"><span className="flex items-center gap-3 text-slate-300"><Bot className="h-4 w-4 text-amber-300"/>{item.name}</span><span className="font-bold text-white">{Number(item.visits).toLocaleString()}</span></div>)}{!analytics.botBreakdown?.length&&<p className="p-8 text-center text-sm text-slate-500">当前周期未识别到蜘蛛</p>}</div></Panel></div>

              <Panel className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4"><div><h2 className="font-bold text-white">广告点击记录</h2><p className="mt-1 text-xs text-slate-500">第 {analytics.clickPagination?.page||1} / {analytics.clickPagination?.totalPages||1} 页 · 共 {analytics.clickPagination?.total||0} 条</p></div><div className="flex items-center gap-2"><button disabled={(analytics.clickPagination?.page||1)<=1} onClick={()=>setAnalyticsClickPage((analytics.clickPagination?.page||1)-1)} className="rounded border border-slate-700 px-2 py-1 text-xs disabled:opacity-40">上一页</button><button disabled={(analytics.clickPagination?.page||1)>=(analytics.clickPagination?.totalPages||1)} onClick={()=>setAnalyticsClickPage((analytics.clickPagination?.page||1)+1)} className="rounded border border-slate-700 px-2 py-1 text-xs disabled:opacity-40">下一页</button><Badge variant="neutral">首页交易所广告位</Badge></div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-slate-800 text-xs text-slate-500"><th className="p-4">时间</th><th className="p-4">目标域名</th><th className="p-4">来源域名</th><th className="p-4">类型</th></tr></thead><tbody>{(analytics.recentClicks||[]).map((item,index)=><tr key={`analytics-click-${item.id}-${index}`} className="border-b border-slate-800/60"><td className="p-4 text-slate-400">{new Date(item.occurredAt).toLocaleString()}</td><td className="p-4 font-mono text-cyan-200">{item.destinationHost}</td><td className="p-4 text-slate-400">{item.referrerHost||'直接访问/未知'}</td><td className="p-4">{item.isBot?<Badge variant="warning">{item.botName||'疑似蜘蛛'}</Badge>:<Badge variant="success">用户点击</Badge>}</td></tr>)}{!analytics.recentClicks?.length&&<tr><td colSpan="4" className="p-8 text-center text-slate-500">暂无广告点击</td></tr>}</tbody></table></div></Panel>

              <Panel className="overflow-hidden"><div className="border-b border-slate-800 px-5 py-4"><h2 className="font-bold text-white">最近访问记录</h2><div className="flex items-center gap-2"><span className="text-xs text-slate-500">第 {analytics.visitPagination?.page||1} / {analytics.visitPagination?.totalPages||1} 页 · 共 {analytics.visitPagination?.total||0} 条</span><button disabled={(analytics.visitPagination?.page||1)<=1} onClick={()=>setAnalyticsVisitPage((analytics.visitPagination?.page||1)-1)} className="rounded border border-slate-700 px-2 py-1 text-xs disabled:opacity-40">上一页</button><button disabled={(analytics.visitPagination?.page||1)>=(analytics.visitPagination?.totalPages||1)} onClick={()=>setAnalyticsVisitPage((analytics.visitPagination?.page||1)+1)} className="rounded border border-slate-700 px-2 py-1 text-xs disabled:opacity-40">下一页</button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left text-sm"><thead><tr className="border-b border-slate-800 text-xs text-slate-500"><th className="p-4">时间</th><th className="p-4">路径</th><th className="p-4">来源域名</th><th className="p-4">访客类型</th><th className="p-4">User-Agent</th></tr></thead><tbody>{(analytics.recentVisits||[]).map((item,index)=><tr key={`analytics-visit-${item.id}-${index}`} className="border-b border-slate-800/60"><td className="p-4 whitespace-nowrap text-slate-400">{new Date(item.occurredAt).toLocaleString()}</td><td className="p-4 font-mono text-cyan-200">{item.path}</td><td className="p-4 text-slate-400">{item.referrerHost||'直接访问/未知'}</td><td className="p-4">{item.isBot?<Badge variant="warning">{item.botName||'疑似蜘蛛'}</Badge>:<Badge variant="success">用户</Badge>}</td><td className="max-w-sm truncate p-4 text-xs text-slate-500" title={item.userAgent||''}>{item.userAgent||'未提供'}</td></tr>)}{!analytics.recentVisits?.length&&<tr><td colSpan="5" className="p-8 text-center text-slate-500">暂无访问记录</td></tr>}</tbody></table></div></Panel>
            </>}
          </section>
        )}

        {activeTab === 'paymentSettings' && (
          <section className="space-y-6 pb-20 animate-in fade-in duration-300">
            <div className="rounded-3xl border border-amber-400/25 bg-amber-400/10 p-6 text-sm leading-6 text-amber-100">
              <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /><div><p className="font-bold text-amber-200">支付渠道资料仅作接入准备，真实收款保持关闭</p><p className="mt-1 text-amber-100/75">保存商户标识、回调地址和证书序列号后，仍不能创建付费订单、发放许可证或结算创作者收入。只有完成 Payment Intent、签名回调、服务端二次查单、退款和对账验收后，才可单独评估开启付费能力。</p></div></div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Panel className="overflow-hidden border-emerald-400/20 bg-gradient-to-br from-emerald-950/25 to-slate-950/50 p-0">
                <div className="border-b border-emerald-400/15 px-6 py-5"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/15"><Wallet className="h-5 w-5 text-emerald-300" /></span><div><h2 className="font-bold text-white">微信支付</h2><p className="mt-1 text-xs text-slate-500">商户信息、通知地址与证书标识</p></div></div><Badge variant={settings.wechatPaySetupEnabled ? 'success' : 'neutral'}>{settings.wechatPaySetupEnabled ? '接入资料已启用' : '尚未启用'}</Badge></div></div>
                <div className="space-y-5 p-6">
                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-700/80 bg-slate-950/55 px-4 py-3"><span><span className="block text-sm font-semibold text-white">保存为待接入渠道</span><span className="mt-1 block text-xs text-slate-500">该开关不等同于真实收款开关。</span></span><input type="checkbox" checked={settings.wechatPaySetupEnabled === true} onChange={event => setSettings({ ...settings, wechatPaySetupEnabled: event.target.checked })} className="h-4 w-4 accent-emerald-400" /></label>
                  <div className="grid gap-4 md:grid-cols-2"><Field label="商户号" required={settings.wechatPaySetupEnabled}><input maxLength={64} value={settings.wechatPayMchId || ''} onChange={event => setSettings({ ...settings, wechatPayMchId: event.target.value })} placeholder="微信支付商户号" /></Field><Field label="应用 AppID" required={settings.wechatPaySetupEnabled}><input maxLength={64} value={settings.wechatPayAppId || ''} onChange={event => setSettings({ ...settings, wechatPayAppId: event.target.value })} placeholder="例如 wx1234567890abcdef" /></Field></div>
                  <Field label="支付结果通知地址" required={settings.wechatPaySetupEnabled}><input type="url" maxLength={500} value={settings.wechatPayNotifyUrl || ''} onChange={event => setSettings({ ...settings, wechatPayNotifyUrl: event.target.value })} placeholder="https://你的域名/api/payments/webhooks/wechat-pay" /></Field>
                  <Field label="平台证书序列号"><input maxLength={128} value={settings.wechatPayCertificateSerial || ''} onChange={event => setSettings({ ...settings, wechatPayCertificateSerial: event.target.value })} placeholder="从微信支付商户平台复制的证书序列号" /></Field>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/65 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="h-4 w-4 text-cyan-300" />服务器密钥状态</p><div className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><span className={settings.wechatPayApiV3KeyConfigured ? 'text-emerald-300' : 'text-amber-300'}>{settings.wechatPayApiV3KeyConfigured ? '✓ API v3 Key 已配置' : '○ API v3 Key 未配置'}</span><span className={settings.wechatPayMerchantPrivateKeyConfigured ? 'text-emerald-300' : 'text-amber-300'}>{settings.wechatPayMerchantPrivateKeyConfigured ? '✓ 商户私钥已配置' : '○ 商户私钥未配置'}</span><span className={settings.wechatPayPlatformCertificateConfigured ? 'text-emerald-300' : 'text-amber-300'}>{settings.wechatPayPlatformCertificateConfigured ? '✓ 平台证书已配置' : '○ 平台证书未配置'}</span></div><p className="mt-3 text-xs leading-5 text-slate-500">敏感值只允许通过服务器 Secret 配置，管理界面永不读取或展示原文。</p></div>
                </div>
              </Panel>

              <Panel className="overflow-hidden border-sky-400/20 bg-gradient-to-br from-sky-950/25 to-slate-950/50 p-0">
                <div className="border-b border-sky-400/15 px-6 py-5"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400/15"><CreditCard className="h-5 w-5 text-sky-300" /></span><div><h2 className="font-bold text-white">支付宝</h2><p className="mt-1 text-xs text-slate-500">应用信息、签约主体与异步通知</p></div></div><Badge variant={settings.alipaySetupEnabled ? 'success' : 'neutral'}>{settings.alipaySetupEnabled ? '接入资料已启用' : '尚未启用'}</Badge></div></div>
                <div className="space-y-5 p-6">
                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-700/80 bg-slate-950/55 px-4 py-3"><span><span className="block text-sm font-semibold text-white">保存为待接入渠道</span><span className="mt-1 block text-xs text-slate-500">该开关不等同于真实收款开关。</span></span><input type="checkbox" checked={settings.alipaySetupEnabled === true} onChange={event => setSettings({ ...settings, alipaySetupEnabled: event.target.checked })} className="h-4 w-4 accent-sky-400" /></label>
                  <div className="grid gap-4 md:grid-cols-2"><Field label="应用 AppID" required={settings.alipaySetupEnabled}><input maxLength={64} value={settings.alipayAppId || ''} onChange={event => setSettings({ ...settings, alipayAppId: event.target.value })} placeholder="支付宝开放平台 AppID" /></Field><Field label="签约主体 / Seller ID"><input maxLength={128} value={settings.alipaySellerId || ''} onChange={event => setSettings({ ...settings, alipaySellerId: event.target.value })} placeholder="企业或签约主体标识" /></Field></div>
                  <Field label="支付结果通知地址" required={settings.alipaySetupEnabled}><input type="url" maxLength={500} value={settings.alipayNotifyUrl || ''} onChange={event => setSettings({ ...settings, alipayNotifyUrl: event.target.value })} placeholder="https://你的域名/api/payments/webhooks/alipay" /></Field>
                  <Field label="网关地址"><input type="url" maxLength={500} value={settings.alipayGateway || ''} onChange={event => setSettings({ ...settings, alipayGateway: event.target.value })} placeholder="https://openapi.alipay.com/gateway.do" /></Field>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/65 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="h-4 w-4 text-cyan-300" />服务器密钥状态</p><div className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><span className={settings.alipayAppPrivateKeyConfigured ? 'text-emerald-300' : 'text-amber-300'}>{settings.alipayAppPrivateKeyConfigured ? '✓ 应用私钥已配置' : '○ 应用私钥未配置'}</span><span className={settings.alipayPublicKeyConfigured ? 'text-emerald-300' : 'text-amber-300'}>{settings.alipayPublicKeyConfigured ? '✓ 支付宝公钥已配置' : '○ 支付宝公钥未配置'}</span></div><p className="mt-3 text-xs leading-5 text-slate-500">敏感值只允许通过服务器 Secret 配置，管理界面永不读取或展示原文。</p></div>
                </div>
              </Panel>
            </div>

            <Panel className="p-6"><h2 className="flex items-center gap-2 font-bold text-white"><Key className="h-5 w-5 text-cyan-300" />服务器 Secret 配置清单</h2><p className="mt-2 text-sm leading-6 text-slate-500">在服务器的 `/etc/nexus-quant/nexus.env`（或使用的 Secret 管理器）写入以下变量，然后重启 `nexus-quant` 服务。不要把私钥、API v3 Key 或公钥粘贴到后台、Git、聊天记录或浏览器表单。</p><div className="mt-4 grid gap-3 font-mono text-xs text-cyan-200 md:grid-cols-2"><code className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">WECHAT_PAY_API_V3_KEY</code><code className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">WECHAT_PAY_MERCHANT_PRIVATE_KEY</code><code className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">WECHAT_PAY_PLATFORM_CERTIFICATE</code><code className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">ALIPAY_APP_PRIVATE_KEY</code><code className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">ALIPAY_PUBLIC_KEY</code></div></Panel>
          </section>
        )}

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-20 animate-in fade-in duration-300">
             <div className="md:col-span-2 bg-gradient-to-br from-purple-900/20 to-zinc-900/50 border border-purple-500/20 rounded-3xl p-8 space-y-4 shadow-xl">
                <h2 className="text-lg font-bold text-white flex items-center gap-2"><Hash className="text-purple-400" /> 论坛与社区导航配置</h2>
                <input type="text" name="forumCategories" value={settings.forumCategories || ''} onChange={(e) => setSettings({...settings, forumCategories: e.target.value})} placeholder="例如：XAUUSD 策略,MQL5 开发,官方公告" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-cyan-500 focus:outline-none transition-colors" />
             </div>

             <div className="md:col-span-2 rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 to-zinc-900/60 p-8 shadow-xl">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                  <div><h2 className="text-lg font-bold text-white">{lang === 'zh' ? '首页交易所广告位' : 'Homepage exchange advertisement'}</h2><p className="mt-1 text-sm text-zinc-500">{lang === 'zh' ? '配置赞助标识、标题、说明、按钮和跳转链接；保存后在首页策略区上方展示。' : 'Set the sponsored label, title, description, button, and destination. It appears above the strategy section.'}</p></div>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-semibold text-white"><input type="checkbox" checked={settings.exchangeAdEnabled === true || settings.exchangeAdEnabled === 'true'} onChange={event => setSettings({ ...settings, exchangeAdEnabled: event.target.checked })} className="h-4 w-4 accent-cyan-400" />{lang === 'zh' ? '启用广告位' : 'Enable ad slot'}</label>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <input type="text" maxLength={100} value={settings.exchangeAdTitle || ''} onChange={event => setSettings({ ...settings, exchangeAdTitle: event.target.value })} placeholder={lang === 'zh' ? '广告标题，例如：连接全球市场' : 'Ad title, e.g. Access global markets'} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white" />
                  <input type="text" maxLength={40} value={settings.exchangeAdCta || ''} onChange={event => setSettings({ ...settings, exchangeAdCta: event.target.value })} placeholder={lang === 'zh' ? '按钮文字，例如：了解更多' : 'Button label, e.g. Learn more'} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white" />
                  <textarea maxLength={300} rows={3} value={settings.exchangeAdDescription || ''} onChange={event => setSettings({ ...settings, exchangeAdDescription: event.target.value })} placeholder={lang === 'zh' ? '广告说明（最多 300 字）' : 'Ad description (up to 300 characters)'} className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white md:col-span-2" />
                  <input type="url" maxLength={500} value={settings.exchangeAdUrl || ''} onChange={event => setSettings({ ...settings, exchangeAdUrl: event.target.value })} placeholder="https://exchange.example/" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-cyan-200 md:col-span-2" />
                </div>
                <p className="mt-3 text-xs leading-5 text-zinc-500">{lang === 'zh' ? '广告默认关闭；只接受 HTTP/HTTPS 跳转，链接将在新标签打开。启用时至少填写标题和说明。' : 'The ad is disabled by default. Only HTTP/HTTPS links are allowed and open in a new tab. Add a title and description before enabling.'}</p>
             </div>

             <div className="md:col-span-2 rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-950/30 to-zinc-900/60 p-8 shadow-xl">
                <div className="mb-5"><h2 className="text-lg font-bold text-white">首页顶部精选 EA</h2><p className="mt-1 text-sm text-zinc-500">管理员可指定最多三款已上架策略。首页顶部会自动轮动展示；未提供报告的策略也能精选，但会明确显示“未提供验证资料”。</p></div>
                <div className="grid gap-4 md:grid-cols-3">{[0,1,2].map(slot=>{const selected=Number(settings.featuredProductIds?.[slot]||0);return <label key={`featured-slot-${slot}`} className="block"><span className="mb-2 block text-xs font-bold text-slate-400">精选位 {slot+1}</span><select value={selected||''} onChange={event=>{const value=Number(event.target.value||0);const next=[...(settings.featuredProductIds||[])];if(value)next[slot]=value;else next.splice(slot,1);setSettings({...settings,featuredProductIds:[...new Set(next.filter(Boolean))].slice(0,3)});}} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white"><option value="">不配置</option>{productList.filter(product=>product.status==='active'&&product.deleted_at==null).map(product=><option key={`featured-product-${product.id}`} value={product.id} disabled={product.id!==selected&&settings.featuredProductIds?.includes(product.id)}>{product.title} · ${product.price||0}</option>)}</select></label>})}</div>
                <p className="mt-4 text-xs leading-5 text-zinc-500">留空时首页只会回退展示已通过 MT5 报告验证的策略；配置后严格按这里的顺序轮播，已下架或删除的策略会自动跳过。</p>
             </div>

             <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 space-y-5 shadow-xl">
                <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Mail className="text-emerald-400" /> 基础与邮件网关</h2>
                <input type="text" value={settings.siteName} onChange={(e) => setSettings({...settings, siteName: e.target.value})} placeholder="网站名称" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white" />
                <input type="text" value={settings.contactEmail} onChange={(e) => setSettings({...settings, contactEmail: e.target.value})} placeholder="联系邮箱" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white" />
                <input type="text" value={settings.smtpHost} onChange={(e) => setSettings({...settings, smtpHost: e.target.value})} placeholder="SMTP 主机" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white" />
                <input type="text" value={settings.smtpUser} onChange={(e) => setSettings({...settings, smtpUser: e.target.value})} placeholder="SMTP 账号" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white" />
                <input type="password" value={settings.smtpPass} onChange={(e) => setSettings({...settings, smtpPass: e.target.value})} placeholder="SMTP 密码" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white" />
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 space-y-5 shadow-xl">
                <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Wallet className="text-amber-400" /> 虚拟币收款钱包</h2>
                <input type="text" value={settings.usdtAddress} onChange={(e) => setSettings({...settings, usdtAddress: e.target.value})} placeholder="USDT TRC20" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-emerald-400 font-mono" />
                <input type="text" value={settings.btcAddress} onChange={(e) => setSettings({...settings, btcAddress: e.target.value})} placeholder="BTC Address" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-amber-400 font-mono" />
                <input type="text" value={settings.ethAddress} onChange={(e) => setSettings({...settings, ethAddress: e.target.value})} placeholder="ETH Address" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-blue-400 font-mono" />
              </div>
          </div>
        )}

        {currentCommunitySection && (
          <section className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/20 to-zinc-900/60 p-6 shadow-xl md:p-8">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 text-lg font-bold text-white"><CommunitySectionIcon className="h-5 w-5 text-emerald-300" />{currentCommunitySection.title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{currentCommunitySection.key === 'news' ? '编辑社区重要新闻，包括双语标题、摘要、日期与来源链接。内容由管理员人工维护。' : currentCommunitySection.key === 'documents' ? '管理社区“文档”栏目中的参考资料与官方链接。仅接受 HTTP/HTTPS 地址。' : '维护策略库中的研究类型与说明；内容仅用于教育和研究，不构成投资建议。'}</p></div><span className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">{settings.communityContent?.[currentCommunitySection.key]?.length || 0} / {currentCommunitySection.max}</span></div>
            <div className="mb-4 flex justify-end"><button type="button" disabled={(settings.communityContent?.[currentCommunitySection.key]?.length || 0) >= currentCommunitySection.max} onClick={() => addCommunityItem(currentCommunitySection.key)} className="rounded-lg border border-cyan-500/30 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40">添加内容</button></div>
            <div className="space-y-4">{(settings.communityContent?.[currentCommunitySection.key] || []).map((item, index) => <article key={`community-${currentCommunitySection.key}-${index}`} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-zinc-500">{currentCommunitySection.title} #{index + 1}</span><button type="button" onClick={() => removeCommunityItem(currentCommunitySection.key, index)} className="rounded-md px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10">删除</button></div><div className="grid gap-3 md:grid-cols-2">{currentCommunitySection.fields.map(([field, label, maxLength, multiline]) => <label key={`community-field-${currentCommunitySection.key}-${index}-${field}`} className="block text-xs text-zinc-500">{label}{multiline ? <textarea rows={3} maxLength={maxLength} value={item[field] || ''} onChange={event => updateCommunityItem(currentCommunitySection.key, index, field, event.target.value)} className="mt-1 w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white" /> : <input type={field === 'date' ? 'date' : field === 'url' ? 'url' : 'text'} maxLength={maxLength} value={item[field] || ''} onChange={event => updateCommunityItem(currentCommunitySection.key, index, field, event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white" />}</label>)}</div></article>)}</div>
            {(settings.communityContent?.[currentCommunitySection.key]?.length || 0) === 0 && <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">当前没有内容，可点击“添加内容”新建。</p>}
          </section>
        )}

        {activeTab === 'users' && (
           <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in duration-300">
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead><tr className="bg-zinc-950/50 text-xs uppercase tracking-widest text-zinc-500 border-b border-zinc-800"><th className="p-5">用户标识</th><th className="p-5">账户余额</th><th className="p-5">系统权限与头衔</th><th className="p-5 text-right">超管操作</th></tr></thead>
                  <tbody className="text-sm">
                    {userList.map((u, index) => {
                      const badge = getUserTitle(u.post_count || 0, u.ea_count || 0, u.role);
                      return (
                      <tr key={`user-${u.id}-${index}`} className="border-b border-zinc-800/40 hover:bg-zinc-800/40 transition-colors group">
                        <td className="p-5">
                          <div className="flex items-center gap-3">
                            {u.avatar_url ? <Image src={u.avatar_url} width={40} height={40} alt={`${u.username} avatar`} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-cyan-400 font-black">{u.username.charAt(0).toUpperCase()}</div>}
                            <div><div className="font-bold text-white">{u.username}</div><div className="text-xs text-zinc-500">{u.email}</div></div>
                          </div>
                        </td>
                        <td className="p-5">
                          <div className="font-black text-emerald-400 text-lg">${u.balance || 0}</div>
                          <button onClick={() => setBalanceModal({ isOpen: true, userId: u.id, username: u.username, balance: u.balance || 0 })} className="text-xs text-zinc-500 hover:text-cyan-400 mt-1">💳 修改余额</button>
                        </td>
                        <td className="p-5 space-y-2">
                          <select value={u.role} onChange={(e) => handleChangeRole(u.id, e.target.value)} disabled={u.id === 1} className="bg-zinc-950 border border-zinc-700 text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer">
                             <option value="user">👤 普通用户</option>
                            <option value="developer">💻 开发者</option>
                            <option value="admin">👑 超级管理员</option>
                          </select>
                          <br/><span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}>{badge.title}</span>
                        </td>
                        <td className="p-5 text-right opacity-50 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setPwdModal({ isOpen: true, userId: u.id, username: u.username, newPwd: '' })} className="px-3 py-2 bg-zinc-800 hover:bg-cyan-600 text-zinc-300 rounded-lg text-xs font-bold mr-2"><Key className="w-3.5 h-3.5 inline" /> 改密</button>
                          <button onClick={() => handleDeleteUser(u.id, u.username)} disabled={u.id === 1} className="px-3 py-2 bg-zinc-800 hover:bg-red-600 text-zinc-300 rounded-lg text-xs font-bold disabled:opacity-30"><Trash2 className="w-3.5 h-3.5 inline" /> 删除</button>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
           </div>
        )}

        {activeTab === 'products' && <ProductReviewWorkspace
          lang={lang}
          products={productList}
          onProductStatus={handleApproveEA}
          onDelete={handleDeleteEA}
          onEvidenceReview={handleEvidenceReview}
          onVerification={handleVerification}
          onRevokeVerification={handleRevokeVerification}
          onVersionReview={handleVersionReview}
        />}
        {activeTab==='licenses'&&<div className="overflow-x-auto rounded-3xl border border-zinc-800 bg-zinc-900/50"><table className="min-w-[760px] w-full text-left text-sm"><thead><tr className="border-b border-zinc-800 bg-zinc-950/50 text-xs text-zinc-500"><th className="p-4">授权</th><th className="p-4">产品</th><th className="p-4">状态/到期</th><th className="p-4">绑定</th><th className="p-4 text-right">操作</th></tr></thead><tbody>{licenses.map((license, index)=><tr key={`license-${license.id}-${index}`} className="border-b border-zinc-800/50"><td className="p-4">#{license.id} · {license.type}<div className="text-[10px] text-zinc-600">user_id {license.userId}</div></td><td className="p-4 text-white">{license.productTitle}</td><td className="p-4"><span className={license.status==='active'?'text-emerald-400':'text-red-400'}>{license.status}</span><div className="text-[10px] text-zinc-600">{license.expiresAt?new Date(license.expiresAt).toLocaleString():'永久'}</div></td><td className="p-4 text-[10px] text-zinc-500">{license.bindings.map(binding=>`${binding.type}:${binding.mask}`).join(' · ')||'未绑定'}</td><td className="p-4 text-right">{license.status==='active'&&<button onClick={()=>handleRevokeLicense(license)} className="rounded bg-red-900/50 px-3 py-2 text-xs text-red-300">撤销</button>}</td></tr>)}</tbody></table></div>}
        {activeTab==='reports'&&<div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/50"><div className="border-b border-zinc-800 p-5 text-xs text-zinc-500">确认违规会隐藏对应策略、帖子或评论；前台举报不会直接删除内容。</div><table className="w-full text-left text-sm"><thead><tr className="border-b border-zinc-800 bg-zinc-950/50 text-xs text-zinc-500"><th className="p-4">目标</th><th className="p-4">原因</th><th className="p-4">身份</th><th className="p-4">提交时间</th><th className="p-4 text-right">处置</th></tr></thead><tbody>{reports.length===0?<tr><td colSpan="5" className="p-10 text-center text-zinc-500">暂无待处理举报</td></tr>:reports.map((report, index)=><tr key={`report-${report.id}-${index}`} className="border-b border-zinc-800/50"><td className="p-4"><span className="font-bold uppercase text-amber-300">{report.targetType} #{report.targetId}</span><div className="mt-1 max-w-sm truncate text-zinc-400">{report.targetLabel}</div></td><td className="p-4"><span className="font-bold text-white">{report.reason}</span><div className="mt-1 max-w-sm whitespace-pre-wrap text-xs text-zinc-500">{report.details||'无补充说明'}</div></td><td className="p-4 text-xs text-zinc-500">举报 user_id {report.reporterUserId}<br/>作者 user_id {report.targetOwnerUserId}</td><td className="p-4 text-xs text-zinc-500">{new Date(report.createdAt).toLocaleString()}</td><td className="p-4 text-right space-x-2"><button onClick={()=>handleReportResolution(report,'dismiss')} className="rounded bg-zinc-800 px-3 py-2 text-xs text-zinc-300">驳回</button><button onClick={()=>handleReportResolution(report,'confirm')} className="rounded bg-red-900/60 px-3 py-2 text-xs font-bold text-red-300">确认违规并隐藏</button></td></tr>)}</tbody></table></div>}

        {/* 财务订单：付费结算在可信支付核验接入前保持关闭 */}
        {activeTab === 'orders' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-300">
              付费购买和人工确认到账已关闭。当前只能查看历史订单或驳回待处理订单，不能发放付费资产或结算创作者余额。
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-emerald-900/40 to-zinc-950 border border-emerald-500/20 p-8 rounded-3xl shadow-xl">
                <div className="flex items-center gap-3 mb-2 text-emerald-400"><BadgeDollarSign className="w-5 h-5"/> <span className="font-bold">已入账总流水 (USD)</span></div>
                <div className="text-4xl font-black text-white">
                  ${orderList.filter(o => o.status === 'completed' && (Number(o.price) === 0 || o.payment_verified === 1)).reduce((sum, o) => sum + (Number(o.price) || 0), 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-gradient-to-br from-cyan-900/40 to-zinc-950 border border-cyan-500/20 p-8 rounded-3xl shadow-xl">
                <div className="flex items-center gap-3 mb-2 text-cyan-400"><CreditCard className="w-5 h-5"/> <span className="font-bold">订单总笔数</span></div>
                <div className="text-4xl font-black text-white">{orderList.length} <span className="text-base text-zinc-500 font-normal">笔</span></div>
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead>
                    <tr className="bg-zinc-950/50 text-xs uppercase tracking-widest text-zinc-500 border-b border-zinc-800">
                      <th className="p-5 font-bold">订单单号</th>
                      <th className="p-5 font-bold">买家</th>
                      <th className="p-5 font-bold">策略名</th>
                      <th className="p-5 font-bold">原作者</th>
                      <th className="p-5 font-bold">成交金额</th>
                      <th className="p-5 font-bold">交易哈希 (TXID)</th>
                      <th className="p-5 font-bold">当前状态</th>
                      <th className="p-5 font-bold text-right">财务审核</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {orderList.length === 0 ? (
                      <tr><td colSpan="8" className="p-10 text-center text-zinc-500">暂无任何交易订单</td></tr>
                    ) : orderList.map((o, index) => (
                      <tr key={`order-${o.order_id}-${index}`} className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors">
                        <td className="p-5 font-mono text-xs text-zinc-500">TXN-{o.order_id.toString().padStart(6, '0')}</td>
                        <td className="p-5 font-bold text-white flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-cyan-900 text-cyan-400 flex items-center justify-center text-[10px]">{o.buyer ? o.buyer.charAt(0).toUpperCase() : '?'}</div> 
                          {o.buyer}
                        </td>
                        <td className="p-5 text-cyan-400 font-bold">{o.title || '已删除策略'}</td>
                        <td className="p-5 text-zinc-400">{o.author || '-'}</td>
                        <td className="p-5 font-black">{o.price === 0 ? <span className="text-zinc-500">免费领取</span> : <span className="text-emerald-400">${o.price}</span>}</td>
                        <td className="p-5 font-mono text-xs text-zinc-400 max-w-[150px] truncate" title={o.tx_hash}>{o.tx_hash || '-'}</td>
                        <td className="p-5">
                          {o.status === 'completed' && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✅ 已确认</span>}
                          {o.status === 'pending' && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">⏳ 待核对</span>}
                          {o.status === 'rejected' && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">❌ 已驳回</span>}
                        </td>
                        <td className="p-5 text-right space-x-2">
                          {o.status === 'pending' ? (
                            <>
                              <button onClick={() => handleOrderAction(o.order_id, 'reject')} className="px-3 py-1.5 bg-zinc-800 hover:bg-red-600 text-zinc-300 hover:text-white rounded text-xs font-bold transition-colors">驳回</button>
                            </>
                          ) : (
                            <span className="text-xs text-zinc-600">已归档</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'withdrawals' && (
           <div className="overflow-x-auto rounded-3xl border border-zinc-800 bg-zinc-900/50 shadow-2xl animate-in fade-in duration-300">
              <table className="min-w-[760px] w-full text-left whitespace-nowrap">
                <thead><tr className="bg-zinc-950/50 text-xs text-zinc-500 border-b border-zinc-800"><th className="p-5">申请人</th><th className="p-5">提现金额</th><th className="p-5">收款地址(USDT等)</th><th className="p-5">状态</th><th className="p-5 text-right">财务操作</th></tr></thead>
                <tbody className="text-sm">
                  {withdrawals.length === 0 ? <tr><td colSpan="5" className="p-10 text-center text-zinc-500">暂无提现申请</td></tr> : withdrawals.map((w, index) => (
                    <tr key={`withdrawal-${w.id}-${index}`} className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors">
                      <td className="p-5 font-bold text-white">{w.username}</td>
                      <td className="p-5 font-black text-rose-400">${w.amount}</td>
                      <td className="p-5 font-mono text-xs text-zinc-500">{w.crypto_address}</td>
                      <td className="p-5">{w.status === 'pending' ? <span className="text-amber-400">⏳ 处理中</span> : w.status === 'completed' ? <span className="text-emerald-400">✅ 已打款</span> : <span className="text-red-400">❌ 已驳回</span>}</td>
                      <td className="p-5 text-right space-x-2">
                        {w.status === 'pending' && (
                          <>
                            <button onClick={() => handleWithdrawAction(w.id, 'completed')} className="px-3 py-1.5 bg-emerald-600 text-white rounded font-bold">已打款</button>
                            <button onClick={() => handleWithdrawAction(w.id, 'rejected')} className="px-3 py-1.5 bg-red-600 text-white rounded font-bold">驳回(退钱)</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
        )}

        {status && <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-zinc-800 text-white border border-zinc-700 px-6 py-3 rounded-full shadow-2xl text-sm font-bold z-50 animate-bounce flex items-center gap-2"><CheckCircle className="w-4 h-4 text-cyan-400" />{status}</div>}
        </div></main>
      </div>

      <Dialog open={balanceModal.isOpen} onClose={() => setBalanceModal({ ...balanceModal, isOpen: false })} title="调控用户余额" description={`修改 ${balanceModal.username || '用户'} 的底层金额；操作会写入账本和审计。`} footer={<><Button onClick={() => setBalanceModal({ ...balanceModal, isOpen: false })}>取消</Button><Button variant="primary" onClick={submitUpdateBalance}>确认调整</Button></>}><Field label="余额（USD）" required><input type="number" inputMode="decimal" value={balanceModal.balance} onChange={event => setBalanceModal({ ...balanceModal, balance: event.target.value })} /></Field></Dialog>

      <Dialog open={pwdModal.isOpen} onClose={() => setPwdModal({ ...pwdModal, isOpen: false, newPwd: '' })} title="强制修改密码" description={`为 ${pwdModal.username || '用户'} 设置新密码；现有会话会按服务端策略失效。`} footer={<><Button onClick={() => setPwdModal({ ...pwdModal, isOpen: false, newPwd: '' })}>取消</Button><Button variant="primary" onClick={submitResetPwd}>确认修改</Button></>}><Field label="新密码" required><input type="password" autoComplete="new-password" value={pwdModal.newPwd} onChange={event => setPwdModal({ ...pwdModal, newPwd: event.target.value })} /></Field></Dialog>
    </div></AdminLocale>
  );
}
