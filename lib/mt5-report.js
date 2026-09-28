import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import db from './db.js';

export const MAX_MT5_REPORT_SIZE = 10 * 1024 * 1024;

export function reportRoot() {
  const configured = process.env.NEXUS_REPORT_ROOT;
  return configured ? path.resolve(/* turbopackIgnore: true */ configured) : path.join(process.cwd(), 'storage', 'private', 'reports');
}

export function reportPath(name) {
  const root = reportRoot(); const target = path.resolve(root, path.basename(name));
  if (path.dirname(target) !== root) throw new Error('INVALID_REPORT_PATH');
  return target;
}

export function decodeReport(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString('utf16le');
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.from(buffer.subarray(2)); for (let i = 0; i + 1 < swapped.length; i += 2) [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
    return swapped.toString('utf16le');
  }
  const sample = buffer.subarray(0, Math.min(buffer.length, 2000));
  let evenNulls = 0; let oddNulls = 0;
  for (let index = 0; index < sample.length; index += 1) if (sample[index] === 0) (index % 2 === 0 ? evenNulls++ : oddNulls++);
  if (oddNulls > sample.length * 0.15 && oddNulls > evenNulls * 3) return buffer.toString('utf16le').replace(/^\uFEFF/, '');
  return buffer.toString('utf8').replace(/^\uFEFF/, '');
}

function entityDecode(value) {
  return value.replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function text(value) { return entityDecode(value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(); }
function number(value) { const match = String(value).replace(/\s/g, '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/); return match ? Number(match[0]) : null; }
function percent(value) { const matches = [...String(value).matchAll(/(-?\d+(?:\.\d+)?)\s*%/g)]; return matches.length ? Number(matches.at(-1)[1]) : number(value); }

function tableRows(html) {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => text(cell[1]))).filter((cells) => cells.length);
}

function normalizedLabel(value) {
  return String(value).normalize('NFKC').toLowerCase().replace(/[：:]/g, '').replace(/[（）()\s]/g, '').trim();
}

function findValue(rows, labels) {
  const expected = labels.map(normalizedLabel);
  for (const cells of rows) for (let index = 0; index < cells.length; index += 1) {
    const normalized = normalizedLabel(cells[index]);
    if (expected.includes(normalized) && cells[index + 1]) return cells[index + 1];
  }
  return null;
}

function isoDate(raw) {
  const match = String(raw).match(/(20\d{2})[.\/-](\d{2})[.\/-](\d{2})/); return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function tradesFromRows(rows) {
  const normalizedRows = rows.map((cells) => cells.map((cell) => cell.replace(/:$/, '').trim().toLowerCase()));
  const headerIndex = normalizedRows.findIndex((cells) => cells.some((cell) => ['profit','盈利','利润'].includes(cell)) && cells.some((cell) => ['time','时间'].includes(cell)));
  if (headerIndex < 0) throw new Error('REPORT_DEAL_HEADER_REQUIRED');
  const header = normalizedRows[headerIndex];
  const indexOf = (labels) => header.findIndex((cell) => labels.includes(cell));
  const timeIndex = indexOf(['time','时间']); const profitIndex = indexOf(['profit','盈利','利润']);
  const commissionIndex = indexOf(['commission','手续费','佣金']); const swapIndex = indexOf(['swap','库存费','隔夜利息']);
  const trades = [];
  for (const cells of rows.slice(headerIndex + 1)) {
    const date = isoDate(cells[timeIndex]); if (!date) continue;
    const lowered = cells.join(' ').toLowerCase();
    if (!/(buy|sell|买|卖|deal|交易)/i.test(lowered)) continue;
    const baseProfit = number(cells[profitIndex]); if (!Number.isFinite(baseProfit)) continue;
    const profit = baseProfit + (commissionIndex >= 0 ? number(cells[commissionIndex]) || 0 : 0) + (swapIndex >= 0 ? number(cells[swapIndex]) || 0 : 0);
    trades.push({ date, profit });
  }
  return trades;
}

function curves(initialDeposit, trades) {
  const daily = new Map(); for (const trade of trades) daily.set(trade.date, (daily.get(trade.date) || 0) + trade.profit);
  const dates = [...daily.keys()].sort(); if (dates.length < 2) throw new Error('REPORT_TRADES_REQUIRED');
  let equity = initialDeposit; let peak = initialDeposit;
  const equityCurve = []; const drawdownCurve = [];
  const monthlyStart = new Map(); const monthlyEnd = new Map();
  for (const date of dates) {
    const month = date.slice(0, 7); if (!monthlyStart.has(month)) monthlyStart.set(month, equity);
    equity += daily.get(date); peak = Math.max(peak, equity);
    equityCurve.push({ date, value: Number(equity.toFixed(2)) });
    drawdownCurve.push({ date, percent: Number((peak > 0 ? ((peak - equity) / peak) * 100 : 0).toFixed(2)) });
    monthlyEnd.set(month, equity);
  }
  const monthlyReturns = [...monthlyStart].map(([month, start]) => ({ month, percent: Number((start > 0 ? ((monthlyEnd.get(month) - start) / start) * 100 : 0).toFixed(2)) }));
  return { equityCurve, drawdownCurve, monthlyReturns };
}

export function parseMt5Report(buffer) {
  const html = decodeReport(buffer);
  if (!/<html|<table|strategy tester|策略测试/i.test(html)) throw new Error('REPORT_FORMAT_INVALID');
  const rows = tableRows(html);
  const initialDeposit = number(findValue(rows, ['Initial Deposit', '初始资金', '初始入金', '初始存款']));
  const netProfit = number(findValue(rows, ['Total Net Profit', '总净盈利', '总净利润']));
  const profitFactor = number(findValue(rows, ['Profit Factor', '盈利因子']));
  const sharpeRatio = number(findValue(rows, ['Sharpe Ratio', '夏普比率']));
  const recoveryFactor = number(findValue(rows, ['Recovery Factor', '恢复因子', '复原因子', '恢复系数', '采收率']));
  const totalTrades = number(findValue(rows, ['Total Trades', '交易总计', '总交易']));
  const drawdownText = findValue(rows, ['Equity Drawdown Maximal', '最大净值回撤', '最大净值亏损'])
    || findValue(rows, ['Balance Drawdown Maximal', '最大余额回撤', '最大结余亏损']);
  const maxDrawdownPercent = percent(drawdownText);
  const profitTradesText = findValue(rows, ['Profit Trades (% of total)', '盈利交易（占总数的%）', '盈利交易 (% 全部)', '盈利交易（% 全部）', '获利交易 (% 全部)']);
  const winRatePercent = percent(profitTradesText);
  const required = { initialDeposit, netProfit, profitFactor, sharpeRatio, maxDrawdownPercent, recoveryFactor, winRatePercent, totalTrades };
  const missingFields = Object.entries(required).filter(([, value]) => value === null || !Number.isFinite(value)).map(([field]) => field);
  if (initialDeposit !== null && initialDeposit <= 0) missingFields.push('initialDeposit');
  if (totalTrades !== null && totalTrades < 1) missingFields.push('totalTrades');
  if (missingFields.length) { const error = new Error('REPORT_METRICS_INCOMPLETE'); error.missingFields = [...new Set(missingFields)]; throw error; }
  const generated = curves(initialDeposit, tradesFromRows(rows));
  const observedMax = Math.max(...generated.drawdownCurve.map((point) => point.percent));
  return { ...required, totalTrades: Math.trunc(totalTrades), ...generated, reportedMaxDrawdownPercent: maxDrawdownPercent, calculatedMaxDrawdownPercent: observedMax };
}

export function storeReport(buffer) {
  const root = reportRoot(); fs.mkdirSync(root, { recursive: true });
  const name = `${Date.now()}_${crypto.randomBytes(16).toString('hex')}.html`;
  fs.writeFileSync(reportPath(name), buffer, { flag: 'wx', mode: 0o600 }); return name;
}

export function cleanupOrphanReports(now = Date.now()) {
  const rows = db.prepare('SELECT id,stored_name FROM strategy_reports WHERE product_id IS NULL AND uploaded_at<=?').all(now - 24 * 60 * 60 * 1000);
  const remove = db.prepare('DELETE FROM strategy_reports WHERE id=? AND product_id IS NULL'); let removed = 0;
  for (const row of rows) if (remove.run(row.id).changes === 1) { try { fs.rmSync(reportPath(row.stored_name), { force:true }); } catch {} removed += 1; }
  return removed;
}

export function reportDto(row) { return { id: row.id, originalName: row.original_name, sha256: row.content_sha256, metrics: JSON.parse(row.extracted_json), uploadedAt: row.uploaded_at }; }

export function claimReport(productId, ownerUserId, reportId) {
  const row = db.prepare('SELECT * FROM strategy_reports WHERE id=?').get(reportId);
  if (!row || row.owner_user_id !== ownerUserId || (row.product_id !== null && row.product_id !== productId)) throw new Error('REPORT_OWNERSHIP_INVALID');
  db.prepare('UPDATE strategy_reports SET product_id=NULL WHERE product_id=?').run(productId);
  if (db.prepare('UPDATE strategy_reports SET product_id=? WHERE id=? AND owner_user_id=? AND product_id IS NULL').run(productId, reportId, ownerUserId).changes !== 1) throw new Error('REPORT_ALREADY_USED');
}

export function verifyMetricsAgainstReport(reportId, ownerUserId, metrics) {
  const row = db.prepare('SELECT * FROM strategy_reports WHERE id=? AND owner_user_id=?').get(reportId, ownerUserId);
  if (!row) throw new Error('REPORT_OWNERSHIP_INVALID'); const extracted = JSON.parse(row.extracted_json);
  for (const field of ['initialDeposit','netProfit','profitFactor','sharpeRatio','maxDrawdownPercent','recoveryFactor','winRatePercent','totalTrades']) {
    const tolerance = field === 'totalTrades' ? 0 : Math.max(0.01, Math.abs(extracted[field]) * 0.005);
    if (Math.abs(Number(metrics[field]) - Number(extracted[field])) > tolerance) throw new Error('REPORT_METRICS_MODIFIED');
  }
  if (JSON.stringify(metrics.equityCurve) !== JSON.stringify(extracted.equityCurve)
    || JSON.stringify(metrics.drawdownCurve) !== JSON.stringify(extracted.drawdownCurve)
    || JSON.stringify(metrics.monthlyReturns) !== JSON.stringify(extracted.monthlyReturns)) throw new Error('REPORT_CURVES_MODIFIED');
  return extracted;
}
