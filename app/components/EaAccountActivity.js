'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {apiFetch} from '@/lib/api-client';
import {reporterPreset,presetBytes} from '@/lib/ea-reporter-preset.mjs';
import {Button,Field,Panel,useInteraction} from './ui/UiKit';

export default function EaAccountActivity({licenses,t}){
  const [items,setItems]=useState([]),[authorizations,setAuthorizations]=useState([]);
  const [form,setForm]=useState({licenseId:'',label:'',consent:false}),[credential,setCredential]=useState(null);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [updated,setUpdated]=useState(null),[clock,setClock]=useState(()=>Date.now());
  const setupRef=useRef(null),{confirmAction}=useInteraction();
  const eligible=licenses.filter(x=>x.status==='active'&&x.type!=='trial');
  const selectedLicenseId=form.licenseId||(eligible.length===1?String(eligible[0].id):'');
  const load=useCallback(async()=>{
    try{
      const responses=await Promise.all([apiFetch('/api/ea-connections',{cache:'no-store'}).then(r=>r.json()),apiFetch('/api/runtime-authorizations',{cache:'no-store'}).then(r=>r.json())]);
      if(!responses.every(x=>x.success))throw Error(t('账户动态读取失败','Could not load account activity'));
      setItems(responses[0].items);setAuthorizations(responses[1].items);setError('');setUpdated(Date.now());
    }catch(e){setError(e.message);}
  },[t]);
  useEffect(()=>{
    let active=true;
    const run=()=>{if(active&&document.visibilityState!=='hidden'){setClock(Date.now());void load();}};
    const start=setTimeout(run,0),timer=setInterval(run,30000);document.addEventListener('visibilitychange',run);
    return()=>{active=false;clearTimeout(start);clearInterval(timer);document.removeEventListener('visibilitychange',run);};
  },[load]);
  useEffect(()=>{if(credential)setupRef.current?.scrollIntoView?.({behavior:'smooth',block:'start'});},[credential]);
  const create=async event=>{
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const licenseId=Number(selectedLicenseId),selected=eligible.find(x=>x.id===licenseId);
      const label=(form.label.trim()||`${selected?.productTitle||'MT5'} ${t('账户','account')}`).slice(0,60);
      const response=await apiFetch('/api/ea-connections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',licenseId,label,consent:form.consent})}),body=await response.json();
      if(!response.ok||!body.success)throw Error(body.message||t('连接创建失败','Could not create connection'));
      reporterPreset(body);setCredential(body);setForm({licenseId:'',label:'',consent:false});await load();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const resetSetup=async item=>{
    if(!await confirmAction({title:t('重新生成此连接的配置','Regenerate this connection setup'),description:t('旧配置会立即失效，请将新配置重新加载到上报程序。已绑定的交易账号和终端保持不变，不创建重复连接，也不影响原交易 EA。','The old configuration will stop working. Load the new configuration into the reporter. The bound account and terminal remain unchanged; no duplicate connection is created and the trading EA is unaffected.'),confirmLabel:t('重新生成配置','Regenerate setup')}))return;
    setBusy(true);setError('');setNotice('');
    try{
      const response=await apiFetch('/api/ea-connections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reset_setup',id:item.id})}),body=await response.json();
      reporterPreset(body);setCredential(body);await load();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const downloadSetup=()=>{
    try{
      const preset=reporterPreset(credential),url=URL.createObjectURL(new Blob([presetBytes(preset.content)],{type:'application/octet-stream'}));
      const link=document.createElement('a');link.href=url;link.download=preset.filename;document.body.appendChild(link);
      try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
      setNotice(t('已请求下载配置文件，请在浏览器下载列表中查看。接着在上报程序的“输入参数”中点击“加载”，选择此文件。','Configuration download requested. Check your browser downloads, then choose Load in the reporter Inputs tab and select this file.'));
    }catch{setError(t('浏览器未能下载配置，请重试或使用普通浏览器打开本页。','Could not download the configuration. Retry or open this page in a regular browser.'));}
  };
  const revoke=async id=>{
    if(!await confirmAction({title:t('停止此账户数据上报','Stop reporting account data'),description:t('撤销后连接密钥立即失效。此操作不平仓，也不改变交易账户。','The connection credential becomes invalid immediately. This does not close trades or change the trading account.'),confirmLabel:t('撤销连接','Revoke connection')}))return;
    setBusy(true);
    try{
      await apiFetch('/api/ea-connections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'revoke',id})});
      if(credential?.id===id)setCredential(null);await load();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const states={online:t('账户已连接','Account connected'),offline:t('终端离线／数据已过时','Offline / stale data'),waiting:t('等待在 MT5 加载配置','Waiting for setup in MT5'),revoked:t('连接已失效','Connection inactive')};
  const money=(value,currency)=>value===null||value===undefined?'—':`${Number(value).toLocaleString(t('zh-CN','en-US'),{maximumFractionDigits:2})} ${currency||''}`;
  return <div className="space-y-5">
    <Panel className="space-y-3 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">{t('我的交易账户','My trading accounts')}</h2><Button size="sm" onClick={load}>{t('刷新','Refresh')}</Button></div>
      <p className="text-sm leading-6 text-slate-400">{t('选择 EA，下载专属配置，在 MT5 上报程序中加载即可。不用复制编号或密钥，也不用填写魔术码。','Choose an EA, download your personal configuration and load it into the MT5 reporter. No IDs, tokens or magic numbers to enter.')}</p>
      <p className="text-xs leading-6 text-slate-400">{t('仅查看整个账户的余额、净值和持仓数据，不拆分单款 EA 收益。数据由终端自报，不是券商核验实盘证明；不收集交易密码，不远程开平仓。页面每30秒刷新，超过2分钟未收到上报显示离线。','Shows account-wide balances, equity and positions, without attributing profits to a particular EA. Data is terminal-reported, not broker-verified. No trading passwords or remote trading. Refreshes every 30 seconds; reports become offline after 2 minutes.')}</p>
      <a className="text-sm text-teal-500 underline" href="/ea-integration">{t('查看详细步骤与程序下载','Setup instructions and program downloads')}</a>
      {updated&&<p className="text-xs text-slate-400">{t('页面更新','Page refreshed')} {new Date(updated).toLocaleTimeString()}</p>}{error&&<p role="alert" className="text-sm text-red-400">{error}</p>}
    </Panel>
    <Panel className="space-y-4 p-5"><div><h3 className="font-bold">{t('连接新账户','Connect an account')}</h3><p className="mt-1 text-sm text-slate-400">{t('配置已为你填写好，选择已兑换 EA 后生成即可。','Your settings are filled automatically. Select a redeemed EA to prepare your configuration.')}</p></div>
      <form onSubmit={create} className="grid gap-4 sm:grid-cols-2"><Field label={t('选择已兑换 EA','Choose a redeemed EA')} required><select required disabled={busy} value={selectedLicenseId} onChange={e=>setForm({...form,licenseId:e.target.value})}><option value="">{t('请选择 EA','Select an EA')}</option>{eligible.map(x=><option value={x.id} key={x.id}>{x.productTitle}</option>)}</select></Field>
        <Field label={t('账户备注（可选）','Account label (optional)')}><input maxLength={60} disabled={busy} value={form.label} onChange={e=>setForm({...form,label:e.target.value})} placeholder={t('例如：TMGM 模拟账户','Example: TMGM demo')}/></Field>
        <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" required disabled={busy} checked={form.consent} onChange={e=>setForm({...form,consent:e.target.checked})}/>{t('我同意向个人中心上报账号尾号、服务器、币种、余额、净值、可用保证金、浮盈亏和持仓统计。','I consent to reporting my masked account ID, server, currency, balance, equity, free margin, floating P/L and position statistics to my personal center.')}</label>
        <Button type="submit" variant="primary" disabled={!eligible.length} loading={busy}>{t('生成我的 MT5 配置','Prepare my MT5 setup')}</Button>
      </form>{!eligible.length&&<p className="text-sm text-slate-400">{t('请先兑换一款 EA，再创建账户连接。','Redeem an EA before creating an account connection.')}</p>}
    </Panel>
    {credential&&<Panel className="scroll-mt-24 space-y-4 border-teal-500/40 p-5" ref={setupRef}><h3 className="font-bold">{t('配置已准备好，按下面三步完成连接','Your setup is ready. Complete these three steps')}</h3>
      <ol className="list-decimal space-y-4 pl-5 text-sm leading-7">
        <li><strong>{t('下载程序和你的专属配置','Download the reporter and your personal configuration')}</strong><div className="mt-2 flex flex-wrap gap-2"><Button href="/ea-integration/download?file=NexusAccountReporter.ex5" download="NexusAccountReporter.ex5">{t('下载上报程序 EX5','Download reporter EX5')}</Button><Button variant="primary" onClick={downloadSetup}>{t('下载我的配置文件','Download my configuration')}</Button></div><p className="mt-1 text-xs text-slate-400">{t('程序已安装过可跳过重复下载。配置文件包含私人连接凭证，不要发给他人。离开或刷新页面后无法再次下载同一凭证，可从账户卡片重新生成。','Skip the reporter download if already installed. Your configuration contains a private credential; do not share it. After leaving or refreshing, regenerate it from the account card if needed.')}</p></li>
        <li><strong>{t('在 MT5 允许连接网站（首次使用设置一次）','Allow the website in MT5 (once per terminal)')}</strong><p>{t('工具 → 选项 → EA交易 → 勾选“允许 WebRequest” → 添加下面地址：','Tools → Options → Expert Advisors → Allow WebRequest → add:')}</p><code className="break-all select-all">https://nqstrategy.com</code></li>
        <li><strong>{t('在空闲图表加载上报程序和配置','Load the reporter and configuration on a spare chart')}</strong><p>{t('把 EX5 放入 MT5 数据文件夹的 MQL5/Experts，刷新导航。新开一个空闲图表，将 NexusAccountReporter 拖到图表；在“输入参数”点击“加载 / Load”，选刚下载的 .set 文件，点击确定。无需手动填写参数。','Place the EX5 in the MT5 data folder under MQL5/Experts and refresh Navigator. Open a spare chart, drag NexusAccountReporter onto it, then choose Inputs → Load and select your downloaded .set file. Confirm without editing parameters.')}</p><p className="text-xs text-amber-500">{t('不要拖到正在运行交易 EA 的图表，否则 MT5 会替换原 EA。仅在导航树看到程序名称，还不代表它已运行。','Do not use a chart already running your trading EA: MT5 would replace it. Seeing the reporter in Navigator does not mean it is running.')}</p></li>
      </ol><p role="status" className="text-sm text-teal-500">{notice||t('完成后等待约30秒，下面的账户卡片会显示连接结果。','After setup, allow about 30 seconds for your account card to show the result.')}</p>
      <Button variant="ghost" onClick={()=>{setCredential(null);setNotice('');}}>{t('已完成，隐藏私人配置','Done; hide private setup')}</Button>
    </Panel>}
    <div className="grid gap-4 lg:grid-cols-2">{items.map(item=>{
      const status=item.status==='online'&&clock-item.lastSeenAt>120000?'offline':item.status;
      return <Panel className="space-y-3 p-5" key={item.id}><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold">{item.label}</h3><p className="text-xs text-slate-400">{item.productTitle} · {item.accountMask||t('尚未连接','Not connected')} · {item.serverName||'—'}</p></div><span className={`text-xs ${status==='online'?'text-teal-500':'text-amber-500'}`}>{states[status]}</span></div>
        {status==='waiting'?<div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-sm leading-6"><strong>{t('还差 MT5 中的加载操作','Finish loading the setup in MT5')}</strong><p>{t('生成网站连接不会自动启动电脑上的程序。请在空闲图表挂载 NexusAccountReporter，并加载专属配置文件。找不到旧配置时，可点击下方重新生成。','Creating a website connection does not start a program on your computer. Attach NexusAccountReporter to a spare chart and load your personal configuration. Regenerate below if the old file is unavailable.')}</p></div>:<dl className={`grid grid-cols-2 gap-3 text-sm ${status==='online'?'':'opacity-65'}`}>{[[t('账户余额','Account balance'),money(item.balance,item.currency)],[t('账户净值','Account equity'),money(item.equity,item.currency)],[t('账户浮盈亏','Account floating P/L'),money(item.floatingProfit,item.currency)],[t('可用保证金','Free margin'),money(item.freeMargin,item.currency)],[t('账户持仓数','Account positions'),item.positionsCount??'—']].map(([label,value])=><div key={label}><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}</dl>}
        <p className="text-xs text-slate-400">{t('最近上报','Last report')} {item.lastSeenAt?new Date(item.lastSeenAt).toLocaleString(t('zh-CN','en-US')):t('尚未收到数据','No data received')}</p>
        {status!=='revoked'&&<div className="flex flex-wrap gap-2">{credential?.id===item.id?<Button size="sm" disabled={busy} onClick={downloadSetup}>{t('下载我的配置文件','Download my configuration')}</Button>:<Button size="sm" disabled={busy} onClick={()=>resetSetup(item)}>{t('重新生成专属配置','Regenerate personal setup')}</Button>}<Button size="sm" variant="danger" disabled={busy} onClick={()=>revoke(item.id)}>{t('撤销连接','Revoke connection')}</Button></div>}
      </Panel>;
    })}</div>
    {!items.length&&<Panel className="p-5 text-sm text-slate-400">{t('尚未连接账户，先在上方生成你的 MT5 配置。','No account connected. Prepare your MT5 setup above.')}</Panel>}
    <Panel className="p-5"><h3 className="font-bold">{t('独立运行授权','Standalone runtime authorizations')}</h3><p className="mt-2 text-sm text-slate-400">{t('管理员签发的授权码仅在要求授权的交易 EA 中使用，与账户上报程序的专属配置无关。','Administrator-issued codes are only for trading EAs that require authorization, separate from your account reporter setup.')}</p>{authorizations.map(row=><div className="mt-3 border-t border-slate-700 pt-3 text-sm" key={row.id}><strong>{row.productTitle}</strong> · {row.codeHint} · {({issued:t('待激活','Not activated'),active:t('有效','Active'),expired:t('已到期','Expired'),revoked:t('已撤销','Revoked')})[row.status]}<p className="mt-1 text-xs text-slate-400">{row.expiresAt?new Date(row.expiresAt).toLocaleString():t(`首次激活起 ${row.durationDays} 天`,`${row.durationDays} days after first activation`)} · {row.accountMask||t('未绑定','Not bound')}</p></div>)}{!authorizations.length&&<p className="mt-3 text-sm text-slate-400">{t('暂无独立授权码，不影响已兑换 EA 的下载或创建只读账户连接。','No standalone code. This does not affect redeemed EA downloads or read-only account reporting.')}</p>}</Panel>
  </div>;
}
