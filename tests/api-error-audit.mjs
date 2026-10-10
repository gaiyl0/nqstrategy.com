import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = fileURLToPath(new URL('../app/api/', import.meta.url));
const routeFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === 'route.js') routeFiles.push(full);
  }
}
walk(apiRoot);

let assertions = 0;
for (const file of routeFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(apiRoot, file).replaceAll('\\', '/');
  assert.match(source, /import \{ withApiErrors \} from '@\/lib\/api-errors';/, `${relative} is missing the API error boundary`);
  assertions += 1;
  assert.doesNotMatch(source, /^export async function (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/m, `${relative} exports an unwrapped handler`);
  assertions += 1;
  const handlers = [...source.matchAll(/^async function (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)Handler\b/gm)].map(match => match[1]);
  assert.ok(handlers.length > 0, `${relative} has no HTTP handlers`);
  assertions += 1;
  for (const method of handlers) {
    assert.match(source, new RegExp(`export const ${method} = withApiErrors\\(${method}Handler,`), `${relative} does not wrap ${method}`);
    assertions += 1;
  }
}

const joined = routeFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');
assert.doesNotMatch(joined, /message\s*:\s*(?:error|err)\.message/, 'an API response may expose a raw exception message');
assertions += 1;
assert.doesNotMatch(joined, /console\.error\([^;]*(?:error|err)\s*\)/, 'raw exception details may only be recorded in the signed audit chain');
assertions += 1;
const auditRoute = fs.readFileSync(path.join(apiRoot, 'audit', 'route.js'), 'utf8');
assert.match(auditRoute, /delete metadata\.diagnostic;[\s\S]*delete metadata\.stackDigest;/, 'audit API must not return internal diagnostics to the browser');
assertions += 1;
assert.doesNotMatch(auditRoute, /health:\s*getAuditHealth\(\)|\bintegrity,/, 'audit API must expose only its public integrity and health views');
assertions += 1;
assert.equal(routeFiles.length, 43, 'route inventory changed; review and update the audit baseline');
const brandRoute = fs.readFileSync(path.join(apiRoot, 'site-brand', 'route.js'), 'utf8');
assert.match(brandRoute, /role !== 'admin'/, 'brand workspace must stay administrator-only');
assert.match(brandRoute, /writeAudit\(context/, 'brand configuration mutations must be audited');
assertions += 2;
assertions += 1;

console.log(`API route error audit passed: ${routeFiles.length} routes, ${assertions} assertions`);
