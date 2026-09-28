import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const markdownFiles = fs.readdirSync(root, { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
  .map(entry => entry.name);
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
let assertions = 0;

for (const name of markdownFiles) {
  const source = fs.readFileSync(path.join(root, name), 'utf8');
  for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].trim().replace(/^<|>$/g, '');
    if (/^(?:https?:|mailto:|#)/i.test(target)) continue;
    const filePart = decodeURIComponent(target.split('#')[0]);
    assert.ok(fs.existsSync(path.resolve(root, path.dirname(name), filePart)), `${name} contains a broken link: ${target}`);
    assertions += 1;
  }
  for (const match of source.matchAll(/npm run ([a-z0-9:_-]+)/gi)) {
    assert.ok(packageJson.scripts[match[1]], `${name} references missing npm script: ${match[1]}`);
    assertions += 1;
  }
}

const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
assert.doesNotMatch(readme, /## Deploy on Vercel|easiest way to deploy.*Vercel/i); assertions += 1;
assert.match(readme, /当前不支持 Vercel、无共享磁盘 Serverless 或多实例部署/); assertions += 1;
assert.match(readme, /真实付费 \| 禁止上线/); assertions += 1;

const checklist = fs.readFileSync(path.join(root, 'GO_LIVE_CHECKLIST.md'), 'utf8');
for (const heading of ['已完成的代码安全基线', '代码完成但必须在生产现场确认', '仍未完成的工程发布项', '免费模式上线条件', '真实支付硬性阻断']) {
  assert.ok(checklist.includes(heading), `GO_LIVE_CHECKLIST.md is missing status class: ${heading}`);
  assertions += 1;
}
assert.doesNotMatch(checklist, /11 errors|为登录、注册、验证码、上传、订单和提现增加限流|验证码改用加密安全随机数|为 Cookie 状态写接口建立 CSRF/); assertions += 1;
assert.match(checklist, /真实资金状态：\*\*禁止上线，付费能力继续关闭\*\*/); assertions += 1;

for (const name of ['DEPLOYMENT_SECURITY.md', 'CSRF_SECURITY.md', 'UPLOAD_SECURITY.md', 'AUDIT_INTEGRITY.md', 'DATABASE_MIGRATIONS.md', 'WALLET_LEDGER.md']) {
  const source = fs.readFileSync(path.join(root, name), 'utf8');
  assert.match(source, /Status \(2026-09-28\)|状态（2026-09-28）/, `${name} is missing code/deployment status`);
  assertions += 1;
}

console.log(`Documentation convergence tests passed: ${markdownFiles.length} files, ${assertions} assertions`);
