import Image from 'next/image';
import { Box, CheckCircle, Download, Edit, FolderDown, Settings, Trash2, Upload, Wallet } from 'lucide-react';

export default function ProfileView({ user, myBadge, setProfileForm, setProfileModal, t, myOrders, handleSecureDownload, handleLicenseBind, handleLicenseToken, showToast, myLicenses, setWithdrawModal, mySocial, setRoute, myEAs, handleEditEA, setVersionModal, setVersionForm, setVersionFile, handleDeleteMyEA }) {
  return (
<div className="max-w-5xl mx-auto px-4 py-10 space-y-8 animate-in fade-in duration-300">
  <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 flex flex-col md:flex-row items-center md:items-start gap-8 shadow-xl relative">
    <div className="w-28 h-28 shrink-0 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 p-1 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
      {user.avatar_url ? (
        <Image src={user.avatar_url} width={112} height={112} alt={`${user.username} avatar`} className="w-full h-full rounded-full object-cover border border-zinc-800" />
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
        <button onClick={() => { setProfileForm({ newUsername: user.username, password: '', currentPassword: '' }); setProfileModal(true); }} className="px-6 py-2.5 bg-zinc-800 hover:bg-cyan-600 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg border border-zinc-700 hover:border-cyan-500/50">
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
              {order.logo_url ? <Image src={order.logo_url} width={48} height={48} alt={`${order.title} logo`} className="w-12 h-12 rounded-xl object-cover border border-zinc-800" /> : <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800"><Box className="w-5 h-5 text-cyan-500/50" /></div>}
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
              {p.logo_url ? <Image src={p.logo_url} width={48} height={48} alt={`${p.title} logo`} className="w-12 h-12 rounded-xl object-cover border border-zinc-800" /> : <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800"><Box className="w-5 h-5 text-zinc-600" /></div>}
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
  );
}
