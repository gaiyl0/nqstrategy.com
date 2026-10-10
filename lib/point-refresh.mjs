const eventName = 'nq:points-changed';
const storageKey = 'nq:points-refresh';

// Invalidation only: never broadcast balances or private account information.
export function notifyPointChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(eventName));
  try { window.localStorage.setItem(storageKey, `${Date.now()}:${Math.random()}`); } catch { /* Storage may be disabled. */ }
}

export function affectsPoints(input, init, payload) {
  let path;
  try { path = new URL(typeof input === 'string' ? input : input.url, 'https://nexus.invalid').pathname; } catch { return false; }
  const method = String(init.method || input?.method || 'GET').toUpperCase();
  if (method === 'GET') return path === '/api/points/recharge' && payload?.order?.status === 'paid';
  if (method !== 'POST') return false;
  return ['/api/points', '/api/points/refunds', '/api/points/withdrawals', '/api/points/admin', '/api/points/finance', '/api/posts', '/api/comments', '/api/social'].includes(path);
}

export function subscribePointRefresh(refresh, target = window) {
  let lastRefresh = Date.now();
  const run = force => {
    if (target.document.visibilityState === 'hidden') return;
    if (!force && Date.now() - lastRefresh < 10000) return;
    lastRefresh = Date.now();
    void refresh();
  };
  const changed = () => run(true);
  const resume = () => run(false);
  const online = () => run(true);
  const storage = event => { if (event.key === storageKey) changed(); };
  target.addEventListener(eventName, changed);
  target.addEventListener('storage', storage);
  target.addEventListener('focus', resume);
  target.addEventListener('online', online);
  target.document.addEventListener('visibilitychange', resume);
  const timer = target.setInterval(resume, 60000);
  return () => {
    target.clearInterval(timer);
    target.removeEventListener(eventName, changed);
    target.removeEventListener('storage', storage);
    target.removeEventListener('focus', resume);
    target.removeEventListener('online', online);
    target.document.removeEventListener('visibilitychange', resume);
  };
}

// Only the newest read may publish. Abort and timeout also cover response parsing.
export function createPointReader(read, publish, timeoutMs = 15000) {
  let generation = 0, controller, disposed = false;
  const refresh = async () => {
    if (disposed) return;
    const current = ++generation;
    controller?.abort();
    const request = new AbortController();
    controller = request;
    publish({ loading: true, error: false });
    let timer;
    try {
      const data = await Promise.race([
        read(request.signal),
        new Promise((_, reject) => { timer = setTimeout(() => { request.abort(); reject(new Error('POINT_READ_TIMEOUT')); }, timeoutMs); }),
      ]);
      if (!data?.success || !Number.isFinite(data.balance) || data.balance < 0) throw new Error('POINT_READ_INVALID');
      if (!disposed && current === generation) publish({ data, loading: false, error: false });
    } catch {
      if (!disposed && current === generation) publish({ loading: false, error: true });
    } finally { clearTimeout(timer); }
  };
  return { refresh, dispose() { disposed = true; generation++; controller?.abort(); } };
}
