import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import Database from 'better-sqlite3';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const { NEXUS_DB_PATH: dbPath, TEST_BASE_URL: baseUrl, JWT_SECRET: jwtSecret, TRUSTED_PROXY_SHARED_SECRET: proxySecret } = process.env;
assert.ok(dbPath && baseUrl && jwtSecret && proxySecret);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
assert.equal((await fetch(`${baseUrl}/api/products`)).status, 200);
const db = new Database(dbPath);
const userId = Number(db.prepare("INSERT INTO users(username,email,password,role,email_verified) VALUES('resume-dev','resume@test.invalid','x','developer',1)").run().lastInsertRowid);
function cookie() {
  const data = Buffer.from(JSON.stringify({ id: userId, sv: 1, exp: Date.now() + 60_000 })).toString('base64url');
  return `nexus_token=${data}.${crypto.createHmac('sha256', jwtSecret).update(data).digest('base64url')}`;
}
const scanner = http.createServer((_request, response) => { response.writeHead(200, { 'content-type': 'application/json' }); response.end('{"clean":true}'); });
await new Promise((resolve) => scanner.listen(3153, '127.0.0.1', resolve));
async function post(pathname, form) {
  const response = await fetch(`${baseUrl}${pathname}`, { method: 'POST', headers: { cookie: cookie(), origin: 'https://nexus.test', 'x-forwarded-for': '203.0.113.70', 'x-nexus-proxy-secret': proxySecret }, body: form });
  return { status: response.status, body: await response.json() };
}
function fileForm(bytes, name, type, evidenceType) {
  const form = new FormData(); form.set('file', new File([bytes], name, { type }));
  if (evidenceType) form.set('evidenceType', evidenceType);
  return form;
}
try {
  const png = await sharp({ create: { width: 40, height: 30, channels: 4, background: '#22d3ee' } }).png().toBuffer();
  const firstUpload = await post('/api/upload', fileForm(png, 'logo.png', 'image/png'));
  const resumedUpload = await post('/api/upload', fileForm(png, 'logo-again.png', 'image/png'));
  assert.equal(firstUpload.status, 200); assert.equal(resumedUpload.status, 200);
  assert.equal(resumedUpload.body.resumed, true); assert.equal(resumedUpload.body.url, firstUpload.body.url);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM uploads WHERE owner_user_id=? AND deleted_at IS NULL').get(userId).count, 1);

  const firstEvidence = await post('/api/evidence', fileForm(png, 'settings.png', 'image/png', 'settings'));
  const resumedEvidence = await post('/api/evidence', fileForm(png, 'settings-again.png', 'image/png', 'settings'));
  assert.equal(firstEvidence.status, 201); assert.equal(resumedEvidence.status, 200);
  assert.equal(resumedEvidence.body.resumed, true); assert.equal(resumedEvidence.body.evidence.id, firstEvidence.body.evidence.id);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM strategy_evidence WHERE owner_user_id=?').get(userId).count, 1);
  const statisticsEvidence = await post('/api/evidence', fileForm(png, 'statistics.png', 'image/png', 'statistics'));
  const chartEvidence = await post('/api/evidence', fileForm(png, 'chart.png', 'image/png', 'chart'));
  assert.equal(statisticsEvidence.status, 201); assert.equal(chartEvidence.status, 201);
  const reportHtml = `<!doctype html><html><body><h1>Strategy Tester Report</h1><table>
    <tr><td>Initial Deposit:</td><td>10 000.00</td><td>Total Net Profit:</td><td>300.00</td></tr>
    <tr><td>Profit Factor:</td><td>1.80</td><td>Sharpe Ratio:</td><td>1.40</td></tr>
    <tr><td>Recovery Factor:</td><td>2.20</td><td>Balance Drawdown Maximal:</td><td>200.00 (2.00%)</td></tr>
    <tr><td>Total Trades:</td><td>2</td><td>Profit Trades (% of total):</td><td>2 (100.00%)</td></tr>
    <tr><th>Time</th><th>Deal</th><th>Type</th><th>Commission</th><th>Swap</th><th>Profit</th><th>Balance</th></tr>
    <tr><td>2026.01.02 10:00</td><td>1</td><td>buy</td><td>0</td><td>0</td><td>100.00</td><td>10100</td></tr>
    <tr><td>2026.02.03 10:00</td><td>2</td><td>sell</td><td>0</td><td>0</td><td>200.00</td><td>10300</td></tr></table></body></html>`;
  const reportBytes = Buffer.from(reportHtml);
  const firstReport = await post('/api/strategy-report', fileForm(reportBytes, 'report.html', 'text/html'));
  const resumedReport = await post('/api/strategy-report', fileForm(reportBytes, 'report-again.html', 'text/html'));
  assert.equal(firstReport.status, 201); assert.equal(firstReport.body.report.metrics.netProfit, 300);
  assert.equal(resumedReport.status, 200); assert.equal(resumedReport.body.resumed, true);
  assert.equal(resumedReport.body.report.id, firstReport.body.report.id);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM strategy_reports WHERE owner_user_id=?').get(userId).count, 1);
  const eaBytes = Buffer.concat([Buffer.from('EX5\x02','binary'),Buffer.alloc(128,9)]);
  const ea = await post('/api/upload', fileForm(eaBytes, 'strategy.ex5', 'application/octet-stream'));
  assert.equal(ea.status, 200);
  const extracted = firstReport.body.report.metrics;
  const metrics = { initialDeposit:extracted.initialDeposit,netProfit:extracted.netProfit,profitFactor:extracted.profitFactor,sharpeRatio:extracted.sharpeRatio,maxDrawdownPercent:extracted.maxDrawdownPercent,recoveryFactor:extracted.recoveryFactor,winRatePercent:extracted.winRatePercent,totalTrades:extracted.totalTrades,equityCurve:extracted.equityCurve,drawdownCurve:extracted.drawdownCurve,monthlyReturns:extracted.monthlyReturns };
  const productBody = { title:'Report EA',description:'parsed from original MT5 report',price:0,winRate:'',drawdown:'',pairs:'XAUUSD',eaTypes:['趋势'],logo_url:firstUpload.body.url,file_url:ea.body.url,
    evidenceIds:[firstEvidence.body.evidence.id,statisticsEvidence.body.evidence.id,chartEvidence.body.evidence.id],reportId:firstReport.body.report.id,metrics,version:'1.0.0',releaseNotes:'Initial release',upgradePolicy:'all_existing' };
  const tampered = await fetch(`${baseUrl}/api/products`, { method:'POST', headers:{ cookie:cookie(),origin:'https://nexus.test','content-type':'application/json','x-forwarded-for':'203.0.113.71','x-nexus-proxy-secret':proxySecret }, body:JSON.stringify({ ...productBody,metrics:{...productBody.metrics,netProfit:999} }) });
  assert.equal(tampered.status, 409);
  const created = await fetch(`${baseUrl}/api/products`, { method:'POST', headers:{ cookie:cookie(),origin:'https://nexus.test','content-type':'application/json','x-forwarded-for':'203.0.113.72','x-nexus-proxy-secret':proxySecret }, body:JSON.stringify(productBody) });
  assert.equal(created.status, 201); const productId = (await created.json()).id;
  assert.equal(db.prepare('SELECT product_id FROM strategy_reports WHERE id=?').get(firstReport.body.report.id).product_id, productId);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM strategy_metrics WHERE product_id=?').get(productId).count, 1);
  console.log(JSON.stringify({ passed: true, assertions: 23, productId }));
} finally {
  await new Promise((resolve) => scanner.close(resolve)); db.close();
}
