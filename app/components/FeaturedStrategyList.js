import { ShieldCheck } from 'lucide-react';
import { Panel } from './ui/UiKit';

export default function FeaturedStrategyList({ products, renderCard, t }) {
  if (!products.length) return <Panel className="home-featured-empty flex items-center gap-3 p-4"><ShieldCheck className="h-5 w-5 shrink-0 text-cyan-300" /><p className="text-sm text-slate-400">{t('暂无精选 EA，您可以查看策略市场。', 'No featured EAs yet. Explore the strategy market.')}</p></Panel>;
  return <div className="home-featured-grid" data-count={products.length} role="list" aria-label={t('精选 EA 策略', 'Featured EA strategies')}>
    {products.map(product => <div key={product.id} className="home-featured-item min-w-0" role="listitem">{renderCard(product, products.length === 1)}</div>)}
  </div>;
}
