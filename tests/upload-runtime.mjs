import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import Database from 'better-sqlite3';
import sharp from 'sharp';

const { NEXUS_DB_PATH: dbPath, TEST_BASE_URL: baseUrl, JWT_SECRET: jwtSecret, TRUSTED_PROXY_SHARED_SECRET: proxySecret } = process.env;
assert.ok(dbPath && baseUrl && jwtSecret && proxySecret);
assert.equal((await fetch(`${baseUrl}/api/products`)).status, 200);
const db = new Database(dbPath);
const userInsert = db.prepare(`INSERT INTO users (username,email,password,role,email_verified) VALUES (?,?,?,?,1)`);
const ownerId = Number(userInsert.run('owner','owner@example.test','x','developer').lastInsertRowid);
const otherId = Number(userInsert.run('other','other@example.test','x','developer').lastInsertRowid);
const ordinaryId = Number(userInsert.run('ordinary','ordinary@example.test','x','user').lastInsertRowid);
const adminId = Number(userInsert.run('admin','admin@example.test','x','admin').lastInsertRowid);

function cookie(userId) {
  const data = Buffer.from(JSON.stringify({ id: userId, sv: 1, exp: Date.now() + 60_000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', jwtSecret).update(data).digest('base64url');
  return `nexus_token=${data}.${signature}`;
}

const scanner = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    const malware = decodeURIComponent(String(request.headers['x-upload-file-name'] || '')).includes('malware');
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ clean: !malware, reason: malware ? 'malware' : undefined }));
  });
});
await new Promise((resolve) => scanner.listen(3151, '127.0.0.1', resolve));

let ip = 20;
async function request(path, { method = 'POST', userId = ownerId, body, headers = {} } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      cookie: cookie(userId), origin: 'https://nexus.test', 'x-forwarded-for': `203.0.113.${ip++}`,
      'x-nexus-proxy-secret': proxySecret, ...headers,
    },
    body,
  });
}
async function upload(name, bytes, type, userId = ownerId) {
  const form = new FormData();
  form.set('file', new File([bytes], name, { type }));
  const response = await request('/api/upload', { userId, body: form });
  return { status: response.status, body: await response.json() };
}

try {
  const png = await sharp({ create: { width: 20, height: 20, channels: 4, background: '#22d3ee' } }).png().toBuffer();
  assert.equal((await upload('fake.png', Buffer.from('<script>x</script>'), 'image/png')).status, 400);
  assert.equal((await upload('archive.zip', Buffer.from('PK\x03\x04'), 'application/zip')).status, 400);
  assert.equal((await upload('fake.ex5', Buffer.alloc(100), 'application/octet-stream')).status, 400);
  assert.equal((await upload('ordinary.ex5', Buffer.concat([Buffer.from('EX5\x02','binary'),Buffer.alloc(128)]), 'application/octet-stream', ordinaryId)).status, 403);
  assert.equal((await upload('malware.ex5', Buffer.concat([Buffer.from('EX5\x02','binary'),Buffer.alloc(128,1)]), 'application/octet-stream')).status, 400);

  const logo = await upload('logo.png', png, 'image/png');
  assert.equal(logo.status, 200);
  const resumedLogo = await upload('same.png', png, 'image/png');
  assert.equal(resumedLogo.status, 200);
  assert.equal(resumedLogo.body.resumed, true);
  assert.equal(resumedLogo.body.url, logo.body.url);
  const ea1Bytes = Buffer.concat([Buffer.from('EX5\x02','binary'),Buffer.alloc(128,2)]);
  const ea1 = await upload('strategy.ex5', ea1Bytes, 'application/octet-stream');
  assert.equal(ea1.status, 200);

  const metrics = {
    initialDeposit: 10000, netProfit: 1250.5, profitFactor: 1.82, sharpeRatio: 1.35,
    maxDrawdownPercent: 8.5, recoveryFactor: 2.1, winRatePercent: 62.5, totalTrades: 240,
    equityCurve: [{ date: '2026-01-01', value: 10000 }, { date: '2026-02-01', value: 11250.5 }],
    drawdownCurve: [{ date: '2026-01-01', percent: 0 }, { date: '2026-02-01', percent: 8.5 }],
    monthlyReturns: [{ month: '2026-01', percent: 5 }, { month: '2026-02', percent: 7.14 }],
  };
  const productBody = { title: 'Secure EA', description: 'validated upload', price: 0, winRate: '', drawdown: '', pairs: 'XAUUSD', eaTypes: ['趋势'], metrics, logo_url: logo.body.url, file_url: ea1.body.url };
  const invalidMetrics = await request('/api/products', { body: JSON.stringify({ ...productBody, metrics: { ...metrics, maxDrawdownPercent: 7 } }), headers: { 'content-type': 'application/json' } });
  assert.equal(invalidMetrics.status, 400);
  assert.equal(db.prepare('SELECT attached_product_id FROM uploads WHERE url = ?').get(ea1.body.url).attached_product_id, null);
  const cross = await request('/api/products', { userId: otherId, body: JSON.stringify(productBody), headers: { 'content-type': 'application/json' } });
  assert.equal(cross.status, 400);
  const created = await request('/api/products', { body: JSON.stringify(productBody), headers: { 'content-type': 'application/json' } });
  assert.equal(created.status, 201);
  const productId = (await created.json()).id;
  assert.equal(db.prepare('SELECT reviewed_at FROM strategy_metrics WHERE product_id = ?').get(productId).reviewed_at, null);
  const approved = await request('/api/products', { method: 'PATCH', userId: adminId, body: JSON.stringify({ id: productId, status: 'active' }), headers: { 'content-type': 'application/json' } });
  assert.equal(approved.status, 200);
  const publicResponse = await fetch(`${baseUrl}/api/products`);
  assert.equal(publicResponse.status, 200);
  const publicProduct = (await publicResponse.json()).products.find((product) => product.id === productId);
  assert.equal(publicProduct.metrics.profitFactor, 1.82);
  assert.equal(publicProduct.metrics.disclosure, 'developer_submitted_admin_reviewed');
  const reused = await request('/api/products', { body: JSON.stringify({ ...productBody, title: 'Reuse' }), headers: { 'content-type': 'application/json' } });
  assert.equal(reused.status, 400);

  const ea2Bytes = Buffer.concat([Buffer.from('EX5\x02','binary'),Buffer.alloc(128,3)]);
  const ea2 = await upload('replacement.ex5', ea2Bytes, 'application/octet-stream');
  assert.equal(ea2.status, 200);
  const updated = await request('/api/products', { method: 'PATCH', body: JSON.stringify({ ...productBody, id: productId, logo_url: '', file_url: ea2.body.url }), headers: { 'content-type': 'application/json' } });
  assert.equal(updated.status, 200);
  assert.equal(db.prepare('SELECT status FROM products WHERE id = ?').get(productId).status, 'pending');
  assert.equal(db.prepare('SELECT reviewed_at FROM strategy_metrics WHERE product_id = ?').get(productId).reviewed_at, null);
  const oldUpload = db.prepare('SELECT attached_product_id,expires_at FROM uploads WHERE url=?').get(ea1.body.url);
  const newUpload = db.prepare('SELECT attached_product_id,expires_at,status FROM uploads WHERE url=?').get(ea2.body.url);
  assert.equal(oldUpload.attached_product_id, null);
  assert.ok(oldUpload.expires_at > Date.now());
  assert.equal(newUpload.attached_product_id, productId);
  assert.equal(newUpload.expires_at, null);
  assert.equal(newUpload.status, 'attached');

  const deleted = await request(`/api/products?id=${productId}`, { method: 'DELETE' });
  assert.equal(deleted.status, 200);
  assert.equal(db.prepare('SELECT attached_product_id FROM uploads WHERE url=?').get(ea2.body.url).attached_product_id, null);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM uploads WHERE original_name=?').get('malware.ex5').n, 0);
  console.log(JSON.stringify({ passed: true, assertions: 33, productId }));
} finally {
  await new Promise((resolve) => scanner.close(resolve));
  db.close();
}
