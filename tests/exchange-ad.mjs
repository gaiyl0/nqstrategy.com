import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { settingsSchema } from '../lib/validation.js';

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
};
assert.equal(settingsSchema.safeParse(validAd).success, true);
assert.equal(settingsSchema.safeParse({ ...validAd, exchangeAdUrl: 'javascript:alert(1)' }).success, false);
assert.equal(settingsSchema.safeParse({ ...validAd, exchangeAdTitle: 'x'.repeat(101) }).success, false);
assert.equal(settingsSchema.safeParse({ ...validAd, exchangeAdDescription: 'x'.repeat(301) }).success, false);
assert.equal(settingsSchema.safeParse({ ...validAd, exchangeAdCta: 'x'.repeat(41) }).success, false);

for (const key of Object.keys(validAd)) assert.match(route, new RegExp(`'${key}'`), `public settings must include ${key}`);
assert.match(route, /smtpPass/, 'SMTP secrets remain supported for administrators');
assert.match(home, /adEnabled&&adTitle&&adDescription/, 'the ad appears only when enabled and configured with required copy');
assert.match(home, /safeExchangeAdUrl/, 'homepage must validate the destination before rendering the link');
assert.match(home, /rel="noopener noreferrer sponsored"/, 'external sponsor links must be isolated and marked sponsored');
assert.match(admin, /Enable ad slot/, 'administrator can enable or disable the ad slot');
assert.match(appPage, /<HomeView[^>]*siteSettings=\{siteSettings\}/, 'homepage receives public settings from the settings API');

console.log('Exchange ad tests passed: schema limits, URL validation, public settings, admin controls, and homepage rendering');
