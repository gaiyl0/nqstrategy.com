import crypto from 'node:crypto';
import db from './db.js';
import { createSecurityContext } from './security.js';
import { resolveTrustedClientIp } from './deployment-security.mjs';
import { agentType, cookieVisitor, visitorHash, signedValue, readSigned, verifyCrawler } from './analytics-confidence.mjs';
import { decodeProductSlug } from './product-slug.mjs';

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
  return destination === 'document' || (!destination && accept.includes('text/html')) || Boolean(agentType(request.headers.get('user-agent')).name && validAnalyticsPath(path,true));
}

export function validAnalyticsPath(path,spider=false) {
  if (typeof path!=='string'||path.length>300)return false;
  if (['/','/?route=home','/?route=market','/?route=forum','/help','/privacy','/terms','/risk-disclosure','/ea-strategies','/xauusd-gold-ea'].includes(path))return true;
  if(spider && ['/robots.txt','/sitemap.xml'].includes(path))return true;
  const article=path.match(/^\/forum\/([1-9]\d*)$/);
  if(article)return !!db.prepare("SELECT 1 FROM posts WHERE id=? AND moderation_status='visible'").get(Number(article[1]));
  if(path.startsWith('/market/')) {
    const slug=decodeProductSlug(path.slice(8));
    return !!slug&&!!db.prepare("SELECT 1 FROM products WHERE slug=? AND status='active' AND deleted_at IS NULL AND moderation_status='visible'").get(slug);
  }
  return false;
}

function insertVisit(identity,path,kind,reason,proof=null) {
  return db.transaction(()=>{
    if(db.prepare('SELECT 1 FROM site_visit_events WHERE visitor_hash=? AND path=? AND traffic_kind=? AND occurred_at>?').get(identity.visitorHash,path,kind,Date.now()-(kind==='browser'?30000:5000)))return false;
    if(db.prepare('SELECT count(*) n FROM site_visit_events WHERE visitor_hash=? AND occurred_at>?').get(identity.visitorHash,Date.now()-60000).n>=60)return false;
    return db.prepare(`INSERT OR IGNORE INTO site_visit_events
      (visitor_hash,path,referrer_host,user_agent,is_bot,bot_name,occurred_at,traffic_kind,classification_reason,proof_id)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(identity.visitorHash,path,identity.referrerHost,identity.userAgent,kind==='spider'?1:identity.isBot,identity.botName,Date.now(),kind,reason,proof).changes>0;
  }).immediate();
}

export function issueVisitProof(request,path,visitor,now=Date.now()) {
  if(!validAnalyticsPath(path)||!agentType(request.headers.get('user-agent')).browser)return null;
  return signedValue({at:now,exp:now+120000,path,visitor:visitorHash(visitor.id),ua:visitorHash(request.headers.get('user-agent')||''),nonce:crypto.randomUUID()});
}

export function confirmBrowserVisit(request,input,now=Date.now()) {
  if(!input||input.visible!==true||input.webdriver!==false)return false;
  const visitor=cookieVisitor(request,now),proof=readSigned(input.proof,now);
  if(!visitor||!proof||now-proof.at<5000||proof.exp-proof.at!==120000||!validAnalyticsPath(proof.path)||!agentType(request.headers.get('user-agent')).browser)return false;
  if(proof.visitor!==visitorHash(visitor.id)||proof.ua!==visitorHash(request.headers.get('user-agent')||'')||typeof proof.nonce!=='string')return false;
  const identity={...analyticsIdentity(request),visitorHash:proof.visitor};
  return insertVisit(identity,proof.path,'browser','visible_browser_confirmation',proof.nonce);
}

export async function recordSiteVisit(request) {
  const agent=agentType(request.headers.get('user-agent'));
  const path=String(request.nextUrl.pathname||'/');
  if(!validAnalyticsPath(path,true)||agent.excluded||!agent.name)return false;
  if(request.headers.has('next-router-prefetch')||request.headers.get('purpose')==='prefetch')return false;
  const identity = analyticsIdentity(request);
  const source=resolveTrustedClientIp(request);
  const verified=source.trusted&&await verifyCrawler(source.ip,agent.name);
  identity.botName=agent.name;identity.isBot=1;
  return insertVisit(identity,path,verified?'spider':'unknown',verified?'forward_confirmed_dns':'unverified_crawler');
}

export async function recordAdClick(request, destination,excludeAdmin=false) {
  if(excludeAdmin)return false;
  const agent=agentType(request.headers.get('user-agent'));
  if(agent.excluded)return false;
  const identity = analyticsIdentity(request);
  const visitor=cookieVisitor(request);
  if(visitor)identity.visitorHash=visitorHash(visitor.id);
  const confirmed=agent.browser&&visitor&&request.headers.get('sec-fetch-user')==='?1'&&db.prepare("SELECT 1 FROM site_visit_events WHERE visitor_hash=? AND traffic_kind='browser' AND occurred_at>?").get(identity.visitorHash,Date.now()-1800000);
  const kind=confirmed?'browser':'unknown';
  const destinationHost = new URL(destination).hostname.slice(0, 253);
  if(db.prepare('SELECT 1 FROM ad_click_events WHERE visitor_hash=? AND destination_host=? AND occurred_at>?').get(identity.visitorHash,destinationHost,Date.now()-30000))return false;
  db.prepare(`INSERT INTO ad_click_events
    (slot,visitor_hash,destination_host,referrer_host,user_agent,is_bot,bot_name,occurred_at,traffic_kind,classification_reason)
    VALUES ('exchange_home',?,?,?,?,?,?,?,?,?)`).run(
    identity.visitorHash,
    destinationHost,
    identity.referrerHost,
    identity.userAgent,
    identity.isBot,
    identity.botName,
    Date.now(),
    kind,
    confirmed?'confirmed_browser_navigation':'unconfirmed_click',
  );
  return !!confirmed;
}

export function getSiteAnalytics({ days, limit=20, visitPage=1, clickPage=1 }) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const visitSummary = db.prepare(`SELECT
    COUNT(*) AS totalVisits,
    SUM(CASE WHEN traffic_kind='browser' THEN 1 ELSE 0 END) AS humanVisits,
    SUM(CASE WHEN traffic_kind='spider' THEN 1 ELSE 0 END) AS botVisits,
    COUNT(DISTINCT CASE WHEN traffic_kind='browser' THEN visitor_hash END) AS uniqueHumanVisitors
    FROM site_visit_events WHERE traffic_kind IN ('browser','spider') AND occurred_at>=?`).get(cutoff);
  const adSummary = db.prepare(`SELECT
    COUNT(*) AS totalClicks,
    SUM(CASE WHEN traffic_kind='browser' THEN 1 ELSE 0 END) AS humanClicks,
    SUM(CASE WHEN traffic_kind='spider' THEN 1 ELSE 0 END) AS botClicks,
    COUNT(DISTINCT CASE WHEN traffic_kind='browser' THEN visitor_hash END) AS uniqueHumanClickers
    FROM ad_click_events WHERE traffic_kind IN ('browser','spider') AND occurred_at>=?`).get(cutoff);
  const topPaths = db.prepare(`SELECT path,COUNT(*) AS visits,
    SUM(CASE WHEN traffic_kind='spider' THEN 1 ELSE 0 END) AS botVisits
    FROM site_visit_events WHERE traffic_kind IN ('browser','spider') AND occurred_at>=? GROUP BY path ORDER BY visits DESC,path ASC LIMIT 20`).all(cutoff);
  const botBreakdown = db.prepare(`SELECT COALESCE(bot_name,'Unknown bot') AS name,COUNT(*) AS visits
    FROM site_visit_events WHERE traffic_kind IN ('browser','spider') AND occurred_at>=? AND traffic_kind='spider' GROUP BY bot_name ORDER BY visits DESC,name ASC LIMIT 20`).all(cutoff);
  const daily = db.prepare(`SELECT date(occurred_at/1000,'unixepoch') AS day,
    COUNT(*) AS visits,SUM(CASE WHEN traffic_kind='spider' THEN 1 ELSE 0 END) AS botVisits
    FROM site_visit_events WHERE traffic_kind IN ('browser','spider') AND occurred_at>=? GROUP BY day ORDER BY day ASC`).all(cutoff);
  const visitTotal=Number(db.prepare("SELECT COUNT(*) count FROM site_visit_events WHERE traffic_kind IN ('browser','spider') AND occurred_at>=?").get(cutoff).count);
  const clickTotal=Number(db.prepare("SELECT COUNT(*) count FROM ad_click_events WHERE traffic_kind IN ('browser','spider') AND occurred_at>=?").get(cutoff).count);
  const visitTotalPages=Math.max(1,Math.ceil(visitTotal/limit)), clickTotalPages=Math.max(1,Math.ceil(clickTotal/limit));
  const safeVisitPage=Math.min(visitPage,visitTotalPages), safeClickPage=Math.min(clickPage,clickTotalPages);
  const recentVisits=db.prepare(`SELECT id,path,referrer_host AS referrerHost,user_agent AS userAgent,is_bot AS isBot,traffic_kind AS trafficKind,classification_reason AS classificationReason,bot_name AS botName,occurred_at AS occurredAt FROM site_visit_events WHERE traffic_kind IN ('browser','spider') AND occurred_at>=? ORDER BY occurred_at DESC,id DESC LIMIT ? OFFSET ?`).all(cutoff,limit,(safeVisitPage-1)*limit);
  const recentClicks=db.prepare(`SELECT id,slot,destination_host AS destinationHost,referrer_host AS referrerHost,is_bot AS isBot,traffic_kind AS trafficKind,classification_reason AS classificationReason,bot_name AS botName,occurred_at AS occurredAt FROM ad_click_events WHERE traffic_kind IN ('browser','spider') AND occurred_at>=? ORDER BY occurred_at DESC,id DESC LIMIT ? OFFSET ?`).all(cutoff,limit,(safeClickPage-1)*limit);
  const excludedSummary=db.prepare("SELECT SUM(traffic_kind='legacy') legacyVisits,SUM(traffic_kind='unknown') unknownVisits FROM site_visit_events WHERE occurred_at>=?").get(cutoff);
  const excludedClicks=db.prepare("SELECT SUM(traffic_kind='legacy') legacyClicks,SUM(traffic_kind='unknown') unknownClicks FROM ad_click_events WHERE occurred_at>=?").get(cutoff);
  return { excludedSummary:{...excludedSummary,...excludedClicks}, days, visitSummary, adSummary, topPaths, botBreakdown, daily, recentVisits, recentClicks, visitPagination:{page:safeVisitPage,pageSize:limit,total:visitTotal,totalPages:visitTotalPages}, clickPagination:{page:safeClickPage,pageSize:limit,total:clickTotal,totalPages:clickTotalPages} };
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
