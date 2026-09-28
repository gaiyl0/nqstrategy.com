import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const tests = Object.keys(packageJson.scripts).filter((name) => name.startsWith('test:') && name !== 'test:all');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('npm_execpath is unavailable; run this script through npm run test:all');

for (const test of tests) {
  console.log(`\n=== ${test} ===`);
  const result = spawnSync(process.execPath, [npmCli, 'run', test], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`\nAll ${tests.length} test scripts passed.`);
