import assert from 'node:assert/strict';
import { settingsSchema } from '../lib/validation.js';

// Exercise persisted administrator input boundaries, including rollback to classic.
for (const frontendDesign of ['classic', 'editorial']) {
  for (const adminDesign of ['classic', 'editorial']) {
    const result = settingsSchema.safeParse({ frontendDesign, adminDesign });
    assert.equal(result.success, true);
    assert.equal(result.data.frontendDesign, frontendDesign);
    assert.equal(result.data.adminDesign, adminDesign);
  }
}
assert.equal(settingsSchema.safeParse({ siteName: 'Nexus Quant' }).success, true, 'legacy settings remain valid');
assert.equal(settingsSchema.safeParse({ homeModules: [] }).success, true, 'all modules can be disabled');
assert.equal(settingsSchema.safeParse({ homeModules: ['articles', 'hero', 'featured'] }).success, true, 'module order is configurable');
for (const invalid of [
  { frontendDesign: 'visitor-custom' }, { adminDesign: 'unknown' },
  { homeModules: ['hero', 'hero'] }, { homeModules: ['javascript'] },
  { featuredRotationSeconds: 2 }, { featuredRotationSeconds: 61 },
  { featuredRotationSeconds: 3.5 }, { featuredAutoRotate: 'false' },
  { homeArticleCount: 0 }, { homeArticleCount: 13 },
  { homeHeroTitle: 'a'.repeat(81) }, { homeHeroDescription: 'a'.repeat(301) },
]) assert.equal(settingsSchema.safeParse(invalid).success, false, JSON.stringify(invalid));
assert.equal(settingsSchema.safeParse({ featuredAutoRotate: false, featuredRotationSeconds: 3, homeArticleCount: 12 }).success, true);
console.log('Site design settings passed: independent themes, legacy compatibility, module order and input limits');

for (const value of [
  {socialXUrl:'https://x.com/nexus',telegramGroupUrl:'https://t.me/+invite',contactEmail:'contact@example.com'},
  {socialXUrl:'',telegramGroupUrl:''},
]) assert.equal(settingsSchema.safeParse(value).success,true);
for (const value of [
  {socialXUrl:'javascript:alert(1)'},{socialXUrl:'https://x.com.evil.test/nexus'},
  {socialXUrl:'https://attacker@x.com/nexus'},{telegramGroupUrl:'http://t.me/nexus'},
  {telegramGroupUrl:'https://example.com/nexus'},
]) assert.equal(settingsSchema.safeParse(value).success,false);
console.log('Footer contact validation passed: allowed platforms, empty links, protocol and credential boundaries');
