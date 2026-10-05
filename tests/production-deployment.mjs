import assert from 'node:assert/strict';
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const local = fs.readFileSync('scripts/deploy-production.ps1', 'utf8');
const remote = fs.readFileSync('scripts/deploy-release.sh', 'utf8');

assert.match(packageJson.scripts['deploy:production'], /deploy-production\.ps1/);
for (const requirement of ['git status --porcelain', 'git fetch origin', 'npm run lint', 'npm run test:all', 'git archive', 'scp', 'ssh']) {
  assert.ok(local.includes(requirement), `local deployment preflight is missing: ${requirement}`);
}
for (const requirement of ['flock -n', 'npm ci --include=dev', 'npm run build', 'npm run backup:create', 'npm run db:migrate -- up', 'npm run db:migrate -- verify', 'npm run audit:verify', 'npm run ledger:verify', 'ln -sfn', '/api/health', '/api/reports?status=pending', 'rollback']) {
  assert.ok(remote.includes(requirement), `server deployment runner is missing: ${requirement}`);
}
assert.match(remote, /systemctl stop nexus-quant[\s\S]*npm run db:migrate -- up[\s\S]*systemctl start nexus-quant/);
assert.match(remote, /install -o nexus -g nexus -m 0600[\s\S]*data\.db/);
assert.match(remote, /chown -R nexus:nexus "\$runtime_root\/public\/uploads"/);
assert.ok(remote.includes("NEXUS_DB_PATH='$release_dir/.build-data.db'"),'build must not auto-migrate the production database before backup');
assert.ok(remote.includes("cd '$old_release'; npm run backup:create"),'pre-upgrade backup must validate against the previous release schema');
assert.doesNotMatch(remote, /\.env\.production|JWT_SECRET=/);

console.log('Production deployment tests passed: preflight, immutable release, backup, migration, health checks and rollback');

