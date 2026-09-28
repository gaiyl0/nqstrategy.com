import db from './db.js';

const selectMetrics = db.prepare('SELECT * FROM strategy_metrics WHERE product_id = ?');

function parseJson(value) {
  try { return JSON.parse(value); } catch { return []; }
}

export function metricsFromRow(row, { includeUnreviewed = false } = {}) {
  if (!row || (!includeUnreviewed && !row.reviewed_at)) return null;
  return {
    initialDeposit: row.initial_deposit,
    netProfit: row.net_profit,
    profitFactor: row.profit_factor,
    sharpeRatio: row.sharpe_ratio,
    maxDrawdownPercent: row.max_drawdown_percent,
    recoveryFactor: row.recovery_factor,
    winRatePercent: row.win_rate_percent,
    totalTrades: row.total_trades,
    equityCurve: parseJson(row.equity_curve_json),
    drawdownCurve: parseJson(row.drawdown_curve_json),
    monthlyReturns: parseJson(row.monthly_returns_json),
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at,
    reviewedByUserId: row.reviewed_by_user_id,
    disclosure: 'developer_submitted_admin_reviewed',
  };
}

export function getStrategyMetrics(productId, options) {
  return metricsFromRow(selectMetrics.get(productId), options);
}

export function upsertStrategyMetrics(productId, metrics) {
  const now = Date.now();
  db.prepare(`
    INSERT INTO strategy_metrics (
      product_id, initial_deposit, net_profit, profit_factor, sharpe_ratio,
      max_drawdown_percent, recovery_factor, win_rate_percent, total_trades,
      equity_curve_json, drawdown_curve_json, monthly_returns_json,
      submitted_at, updated_at, reviewed_at, reviewed_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
    ON CONFLICT(product_id) DO UPDATE SET
      initial_deposit = excluded.initial_deposit,
      net_profit = excluded.net_profit,
      profit_factor = excluded.profit_factor,
      sharpe_ratio = excluded.sharpe_ratio,
      max_drawdown_percent = excluded.max_drawdown_percent,
      recovery_factor = excluded.recovery_factor,
      win_rate_percent = excluded.win_rate_percent,
      total_trades = excluded.total_trades,
      equity_curve_json = excluded.equity_curve_json,
      drawdown_curve_json = excluded.drawdown_curve_json,
      monthly_returns_json = excluded.monthly_returns_json,
      updated_at = excluded.updated_at,
      reviewed_at = NULL,
      reviewed_by_user_id = NULL
  `).run(
    productId, metrics.initialDeposit, metrics.netProfit, metrics.profitFactor,
    metrics.sharpeRatio, metrics.maxDrawdownPercent, metrics.recoveryFactor,
    metrics.winRatePercent, metrics.totalTrades, JSON.stringify(metrics.equityCurve),
    JSON.stringify(metrics.drawdownCurve), JSON.stringify(metrics.monthlyReturns),
    now, now,
  );
}

export function reviewStrategyMetrics(productId, adminUserId) {
  return db.prepare(`
    UPDATE strategy_metrics
    SET reviewed_at = ?, reviewed_by_user_id = ?
    WHERE product_id = ?
  `).run(Date.now(), adminUserId, productId);
}

export function clearStrategyMetricsReview(productId) {
  db.prepare('UPDATE strategy_metrics SET reviewed_at = NULL, reviewed_by_user_id = NULL WHERE product_id = ?').run(productId);
}
