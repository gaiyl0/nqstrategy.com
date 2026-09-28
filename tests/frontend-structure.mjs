import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'app', 'page.js');
const page = fs.readFileSync(pagePath, 'utf8');
const lineCount = page.split(/\r?\n/).length;
const components = [
  'AppHeader',
  'UploadView',
  'ForumView',
  'ProfileView',
  'AppOverlays',
];

assert.ok(lineCount <= 600, `app/page.js regressed to ${lineCount} lines; keep orchestration separate from business views`);
for (const component of components) {
  const componentPath = path.join(root, 'app', 'components', `${component}.js`);
  assert.ok(fs.existsSync(componentPath), `${component}.js is missing`);
  assert.match(page, new RegExp(`import ${component} from './components/${component}'`));
  assert.match(page, new RegExp(`<${component}\\b`));
}
assert.match(page, /useAppRoute, useLanguage, useToast/);
assert.ok(fs.existsSync(path.join(root, 'app', 'hooks', 'useAppShell.js')), 'app shell hooks are missing');
assert.doesNotMatch(page, /<header className=/, 'header rendering belongs in AppHeader');
assert.doesNotMatch(page, /MT5 HTML 原始回测报告/, 'upload form rendering belongs in UploadView');
assert.doesNotMatch(page, /发表新主题/, 'forum rendering belongs in ForumView');
assert.doesNotMatch(page, /余额提现申请/, 'modal rendering belongs in AppOverlays');


const profileView = fs.readFileSync(path.join(root, 'app', 'components', 'ProfileView.js'), 'utf8');
for (const callback of ['handleSecureDownload', 'handleLicenseBind', 'handleLicenseToken', 'showToast']) {
  assert.match(profileView, new RegExp(`function ProfileView\\([^)]*${callback}`), `ProfileView must declare ${callback}`);
  assert.match(page, new RegExp(`<ProfileView[^\n]*${callback}`), `app/page.js must pass ${callback} to ProfileView`);
}
assert.doesNotMatch(page, /\bhandleDownload\b/, 'undefined handleDownload alias must not return');

const forumView = fs.readFileSync(path.join(root, 'app', 'components', 'ForumView.js'), 'utf8');
for (const dependency of ['products', 'handlePinPost', 'handlePinComment', 'handleReport']) {
  assert.match(forumView, new RegExp(`function ForumView\\([^)]*${dependency}`), `ForumView must declare ${dependency}`);
  assert.match(page, new RegExp(`<ForumView[^\n]*${dependency}`), `app/page.js must pass ${dependency} to ForumView`);
}
assert.doesNotMatch(page, /\bsetToastMsg\b/, 'page orchestration must use the toast hook API');

console.log(`Frontend structure tests passed: app/page.js ${lineCount} lines, ${components.length} extracted component boundaries`);
