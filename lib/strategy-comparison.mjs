export const COMPARISON_MIN = 2;
export const COMPARISON_MAX = 4;

export const VERIFICATION_RANK = {
  unverified: 0,
  screenshot_reviewed: 1,
  report_verified: 2,
  reproducible_backtest: 3,
  platform_rerun: 4,
  live_verified: 5,
};

export function parseCsv(value) {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

export function parseComparisonState(search = '') {
  const params = new URLSearchParams(String(search).replace(/^\?/, ''));
  const ids = [...new Set(parseCsv(params.get('compare')).map(Number).filter(Number.isSafeInteger).filter(id => id > 0))].slice(0, COMPARISON_MAX);
  return {
    ids,
    q: (params.get('q') || '').slice(0, 100),
    pair: (params.get('pair') || '').slice(0, 40),
    type: (params.get('type') || '').slice(0, 40),
    verification: Object.hasOwn(VERIFICATION_RANK, params.get('verification')) ? params.get('verification') : '',
    maxDrawdown: numberParam(params.get('maxDrawdown'), 0, 100),
    maxPrice: numberParam(params.get('maxPrice'), 0, 1_000_000),
    page: Math.max(1,Math.min(100000,Number.parseInt(params.get('page')||'1',10)||1)),
  };
}

function numberParam(value, min, max) {
  if (value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function serializeComparisonState(state) {
  const params = new URLSearchParams();
  if (state.ids?.length) params.set('compare', state.ids.slice(0, COMPARISON_MAX).join(','));
  if (state.q) params.set('q', state.q);
  if (state.pair) params.set('pair', state.pair);
  if (state.type) params.set('type', state.type);
  if (state.verification) params.set('verification', state.verification);
  if (state.maxDrawdown !== null && state.maxDrawdown !== '') params.set('maxDrawdown', String(state.maxDrawdown));
  if (state.maxPrice !== null && state.maxPrice !== '') params.set('maxPrice', String(state.maxPrice));
  if (state.page && state.page > 1) params.set('page', String(state.page));
  return params.toString();
}

export function filterStrategies(products, filters) {
  return products.filter(product => {
    const pairs = parseCsv(product.pairs).map(item => item.toLowerCase());
    const types = parseCsv(product.ea_type);
    const level = product.verification?.level || 'unverified';
    const drawdown = Number(product.metrics?.maxDrawdownPercent);
    const price = Number(product.price);
    return (!filters.pair || pairs.includes(filters.pair.toLowerCase()))
      && (!filters.type || types.includes(filters.type))
      && (!filters.verification || VERIFICATION_RANK[level] >= VERIFICATION_RANK[filters.verification])
      && (filters.maxDrawdown === null || (Number.isFinite(drawdown) && drawdown <= Number(filters.maxDrawdown)))
      && (filters.maxPrice === null || (Number.isFinite(price) && price <= Number(filters.maxPrice)));
  });
}

export function comparisonAvailability(product) {
  return Boolean(product?.metrics?.reviewedAt && product?.report && product?.currentVersion);
}

export function selectComparison(ids, productId) {
  if (ids.includes(productId)) return ids.filter(id => id !== productId);
  if (ids.length >= COMPARISON_MAX) return ids;
  return [...ids, productId];
}
