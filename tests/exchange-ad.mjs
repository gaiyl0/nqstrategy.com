import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { settingsSchema } from '../lib/validation.js';
import { DEFAULT_COMMUNITY_CONTENT } from '../lib/community-content.js';

const root = process.cwd();
const route = fs.readFileSync(path.join(root, 'app', 'api', 'settings', 'route.js'), 'utf8');
const home = fs.readFileSync(path.join(root, 'app', 'components', 'HomeView.js'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'app', 'tianwei', 'page.js'), 'utf8');
const appPage = fs.readFileSync(path.join(root, 'app', 'page.js'), 'utf8');

const validAd = {
  exchangeAdEnabled: true,
  exchangeAdTitle: 'Connect to global markets',
  exchangeAdDescription: 'A configurable exchange partner message.',
  exchangeAdCta: 'Learn more',
  exchangeAdUrl: 'https://exchange.example/partner',
  exchangeAdCta2: 'Open details',
  exchangeAdUrl2: 'https://second.example/partner',
};
assert.equal(settingsSchema.safeParse(validAd).success, true);
assert.equal(settingsSchema.safeParse({ ...validAd, exchangeAdUrl: 'javascript:alert(1)' }).success, false);
assert.equal(settingsSchema.safeParse({ ...validAd, exchangeAdTitle: 'x'.repeat(101) }).success, false);
assert.equal(settingsSchema.safeParse({ ...validAd, exchangeAdDescription: 'x'.repeat(301) }).success, false);
assert.equal(settingsSchema.safeParse({ ...validAd, exchangeAdCta: 'x'.repeat(41) }).success, false);
assert.equal(settingsSchema.safeParse({ ...validAd, exchangeAdUrl2: 'javascript:alert(1)' }).success, false);
assert.equal(settingsSchema.safeParse({ ...validAd, exchangeAdCta2: 'x'.repeat(41) }).success, false);
assert.equal(settingsSchema.safeParse({ featuredProductIds: [1, 2, 3] }).success, true, 'three selected homepage strategies must validate');
assert.equal(settingsSchema.safeParse({ featuredProductIds: [1, 1] }).success, false, 'featured strategies cannot be duplicated');
assert.equal(settingsSchema.safeParse({ featuredProductIds: [1, 2, 3, 4] }).success, false, 'featured strategies are limited to three slots');

assert.equal(settingsSchema.safeParse({ communityContent: DEFAULT_COMMUNITY_CONTENT }).success, true, 'default community content must satisfy the editor schema');
assert.equal(settingsSchema.safeParse({ communityContent: { ...DEFAULT_COMMUNITY_CONTENT, news: [{ ...DEFAULT_COMMUNITY_CONTENT.news[0], url: 'javascript:alert(1)' }] } }).success, false, 'community links must reject executable schemes');
assert.equal(settingsSchema.safeParse({ communityContent: { ...DEFAULT_COMMUNITY_CONTENT, news: [{ ...DEFAULT_COMMUNITY_CONTENT.news[0], date: '2026-99-99' }] } }).success, false, 'community dates must be valid calendar dates');
assert.equal(settingsSchema.safeParse({ communityContent: { ...DEFAULT_COMMUNITY_CONTENT, documents: Array(13).fill(DEFAULT_COMMUNITY_CONTENT.documents[0]) } }).success, false, 'community document count must be bounded');

for (const key of Object.keys(validAd)) assert.match(route, new RegExp(`'${key}'`), `public settings must include ${key}`);
assert.match(route, /smtpPass/, 'SMTP secrets remain supported for administrators');
assert.match(route, /'communityContent'/, 'community editorial content is public');
assert.match(route, /JSON\.stringify\(value\)/, 'structured community content must be stored as JSON');
assert.match(route, /getSessionUser\(\)/, 'settings writes must retain server-side session authorization');
assert.match(home, /adEnabled&&adTitle&&adDescription/, 'the ad appears only when enabled and configured with required copy');
assert.match(home, /safeExchangeAdUrl/, 'homepage must validate whether an ad destination is configured');
assert.match(home, /href="\/api\/analytics\/ad-click"/, 'homepage ad clicks must pass through the server-side counter');
assert.match(home, /href="\/api\/analytics\/ad-click\?button=2"/, 'second button must pass through its own server-side slot');
assert.match(fs.readFileSync(path.join(root,'app','components','EditorialHome.js'),'utf8'), /href="\/api\/analytics\/ad-click\?button=2"/, 'editorial theme must render the second button');
assert.match(home, /rel="noopener noreferrer sponsored"/, 'external sponsor links must be isolated and marked sponsored');
assert.match(home, /featuredProductIds/, 'homepage must consume administrator-selected featured strategies');
assert.match(home, /setInterval/, 'homepage feature area must rotate configured strategies');
assert.match(admin, /Enable ad slot/, 'administrator can enable or disable the ad slot');
assert.match(admin, /首页顶部精选 EA/, 'administrator must be able to configure the homepage feature area');
assert.match(admin, /COMMUNITY_EDITOR_SECTIONS/, 'administrator can edit community editorial fields');
assert.match(appPage, /communityContent: siteSettings\?\.communityContent/, 'forum receives server-managed public editorial content');
assert.match(appPage, /<HomeView[^>]*siteSettings=\{siteSettings\}/, 'homepage receives public settings from the settings API');

console.log('Exchange ad tests passed: schema limits, URL validation, public settings, admin controls, and homepage rendering');
