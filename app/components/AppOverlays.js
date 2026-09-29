import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { CheckCircle, Settings, Shield, User as UserIcon, Wallet, X } from 'lucide-react';

function AvatarPicker({ currentUrl, username, setAvatarFile, t }) {
  const previewUrlRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextUrl = file ? URL.createObjectURL(file) : null;
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
    setAvatarFile(file);
  };

  return (
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 shrink-0 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center overflow-hidden">
        {previewUrl ? <Image src={previewUrl} width={64} height={64} unoptimized alt={t('新头像预览', 'New avatar preview')} className="w-full h-full object-cover" /> : (currentUrl ? <Image src={currentUrl} width={64} height={64} alt={`${username} avatar`} className="w-full h-full object-cover" /> : <UserIcon className="w-6 h-6 text-zinc-600" />)}
      </div>
      <label className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors w-full text-center">
        {t('上传新头像', 'Upload New')}
        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChange} />
      </label>
    </div>
  );
}

export default function AppOverlays({ versionModal, setVersionModal, versionForm, setVersionForm, setVersionFile, submitVersion, isVersionSubmitting, profileModal, setProfileModal, setAvatarFile, setProfileForm, user, profileForm, submitProfileUpdate, isProfileUpdating, withdrawModal, setWithdrawModal, withdrawAddress, setWithdrawAddress, submitWithdrawal, authModal, setAuthModal, setSentCode, authForm, setAuthForm, handleSendAuthCode, isSendingCode, sentCode, resetForm, setResetForm, isAuthSubmitting, submitLogin, submitRegister, handleSendResetCode, isSendingResetCode, isResetSubmitting, submitResetPassword, toastMsg, t }) {
  return (
    <>
{versionModal&&<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"><div role="dialog" aria-modal="true" aria-labelledby="version-dialog-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-violet-500/30 bg-zinc-950 p-7 shadow-2xl"><div className="flex items-center justify-between"><h3 id="version-dialog-title" className="text-xl font-black text-white">{t('提交新版本','Submit New Version')} · {versionModal.title}</h3><button aria-label={t('关闭','Close')} onClick={()=>setVersionModal(null)} className="text-zinc-500 hover:text-white"><X/></button></div><div className="mt-6 space-y-4"><input value={versionForm.version} onChange={e=>setVersionForm({...versionForm,version:e.target.value})} placeholder="1.1.0" className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"/><textarea value={versionForm.releaseNotes} onChange={e=>setVersionForm({...versionForm,releaseNotes:e.target.value})} rows="5" placeholder={t('本版本更新日志','Release notes')} className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"/><select value={versionForm.upgradePolicy} onChange={e=>setVersionForm({...versionForm,upgradePolicy:e.target.value})} className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"><option value="all_existing">{t('所有已有买家免费继承','All existing owners inherit')}</option><option value="new_purchases_only">{t('仅版本发布后的新买家','Only purchases after release')}</option></select><input type="file" accept=".ex4,.ex5" onChange={e=>setVersionFile(e.target.files?.[0]||null)} className="block w-full text-xs text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500/10 file:px-3 file:py-2 file:font-bold file:text-violet-300"/><button onClick={submitVersion} disabled={isVersionSubmitting} className="w-full rounded-xl bg-violet-600 py-3 font-black text-white disabled:opacity-50">{isVersionSubmitting?t('提交中…','Submitting…'):t('提交管理员审核','Submit for Review')}</button></div></div></div>}

{/* 修改个人资料弹窗 */}
{profileModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in zoom-in-95">
    <div role="dialog" aria-modal="true" className="max-h-[90vh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-3xl max-w-sm w-full p-8 relative shadow-2xl">
      <button aria-label={t('关闭','Close')} onClick={() => { setProfileModal(false); setAvatarFile(null); setProfileForm({newUsername:user.username,password:'',currentPassword:''}); }} className="absolute top-5 right-5 text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
      <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2"><Settings className="w-5 h-5 text-cyan-400"/> {t('编辑个人资料', 'Edit Profile')}</h3>
      <div className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-zinc-400 mb-2">{t('个人头像 (可选)', 'Avatar (Optional)')}</label>
          <AvatarPicker currentUrl={user?.avatar_url} username={user?.username || ''} setAvatarFile={setAvatarFile} t={t} />
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-400 mb-2">{t('专属用户名', 'Username')}</label>
          <input type="text" value={profileForm.newUsername} onChange={e => setProfileForm({...profileForm, newUsername: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-400 mb-2">{t('当前密码（修改密码时必填）', 'Current Password (required to change password)')}</label>
          <input type="password" autoComplete="current-password" value={profileForm.currentPassword} onChange={e => setProfileForm({...profileForm, currentPassword: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none" placeholder="******" />
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-400 mb-2">{t('修改安全密码 (留空则不修改)', 'New Password (leave blank to keep)')}</label>
          <input type="password" autoComplete="new-password" value={profileForm.password} onChange={e => setProfileForm({...profileForm, password: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none" placeholder="******" />
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
    <div role="dialog" aria-modal="true" className="max-h-[90vh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-3xl max-w-sm w-full p-8 relative shadow-2xl">
      <button aria-label={t('关闭','Close')} onClick={() => setWithdrawModal(false)} className="absolute top-5 right-5 text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
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
    <div role="dialog" aria-modal="true" className="max-h-[90vh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-3xl max-w-sm w-full p-8 relative shadow-2xl">
      <button aria-label={t('关闭','Close')} onClick={() => { setAuthModal(null); setSentCode(null); }} className="absolute top-5 right-5 text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
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
    </>
  );
}
