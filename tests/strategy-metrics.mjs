import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-strategy-metrics-'));
process.env.NODE_ENV = 'test';
process.env.NEXUS_DB_PATH = path.join(root, 'test.db');

let db;
try {
  const { createProductSchema } = await import('../lib/validation.js');
  const validMetrics = {
    initialDeposit: 10000, netProfit: 1500, profitFactor: 1.8, sharpeRatio: 1.4,
    maxDrawdownPercent: 8.5, recoveryFactor: 2.2, winRatePercent: 64.5, totalTrades: 250,
    equityCurve: [{ date: '2026-01-01', value: 10000 }, { date: '2026-02-01', value: 11500 }],
    drawdownCurve: [{ date: '2026-01-01', percent: 0 }, { date: '2026-02-01', percent: 8.5 }],
    monthlyReturns: [{ month: '2026-01', percent: 6 }, { month: '2026-02', percent: 8.49 }],
  };
  const base = { title: 'Metrics EA', description: '', pointsPrice: 100, winRate: '', drawdown: '', pairs: 'XAUUSD', eaTypes: ['趋势'], logo_url: '', file_url: '/private/eas/test.ex5', metrics: validMetrics, evidenceIds: [1, 2, 3], reportId: 1,version:'1.0.0',releaseNotes:'Initial release',upgradePolicy:'all_existing' };
  assert.equal(createProductSchema.safeParse(base).success, true);
  assert.equal(createProductSchema.safeParse({...base,price:99}).success,false,'publisher cannot submit a separate USD sale price');
  const noDisclosure = { ...base, title: 'No report EA', reportId: null, evidenceIds: [], metrics: undefined };
  assert.equal(createProductSchema.safeParse(noDisclosure).success, true, 'EA submission must allow no report, metrics, or screenshots');
  assert.equal(createProductSchema.safeParse({ ...noDisclosure, metrics: validMetrics }).success, false, 'hand-entered performance cannot be submitted without an MT5 report');
  assert.equal(createProductSchema.safeParse({ ...base, reportId: 1, metrics: undefined }).success, false, 'an attached report must retain its extracted metrics');
  assert.equal(createProductSchema.safeParse({ ...base, unknown: true }).success, false);
  assert.equal(createProductSchema.safeParse({ ...base, metrics: { ...validMetrics, winRatePercent: 101 } }).success, false);
  assert.equal(createProductSchema.safeParse({ ...base, metrics: { ...validMetrics, maxDrawdownPercent: 101 } }).success, false);
  assert.equal(createProductSchema.safeParse({ ...base, metrics: { ...validMetrics, equityCurve: [...validMetrics.equityCurve].reverse() } }).success, false);
  assert.equal(createProductSchema.safeParse({ ...base, metrics: { ...validMetrics, monthlyReturns: [] } }).success, false);

  const dbModule = await import('../lib/db.js');
  db = dbModule.default;
  const userId = Number(db.prepare("INSERT INTO users (username,email,role,password) VALUES ('dev','dev@test.invalid','developer','x')").run().lastInsertRowid);
  const adminId = Number(db.prepare("INSERT INTO users (username,email,role,password) VALUES ('admin','admin@test.invalid','admin','x')").run().lastInsertRowid);
  const productId = Number(db.prepare("INSERT INTO products (title,author,author_user_id,status) VALUES ('EA','dev',?,'pending')").run(userId).lastInsertRowid);
  const { clearStrategyMetricsReview, getStrategyMetrics, reviewStrategyMetrics, upsertStrategyMetrics } = await import('../lib/strategy-metrics.js');
  upsertStrategyMetrics(productId, validMetrics);
  assert.equal(getStrategyMetrics(productId), null);
  assert.equal(getStrategyMetrics(productId, { includeUnreviewed: true }).totalTrades, 250);
  assert.equal(reviewStrategyMetrics(productId, adminId).changes, 1);
  assert.equal(getStrategyMetrics(productId).disclosure, 'developer_submitted_admin_reviewed');
  upsertStrategyMetrics(productId, { ...validMetrics, netProfit: 1600 });
  assert.equal(getStrategyMetrics(productId), null);
  clearStrategyMetricsReview(productId);
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  console.log(JSON.stringify({ success: true, assertions: 13 }));
} finally {
  db?.close();
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
