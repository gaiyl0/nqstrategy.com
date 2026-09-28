import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { createSecurityContext, enforceRateLimits, RATE_LIMITS, withAudit } from '@/lib/security';
import { malwareScan, sha256 } from '@/lib/upload-security';
import { MAX_MT5_REPORT_SIZE, cleanupOrphanReports, parseMt5Report, reportDto, reportPath, storeReport } from '@/lib/mt5-report';

export const dynamic = 'force-dynamic';

const ERRORS = {
  REPORT_FORMAT_INVALID: '文件不是可识别的 MT5 HTML 报告',
  REPORT_METRICS_INCOMPLETE: '报告缺少必需的 MT5 统计指标',
  REPORT_TRADES_REQUIRED: '报告缺少至少两个交易日期的成交明细，无法生成曲线',
  REPORT_DEAL_HEADER_REQUIRED: '报告缺少可识别的成交表头（Time/Profit），无法安全生成曲线',
};

export async function POST(request) {
  const user = await getSessionUser(); const context = createSecurityContext(request, user);
  const layers = [{ policy: RATE_LIMITS.uploadIp }];
  if (user) layers.push({ policy: RATE_LIMITS.uploadUserShort, identifier: `user:${user.id}` }, { policy: RATE_LIMITS.uploadUserDaily, identifier: `user:${user.id}` });
  const limited = enforceRateLimits(context, 'strategy-report.upload', layers); if (limited) return limited;
  const audited = (response, outcome, reasonCode, metadata = {}) => withAudit(context, response, { eventType: 'strategy-report.upload', outcome, reasonCode, metadata });
  let storedName;
  try {
    if (!user) return audited(NextResponse.json({ success: false, message: '请先登录' }, { status: 401 }), 'failure', 'UNAUTHENTICATED');
    if (!['developer','admin'].includes(user.role)) return audited(NextResponse.json({ success: false, message: '仅开发者可上传回测报告' }, { status: 403 }), 'failure', 'FORBIDDEN_ROLE');
    cleanupOrphanReports();
    const form = await request.formData(); const file = form.get('file');
    if (!file || typeof file === 'string' || file.size <= 0 || file.size > MAX_MT5_REPORT_SIZE) return audited(NextResponse.json({ success: false, message: 'MT5 HTML 报告必须在 1 字节至 10MB 之间' }, { status: 400 }), 'failure', 'FILE_SIZE_INVALID');
    const originalName = String(file.name || '').slice(0, 255); const extension = path.extname(originalName).toLowerCase();
    if (!['.htm','.html'].includes(extension)) return audited(NextResponse.json({ success: false, message: '请上传 MT5 导出的 HTML 报告' }, { status: 400 }), 'failure', 'EXTENSION_NOT_ALLOWED');
    const content = Buffer.from(await file.arrayBuffer()); const hash = sha256(content);
    const existing = db.prepare('SELECT * FROM strategy_reports WHERE owner_user_id=? AND content_sha256=?').get(user.id, hash);
    if (existing) {
      if (existing.product_id === null && fs.existsSync(reportPath(existing.stored_name))) return audited(NextResponse.json({ success: true, report: reportDto(existing), resumed: true }), 'success', 'REPORT_RESUMED', { reportId: existing.id });
      if (existing.product_id === null) { db.prepare('DELETE FROM strategy_reports WHERE id=? AND product_id IS NULL').run(existing.id); try { fs.rmSync(reportPath(existing.stored_name), { force:true }); } catch {} }
      else
      return audited(NextResponse.json({ success: false, message: '相同报告已经绑定到其他策略' }, { status: 409 }), 'failure', 'REPORT_ALREADY_BOUND');
    }
    let metrics; try { metrics = parseMt5Report(content); } catch (error) {
      const fieldNames = { initialDeposit:'初始入金',netProfit:'总净盈利',profitFactor:'盈利因子',sharpeRatio:'夏普比率',maxDrawdownPercent:'最大回撤',recoveryFactor:'复原因子',winRatePercent:'盈利交易比例',totalTrades:'交易总计' };
      const missing = Array.isArray(error.missingFields) ? error.missingFields.map((field)=>fieldNames[field] || field).join('、') : '';
      const message = missing ? `报告缺少或无法识别：${missing}` : (ERRORS[error.message] || 'MT5 报告解析失败');
      return audited(NextResponse.json({ success: false, message, missingFields: error.missingFields || [] }, { status: 400 }), 'failure', error.message, { missingFields: error.missingFields || [] });
    }
    const scan = await malwareScan(content, { fileName: originalName, contentType: 'text/html', sha256: hash });
    if (!scan.clean) return audited(NextResponse.json({ success: false, message: scan.reason === 'SCANNER_UNAVAILABLE' ? '安全扫描服务暂不可用' : '报告未通过安全扫描' }, { status: scan.reason === 'SCANNER_UNAVAILABLE' ? 503 : 400 }), 'failure', scan.reason);
    storedName = storeReport(content);
    const result = db.prepare(`INSERT INTO strategy_reports(owner_user_id,original_name,stored_name,content_sha256,size,extracted_json,uploaded_at) VALUES(?,?,?,?,?,?,?)`).run(user.id, originalName, storedName, hash, content.length, JSON.stringify(metrics), Date.now());
    return audited(NextResponse.json({ success: true, report: reportDto(db.prepare('SELECT * FROM strategy_reports WHERE id=?').get(Number(result.lastInsertRowid))) }, { status: 201 }), 'success', 'REPORT_PARSED', { trades: metrics.totalTrades });
  } catch (error) {
    if (storedName) try { fs.rmSync(reportPath(storedName), { force: true }); } catch {}
    console.error('MT5 报告上传异常:', error); return audited(NextResponse.json({ success: false, message: 'MT5 报告处理失败' }, { status: 500 }), 'failure', 'INTERNAL_ERROR');
  }
}
