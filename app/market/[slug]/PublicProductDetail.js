"use client";

import Link from 'next/link';
import {ArrowLeft} from 'lucide-react';
import StrategyDetail from '@/app/components/StrategyDetail';
import {useLanguage} from '@/app/hooks/useAppShell';


export default function PublicProductDetail({product}) {
  const {t}=useLanguage();
  const marketUrl = `/?route=market&q=${encodeURIComponent(product.title)}`;
  return <StrategyDetail product={product} t={t}
    back={<><Link href="/?route=market" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-300"><ArrowLeft className="h-4 w-4"/>{t('返回市场列表','Back to Market')}</Link></>}
    actions={<Link href={marketUrl} className="flex min-h-11 items-center justify-center rounded-lg border border-cyan-400/50 bg-cyan-500/15 px-5 py-3 text-sm font-bold text-cyan-200">{t('前往市场查看获取与授权','View access and licensing in the market')}</Link>}
    ratingAction={<Link href={marketUrl} className="inline-flex min-h-11 items-center rounded-lg border border-slate-600 px-4 text-sm text-slate-300">{t('前往市场登录并评分','Sign in and rate in the market')}</Link>}
  />;
}
