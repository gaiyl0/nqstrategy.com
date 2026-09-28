import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');
const kit = fs.readFileSync(path.join(root, 'app', 'components', 'ui', 'UiKit.js'), 'utf8');

for (const token of ['--nq-bg', '--nq-panel', '--nq-border', '--nq-primary', '--nq-success', '--nq-warning', '--nq-danger', '--nq-radius-md', '--nq-shadow-dialog', '--nq-focus']) {
  assert.match(css, new RegExp(token), `missing design token ${token}`);
}
for (const component of ['Button', 'Panel', 'Badge', 'Field', 'Tabs', 'EmptyState', 'Skeleton', 'Notice', 'Dialog', 'Drawer']) {
  assert.match(kit, new RegExp(`export function ${component}\\b`), `missing UI primitive ${component}`);
}
assert.match(kit, /role="dialog"/);
assert.match(kit, /aria-modal="true"/);
assert.match(kit, /event\.key === 'Escape'/);
assert.match(kit, /document\.body\.style\.overflow = 'hidden'/);
assert.match(css, /prefers-reduced-motion/);

console.log('UI design system tests passed: tokens, primitives, focus management and reduced-motion policy');
