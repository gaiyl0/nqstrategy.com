export function strategyAcquisition(product, { userId = null, owned = false, balance = null } = {}) {
  const price = Number(product?.points_price);
  const free = Number(product?.price) === 0;
  const priced = Number(product?.price) > 0 && Number.isInteger(price) && price > 0;
  const knownBalance = typeof balance === 'number' && Number.isFinite(balance) && balance >= 0;
  const gap = priced && knownBalance ? Math.max(0, price - balance) : null;
  const owner = userId != null && product?.author_user_id === userId;
  const available = product?.status === 'active' && !product?.deleted_at;
  const versionReady = Boolean(product?.currentVersion?.id && product.currentVersion.status === 'published');
  const state = owned ? 'owned' : owner ? 'author' : !available ? 'unavailable' : !versionReady ? 'no_version' : free ? 'free' : !priced ? 'unpriced' : userId == null ? 'login' : !knownBalance ? 'loading' : gap > 0 ? 'insufficient' : 'redeem';
  return { state, price: priced ? price : null, gap, balance: knownBalance ? balance : null };
}
