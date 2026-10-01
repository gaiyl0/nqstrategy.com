import db from './db.js';
import { createSecurityContext } from './security.js';

const BOT_SIGNATURES = [
  ['Googlebot', /googlebot/i],
  ['Bingbot', /bingbot|adidxbot/i],
  ['Baiduspider', /baiduspider/i],
  ['YandexBot', /yandex(?:bot|images)/i],
  ['DuckDuckBot', /duckduckbot/i],
  ['Sogou Spider', /sogou.*(?:spider|web)/i],
  ['Bytespider', /bytespider/i],
  ['Applebot', /applebot/i],
  ['AhrefsBot', /ahrefsbot/i],
  ['SemrushBot', /semrushbot/i],
  ['MJ12bot', /mj12bot/i],
  ['Generic crawler', /(?:^|\b)(?:bot|crawler|spider|slurp|scrapy|httpclient)(?:\b|\/)/i],
];

function classifyUserAgent(userAgent) {
  const value = String(userAgent || '').slice(0, 300);
  const match = BOT_SIGNATURES.find(([, pattern]) => pattern.test(value));
  return { userAgent: value || null, isBot: match ? 1 : 0, botName: match?.[0] || null };
}

function safeReferrerHost(request) {
  const value = request.headers.get('referer');
  if (!value) return null;
  try { return new URL(value).hostname.slice(0, 253) || null; } catch { return null; }
}

function analyticsIdentity(request) {
  const context = createSecurityContext(request);
  return {
    visitorHash: context.sourceHash,
    referrerHost: safeReferrerHost(request),
    ...classifyUserAgent(context.userAgent),
  };
}

export function isTrackablePageRequest(request) {
  if (request.method !== 'GET') return false;
  const path = request.nextUrl.pathname;
  if (path === '/robots.txt' || path === '/sitemap.xml') return true;
  const destination = String(request.headers.get('sec-fetch-dest') || '').toLowerCase();
  const accept = String(request.headers.get('accept') || '').toLowerCase();
  return destination === 'document' || (!destination && accept.includes('text/html'));
}

export function recordSiteVisit(request) {
  const identity = analyticsIdentity(request);
  db.prepare(`INSERT INTO site_visit_events
    (visitor_hash,path,referrer_host,user_agent,is_bot,bot_name,occurred_at)
    VALUES (?,?,?,?,?,?,?)`).run(
    identity.visitorHash,
    String(request.nextUrl.pathname || '/').slice(0, 300),
    identity.referrerHost,
    identity.userAgent,
    identity.isBot,
    identity.botName,
    Date.now(),
  );
}

export function recordAdClick(request, destination) {
  const identity = analyticsIdentity(request);
  const destinationHost = new URL(destination).hostname.slice(0, 253);
  db.prepare(`INSERT INTO ad_click_events
    (slot,visitor_hash,destination_host,referrer_host,user_agent,is_bot,bot_name,occurred_at)
    VALUES ('exchange_home',?,?,?,?,?,?,?)`).run(
    identity.visitorHash,
    destinationHost,
    identity.referrerHost,
    identity.userAgent,
    identity.isBot,
    identity.botName,
    Date.now(),
  );
}

export function getSiteAnalytics({ days, limit=20, visitPage=1, clickPage=1 }) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const visitSummary = db.prepare(`SELECT
    COUNT(*) AS totalVisits,
    SUM(CASE WHEN is_bot=0 THEN 1 ELSE 0 END) AS humanVisits,
    SUM(CASE WHEN is_bot=1 THEN 1 ELSE 0 END) AS botVisits,
    COUNT(DISTINCT CASE WHEN is_bot=0 THEN visitor_hash END) AS uniqueHumanVisitors
    FROM site_visit_events WHERE occurred_at>=?`).get(cutoff);
  const adSummary = db.prepare(`SELECT
    COUNT(*) AS totalClicks,
    SUM(CASE WHEN is_bot=0 THEN 1 ELSE 0 END) AS humanClicks,
    SUM(CASE WHEN is_bot=1 THEN 1 ELSE 0 END) AS botClicks,
    COUNT(DISTINCT CASE WHEN is_bot=0 THEN visitor_hash END) AS uniqueHumanClickers
    FROM ad_click_events WHERE occurred_at>=?`).get(cutoff);
  const topPaths = db.prepare(`SELECT path,COUNT(*) AS visits,
    SUM(CASE WHEN is_bot=1 THEN 1 ELSE 0 END) AS botVisits
    FROM site_visit_events WHERE occurred_at>=? GROUP BY path ORDER BY visits DESC,path ASC LIMIT 20`).all(cutoff);
  const botBreakdown = db.prepare(`SELECT COALESCE(bot_name,'Unknown bot') AS name,COUNT(*) AS visits
    FROM site_visit_events WHERE occurred_at>=? AND is_bot=1 GROUP BY bot_name ORDER BY visits DESC,name ASC LIMIT 20`).all(cutoff);
  const daily = db.prepare(`SELECT date(occurred_at/1000,'unixepoch') AS day,
    COUNT(*) AS visits,SUM(CASE WHEN is_bot=1 THEN 1 ELSE 0 END) AS botVisits
    FROM site_visit_events WHERE occurred_at>=? GROUP BY day ORDER BY day ASC`).all(cutoff);
  const visitTotal=Number(db.prepare('SELECT COUNT(*) count FROM site_visit_events WHERE occurred_at>=?').get(cutoff).count);
  const clickTotal=Number(db.prepare('SELECT COUNT(*) count FROM ad_click_events WHERE occurred_at>=?').get(cutoff).count);
  const visitTotalPages=Math.max(1,Math.ceil(visitTotal/limit)), clickTotalPages=Math.max(1,Math.ceil(clickTotal/limit));
  const safeVisitPage=Math.min(visitPage,visitTotalPages), safeClickPage=Math.min(clickPage,clickTotalPages);
  const recentVisits=db.prepare(`SELECT id,path,referrer_host AS referrerHost,user_agent AS userAgent,is_bot AS isBot,bot_name AS botName,occurred_at AS occurredAt FROM site_visit_events WHERE occurred_at>=? ORDER BY occurred_at DESC,id DESC LIMIT ? OFFSET ?`).all(cutoff,limit,(safeVisitPage-1)*limit);
  const recentClicks=db.prepare(`SELECT id,slot,destination_host AS destinationHost,referrer_host AS referrerHost,is_bot AS isBot,bot_name AS botName,occurred_at AS occurredAt FROM ad_click_events WHERE occurred_at>=? ORDER BY occurred_at DESC,id DESC LIMIT ? OFFSET ?`).all(cutoff,limit,(safeClickPage-1)*limit);
  return { days, visitSummary, adSummary, topPaths, botBreakdown, daily, recentVisits, recentClicks, visitPagination:{page:safeVisitPage,pageSize:limit,total:visitTotal,totalPages:visitTotalPages}, clickPagination:{page:safeClickPage,pageSize:limit,total:clickTotal,totalPages:clickTotalPages} };
}

try {
  const retentionDays = Math.min(3650, Math.max(30, Number.parseInt(process.env.ANALYTICS_RETENTION_DAYS || '180', 10) || 180));
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  db.transaction(() => {
    db.prepare('DELETE FROM site_visit_events WHERE occurred_at<?').run(cutoff);
    db.prepare('DELETE FROM ad_click_events WHERE occurred_at<?').run(cutoff);
  })();
} catch {
  // Analytics cleanup must never prevent the website from starting.
}
