import React from 'react';

const COPY = {
  '运营控制台': 'Operations Console', '生产环境': 'Production', '管理员会话已验证': 'Administrator session verified', '返回网站': 'Back to website',
  '仪表盘': 'Dashboard', '运营仪表盘': 'Operations Dashboard', '用户与角色': 'Users & Roles', '策略与证据审核': 'Strategy & Evidence Review',
  '订单与支付': 'Orders & Payments', '支付渠道配置': 'Payment Channels', '访问与广告统计': 'Traffic & Ad Analytics', '提现管理': 'Withdrawals', '授权管理': 'Licenses', '社区治理': 'Community Moderation', '系统设置': 'System Settings',
  '安全边界已启用': 'Security controls enabled', '管理员 RBAC、会话校验、幂等操作与审计日志继续由服务端执行。': 'Admin RBAC, session checks, idempotency, and audit logging are enforced server-side.',
  '真实业务数据、审核队列与风险操作集中管理。': 'Manage live business data, review queues, and risk-sensitive actions.', '保存所有配置': 'Save all settings',
  '待审策略': 'Strategies awaiting review', '进入策略审核队列': 'Open strategy review queue', '待处理提现': 'Withdrawals awaiting review', '真实打款前必须人工复核': 'Manual review required before payout',
  '风险事件': 'Risk events', '当前待处理内容举报': 'Content reports awaiting review', '历史订单': 'Order history', '付费能力仍处于关闭状态': 'Paid checkout remains disabled',
  '待办队列': 'Review queue', '来自当前数据库的真实待处理记录': 'Pending items from the current database', '策略审核': 'Strategy review', '提现复核': 'Withdrawal review', '订单异常': 'Order issues', '内容举报': 'Content reports',
  '当前没有待处理记录': 'No pending items', '系统状态': 'System status', '管理员身份': 'Administrator', '已验证': 'Verified', '付费能力': 'Paid checkout', '保持关闭': 'Disabled', 'API 操作': 'API actions', '服务端鉴权': 'Server-authorized', '审计边界': 'Audit controls', '已启用': 'Enabled',
  'MT5 软件下载': 'MT5 download', 'MT5 软件下载配置': 'MT5 download settings', '开启 MT5 下载入口': 'Enable MT5 download links', 'MT5 下载地址': 'MT5 download URL', 'MT5 下载按钮文字': 'MT5 download button label', 'MT5 下载说明': 'MT5 download description', '入口预览': 'Link preview',
  '论坛展示模块': 'Forum display modules', '论坛栏目配置': 'Forum categories', '论坛首页模块开关': 'Forum homepage switches', '市场简报 · 重要新闻': 'Market briefings · Important news', '已开启': 'On', '已关闭': 'Off', '显示管理员配置的新闻摘要与来源链接。': 'Show administrator-configured news summaries and source links.', '显示可展开的网格、趋势等策略研究摘要。': 'Show expandable summaries of grid, trend and other strategy research.', '分别控制论坛讨论列表顶部的两个模块。关闭只隐藏展示，已保存的内容不会删除，文档和策略研究资料仍可访问。更改后点击“保存配置”生效。': 'Control the two modules above forum discussions. Disabling a module hides it without deleting its content. Documents and strategy resources remain accessible. Save settings to apply changes.',
  '业务快照': 'Business snapshot', '用户': 'Users', '策略': 'Strategies', '已核验完成订单金额': 'Verified completed order value', '论坛与社区导航配置': 'Forum & community navigation',
  '例如：XAUUSD 策略,MQL5 开发,官方公告': 'Example: XAUUSD, MQL5, Announcements', '基础与邮件网关': 'General & email gateway', '网站名称': 'Site name', '联系邮箱': 'Contact email', 'SMTP 主机': 'SMTP host', 'SMTP 账号': 'SMTP username', 'SMTP 密码': 'SMTP password',
  '用户标识': 'User', '账户余额': 'Balance', '系统权限与头衔': 'Role & title', '超管操作': 'Administrator actions', '普通用户': 'User', '超级管理员': 'Super administrator', '删除': 'Delete',
  '策略详情': 'Strategy', '开发者': 'Developer', '售价': 'Price', '状态': 'Status', '审核操作': 'Review actions', '当前': 'Current', '发布版本': 'Publish version', '拒绝版本': 'Reject version', '下架版本': 'Retire version',
  '待审核': 'Awaiting review', '已审核': 'Reviewed', '待认证': 'Awaiting verification', '已认证': 'Verified', '资料不完整': 'Incomplete', '策略审核': 'Strategy review', '证据认证': 'Evidence verification',
  '全部': 'All', '已通过': 'Approved', '未认证': 'Unverified', '全部开发者': 'All developers', '最新提交优先': 'Newest first', '当前分类没有策略': 'No strategies in this category',
  '资料完整度': 'Completeness', '审核状态': 'Review status', '认证状态': 'Verification status', '共': 'Total', '条记录': 'records', '页': 'pages',
  '审核清单': 'Review checklist', '必需证据通过': 'required evidence approved', '设置截图': 'Settings screenshot', '统计截图': 'Statistics screenshot', '净值曲线': 'Equity curve', '后台分析': 'Backtest analysis', '已提供': 'Provided', '查看': 'View', '未提供': 'Missing',
  'MT5 报告': 'MT5 report', '已解析': 'Parsed', '风险摘要': 'Risk summary', '最大回撤': 'Max drawdown', '交易': 'Trades', '待审证据': 'Evidence awaiting review', '版本审核': 'Version review',
  '确认通过': 'Approve strategy', '永久删除': 'Delete permanently', '下架策略': 'Retire strategy', '认证管理': 'Verification management', '授予认证': 'Grant verification', '当前策略尚未获得认证': 'This strategy is not verified',
  '请先完成必需证据、结构化指标和 MT5 报告审核。': 'Complete required evidence, structured metrics, and MT5 report review first.',
  '证据通过': 'Approve evidence', '拒绝': 'Reject', '批准': 'Approve', '先审核必需证据': 'Review required evidence first', '永久': 'Never', '未绑定': 'Not bound', '撤销': 'Revoke',
  '目标': 'Target', '原因': 'Reason', '身份': 'Identity', '提交时间': 'Submitted', '处置': 'Action', '暂无待处理举报': 'No pending reports', '无补充说明': 'No additional details', '驳回': 'Dismiss', '确认违规并隐藏': 'Confirm violation & hide',
  '付费购买和人工确认到账已关闭。当前只能查看历史订单或驳回待处理订单，不能发放付费资产或结算创作者余额。': 'Paid purchases and manual payment confirmation are disabled. You can review order history or reject pending orders; paid assets and creator payouts cannot be issued.',
  '订单总笔数': 'Total orders', '订单单号': 'Order ID', '策略名': 'Strategy', '当前状态': 'Current status', '财务审核': 'Finance review', '暂无任何交易订单': 'No orders yet', '已删除策略': 'Deleted strategy',
  '申请人': 'Requester', '提现金额': 'Withdrawal amount', '收款地址(USDT等)': 'Payout address (e.g. USDT)', '财务操作': 'Finance actions', '暂无提现申请': 'No withdrawal requests', '处理中': 'Processing', '已打款': 'Paid', '已驳回': 'Rejected',
  '调控用户余额': 'Adjust user balance', '取消': 'Cancel', '确认调整': 'Confirm adjustment', '余额（USD）': 'Balance (USD)', '强制修改密码': 'Reset password', '确认修改': 'Confirm change', '新密码': 'New password',
  '拒绝证据': 'Reject evidence', '拒绝原因': 'Rejection reason', '确认拒绝': 'Confirm rejection', '校正 OCR 统计数据': 'Correct OCR metrics', 'OCR 未提取到可用结果。校正数据将进入审核记录。': 'OCR did not produce usable values. Corrections will be recorded for review.',
  '结构化 JSON': 'Structured JSON', '必须包含初始资金、净利润、Profit Factor、最大回撤、胜率和交易次数。': 'Include initial deposit, net profit, profit factor, maximum drawdown, win rate, and total trades.', '应用校正': 'Apply correction', 'JSON 格式无效': 'Invalid JSON format',
  '校正数据必须是合法 JSON': 'Corrected data must be valid JSON', '证据审核失败': 'Evidence review failed', '证据审核状态已更新': 'Evidence review status updated', '授予策略认证': 'Grant strategy verification', '认证等级': 'Verification level', '可复现回测': 'Reproducible backtest', '平台复跑': 'Platform rerun', '实盘验证': 'Live verification', '下一步': 'Next',
  '认证等级不合法': 'Invalid verification level', '填写认证证据': 'Enter verification evidence', '证据 JSON': 'Evidence JSON', '批准认证': 'Approve verification', '证据必须是合法 JSON': 'Evidence must be valid JSON', '认证失败': 'Verification failed', '认证等级已更新': 'Verification level updated',
  '撤销策略认证': 'Revoke strategy verification', '撤销原因': 'Reason for revocation', '撤销认证': 'Revoke verification', '撤销失败': 'Revocation failed', '认证已撤销': 'Verification revoked', '版本审核失败': 'Version review failed', '版本审核完成': 'Version review complete', '版本': 'Version', '操作原因': 'Reason for action', '确认下架': 'Confirm retirement', '确认拒绝': 'Confirm rejection', '已彻底删除': 'Permanently deleted',
  '密码不能为空': 'Password is required', '密码重置成功！': 'Password reset successfully', '余额修改失败': 'Balance update failed', '余额操作已处理': 'Balance change already processed', '余额修改成功并已记录账本！': 'Balance updated and recorded in the ledger', '调整用户权限': 'Change user role', '权限变更会立即生效': 'Role changes take effect immediately', '请确认新角色与用户的实际职责一致。': 'Confirm the new role matches this user’s responsibilities.', '确认更改': 'Confirm change', '用户权限已更新': 'User role updated',
  '注销用户': 'Deactivate user', '历史资产将保留原 user_id 关联': 'Historical assets remain linked to the original user ID', '账户会被匿名化并停用，同名重新注册不会继承旧订单、产品或收入。': 'The account will be anonymized and disabled. A re-registered username will not inherit prior orders, products, or revenue.', '确认注销': 'Confirm deactivation', '用户已删除': 'User deactivated',
  '批准提现': 'Approve withdrawal', '驳回提现': 'Reject withdrawal', '请确认链下打款已完成': 'Confirm the off-platform payment has been completed', '冻结余额将原子退回': 'Reserved balance will be refunded atomically', '状态更新具有幂等保护，重复操作不会重复结算。': 'Status updates are idempotent; repeating the action will not settle twice.', '驳回退款只会执行一次并写入账本。': 'A rejection refund is issued once and recorded in the ledger.', '确认已打款': 'Confirm payment sent', '驳回并退回余额': 'Reject and refund balance', '提现状态已更新': 'Withdrawal status updated',
  '驳回无效订单': 'Reject invalid order', '订单将进入拒绝状态': 'The order will be marked rejected', '未经服务端确认的付款不会发放资产或触发创作者结算。': 'Payments not verified server-side will not grant assets or trigger creator settlement.', '确认驳回': 'Confirm rejection', '审核操作失败': 'Review action failed', '策略状态更新失败': 'Strategy status update failed', '策略状态已更新': 'Strategy status updated', '配置保存失败': 'Settings could not be saved', '所有配置已永久保存生效！': 'All settings saved successfully',
  '永久删除': 'Delete permanently', '策略文件、审核状态和市场入口将受到影响。': 'This affects the strategy file, review state, and marketplace listing.', '此操作不可撤销': 'This action cannot be undone', '订单总笔数': 'Total orders', '本次操作失败': 'This action failed', '操作失败': 'Action failed', '用户': 'Users', '策略': 'Strategies', '返回网站': 'Back to website', '切换语言': 'Switch language',
  '最高统治者': 'Administrator', '普通用户': 'User', '独立开发者': 'Independent developer', '资深算法师': 'Senior quant researcher', '首席架构师': 'Chief architect', '传奇大牛': 'Legendary quant', '见习宽客': 'Junior quant',
  '订单将进入拒绝状态': 'The order will be marked rejected', '确认违规': 'Confirm violation', '驳回举报': 'Dismiss report', '违规确认依据': 'Reason for confirming violation', '驳回说明': 'Reason for dismissal', '提交处理': 'Submit decision', '举报处理失败': 'Report resolution failed', '举报处理完成': 'Report resolution complete',
  '撤销授权': 'Revoke license', '撤销后现有令牌立即失效。': 'Existing tokens are invalidated immediately after revocation.', '授权撤销失败': 'License revocation failed', '授权已撤销，现有令牌失效': 'License revoked; existing tokens invalidated', '认证已撤销': 'Verification revoked',
  '所有配置已永久保存生效！': 'All settings saved successfully', '✅ 正常': '✅ Normal', '✅ 已验证': '✅ Verified', '⏳ 待审': '⏳ Pending review', '⏳ 处理中': '⏳ Processing', '✅ 已打款': '✅ Paid', '❌ 已驳回': '❌ Rejected', '指标和报告': 'Metrics and report', '请先完成': 'Complete these first', '中文': '中文',
};

export const localizeAdminValue = (value, lang) => {
  if (lang !== 'en' || typeof value !== 'string') return value;
  const trimmed = value.trim();
  const translation = COPY[trimmed];
  return translation ? value.replace(trimmed, translation) : value;
};

export function AdminLocale({ lang, children }) {
  const visit = node => {
    if (typeof node === 'string') return localizeAdminValue(node, lang);
    if (Array.isArray(node)) return React.Children.map(node, visit);
    if (!React.isValidElement(node)) return node;
    const props = { ...node.props };
    for (const key of ['placeholder', 'title', 'aria-label']) {
      if (typeof props[key] === 'string') props[key] = localizeAdminValue(props[key], lang);
    }
    if (props.children !== undefined) props.children = visit(props.children);
    return React.cloneElement(node, props);
  };
  return visit(children);
}
