import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-mt5-report-'));
process.env.NODE_ENV = 'test'; process.env.NEXUS_DB_PATH = path.join(root, 'test.db'); process.env.NEXUS_REPORT_ROOT = path.join(root, 'reports');
let db;
try {
  const report = await import('../lib/mt5-report.js'); const dbModule = await import('../lib/db.js'); db = dbModule.default;
  const html = `<!doctype html><html><body><h1>Strategy Tester Report</h1><table>
  <tr><td>Initial Deposit:</td><td>10 000.00</td><td>Total Net Profit:</td><td>300.00</td></tr>
  <tr><td>Profit Factor:</td><td>1.80</td><td>Sharpe Ratio:</td><td>1.40</td></tr>
  <tr><td>Recovery Factor:</td><td>2.20</td><td>Balance Drawdown Maximal:</td><td>200.00 (2.00%)</td></tr>
  <tr><td>Total Trades:</td><td>2</td><td>Profit Trades (% of total):</td><td>2 (100.00%)</td></tr>
  <tr><th>Time</th><th>Deal</th><th>Type</th><th>Commission</th><th>Swap</th><th>Profit</th><th>Balance</th></tr>
  <tr><td>2026.01.02 10:00</td><td>1</td><td>buy</td><td>0</td><td>0</td><td>100.00</td><td>10100</td></tr>
  <tr><td>2026.02.03 10:00</td><td>2</td><td>sell</td><td>0</td><td>0</td><td>200.00</td><td>10300</td></tr>
  </table></body></html>`;
  const metrics = report.parseMt5Report(Buffer.from(html));
  assert.equal(metrics.initialDeposit, 10000); assert.equal(metrics.netProfit, 300); assert.equal(metrics.totalTrades, 2);
  assert.equal(metrics.winRatePercent, 100); assert.deepEqual(metrics.equityCurve, [{ date:'2026-01-02',value:10100 },{ date:'2026-02-03',value:10300 }]);
  assert.equal(metrics.drawdownCurve.length, 2); assert.equal(metrics.monthlyReturns.length, 2);
  assert.throws(()=>report.parseMt5Report(Buffer.from('<html>no report</html>')), /REPORT_METRICS_INCOMPLETE/);
  const owner = Number(db.prepare("INSERT INTO users(username,email,role,password) VALUES('dev','dev@test.invalid','developer','x')").run().lastInsertRowid);
  const product = Number(db.prepare("INSERT INTO products(title,author,author_user_id) VALUES('EA','dev',?)").run(owner).lastInsertRowid);
  const stored = report.storeReport(Buffer.from(html));
  const id = Number(db.prepare('INSERT INTO strategy_reports(owner_user_id,original_name,stored_name,content_sha256,size,extracted_json,uploaded_at) VALUES(?,?,?,?,?,?,?)').run(owner,'report.html',stored,'a'.repeat(64),html.length,JSON.stringify(metrics),Date.now()).lastInsertRowid);
  report.claimReport(product, owner, id); assert.equal(db.prepare('SELECT product_id FROM strategy_reports WHERE id=?').get(id).product_id, product);
  assert.equal(report.verifyMetricsAgainstReport(id, owner, metrics).totalTrades, 2);
  assert.throws(()=>report.verifyMetricsAgainstReport(id, owner, { ...metrics, netProfit:999 }), /REPORT_METRICS_MODIFIED/);
  const chineseHtml = html.replace('Initial Deposit:', '初始入金：').replace('Total Net Profit:', '总净盈利：').replace('Profit Factor:', '盈利因子：').replace('Sharpe Ratio:', '夏普比率：').replace('Recovery Factor:', '复原因子：').replace('Balance Drawdown Maximal:', '最大结余亏损：').replace('Total Trades:', '交易总计：').replace('Profit Trades (% of total):', '盈利交易（% 全部）：').replace('<th>Time</th>', '<th>时间</th>').replace('<th>Commission</th>', '<th>佣金</th>').replace('<th>Swap</th>', '<th>库存费</th>').replace('<th>Profit</th>', '<th>盈利</th>');
  assert.equal(report.parseMt5Report(Buffer.from('\uFEFF' + chineseHtml, 'utf16le')).initialDeposit, 10000);
  assert.equal(report.parseMt5Report(Buffer.from(chineseHtml, 'utf16le')).recoveryFactor, 2.2);
  assert.equal(report.parseMt5Report(Buffer.from(chineseHtml.replace('复原因子：','采收率：'), 'utf16le')).recoveryFactor, 2.2);
  console.log(JSON.stringify({ success:true, assertions:15 }));
} finally { db?.close(); fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100}); }
