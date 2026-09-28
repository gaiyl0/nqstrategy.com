"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Wallet, Mail, Save, ShieldCheck, Users, Box, Search, CheckCircle, XCircle, Globe, Crown, Key, Trash2, BadgeDollarSign, CreditCard, Hash, HandCoins } from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState('settings'); 
  // 完整补齐所有设置字段，修复界面残缺
  const [settings, setSettings] = useState({ 
    siteName: '', primaryColor: '#22d3ee', contactEmail: '', 
    usdtAddress: '', btcAddress: '', ethAddress: '', 
    smtpHost: '', smtpUser: '', smtpPass: '',
    broker1Name: '', broker1Desc: '', broker1Link: '', 
    broker2Name: '', broker2Desc: '', broker2Link: '', 
    broker3Name: '', broker3Desc: '', broker3Link: '', 
    forumCategories: 'XAUUSD 策略,MQL5 开发,AI 与深度学习,官方公告' 
  });
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [userList, setUserList] = useState([]);
  const [productList, setProductList] = useState([]);
  const [orderList, setOrderList] = useState([]); 
  const [withdrawals, setWithdrawals] = useState([]);
  const [licenses,setLicenses]=useState([]);
  
  const [pwdModal, setPwdModal] = useState({ isOpen: false, userId: null, username: '', newPwd: '' });
  const [balanceModal, setBalanceModal] = useState({ isOpen: false, userId: null, username: '', balance: 0 });

  const fetchUsers = () => fetch(`/api/users?t=${Date.now()}`, { cache: 'no-store' }).then(res => res.json()).then(data => { if (data.success) setUserList(data.users); });
  const fetchProducts = () => fetch(`/api/products?role=admin&t=${Date.now()}`, { cache: 'no-store' }).then(res => res.json()).then(data => { if (data.success) setProductList(data.products); });
  const fetchOrders = () => fetch(`/api/orders?role=admin&t=${Date.now()}`, { cache: 'no-store' }).then(res => res.json()).then(data => { if(data.success) setOrderList(data.orders); }); 
  const fetchWithdrawals = () => fetch(`/api/withdraw?t=${Date.now()}`, { cache: 'no-store' }).then(res => res.json()).then(data => { if(data.success) setWithdrawals(data.withdrawals); });
  const fetchLicenses=()=>fetch('/api/licenses?scope=admin',{cache:'no-store'}).then(response=>response.json()).then(data=>{if(data.success)setLicenses(data.licenses);});

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const authResponse = await fetch('/api/auth/me', { cache: 'no-store' });
        const authData = await authResponse.json();
        if (!authData.success || authData.user?.role !== 'admin') {
          router.replace('/');
          return;
        }
        setAuthChecked(true);
        fetch(`/api/settings?t=${Date.now()}`, { cache: 'no-store' }).then(res => res.json()).then(data => setSettings(prev => ({ ...prev, ...data })));
        fetchUsers();
      } catch {
        router.replace('/');
      }
    };
    bootstrap();
  }, []);

  useEffect(() => { 
    if (!authChecked) return;
    if (activeTab === 'products') fetchProducts(); 
    if (activeTab === 'orders') fetchOrders(); 
    if (activeTab === 'withdrawals') fetchWithdrawals(); 
    if (activeTab === 'licenses') fetchLicenses();
  }, [activeTab, authChecked]);

  const showStatus = (msg) => { setStatus(msg); setTimeout(() => setStatus(''), 3000); };
  const handleSave = async () => { setIsSaving(true); await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) }); showStatus('✅ 所有配置已永久保存生效！'); setIsSaving(false); };

  const handleApproveEA = async (id, newStatus) => {
    const response = await fetch('/api/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: newStatus }) });
    const data = await response.json();
    if (!response.ok || !data.success) return showStatus(`❌ ${data.message || '策略状态更新失败'}`);
    fetchProducts(); showStatus('✅ 策略状态已更新');
  };
  const handleEvidenceReview = async (item, statusAction, report = null) => {
    const rejectionReason = statusAction === 'rejected' ? (window.prompt('请输入拒绝原因') || '') : '';
    if (statusAction === 'rejected' && !rejectionReason) return;
    let correctedExtraction;
    if (statusAction === 'approved' && item.type === 'statistics' && !item.extraction && !report) {
      const entered = window.prompt('OCR 未提取到统计数据。请粘贴校正 JSON，例如 {"initialDeposit":1000,"netProfit":100,"profitFactor":1.5,"maxDrawdownPercent":10,"winRatePercent":55,"totalTrades":100}');
      if (!entered) return;
      try { correctedExtraction = JSON.parse(entered); } catch { return showStatus('❌ 校正数据必须是合法 JSON'); }
    }
    const response = await fetch('/api/evidence', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, status: statusAction, rejectionReason, ...(correctedExtraction ? { correctedExtraction } : {}) }) });
    const data = await response.json();
    if (!response.ok || !data.success) return showStatus(`❌ ${data.message || '证据审核失败'}`);
    fetchProducts(); showStatus('✅ 证据审核状态已更新');
  };
  const handleVerification = async (product) => {
    const level = window.prompt('输入认证等级：reproducible_backtest / platform_rerun / live_verified');
    if (!level) return;
    const examples = {
      reproducible_backtest: '{"parameterFileSha256":"64位SHA256","dataset":"数据集名称","terminalBuild":"MT5 build","testRange":"2026-01-01 至 2026-09-22"}',
      platform_rerun: '{"parameterFileSha256":"64位SHA256","dataset":"数据集名称","terminalBuild":"MT5 build","testRange":"区间","runId":"NEXUS-RUN-编号","resultSha256":"64位SHA256","environment":"复跑环境","rerunAt":"2026-09-27T00:00:00.000Z"}',
      live_verified: '{"provider":"提供方","accountMasked":"****1234","accessMode":"read_only","observedDays":30,"lastCheckedDate":"2026-09-27","maxDrawdownPercent":10}',
    };
    if (!examples[level]) return showStatus('❌ 认证等级不合法');
    const entered = window.prompt(`粘贴认证证据 JSON：\n${examples[level]}`); if (!entered) return;
    let evidence; try { evidence=JSON.parse(entered); } catch { return showStatus('❌ 证据必须是合法 JSON'); }
    const response=await fetch('/api/verifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'approve',productId:product.id,level,evidence})}); const data=await response.json();
    if(!response.ok||!data.success)return showStatus(`❌ ${data.message||'认证失败'}`); fetchProducts();showStatus('✅ 认证等级已更新');
  };
  const handleRevokeVerification=async(product)=>{const reason=window.prompt('请输入撤销认证原因（至少 5 个字符）');if(!reason)return;const response=await fetch('/api/verifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'revoke',productId:product.id,reason})});const data=await response.json();if(!response.ok||!data.success)return showStatus(`❌ ${data.message||'撤销失败'}`);fetchProducts();showStatus('✅ 认证已撤销');};
  const handleVersionReview=async(version,decision)=>{const needsReason=['reject','retire'].includes(decision);const reason=needsReason?(window.prompt(`请输入版本${decision==='retire'?'下架':'拒绝'}原因（至少 5 个字符）`)||''):'';if(needsReason&&!reason)return;const response=await fetch('/api/versions',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:version.id,decision,...(reason?{reason}:{})})});const data=await response.json();if(!response.ok||!data.success)return showStatus(`❌ ${data.message||'版本审核失败'}`);fetchProducts();showStatus(data.replayed?'ℹ️ 该版本已经处理':'✅ 版本审核完成');};
  const handleRevokeLicense=async(license)=>{const reason=window.prompt('请输入授权撤销原因（至少 5 个字符）');if(!reason)return;const response=await fetch('/api/licenses',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({licenseId:license.id,reason})});const data=await response.json();if(!response.ok||!data.success)return showStatus(`❌ ${data.message||'授权撤销失败'}`);fetchLicenses();showStatus(data.replayed?'ℹ️ 授权已撤销':'✅ 授权已撤销，现有令牌失效');};
  const handleDeleteEA = async (id, title) => { if (!window.confirm(`确定彻底删除策略 [${title}] 吗？`)) return; const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' }); const data = await res.json(); if (data.success) { showStatus('🗑️ 已彻底删除'); fetchProducts(); } };

  const submitResetPwd = async () => { if (!pwdModal.newPwd) return showStatus('❌ 密码不能为空'); await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pwdModal.userId, newPassword: pwdModal.newPwd }) }); setPwdModal({ isOpen: false, userId: null, username: '', newPwd: '' }); showStatus('✅ 密码重置成功！'); };
  
  const submitUpdateBalance = async () => {
    const response = await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `admin-balance:${balanceModal.userId}:${crypto.randomUUID()}` }, body: JSON.stringify({ id: balanceModal.userId, manualBalance: Number(balanceModal.balance) }) });
    const data = await response.json();
    if (!response.ok || !data.success) return showStatus(`❌ ${data.message || '余额修改失败'}`);
    setBalanceModal({ isOpen: false }); fetchUsers(); showStatus(data.replayed ? 'ℹ️ 余额操作已处理' : '💰 余额修改成功并已记录账本！');
  };

  const handleChangeRole = async (id, newRole) => { if (!window.confirm(`确定调整此用户权限吗？`)) return; await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, newRole }) }); fetchUsers(); showStatus('👑 用户权限已更新'); };
  const handleDeleteUser = async (id, username) => { if (!window.confirm(`确定永久删除用户 [${username}] 吗？`)) return; await fetch(`/api/users?id=${id}`, { method: 'DELETE' }); fetchUsers(); showStatus('🗑️ 用户已删除'); };

  const handleWithdrawAction = async (id, statusAction) => {
    if (!window.confirm(`确定要 ${statusAction === 'completed' ? '批准打款' : '驳回并退回余额'} 吗？`)) return;
    const response = await fetch('/api/withdraw', {
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
    if (!window.confirm('确定驳回此无效订单吗？')) return;
    try {
      const res = await fetch('/api/orders', {
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 p-6 md:p-12 relative">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-8 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-white flex items-center gap-3"><ShieldCheck className="text-cyan-400 w-8 h-8" /> Nexus Quant 超级控制台</h1>
            <div className="flex flex-wrap gap-4 mt-6">
              <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'settings' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-900'}`}><Settings size={16} /> 核心配置</button>
              <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'users' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-900'}`}><Users size={16} /> 用户管理</button>
              <button onClick={() => setActiveTab('products')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'products' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-900'}`}><Box size={16} /> 策略审核</button>
              <button onClick={() => setActiveTab('orders')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'orders' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/20' : 'text-zinc-500 hover:bg-zinc-900'}`}><BadgeDollarSign size={16} /> 财务订单</button>
              <button onClick={() => setActiveTab('withdrawals')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'withdrawals' ? 'bg-purple-900/40 text-purple-400 border border-purple-500/20' : 'text-zinc-500 hover:bg-zinc-900'}`}><HandCoins size={16} /> 提现审批</button>
              <button onClick={() => setActiveTab('licenses')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'licenses' ? 'bg-violet-900/40 text-violet-300 border border-violet-500/20' : 'text-zinc-500 hover:bg-zinc-900'}`}><Key size={16} /> 授权管理</button>
            </div>
          </div>
          {activeTab === 'settings' && <button onClick={handleSave} disabled={isSaving} className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold rounded-xl shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all">{isSaving ? '保存中...' : '保存所有配置'}</button>}
        </div>
        
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-20 animate-in fade-in duration-300">
             <div className="md:col-span-2 bg-gradient-to-br from-purple-900/20 to-zinc-900/50 border border-purple-500/20 rounded-3xl p-8 space-y-4 shadow-xl">
                <h2 className="text-lg font-bold text-white flex items-center gap-2"><Hash className="text-purple-400" /> 论坛与社区导航配置</h2>
                <input type="text" name="forumCategories" value={settings.forumCategories || ''} onChange={(e) => setSettings({...settings, forumCategories: e.target.value})} placeholder="例如：XAUUSD 策略,MQL5 开发,官方公告" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-cyan-500 focus:outline-none transition-colors" />
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

        {activeTab === 'users' && (
           <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in duration-300">
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead><tr className="bg-zinc-950/50 text-xs uppercase tracking-widest text-zinc-500 border-b border-zinc-800"><th className="p-5">用户标识</th><th className="p-5">账户余额</th><th className="p-5">系统权限与头衔</th><th className="p-5 text-right">超管操作</th></tr></thead>
                  <tbody className="text-sm">
                    {userList.map(u => {
                      const badge = getUserTitle(u.post_count || 0, u.ea_count || 0, u.role);
                      return (
                      <tr key={u.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/40 transition-colors group">
                        <td className="p-5">
                          <div className="flex items-center gap-3">
                            {u.avatar_url ? <img src={u.avatar_url} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-cyan-400 font-black">{u.username.charAt(0).toUpperCase()}</div>}
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

        {activeTab === 'products' && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in duration-300">
            <table className="w-full text-left">
              <thead><tr className="bg-zinc-950/50 text-xs uppercase text-zinc-500 border-b border-zinc-800"><th className="p-5">策略详情</th><th className="p-5">开发者</th><th className="p-5">售价</th><th className="p-5">状态</th><th className="p-5 text-right">审核操作</th></tr></thead>
              <tbody className="text-sm">
                {productList.map(p => (
                  <tr key={p.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors">
                    <td className="p-5">
                      <div className="font-bold text-white">{p.title}</div>
                      {p.metrics ? <div className="mt-2 text-[11px] text-zinc-500">PF {p.metrics.profitFactor} · Sharpe {p.metrics.sharpeRatio} · DD {p.metrics.maxDrawdownPercent}% · {p.metrics.totalTrades} 笔 · 曲线 {p.metrics.equityCurve.length}/{p.metrics.drawdownCurve.length}/{p.metrics.monthlyReturns.length}</div> : <div className="mt-2 text-[11px] font-bold text-amber-400">缺少结构化指标，不能批准</div>}
                      {p.report ? <div className="mt-2 text-[11px] font-bold text-violet-400">MT5 HTML 报告已解析 · SHA {p.report.sha256.slice(0,12)}… · Parser v{p.report.parserVersion}</div> : <div className="mt-2 text-[11px] font-bold text-red-400">缺少 MT5 HTML 原始报告</div>}
                      <div className="mt-2 text-[11px] font-bold text-emerald-400">认证等级：{p.verification?.level || 'unverified'}{p.verification?.status === 'revoked' ? '（已撤销）' : ''}</div>
                      <div className="mt-3 space-y-1">{(p.versions||[]).map(version=><div key={version.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-[10px]"><span className="font-bold text-violet-300">v{version.version}{version.isCurrent?' · 当前':''}</span><span className="text-zinc-500">{version.status} · {version.upgradePolicy}</span><span className="max-w-xs truncate text-zinc-600">{version.releaseNotes}</span>{version.status==='pending'&&<><button onClick={()=>handleVersionReview(version,'approve')} className="rounded bg-emerald-700 px-2 py-1 text-white">发布版本</button><button onClick={()=>handleVersionReview(version,'reject')} className="rounded bg-red-900/60 px-2 py-1 text-red-300">拒绝版本</button></>}{version.status==='published'&&<button onClick={()=>handleVersionReview(version,'retire')} className="rounded bg-amber-900/50 px-2 py-1 text-amber-300">下架版本</button>}</div>)}</div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {(p.evidence || []).map(item => <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-[10px]">
                          <a href={item.previewUrl} target="_blank" rel="noreferrer" className="font-bold uppercase text-cyan-400">{item.type}</a>
                          <div className="mt-1 text-zinc-500">{item.reviewStatus} · OCR {item.extractionStatus}{item.confidence != null ? ` ${(item.confidence * 100).toFixed(0)}%` : ''}</div>
                          <div className="truncate text-zinc-600">SHA {item.sha256.slice(0, 12)}…</div>
                          {item.reviewStatus === 'pending' && <div className="mt-2 flex gap-1"><button onClick={()=>handleEvidenceReview(item,'approved',p.report)} className="rounded bg-emerald-700 px-2 py-1 text-white">证据通过</button><button onClick={()=>handleEvidenceReview(item,'rejected',p.report)} className="rounded bg-red-900/60 px-2 py-1 text-red-300">拒绝</button></div>}
                        </div>)}
                      </div>
                    </td><td className="p-5">{p.author}</td><td className="p-5 font-bold text-cyan-400">${p.price}</td>
                    <td className="p-5">{p.status === 'pending' ? '⏳ 待审' : '✅ 正常'}</td>
                    <td className="p-5 text-right">
                      {p.status === 'pending' ? (() => {
                        const required = ['settings','statistics','chart'];
                        const pendingTypes = required.filter(type => !(p.evidence || []).some(item => item.type === type && item.reviewStatus === 'approved'));
                        const ready = Boolean(p.metrics && p.report && pendingTypes.length === 0);
                        return <div className="inline-flex flex-col items-end gap-1"><button disabled={!ready} title={!ready ? `请先完成：${pendingTypes.join(', ') || '指标和报告'}` : ''} onClick={() => handleApproveEA(p.id, 'active')} className="px-3 py-1 bg-cyan-600 text-white rounded disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600">批准</button>{!ready && <span className="text-[10px] text-amber-400">先审核必需证据</span>}</div>;
                      })() : <button onClick={() => handleApproveEA(p.id, 'pending')} className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded">下架</button>}
                      <button onClick={() => handleDeleteEA(p.id, p.title)} className="px-3 py-1 bg-red-900/40 text-red-400 rounded ml-2">删除</button>
                      {p.status === 'active' && <button onClick={()=>handleVerification(p)} className="px-3 py-1 bg-violet-900/50 text-violet-300 rounded ml-2">认证</button>}
                      {p.verification?.level && p.verification.level !== 'unverified' && <button onClick={()=>handleRevokeVerification(p)} className="px-3 py-1 bg-amber-900/40 text-amber-300 rounded ml-2">撤销认证</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {activeTab==='licenses'&&<div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/50"><table className="w-full text-left text-sm"><thead><tr className="border-b border-zinc-800 bg-zinc-950/50 text-xs text-zinc-500"><th className="p-4">授权</th><th className="p-4">产品</th><th className="p-4">状态/到期</th><th className="p-4">绑定</th><th className="p-4 text-right">操作</th></tr></thead><tbody>{licenses.map(license=><tr key={license.id} className="border-b border-zinc-800/50"><td className="p-4">#{license.id} · {license.type}<div className="text-[10px] text-zinc-600">user_id {license.userId}</div></td><td className="p-4 text-white">{license.productTitle}</td><td className="p-4"><span className={license.status==='active'?'text-emerald-400':'text-red-400'}>{license.status}</span><div className="text-[10px] text-zinc-600">{license.expiresAt?new Date(license.expiresAt).toLocaleString():'永久'}</div></td><td className="p-4 text-[10px] text-zinc-500">{license.bindings.map(binding=>`${binding.type}:${binding.mask}`).join(' · ')||'未绑定'}</td><td className="p-4 text-right">{license.status==='active'&&<button onClick={()=>handleRevokeLicense(license)} className="rounded bg-red-900/50 px-3 py-2 text-xs text-red-300">撤销</button>}</td></tr>)}</tbody></table></div>}

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
                    ) : orderList.map(o => (
                      <tr key={o.order_id} className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors">
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
           <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in duration-300">
              <table className="w-full text-left whitespace-nowrap">
                <thead><tr className="bg-zinc-950/50 text-xs text-zinc-500 border-b border-zinc-800"><th className="p-5">申请人</th><th className="p-5">提现金额</th><th className="p-5">收款地址(USDT等)</th><th className="p-5">状态</th><th className="p-5 text-right">财务操作</th></tr></thead>
                <tbody className="text-sm">
                  {withdrawals.length === 0 ? <tr><td colSpan="5" className="p-10 text-center text-zinc-500">暂无提现申请</td></tr> : withdrawals.map(w => (
                    <tr key={w.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors">
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
      </div>

      {balanceModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 relative shadow-2xl w-full max-w-sm">
            <button onClick={() => setBalanceModal({...balanceModal, isOpen: false})} className="absolute top-5 right-5 text-zinc-400 hover:text-white"><XCircle className="w-5 h-5" /></button>
            <h3 className="text-xl font-bold text-white mb-4">调控用户余额</h3>
            <p className="text-sm text-zinc-500 mb-4">修改 <span className="text-cyan-400">{balanceModal.username}</span> 的底层金额 (USD)</p>
            <input type="number" value={balanceModal.balance} onChange={e => setBalanceModal({...balanceModal, balance: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-emerald-400 font-bold text-xl focus:border-cyan-500 outline-none mb-4" />
            <button onClick={submitUpdateBalance} className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl">强制覆盖余额</button>
          </div>
        </div>
      )}

      {pwdModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 relative shadow-2xl w-full max-w-sm">
            <button onClick={() => setPwdModal({...pwdModal, isOpen: false})} className="absolute top-5 right-5 text-zinc-400 hover:text-white"><XCircle className="w-5 h-5" /></button>
            <h3 className="text-xl font-bold text-white mb-4">强制修改密码</h3>
            <input type="text" value={pwdModal.newPwd} onChange={e => setPwdModal({...pwdModal, newPwd: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-amber-500 outline-none mb-4" placeholder="输入新密码" />
            <button onClick={submitResetPwd} className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl">确认修改</button>
          </div>
        </div>
      )}
    </div>
  );
}
