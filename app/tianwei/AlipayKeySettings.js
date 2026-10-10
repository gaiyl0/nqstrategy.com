'use client';
import { useState } from 'react';
import { apiFetch, apiErrorMessage } from '@/lib/api-client';

export default function AlipayKeySettings({ settings, onSaved }) {
  const [keys, setKeys] = useState({ privateKey: '', publicKey: '', appPublicKey: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function save() {
    setBusy(true); setMessage('');
    try {
      const response = await apiFetch('/api/settings/alipay-keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(keys),
      });
      const status = await response.json();
      onSaved(status);
      setKeys({ privateKey: '', publicKey: '', appPublicKey: '' });
      setMessage('密钥已保存，输入框已清空。无需重启；请另行保存 AppID、PID 和通知地址。');
    } catch (error) { setMessage(apiErrorMessage(error, '密钥保存失败')); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4 rounded-xl border border-slate-300 p-4">
    <h3 className="font-semibold">支付宝密钥配置 · 普通公钥模式</h3>
    <p className="text-sm leading-6">粘贴密钥后点击下方保存。留空保留原配置；管理界面永不读取或展示原文。应用公钥应与支付宝开放平台上传的一致，支付宝公钥用于验签。</p>
    {[
      ['privateKey', '应用私钥', 'alipayAppPrivateKeyConfigured', '用于网站请求加签，必需'],
      ['publicKey', '支付宝公钥', 'alipayPublicKeyConfigured', '用于支付宝响应和付款通知验签，必需'],
      ['appPublicKey', '应用公钥（可选）', 'alipayAppPublicKeyConfigured', '用于核对是否与应用私钥匹配'],
    ].map(([key, label, status, hint]) => <label key={key} className="block space-y-2 text-sm">
      <span className="flex justify-between gap-3 font-semibold"><span>{label}</span><span>{settings[status] ? '已配置 · 留空不更改' : '未配置'}</span></span>
      <textarea aria-label={label} rows={key === 'privateKey' ? 4 : 3} maxLength={16000} autoComplete="off" spellCheck={false}
        disabled={busy} value={keys[key]} onChange={event => setKeys(current => ({ ...current, [key]: event.target.value }))}
        placeholder={`粘贴${label}，支持 PEM 或纯 Base64 格式`}
        className={`w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-sm text-slate-900 ${key === 'privateKey' ? '[-webkit-text-security:disc]' : ''}`} />
      <span className="block text-xs">{hint}</span>
    </label>)}
    <button type="button" onClick={save} disabled={busy || !Object.values(keys).some(value => value.trim())}
      className="rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? '正在保存…' : '保存支付宝密钥'}</button>
    <p role="status" className="text-sm leading-6">{message}</p>
  </div>;
}
