import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');
const kit = fs.readFileSync(path.join(root, 'app', 'components', 'ui', 'UiKit.js'), 'utf8');
const market = [
  fs.readFileSync(path.join(root, 'app', 'components', 'StrategyAcquisition.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'app', 'components', 'MarketView.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'app', 'components', 'StrategyMarketCatalog.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'app', 'components', 'MarketFilters.js'), 'utf8'),
].join('\n');
const profile = fs.readFileSync(path.join(root, 'app', 'components', 'ProfileView.js'), 'utf8');
const forum = ['ForumView.js', 'CommunityResources.js'].map(file => fs.readFileSync(path.join(root, 'app', 'components', file), 'utf8')).join('\n');
const communityContent = fs.readFileSync(path.join(root, 'lib', 'community-content.js'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'app', 'tianwei', 'page.js'), 'utf8') + fs.readFileSync(path.join(root, 'app', 'tianwei', 'AdminWorkbench.js'), 'utf8');
assert.match(admin, /activeTab\s*===\s*'points'\s*&&\s*<PointsAdmin\b/, 'the points navigation must render its task administration panel');
const desktopCss = fs.readFileSync(path.join(root, 'app', 'reference-desktop.css'), 'utf8');
assert.match(desktopCss, /\.reference-forum-aside\s*\{[^}]*grid-template-columns:minmax\(0,1fr\)[^}]*min-width:0/, 'long EA descriptions must not expand the forum sidebar grid track');
const productReview = fs.readFileSync(path.join(root, 'app', 'tianwei', 'ProductReviewWorkspace.js'), 'utf8');
const adminLocale = fs.readFileSync(path.join(root, 'app', 'tianwei', 'admin-locale.js'), 'utf8');
const header = fs.readFileSync(path.join(root, 'app', 'components', 'AppHeader.js'), 'utf8');
const overlays = fs.readFileSync(path.join(root, 'app', 'components', 'AppOverlays.js'), 'utf8');
const comparison = fs.readFileSync(path.join(root, 'app', 'components', 'StrategyComparison.js'), 'utf8');

for (const token of ['--nq-bg', '--nq-panel', '--nq-border', '--nq-primary', '--nq-success', '--nq-warning', '--nq-danger', '--nq-radius-md', '--nq-shadow-dialog', '--nq-focus']) {
  assert.match(css, new RegExp(token), `missing design token ${token}`);
}
for (const component of ['Button', 'Panel', 'Badge', 'Field', 'Tabs', 'EmptyState', 'Skeleton', 'Notice', 'Dialog', 'Drawer']) {
  assert.match(kit, new RegExp(`export function ${component}\\b`), `missing UI primitive ${component}`);
}
assert.match(kit, /export function InteractionProvider\b/);
assert.match(kit, /export function useInteraction\b/);
assert.match(kit, /role="dialog"/);
assert.match(kit, /aria-modal="true"/);
assert.match(kit, /event\.key === 'Escape'/);
assert.match(kit, /document\.body\.style\.overflow = 'hidden'/);
assert.match(css, /prefers-reduced-motion/);

assert.match(market, /product\.metrics\?\.reviewedAt && product\.report/, 'market curves must require reviewed server metrics and an MT5 report');
assert.match(market, /No reviewed curve/, 'market must expose a truthful empty curve state');
assert.match(market, /Points price not set/, 'market must explain why a paid strategy cannot be redeemed without points pricing');
assert.match(market, /Check the point center for available recharge channels/, 'market must keep recharge visibly unavailable');
assert.match(market, /setRetryKey\(value\s*=>\s*value\s*\+\s*1\)/, 'market error retry must issue a new request');
assert.doesNotMatch(market, /Math\.random/, 'market must not generate synthetic chart data');
for (const landmark of ['SideNavigation', 'ComparisonRail', 'StrategyCard', 'market-filter']) {
  assert.match(market, new RegExp(landmark), `market visual composition is missing ${landmark}`);
}
for (const landmark of ['AssetTable', 'Licenses', 'BindingDrawer', 'No trusted return time series']) {
  assert.match(profile, new RegExp(landmark), `profile visual composition is missing ${landmark}`);
}
assert.doesNotMatch(profile, /ProfileNav|editorial-profile-nav/, 'personal center must not duplicate global navigation');
assert.match(profile, /Notifications and messages/, 'personal center must expose the inbox');
assert.match(profile, /Tasks under review/, 'profile statistics must use actual task review status');
assert.match(profile, /Trading passwords and exchange API secrets are not accepted/, 'profile binding drawer must disclose the credential boundary');
assert.doesNotMatch(profile, /placeholder=["'](?:API Key|API Secret)/, 'profile must not collect exchange API credentials');
assert.doesNotMatch(profile, /Math\.random/, 'profile must not generate synthetic portfolio data');
for (const landmark of ['ForumNavigation', 'CommunityHero', 'PostCard', 'CommunityAside', 'This page']) {
  assert.match(forum, new RegExp(landmark), `community visual composition is missing ${landmark}`);
}
assert.match(forum, /post\.views/, 'community view totals must come from post data');
assert.match(forum, /post\.comment_count/, 'community reply totals must come from post data');
assert.match(forum, /Authors, views and replies cover this page only/, 'community statistics must disclose their scope');
for (const source of [
  'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm',
  'https://www.bls.gov/news.release/archives/cpi_09112026.htm',
  'https://www.ecb.europa.eu/press/press_conference/monetary-policy-statement/2026/html/ecb.is260910~6a45359cfc.en.html',
]) assert.ok(communityContent.includes(source), `default community briefing must link to official source ${source}`);
for (const strategy of ['趋势跟随', '区间突破', '均值回归', '组合与风险']) assert.ok(communityContent.includes(strategy), `default community strategy guide is missing ${strategy}`);
assert.match(forum, /教育与研究用途，不构成投资建议或收益承诺/, 'strategy guide must disclose that it is educational, not investment advice');
assert.doesNotMatch(forum, /setSection|<NewsBriefings|<StrategyLibrary/, 'discussion feed must not contain redundant resource sections');
assert.match(forum, /<details[\s\S]*DocumentLibrary/, 'references remain accessible as an optional disclosure');
assert.match(forum, /DocumentLibrary/, 'documents tab must display its content');
assert.match(forum, /nexus_forum_post_draft/, 'forum post composer must preserve a local draft through refreshes');
assert.match(forum, /setPreview\(value => !value\)/, 'forum post composer must provide a live preview toggle');
assert.match(forum, /insert\(snippet\)/, 'editor formatting toolbar must insert supported content blocks');
assert.match(forum, /FormattedContent/, 'article preview and published detail must render supported formatting safely');
assert.match(forum, /插入图片/, 'forum composer must provide an inline image action');
assert.match(forum, /添加附件/, 'forum composer must provide a file attachment action');
assert.match(forum, /nexus_forum_post_draft/, 'image and attachment draft state must survive a page refresh');
assert.match(forum, /community category|Community category/i, 'post composer must keep category selection available');
assert.match(admin, /COMMUNITY_EDITOR_SECTIONS/, 'administrator must have an editor for news, documents and strategies');
for (const tab of ['communityContent', 'communityDocs', 'communityStrategies']) assert.ok(admin.includes(`['${tab}',`), `community editor should have its own sidebar entry: ${tab}`);
assert.match(admin, /communityContent\?\.documents\?\.length/, 'document count should be visible in the admin navigation');
assert.match(admin, /communityContent\?\.strategies\?\.length/, 'strategy count should be visible in the admin navigation');
assert.match(admin, /addCommunityItem/, 'administrator can add editorial items');
assert.match(admin, /removeCommunityItem/, 'administrator can remove editorial items');
assert.doesNotMatch(forum, /Math\.random/, 'community must not generate synthetic activity data');
for (const fakeTotal of ['12,426', '256,781']) assert.doesNotMatch(forum, new RegExp(fakeTotal), `community must not copy mock total ${fakeTotal}`);
for (const landmark of ['运营仪表盘', '待办队列', '积分任务核验', '积分提现审核', '用户与角色', '社区治理']) {
  assert.match(admin, new RegExp(landmark), `admin operations console is missing ${landmark}`);
}
for (const landmark of ['待审核', '已审核', '待认证', '已认证', '资料不完整', '已驳回', '策略审核', '证据认证', '审核清单', '风险摘要', '认证管理']) {
  assert.match(productReview, new RegExp(landmark), `strategy review workspace is missing ${landmark}`);
}
assert.match(admin, /<ProductReviewWorkspace[\s\S]*products=\{productList\}/, 'admin must render the categorized strategy review workspace');
assert.match(productReview, /REQUIRED_EVIDENCE/, 'review readiness must be derived from required evidence');
assert.match(productReview, /未提供验证资料/, 'review workspace must distinguish optional verification materials from basic listing review');
assert.match(productReview, /approvalEligible/, 'unsubmitted verification materials must not block the basic approval flow');
assert.match(productReview, /product\.status === 'active'/, 'review state must come from persisted product status');
assert.match(productReview, /verificationActive\(product\)/, 'verification filters must use persisted verification state');
assert.match(header, /href="\/tianwei"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/, 'admin entry must open the tianwei route in an isolated tab');
assert.equal(fs.existsSync(path.join(root, 'app', 'admin', 'page.js')), false, 'legacy /admin page must not remain routable');
for (const fakeMetric of ['99.9%', '1,284']) assert.doesNotMatch(admin, new RegExp(fakeMetric), `admin dashboard must not copy mock metric ${fakeMetric}`);
assert.match(header, /Mobile primary navigation/, 'small screens must expose primary navigation');
assert.match(header, /aria-current=\{route === value \? 'page'/, 'mobile navigation must announce the active page');
assert.match(header, /env\(safe-area-inset-bottom\)/, 'mobile navigation must respect device safe areas');
assert.equal((overlays.match(/fixed inset-0/g) || []).length, (overlays.match(/role="dialog"/g) || []).length, 'every application overlay must expose dialog semantics');
assert.equal((overlays.match(/<button aria-label=\{t\('关闭','Close'\)\}/g) || []).length, 3, 'every application dialog must have a named close button');
assert.match(admin, /<PointWithdrawalsAdmin/, 'admin must expose point withdrawal review');
assert.match(admin, /setLang\(current => current === 'zh' \? 'en' : 'zh'\)/, 'admin must allow switching its language');
assert.match(admin, /<AdminLocale lang=\{lang\}>/, 'admin interface must localize static UI labels');
assert.match(admin, /localizeConfig\(config\)/, 'admin action dialogs must use the selected language');
assert.match(adminLocale, /'Users & Roles'/, 'admin English catalog must contain translated navigation');
assert.match(adminLocale, /'Finance actions'/, 'admin English catalog must cover operational modules');
assert.match(admin, /<Dialog open=\{pwdModal\.isOpen\}/, 'admin password editor must use the accessible dialog primitive');
for (const key of [
  /key=\{`dashboard-metric-\$\{label\}-\$\{index\}`\}/,
  /key=\{`queue-\$\{target\}-\$\{index\}`\}/,
  /key=\{`user-\$\{u\.id\}-\$\{index\}`\}/,
  /key=\{`license-\$\{license\.id\}-\$\{index\}`\}/,
  /key=\{`report-\$\{report\.id\}-\$\{index\}`\}/,
  /key=\{`order-\$\{o\.order_id\}-\$\{index\}`\}/,
  /key=\{`withdrawal-\$\{w\.id\}-\$\{index\}`\}/,
]) assert.match(admin, key, 'admin mapped rows must use unique namespaced keys with a positional collision guard');
for (const key of [/key=\{product\.id\}/, /key=\{version\.id\}/, /key=\{item\.id\}/]) assert.match(productReview, key, 'review workspace rows must use stable database identifiers');
assert.match(admin, /activeTab==='licenses'&&<div className="overflow-x-auto/, 'license table must scroll on narrow screens');
assert.match(admin, /activeTab === 'withdrawals'[\s\S]*overflow-x-auto/, 'withdrawal table must scroll on narrow screens');
assert.match(comparison, /aria-label=\{t\('移出对比','Remove from comparison'\)\}/, 'comparison remove controls must have accessible names');

for (const directory of ['app', 'lib']) {
  const files = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (/\.(?:js|mjs)$/.test(entry.name)) files.push(target);
    }
  };
  walk(path.join(root, directory));
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/, `${path.relative(root, file)} uses a native browser dialog`);
  }
}

console.log('UI design system tests passed: tokens, primitives, focus management, truthful market data and reduced-motion policy');
