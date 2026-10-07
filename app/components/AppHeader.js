import Image from 'next/image';
import { Activity, Coins, Globe, Home, LogOut, MessageSquare, Store, User as UserIcon } from 'lucide-react';

export default function AppHeader({ siteSettings, setRoute, route, t, user, setAuthModal, toggleLang, lang, showUserMenu, setShowUserMenu, handleLogout, setAuthForm, setForumView }) {
  const mobileItems = [
    ['home', t('首页', 'Home'), Home, () => setRoute('home')],
    ['market', t('市场', 'Market'), Store, () => setRoute('market')],
    ['forum', t('论坛', 'Forum'), MessageSquare, () => { setRoute('forum'); setForumView('list'); }],
    ['points', t('积分', 'Points'), Coins, () => user ? setRoute('points') : setAuthModal('login')],
    ['profile', t('我的', 'Profile'), UserIcon, () => user ? setRoute('profile') : setAuthModal('login')],
  ];
  return <>
<header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
    <button type="button" aria-label={t('返回首页', 'Back to home')} className="flex min-w-0 items-center gap-2 text-left sm:gap-3" onClick={() => setRoute('home')}>
      <div className="w-8 h-8 shrink-0 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.3)]"><Activity className="text-zinc-950 w-5 h-5" /></div>
      <span title={siteSettings?.siteName || 'Nexus Quant'} className="truncate font-extrabold text-base tracking-tight text-white sm:text-xl">{siteSettings?.siteName || 'Nexus Quant'}</span>
    </button>
    <nav className="nq-primary-nav hidden lg:flex items-center gap-2 text-sm font-medium">
      <button onClick={() => setRoute('home')} aria-current={route === 'home' ? 'page' : undefined} className={`nq-nav-item transition-colors ${route === 'home' ? 'text-cyan-400' : 'text-zinc-400 hover:text-white'}`}>{t('首页概览', 'Dashboard')}</button>
      <button onClick={() => setRoute('market')} aria-current={route === 'market' ? 'page' : undefined} className={`nq-nav-item transition-colors ${route === 'market' ? 'text-cyan-400' : 'text-zinc-400 hover:text-white'}`}>{t('策略市场', 'EA Market')}</button>
      <button onClick={() => { setRoute('forum'); setForumView('list'); }} aria-current={route === 'forum' ? 'page' : undefined} className={`nq-nav-item transition-colors ${route === 'forum' ? 'text-cyan-400' : 'text-zinc-400 hover:text-white'}`}>{t('论坛', 'Forum')}</button>
      <button onClick={() => { if(!user) return setAuthModal('login'); setRoute('points'); }} aria-current={route === 'points' ? 'page' : undefined} className={`nq-nav-item transition-colors ${route === 'points' ? 'text-cyan-400' : 'text-zinc-400 hover:text-white'}`}>{t('积分任务', 'Points')}</button>
      <button onClick={() => { if(!user) return setAuthModal('login'); setRoute('profile'); }} aria-current={route === 'profile' ? 'page' : undefined} className={`nq-nav-item transition-colors ${route === 'profile' ? 'text-cyan-400' : 'text-zinc-400 hover:text-white'}`}>{t('个人中心', 'Profile')}</button>
      {user?.role === 'admin' && (<a href="/tianwei" target="_blank" rel="noopener noreferrer" className="rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-400 hover:bg-amber-500/20">{t('后台管理', 'Admin Panel')}</a>)}
    </nav>
    <div className="relative flex shrink-0 items-center gap-2 sm:gap-4">
      <button onClick={toggleLang} aria-label={t('切换语言', 'Switch language')} className="flex min-h-11 items-center gap-1 text-xs bg-zinc-900 border border-zinc-800 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors sm:gap-1.5 sm:px-3">
        <Globe className="w-3.5 h-3.5" /> {lang === 'zh' ? 'EN' : '中文'}
      </button>
      {user ? (
        <div className="relative">
          <button onClick={() => setShowUserMenu(!showUserMenu)} aria-expanded={showUserMenu} className="min-h-11 whitespace-nowrap text-sm font-bold text-zinc-300 bg-zinc-900 px-3 py-1.5 sm:px-4 rounded-lg border border-zinc-800 flex items-center gap-2 hover:bg-zinc-800 transition-colors">
            {user.avatar_url ? <Image src={user.avatar_url} width={20} height={20} alt={`${user.username} avatar`} className="w-5 h-5 rounded-full object-cover" /> : <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"></div>}<span className="max-w-[88px] truncate sm:max-w-[160px]" title={user.username}>{user.username}</span>
          </button>
          {showUserMenu && (
            <div className="absolute right-0 mt-3 w-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
              <button onClick={() => { setRoute('profile'); setShowUserMenu(false); }} className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"><UserIcon className="w-4 h-4" /> {t('个人中心', 'Profile')}</button>
              <div className="h-px bg-zinc-800"></div>
              <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-zinc-800 flex items-center gap-2"><LogOut className="w-4 h-4" /> {t('退出登录', 'Logout')}</button>
            </div>
          )}
        </div>
      ) : (<button onClick={() => { setAuthModal('login'); setAuthForm({ username: '', email: '', password: '', code: '' }); }} className="min-h-11 shrink-0 whitespace-nowrap px-3 py-1.5 sm:px-5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-cyan-600/20">{t('登录 / 注册', 'Login / Register')}</button>)}
    </div>
  </div>
</header>
<nav aria-label={t('移动端主导航', 'Mobile primary navigation')} className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-slate-800 bg-[#07101a]/95 px-[max(0.5rem,env(safe-area-inset-left))] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
  {mobileItems.map(([value, label, Icon, action]) => <button key={value} type="button" aria-current={route === value ? 'page' : undefined} onClick={action} className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${route === value ? 'text-cyan-300' : 'text-slate-500'}`}><Icon className="h-4 w-4" /><span>{label}</span></button>)}
</nav>
</>;
}
