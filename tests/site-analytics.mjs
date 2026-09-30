import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const databasePath = path.resolve('.tmp-site-analytics-test.db');
for (const suffix of ['', '-wal', '-shm']) { try { fs.rmSync(`${databasePath}${suffix}`); } catch {} }
process.env.NEXUS_DB_PATH = databasePath;
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'site-analytics-test-secret-0123456789abcdef';

const { default: db } = await import('../lib/db.js');
const { getSiteAnalytics, isTrackablePageRequest, recordAdClick, recordSiteVisit } = await import('../lib/site-analytics.js');

const request = ({ path: pathname = '/', userAgent = 'Mozilla/5.0', accept = 'text/html', destination = 'document', referrer = '' } = {}) => ({
  method: 'GET',
  nextUrl: { pathname },
  headers: new Headers({
    accept,
    'sec-fetch-dest': destination,
    'user-agent': userAgent,
    ...(referrer ? { referer: referrer } : {}),
  }),
});

const human = request({ path: '/market', referrer: 'https://search.example/results?q=nexus' });
const spider = request({ path: '/robots.txt', userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', accept: 'text/plain', destination: '' });
assert.equal(isTrackablePageRequest(human), true);
assert.equal(isTrackablePageRequest(spider), true);
assert.equal(isTrackablePageRequest(request({ path: '/logo.png', accept: 'image/png', destination: 'image' })), false);

recordSiteVisit(human);
recordSiteVisit(spider);
recordAdClick(human, new URL('https://exchange.example/partner'));

const analytics = getSiteAnalytics({ days: 30, limit: 20 });
assert.equal(analytics.visitSummary.totalVisits, 2);
assert.equal(analytics.visitSummary.humanVisits, 1);
assert.equal(analytics.visitSummary.botVisits, 1);
assert.equal(analytics.botBreakdown[0].name, 'Googlebot');
assert.equal(analytics.adSummary.totalClicks, 1);
assert.equal(analytics.adSummary.humanClicks, 1);
assert.equal(analytics.recentClicks[0].destinationHost, 'exchange.example');
assert.equal(analytics.recentVisits.some(item => item.path === '/robots.txt' && item.isBot === 1), true);
assert.equal(db.prepare('SELECT 1 FROM pragma_table_info(\'site_visit_events\') WHERE name=\'visitor_hash\'').get()[1], 1);

const proxy = fs.readFileSync(path.resolve('proxy.js'), 'utf8');
const adRoute = fs.readFileSync(path.resolve('app/api/analytics/ad-click/route.js'), 'utf8');
const admin = fs.readFileSync(path.resolve('app/tianwei/page.js'), 'utf8');
assert.match(proxy, /recordSiteVisit\(request\)/, 'page requests must be recorded in the server proxy');
assert.match(adRoute, /SELECT value FROM settings WHERE key='exchangeAdUrl'/, 'redirect destination must come from server settings');
assert.doesNotMatch(adRoute, /searchParams.*(?:url|target|destination)/, 'click endpoint must not accept a client-controlled redirect destination');
assert.match(admin, /访问与广告统计/, 'admin must expose the analytics view');
assert.match(admin, /User-Agent/, 'admin must disclose bot classification semantics');

db.close();
for (const suffix of ['', '-wal', '-shm']) { try { fs.rmSync(`${databasePath}${suffix}`); } catch {} }
console.log('Site analytics tests passed: document visits, bot classification, privacy hashing, admin reporting, and controlled ad redirects');
