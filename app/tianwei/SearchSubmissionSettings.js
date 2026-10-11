'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch, apiErrorMessage } from '@/lib/api-client';

const names = { baidu: '百度', bing: '必应 · IndexNow', google: 'Google · Search Console' };
const states = { pending: '等待提交', sending: '正在提交', accepted: '已接收', retry: '等待重试', verifying: '等待密钥核验', failed: '需处理' };
function reason(code) {
  if (!code) return '—';
  const labels = { SEARCH_NETWORK_FAILED: '网络请求失败', SEARCH_KEY_VERIFICATION_PENDING: 'IndexNow 正在核验公开密钥', SEARCH_URL_REJECTED: '引擎拒绝该链接', SEARCH_RESPONSE_INVALID: '引擎返回格式异常', SEARCH_PARTIAL_RESULT_AMBIGUOUS: '部分提交结果无法逐条确认', SEARCH_HTTP_401: '密钥无效或权限不足', SEARCH_HTTP_403: '权限不足，请核对站点授权', SEARCH_HTTP_429: '额度或频率限制，稍后重试', SEARCH_GOOGLE_AUTH_400: 'Google 服务账号授权失败', SEARCH_GOOGLE_AUTH_401: 'Google 服务账号密钥无效' };
  return labels[code] || code.replace('SEARCH_HTTP_', '引擎响应 HTTP ');
}
export default function SearchSubmissionSettings() {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});
  const [keys, setKeys] = useState({ baiduToken: '', googleCredentials: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    try {
      const response = await apiFetch('/api/search-submission', { cache: 'no-store' });
      const next = await response.json(); setData(next); setDraft(next.config);
    } catch (error) { setMessage(apiErrorMessage(error, '无法读取搜索引擎设置，请刷新重试')); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function action(name, extra = {}) {
    setBusy(true); setMessage('');
    try {
      const fields = ['baiduEnabled', 'bingEnabled', 'googleEnabled', 'googleProperty', 'sogouSitemapSubmitted'];
      const input = name === 'save' ? { ...Object.fromEntries(fields.map(key => [key, draft[key]])), ...keys, ...extra } : {};
      const response = await apiFetch('/api/search-submission', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: name, ...input }) });
      const next = await response.json(); setData(next); setDraft(next.config); setKeys({ baiduToken: '', googleCredentials: '' });
      setMessage(name === 'save' ? '设置已保存。自动任务每约 10 分钟检查公开内容；密钥输入框已清空。' : name === 'retry' ? '公开链接已重新加入队列，等待自动任务提交。' : '状态已更新。提交结果见下表，接收不代表已收录。');
    } catch (error) { setMessage(apiErrorMessage(error, '操作失败，请稍后重试')); }
    finally { setBusy(false); }
  }
  function toggle(key, label) { return <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={!!draft[key]} disabled={busy} onChange={event => setDraft(current => ({ ...current, [key]: event.target.checked }))} className="h-4 w-4 accent-teal-700" />{label}</label>; }
  const button = 'rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-teal-600 hover:bg-teal-50 disabled:opacity-50';
  const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900';
  if (!data) return <div className="rounded-xl border border-slate-200 bg-white p-6"><p role="status">{message || '正在读取搜索引擎设置…'}</p><button onClick={load} className={`${button} mt-4`}>重新读取</button></div>;
  return <div className="space-y-5 text-slate-800">
    <div className="rounded-xl border border-teal-200 bg-teal-50 p-5">
      <h2 className="text-lg font-bold">搜索引擎提交</h2>
      <p className="mt-2 text-sm leading-6">只提交公开且允许收录的文章、EA 和页面。新内容及内容修改自动进入队列；审核隐藏或删除的内容不再提交。引擎接收链接不保证抓取、收录或排名。</p>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm"><span>当前站点：{data.config.site}</span><a href={`${data.config.site}/sitemap.xml`} target="_blank" rel="noreferrer" className="font-semibold text-teal-800 underline">查看站点地图 ↗</a><span>公开链接：{data.pages.length}</span></div>
      <p className="mt-2 text-sm">自动任务最近运行：{data.status.workerCheckedAt ? new Date(data.status.workerCheckedAt).toLocaleString() : '尚未运行（部署后启用）'}</p>
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-bold">百度 · 普通收录 API</h3>
        <p className="text-sm leading-6 text-slate-600">在百度搜索资源平台验证当前站点，将“普通收录 → API 提交”里的 token 填入下方。站点网址固定使用当前正式域名。</p>
        <label className="block space-y-2 text-sm"><span>推送密钥：{data.config.baiduTokenConfigured ? '已保存，留空保留' : '未配置'}</span><input type="password" autoComplete="new-password" value={keys.baiduToken} maxLength={200} onChange={event => setKeys(current => ({ ...current, baiduToken: event.target.value }))} className={input} placeholder="填写 token，保存后不回显" /></label>
        {toggle('baiduEnabled', '开启百度自动推送')}
        <div className="flex flex-wrap items-center gap-3"><a href="https://ziyuan.baidu.com/" target="_blank" rel="noreferrer" className="text-sm text-teal-800 underline">百度搜索资源平台 ↗</a>{data.config.baiduTokenConfigured && <button disabled={busy} onClick={() => action('save', { clearBaiduToken: true })} className={button}>清除密钥并关闭</button>}</div>
      </section>
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-bold">必应 · IndexNow</h3>
        <p className="text-sm leading-6 text-slate-600">开启后网站自动生成 IndexNow 公开验证密钥，并主动通知支持 IndexNow 的搜索引擎。无需申请必应 API 密钥。</p>
        {toggle('bingEnabled', '开启必应 IndexNow 自动提交')}
        {data.config.bingKey && <a href={`${data.config.site}/indexnow-key.txt`} target="_blank" rel="noreferrer" className="block text-sm text-teal-800 underline">查看公开密钥验证文件 ↗</a>}
        <a href="https://www.bing.com/webmasters/" target="_blank" rel="noreferrer" className="inline-block text-sm text-teal-800 underline">必应站长工具 ↗</a>
      </section>
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-bold">Google · 自动提交站点地图</h3>
        <p className="text-sm leading-6 text-slate-600">验证 Search Console 资源，在 Google Cloud 项目启用 Search Console API，创建服务账号，并将该账号邮箱加入资源权限。普通商品及论坛页面使用站点地图，不能使用仅面向招聘、直播的 Indexing API。</p>
        <label className="block space-y-2 text-sm"><span>Search Console 资源</span><input value={draft.googleProperty || ''} onChange={event => setDraft(current => ({ ...current, googleProperty: event.target.value }))} className={input} /></label>
        <label className="block space-y-2 text-sm"><span>服务账号 JSON 密钥：{data.config.googleCredentialsConfigured ? '已保存，留空保留' : '未配置'}</span><textarea rows={4} autoComplete="off" spellCheck={false} value={keys.googleCredentials} maxLength={16000} onChange={event => setKeys(current => ({ ...current, googleCredentials: event.target.value }))} className={`${input} font-mono [-webkit-text-security:disc]`} placeholder="粘贴服务账号 JSON；加密保存，不返回原文" /></label>
        {toggle('googleEnabled', '开启 Google 站点地图自动提交')}
        <div className="flex flex-wrap items-center gap-3"><a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" className="text-sm text-teal-800 underline">Google Search Console ↗</a>{data.config.googleCredentialsConfigured && <button disabled={busy} onClick={() => action('save', { clearGoogleCredentials: true })} className={button}>清除密钥并关闭</button>}</div>
      </section>
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-bold">搜狗 · 站点地图与链接提交</h3>
        <p className="text-sm leading-6 text-slate-600">当前公开平台支持网页链接提交，站点地图提交需要平台权限。没有核实到可接入的通用推送 API。请在平台提交本站 sitemap.xml；网站会持续自动更新地图，但此处不会报告主动 API 提交成功。</p>
        {toggle('sogouSitemapSubmitted', '我已在搜狗平台提交站点地图（仅记录配置）')}
        <div className="flex flex-wrap gap-4"><a href="https://zhanzhang.sogou.com/index.php/sitelink/index" target="_blank" rel="noreferrer" className="text-sm text-teal-800 underline">搜狗链接提交 ↗</a><a href="https://zhanzhang.sogou.com/index.php/help/sitemap" target="_blank" rel="noreferrer" className="text-sm text-teal-800 underline">站点地图权限说明 ↗</a></div>
      </section>
    </div>
    <div className="flex flex-wrap gap-3"><button disabled={busy} onClick={() => action('save')} className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">{busy ? '正在处理…' : '保存搜索引擎配置'}</button><button disabled={busy} onClick={() => action('scan')} className={button}>检查新链接</button><button disabled={busy} onClick={() => action('run')} className={button}>立即运行队列</button><button disabled={busy} onClick={() => action('retry')} className={button}>全部公开链接重新排队</button><a href={`data:text/plain;charset=utf-8,${encodeURIComponent(data.pages.join('\n'))}`} download="public-search-urls.txt" className={button}>导出公开链接</a></div>
    <p role="status" className="text-sm leading-6 text-teal-800">{message}</p>
    <div className="grid gap-4 lg:grid-cols-3">{Object.entries(names).map(([engine, label]) => <div key={engine} className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="font-bold">{label}</h3><p className="mt-2 text-sm">{data.config[`${engine}Enabled`] ? '自动提交已开启' : '自动提交已关闭'}</p><p className="mt-2 text-sm">{data.counts.filter(row => row.engine === engine).map(row => `${states[row.state]} ${row.count}`).join(' · ') || '暂无提交记录'}</p>{data.status[engine] && <p className="mt-2 text-sm text-slate-600">最近结果：{reason(data.status[engine].error)}{data.status[engine].remain !== null && ` · 剩余额度 ${data.status[engine].remain}`}</p>}</div>)}</div>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><h3 className="border-b border-slate-200 p-4 font-bold">最近提交记录</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['引擎', '链接', '状态', '次数', '结果', '更新时间'].map(title => <th key={title} className="whitespace-nowrap px-4 py-3 font-semibold">{title}</th>)}</tr></thead><tbody>{data.recent.map(row => <tr key={`${row.engine}:${row.url}`} className="border-t border-slate-100"><td className="px-4 py-3">{names[row.engine]}</td><td className="max-w-sm break-all px-4 py-3"><a href={row.url} target="_blank" rel="noreferrer" className="text-teal-800 hover:underline">{row.url.replace(data.config.site, '') || '/'}</a></td><td className="whitespace-nowrap px-4 py-3">{states[row.state]}</td><td className="px-4 py-3">{row.attempts}</td><td className="px-4 py-3">{reason(row.last_error)}</td><td className="whitespace-nowrap px-4 py-3">{new Date(row.updated_at).toLocaleString()}</td></tr>)}</tbody></table>{!data.recent.length && <p className="p-5 text-sm text-slate-500">保存并开启引擎后，公开链接会进入队列。</p>}</div></section>
  </div>;
}
