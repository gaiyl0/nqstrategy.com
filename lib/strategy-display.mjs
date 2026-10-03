const levels = {
  unverified: ['未认证','Unverified','当前没有有效认证；上架审核不等于表现验证。','There is no active verification. Listing approval does not verify performance.'],
  screenshot_reviewed: ['截图已审核','Screenshots reviewed','已核对截图资料；截图可能被修改，不等于原始报告验证或实盘验证。','Screenshot evidence was reviewed. Screenshots can be altered; this is not source-report or live verification.'],
  report_verified: ['MT5 报告已验证','MT5 report verified','开发者提供的 MT5 原始报告与截图已通过一致性检查，不代表独立实盘观察。','Developer-supplied MT5 source reports and screenshots passed consistency checks; this is not independent live observation.'],
  reproducible_backtest: ['可复现回测','Reproducible backtest','已登记参数摘要、数据集、终端版本与测试区间，可按记录复现。','Parameter digest, dataset, terminal build and test range are recorded for reproduction.'],
  platform_rerun: ['Nexus 平台复跑','Nexus platform rerun','已登记平台独立复跑的编号、环境与结果摘要；复跑仍属于历史测试。','An independent platform rerun ID, environment and result digest are recorded. This remains a historical test.'],
  live_verified: ['Nexus 实盘验证','Nexus live verified','只读实盘观察达到最低 30 天；认证有有效期，不保证未来收益。','Read-only live observation reached at least 30 days. Verification expires and does not guarantee future returns.'],
};
export function verificationDisplay(verification, t = zh => zh, now = Date.now()) {
  const expired = Boolean(verification?.expired || (verification?.expiresAt && Number(verification.expiresAt) <= now));
  const revoked = verification?.status === 'revoked';
  const level = !expired && !revoked && Object.hasOwn(levels,verification?.level) ? verification.level : 'unverified';
  const record = levels[level];
  return {level,label:t(record[0],record[1]),description:t(record[2],record[3]),variant:revoked?'danger':expired?'warning':level==='unverified'?'neutral':level==='live_verified'?'success':'primary',statusLabel:revoked?t('认证已撤销','Verification revoked'):expired?t('认证已过期','Verification expired'):null};
}
export function displayNumber(value, digits=2) {
  if(value===null || value===undefined || value==='' || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString(undefined,{minimumFractionDigits:digits,maximumFractionDigits:digits});
}
export function displayDate(value, t = zh => zh) {
  if(!value || !Number.isFinite(new Date(value).getTime()))return t('未披露','Not disclosed');
  return new Date(value).toLocaleDateString('zh-CN');
}
export function upgradeLabel(policy,t=zh=>zh) {
  return policy==='all_existing'?t('所有已有买家继承此版本','All existing owners inherit this version'):policy==='new_purchases_only'?t('仅此版本发布后的新买家可下载','Only purchases after this release are eligible'):t('升级规则未披露','Upgrade policy not disclosed');
}
