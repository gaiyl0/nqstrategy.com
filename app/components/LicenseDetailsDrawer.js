'use client';
import {useEffect,useState} from 'react';
import {apiFetch} from '@/lib/api-client';
import {Button,Drawer,Panel} from './ui/UiKit';

export default function LicenseDetailsDrawer({license,onClose,onOpenActivity,t}) {
  const [state,setState]=useState({loading:true,error:false,authorizations:[],connections:[]});
  const [retry,setRetry]=useState(0);
  const productId=license?.productId;
  useEffect(()=>{
    if(!productId)return;
    const controller=new AbortController();
    async function load(){
      setState({loading:true,error:false,authorizations:[],connections:[]});
      try{
        const responses=await Promise.all(['/api/runtime-authorizations','/api/ea-connections'].map(async url=>{
          const response=await apiFetch(url,{cache:'no-store',signal:controller.signal});
          const body=await response.json();
          if(!response.ok||!body.success)throw Error('LOAD_FAILED');
          return body.items.filter(item=>item.productId===productId);
        }));
        if(!controller.signal.aborted)setState({loading:false,error:false,authorizations:responses[0],connections:responses[1]});
      }catch{if(!controller.signal.aborted)setState({loading:false,error:true,authorizations:[],connections:[]});}
    }
    void load();return()=>controller.abort();
  },[productId,retry]);
  const statuses={issued:t('待激活','Not activated'),active:t('有效','Active'),expired:t('已到期','Expired'),revoked:t('已撤销','Revoked')};
  return <Drawer open={Boolean(license)} onClose={onClose} title={t('下载许可与运行授权','Download and runtime permissions')} description={license?.productTitle||''}>{license&&<div className="space-y-5">
    <Panel className="space-y-2 p-4"><h3 className="font-bold">{t('下载许可','Download permission')}</h3><p>{license.productTitle}{license.version?` · v${license.version}`:''}</p><p className="text-sm">{t('许可编号','License ID')} #{license.id} · {license.status==='active'?t('有效','Active'):license.status==='revoked'?t('已撤销','Revoked'):t('已到期','Expired')}</p><p className="text-xs leading-6 text-slate-400">{t('这是兑换后的下载凭证，无需手动绑定账号或设备。运行时是否需要授权码，取决于该 EA 是否已接入在线授权。','This is your redemption download permission. No manual account or device binding is required. An authorization code is needed only by EAs that integrate runtime validation.')}</p></Panel>
    {state.loading?<p role="status">{t('正在读取绑定状态…','Loading binding status…')}</p>:state.error?<Panel className="space-y-3 p-4"><p role="alert">{t('绑定状态读取失败，暂不能确认是否已绑定。','Could not load binding status. The current state is unknown.')}</p><Button onClick={()=>setRetry(value=>value+1)}>{t('重新读取','Retry')}</Button></Panel>:<>
      <Panel className="space-y-3 p-4"><h3 className="font-bold">{t('独立运行授权','Standalone runtime authorization')}</h3><p className="text-xs leading-6 text-slate-400">{t('在支持在线授权的 EA 参数中填写管理员发放的授权码。首次连接自动绑定交易账号、服务器与终端，无需填写设备指纹。现有未接入组件的 EA 不会因此自动启用授权校验。','Enter the administrator-issued code in an EA that supports online authorization. The first connection automatically binds the account, server and terminal. No device fingerprint entry is needed. Existing EAs without integration do not gain authorization checks automatically.')}</p>{state.authorizations.length?state.authorizations.map(item=><div className="space-y-1 border-t border-slate-700 pt-3 text-sm" key={item.id}><p>{item.codeHint} · {statuses[item.status]}</p><p className="font-semibold">{item.accountMask?t('已自动绑定','Automatically bound'):t('尚未绑定','Not bound')}</p>{item.accountMask&&<p className="break-words">{item.accountMask} · {item.serverName}</p>}<p className="text-xs text-slate-400">{item.expiresAt?`${t('到期时间','Expires')}: ${new Date(item.expiresAt).toLocaleString(t('zh-CN','en-US'))}`:t(`首次激活起 ${item.durationDays} 天`,`${item.durationDays} days from first activation`)}</p></div>):<p className="text-sm">{t('尚无独立运行授权。若该 EA 要求授权码，请联系管理员领取；原有下载权限不受影响。','No standalone runtime authorization. If this EA asks for a code, contact the administrator. Existing download permissions remain available.')}</p>}<p className="text-xs text-slate-400">{t('更换账号或电脑前，请联系管理员重置运行授权绑定。','Before changing accounts or computers, ask the administrator to reset the runtime binding.')}</p></Panel>
      <Panel className="space-y-3 p-4"><h3 className="font-bold">{t('只读账户数据连接','Read-only account reporting')}</h3><p className="text-xs leading-6 text-slate-400">{t('账户动态使用单独的连接密钥，与运行授权码相互独立。设备识别信息由上报程序自动发送。','Account activity uses a separate reporting credential, independent of the runtime code. The reporter sends the terminal identifier automatically.')}</p>{state.connections.length?state.connections.map(item=><p key={item.id} className="break-words text-sm">{item.label} · {item.status==='revoked'?t('连接已失效','Connection inactive'):item.accountMask?t('已自动绑定','Automatically bound'):t('尚未绑定，等待终端首次连接','Not bound; waiting for first terminal connection')}{item.accountMask?` · ${item.accountMask}`:''}</p>):<p className="text-sm">{t('尚未创建账户数据连接。','No account reporting connection created.')}</p>}</Panel>
    </>}
    {!!license.bindings?.length&&<Panel className="space-y-2 p-4"><h3 className="font-bold">{t('历史绑定记录（仅供参考）','Historical bindings (reference only)')}</h3><p className="break-words text-xs text-slate-400">{license.bindings.map(item=>`${item.type==='device'?t('终端','Terminal'):t('交易账号','Trading account')}: ${item.mask}`).join(' · ')}</p><p className="text-xs text-slate-400">{t('这些记录来自旧版流程，不代表新的运行授权已自动绑定。','These records belong to the legacy flow and do not prove a current runtime authorization binding.')}</p></Panel>}
    <p className="text-xs leading-6 text-slate-400">{t('不收集交易密码或交易所 API Secret。设备指纹在终端自动生成，不需要手动获取或粘贴。','Trading passwords and exchange API secrets are not accepted. Terminal identifiers are generated automatically; no manual copy or entry is needed.')}</p>
    <Button className="w-full" onClick={onOpenActivity}>{t('查看运行授权与账户动态','View runtime authorizations and account activity')}</Button><Button href="/ea-integration" className="w-full">{t('使用说明与组件下载','Instructions and component downloads')}</Button><Button variant="ghost" className="w-full" onClick={onClose}>{t('关闭','Close')}</Button>
  </div>}</Drawer>;
}
