import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = [
  'app/page.js',
  'app/tianwei/page.js',
  'app/components/MarketView.js',
];

let assertions = 0;
for (const file of files) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  assert.match(source, /import \{[^}]*apiFetch[^}]*\} from '@\/lib\/api-client';/, `${file} must import the shared API client`);
  assertions += 1;
  assert.doesNotMatch(source, /\bfetch\(/, `${file} must not call the native fetch API directly`);
  assertions += 1;
}

const adminSource = await readFile(new URL('../app/tianwei/page.js', import.meta.url), 'utf8');
assert.match(adminSource, /await apiFetch\('\/api\/settings'[\s\S]*showStatus\('✅ 所有配置已永久保存生效！'\)/, 'settings success feedback must follow the API request');
assertions += 1;
assert.match(adminSource, /catch \(error\)[\s\S]*apiErrorMessage\(error, '配置保存失败'\)[\s\S]*finally[\s\S]*setIsSaving\(false\)/, 'settings failures must be shown and saving state restored');
assertions += 1;
assert.match(adminSource, /unhandledrejection/, 'admin async handler failures must have a visible fallback');
assertions += 1;

console.log(`Frontend API usage tests passed: ${assertions} assertions`);
