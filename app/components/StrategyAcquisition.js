"use client";

import { useState } from 'react';
import { Coins, Download } from 'lucide-react';
import usePointSnapshot from '../hooks/usePointSnapshot';
import { strategyAcquisition } from '@/lib/strategy-acquisition.mjs';
import { Button } from './ui/UiKit';

export default function StrategyAcquisition({ product, user, owned, onLogin, onTasks, onProfile, onRedeem, onFree, publicMarketUrl, t }) {
  const [busy, setBusy] = useState(false);
  const userId = user?.id;
  const {points,error,loading,retry}=usePointSnapshot(userId,{summary:true,disabled:owned||userId===product.author_user_id||Boolean(publicMarketUrl)});
  const summary=error||loading?null:points;
  const quote = strategyAcquisition(product, { userId, owned, balance: summary?.balance });
  const run = async action => { if (busy) return; setBusy(true); try { await action(product); } finally { setBusy(false); } };
  const labels = {
    owned: t('已获取，前往下载与授权', 'Owned: downloads and licenses'),
    author: t('管理我的策略与版本', 'Manage my strategy and versions'),
    unavailable: t('策略暂不可获取', 'Strategy unavailable'),
    no_version: t('暂无已发布的下载版本', 'No published download version'),
    free: t('免费获取', 'Get for free'),
    unpriced: t('作者尚未设置积分价格', 'Points price not set'),
    login: t('登录后查看积分并兑换', 'Sign in to view points and redeem'),
    loading: t('正在读取积分', 'Loading points'),
    insufficient: t('获得积分，再兑换', 'Earn points to redeem'),
    redeem: t(`使用 ${quote.price} 积分兑换`, `Redeem for ${quote.price} points`),
  };
  const action = quote.state === 'owned' || quote.state === 'author' ? onProfile : quote.state === 'free' ? () => user ? run(onFree) : onLogin() : quote.state === 'login' ? onLogin : quote.state === 'insufficient' ? onTasks : quote.state === 'redeem' ? () => run(onRedeem) : null;
  return <section className="strategy-acquisition rounded-xl border p-5" aria-label={t('获取策略', 'Get strategy')}>
    <h2 className="flex items-center gap-2 text-base font-bold"><Coins className="h-5 w-5"/>{t('获取与下载', 'Access and download')}</h2>
    {publicMarketUrl ? <><p className="mt-3 text-sm leading-6">{t('在市场登录后查看自己的积分与获取资格。兑换成功后，在个人中心下载程序并管理授权。', 'Sign in in the market to check points and eligibility. After redemption, download and manage licenses in your profile.')}</p><a href={publicMarketUrl} className="acquisition-primary mt-4 flex min-h-11 items-center justify-center rounded-lg border px-4 py-3 text-sm font-bold">{t('前往市场获取此策略', 'Get this strategy in the market')}</a></> : <>
      {user && !['owned','author'].includes(quote.state) && <p className="mt-4 text-sm" aria-live="polite">{t('我的可用积分', 'My available points')}：<strong>{quote.balance ?? '—'}</strong></p>}
      {quote.gap > 0 && <p className="mt-2 text-sm leading-6">{t(`还差 ${Number(quote.gap.toFixed(2))} 积分。任务奖励在审核通过后才计入余额。`, `You need ${Number(quote.gap.toFixed(2))} more points. Reviewed task rewards count only after approval.`)}</p>}
      {error && userId != null && !['owned','author'].includes(quote.state) && <div role="alert" className="mt-3 text-sm"><p>{t('积分读取失败，请重试或进入积分中心。', 'Points could not load. Retry or open the point center.')}</p><Button className="mt-2" loading={loading} onClick={retry}>{t('重新读取积分', 'Retry points')}</Button></div>}
      <Button className="acquisition-primary mt-4 w-full" variant="primary" icon={Download} loading={busy} disabled={!action || busy} onClick={action}>{labels[quote.state]}</Button>
      {!['owned','author'].includes(quote.state) && <Button className="mt-2 w-full" onClick={onTasks}>{t('积分任务与充值', 'Point tasks and recharge')}</Button>}
    </>}
    <ol className="mt-4 flex gap-2 border-t pt-4 text-xs leading-6"><li className="flex-1">1 · {t('获得积分','Get points')}</li><li className="flex-1">2 · {t('确认兑换','Redeem')}</li><li className="flex-1">3 · {t('个人中心下载','Profile download')}</li></ol>
    <p className="mt-3 text-xs leading-6">{t('可下载版本与运行授权以个人中心实际记录为准。充值渠道是否开放，以积分中心为准。', 'Your profile determines available versions and licenses. Check the point center for available recharge channels.')}</p>
  </section>;
}
