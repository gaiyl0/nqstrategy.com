import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const read = (file) => fs.readFileSync(file, 'utf8');
const workflow = read('.github/workflows/ci.yml');
const packageJson = JSON.parse(read('package.json'));
const health = read('app/api/health/route.js');
const backup = read('scripts/backup-maintenance.mjs');
const gitGuide = read('GIT_CI.md');
const productionGuide = read('PRODUCTION_RUNBOOK.md');
const recoveryGuide = read('BACKUP_RECOVERY.md');
const paymentGuide = read('REAL_PAYMENT_INTEGRATION.md');

for (const command of ['npm ci','npm run lint','npm run test:all','npm run db:migrate -- verify','npm run build']) {
  assert.ok(workflow.includes(command), `CI is missing ${command}`);
}
assert.match(workflow, /merge_group:/, 'merge queue must trigger CI');
assert.match(workflow, /permissions:\s*\n\s*contents: read/, 'CI permissions must remain read-only');
for (const script of ['test:all','backup:create','backup:verify','backup:restore','backup:drill']) assert.ok(packageJson.scripts[script], `${script} is missing`);
assert.match(health, /cache-control': 'no-store'/);
assert.match(health, /withApiErrors\(GETHandler/);
assert.match(backup, /source\.backup\(/, 'backup must use the SQLite online backup API');
assert.match(backup, /SYMLINK_NOT_ALLOWED/);
assert.match(backup, /BACKUP_FILE_TAMPERED/);
assert.match(backup, /RESTORE_TARGET_NOT_EMPTY/);
assert.match(gitGuide, /required status check/);
assert.match(productionGuide, /\/api\/health/);
assert.match(recoveryGuide, /钱包账本：2 笔交易，签名链有效/);
assert.match(paymentGuide, /PAYMENTS_ENABLED=0/);
assert.match(paymentGuide, /provider_event_id TEXT NOT NULL/);
assert.match(paymentGuide, /只有 `changes === 1`/);

const node = process.execPath;
const drillRoot=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-release-test-'));
const drillEnv={...process.env,NEXUS_DB_PATH:path.join(drillRoot,'data.db')};
const migrate=spawnSync(node,['scripts/db-migrate.mjs','up'],{cwd:process.cwd(),env:drillEnv,encoding:'utf8'});
assert.equal(migrate.status,0,migrate.stderr||migrate.stdout);
const drill = spawnSync(node, ['scripts/backup-maintenance.mjs', 'drill'], { cwd: process.cwd(), env: drillEnv, encoding: 'utf8' });
fs.rmSync(drillRoot,{recursive:true,force:true});
assert.equal(drill.status, 0, drill.stderr || drill.stdout);
assert.match(drill.stdout, /"success": true/);
assert.match(drill.stdout, /"quickCheck": "ok"/);
assert.match(drill.stdout, /"foreignKeyViolations": 0/);

console.log('Release engineering tests passed: CI, health, backup/restore drill, runbooks and payment tutorial');
