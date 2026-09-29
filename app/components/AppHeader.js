import Image from 'next/image';
import { Activity, Globe, Home, LogOut, MessageSquare, Store, User as UserIcon } from 'lucide-react';

export default function AppHeader({ siteSettings, setRoute, route, t, user, setAuthModal, toggleLang, lang, showUserMenu, setShowUserMenu, handleLogout, setAuthForm, setForumView }) {
  const mobileItems = [
    ['home', t('首页', 'Home'), Home, () => setRoute('home')],
    ['market', t('市场', 'Market'), Store, () => setRoute('market')],
    ['forum', t('社区', 'Community'), MessageSquare, () => { setRoute('forum'); setForumView('list'); }],
    ['profile', t('我的', 'Profile'), UserIcon, () => user ? setRoute('profile') : setAuthModal('login')],
  ];
  return <>
<header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setRoute('home')}>
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.3)]"><Activity className="text-zinc-950 w-5 h-5" /></div>
      <span className="font-extrabold text-xl tracking-tight text-white">{siteSettings?.siteName || 'Nexus Quant'}</span>
    </div>
    <nav className="hidden lg:flex items-center space-x-8 text-sm font-medium">
      <button onClick={() => setRoute('home')} className={`transition-colors ${route === 'home' ? 'text-cyan-400' : 'text-zinc-400 hover:text-white'}`}>{t('首页概览', 'Dashboard')}</button>
      <button onClick={() => setRoute('market')} className={`transition-colors ${route === 'market' ? 'text-cyan-400' : 'text-zinc-400 hover:text-white'}`}>{t('策略市场', 'EA Market')}</button>
      <button onClick={() => { setRoute('forum'); setForumView('list'); }} className={`transition-colors ${route === 'forum' ? 'text-cyan-400' : 'text-zinc-400 hover:text-white'}`}>{t('开发者社区', 'Community')}</button>
      <button onClick={() => { if(!user) return setAuthModal('login'); setRoute('profile'); }} className={`transition-colors ${route === 'profile' ? 'text-cyan-400' : 'text-zinc-400 hover:text-white'}`}>{t('个人中心', 'Profile')}</button>
      {user?.role === 'admin' && (<a href="/tianwei" target="_blank" rel="noopener noreferrer" className="rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-400 hover:bg-amber-500/20">{t('后台管理', 'Admin Panel')}</a>)}
    </nav>
    <div className="flex gap-4 items-center relative">
      <button onClick={toggleLang} aria-label={t('切换语言', 'Switch language')} className="flex items-center gap-1 text-xs bg-zinc-900 border border-zinc-800 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors sm:gap-1.5 sm:px-3">
        <Globe className="w-3.5 h-3.5" /> {lang === 'zh' ? 'EN' : '中文'}
      </button>
      {user ? (
        <div className="relative">
          <button onClick={() => setShowUserMenu(!showUserMenu)} className="text-sm font-bold text-zinc-300 bg-zinc-900 px-4 py-1.5 rounded-lg border border-zinc-800 flex items-center gap-2 hover:bg-zinc-800 transition-colors">
            {user.avatar_url ? <Image src={user.avatar_url} width={20} height={20} alt={`${user.username} avatar`} className="w-5 h-5 rounded-full object-cover" /> : <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"></div>}{user.username}
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
<nav aria-label={t('移动端主导航', 'Mobile primary navigation')} className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-slate-800 bg-[#07101a]/95 px-[max(0.5rem,env(safe-area-inset-left))] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
  {mobileItems.map(([value, label, Icon, action]) => <button key={value} type="button" aria-current={route === value ? 'page' : undefined} onClick={action} className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${route === value ? 'text-cyan-300' : 'text-slate-500'}`}><Icon className="h-4 w-4" /><span>{label}</span></button>)}
</nav>
</>;
}
