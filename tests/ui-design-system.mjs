import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');
const kit = fs.readFileSync(path.join(root, 'app', 'components', 'ui', 'UiKit.js'), 'utf8');
const market = [
  fs.readFileSync(path.join(root, 'app', 'components', 'MarketView.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'app', 'components', 'StrategyMarketCatalog.js'), 'utf8'),
].join('\n');

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
assert.match(market, /Paid checkout unavailable/, 'market must keep paid checkout visibly unavailable');
assert.match(market, /setRetryKey\(value\s*=>\s*value\s*\+\s*1\)/, 'market error retry must issue a new request');
assert.doesNotMatch(market, /Math\.random/, 'market must not generate synthetic chart data');
for (const landmark of ['SideNavigation', 'ComparisonRail', 'StrategyCard', 'market-filter']) {
  assert.match(market, new RegExp(landmark), `market visual composition is missing ${landmark}`);
}

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
