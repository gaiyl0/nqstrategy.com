export const DEFAULT_COMMUNITY_CONTENT = {
  updatedAt: '2026-09-29',
  news: [
    { region: '美国 · 美联储', regionEn: 'United States · Federal Reserve', date: '2026-09-16', title: 'FOMC 将联邦基金利率目标区间上调至 3.75%–4.00%', titleEn: 'FOMC raises the federal funds target range to 3.75%–4.00%', summary: '声明称经济活动保持稳健，但通胀仍处高位，地缘政治不确定性仍是风险因素。对量化研究而言，美元利率预期与政策声明前后的波动值得纳入事件风险测试。', summaryEn: 'The statement described solid activity, elevated inflation and geopolitical uncertainty. Quant research can include rate-expectation shifts and event-window volatility in its risk tests.', url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm', source: 'Federal Reserve · FOMC statement', sourceEn: 'Federal Reserve · FOMC statement' },
    { region: '美国 · 通胀', regionEn: 'United States · Inflation', date: '2026-09-11', title: '8 月 CPI 月增 0.4%，同比 3.4%', titleEn: 'August CPI rose 0.4% month over month and 3.4% year over year', summary: 'BLS 报告显示核心 CPI 月增 0.3%、同比 2.4%；汽油价格贡献了当月整体 CPI 增幅的三分之一以上。注意区分季调月率与未季调同比口径。', summaryEn: 'BLS reported core CPI up 0.3% monthly and 2.4% year over year; gasoline accounted for over one third of the monthly headline increase. Note the seasonal-adjustment basis when comparing monthly and annual rates.', url: 'https://www.bls.gov/news.release/archives/cpi_09112026.htm', source: 'U.S. Bureau of Labor Statistics · CPI', sourceEn: 'U.S. Bureau of Labor Statistics · CPI' },
    { region: '欧元区 · 欧洲央行', regionEn: 'Euro area · European Central Bank', date: '2026-09-10', title: 'ECB 上调三项关键利率 25 个基点', titleEn: 'ECB raises its three key rates by 25 basis points', summary: '欧洲央行称中东冲突带来通胀压力；工作人员预测 2026、2027、2028 年总体通胀分别为 3.0%、2.5%、2.1%。欧元相关策略应把利率路径与能源冲击作为情景变量，而非单向信号。', summaryEn: 'The ECB cited inflation pressure from the Middle East conflict and projected headline inflation of 3.0%, 2.5% and 2.1% for 2026, 2027 and 2028. Treat rate paths and energy shocks as scenarios, not one-way signals.', url: 'https://www.ecb.europa.eu/press/press_conference/monetary-policy-statement/2026/html/ecb.is260910~6a45359cfc.en.html', source: 'European Central Bank · Monetary policy statement', sourceEn: 'European Central Bank · Monetary policy statement' },
  ],
  documents: [
    { title: 'MT5 回测报告阅读指南', titleEn: 'How to read an MT5 backtest report', description: '了解回测区间、建模质量、交易数量、盈利因子与回撤口径。', descriptionEn: 'Understand test periods, modeling quality, trade counts, profit factor and drawdown definitions.', url: 'https://www.metatrader5.com/en/terminal/help/algotrading/testing' },
    { title: 'MQL5 官方文档', titleEn: 'Official MQL5 documentation', description: '查阅 MQL5 语言、交易 API 与策略测试器的官方资料。', descriptionEn: 'Official references for the MQL5 language, trading API and Strategy Tester.', url: 'https://www.mql5.com/en/docs' },
  ],
  strategies: [
    { title: '趋势跟随', titleEn: 'Trend following', detail: '用趋势状态过滤入场，预先定义跟踪止损与趋势失效条件；重点检查震荡期的连续小亏损和换手成本。', detailEn: 'Filter entries by regime and define trailing exits and invalidation in advance. Test whipsaw losses and turnover costs in sideways markets.' },
    { title: '区间突破', titleEn: 'Breakout', detail: '把波动率扩张、时段与成交条件纳入突破确认；以独立样本检验假突破、滑点和新闻跳空。', detailEn: 'Confirm breakouts with volatility, session and liquidity conditions. Use out-of-sample data to test false breaks, slippage and news gaps.' },
    { title: '均值回归', titleEn: 'Mean reversion', detail: '先识别适用的震荡状态，并设置价格偏离、止损和最大持仓约束；避免无上限加仓掩盖尾部风险。', detailEn: 'Use a suitable range-bound regime with deviation, stop and exposure limits. Avoid unbounded averaging that hides tail risk.' },
    { title: '组合与风险', titleEn: 'Portfolio & risk', detail: '按风险预算分配仓位，检查品种相关性、保证金占用、最大回撤和压力情景；相关性会随市场状态变化。', detailEn: 'Allocate by risk budget and test correlation, margin, drawdown and stress scenarios. Correlations can change across regimes.' },
  ],
};

export function normalizeCommunityContent(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
}
