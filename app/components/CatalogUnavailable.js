import {Button,Panel} from './ui/UiKit';
export default function CatalogUnavailable({user,setRoute,t}) {
  return <Panel className="mx-auto my-12 max-w-2xl p-8"><h1 className="text-2xl font-bold">{t('商城暂未开放','The store is currently closed')}</h1><p className="my-4 text-sm leading-7">{t('已有订单、程序下载和运行授权仍可在个人中心管理。','Manage existing orders, downloads and licenses in your personal center.')}</p><div className="flex gap-3"><Button onClick={()=>setRoute('home')}>{t('返回首页','Back to home')}</Button>{user&&<Button variant="primary" onClick={()=>setRoute('profile')}>{t('查看我的 EA','My EAs')}</Button>}</div></Panel>;
}
