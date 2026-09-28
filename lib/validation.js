import { NextResponse } from 'next/server.js';
import { z } from 'zod';

const MAX_ID = Number.MAX_SAFE_INTEGER;
const SAFE_UPLOAD_URL_PATTERN = /^\/(?:uploads|private\/eas)\/[A-Za-z0-9._-]+$/;

function trimmedText(label, min, max) {
  return z.string({ error: `${label}必须是字符串` })
    .trim()
    .min(min, `${label}不能少于 ${min} 个字符`)
    .max(max, `${label}不能超过 ${max} 个字符`);
}

function optionalText(label, max) {
  return z.string({ error: `${label}必须是字符串` })
    .trim()
    .max(max, `${label}不能超过 ${max} 个字符`)
    .default('');
}

function decimalSchema(label, { min = 0, max = 1_000_000_000 } = {}) {
  return z.preprocess((value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && /^-?(0|[1-9]\d*)(\.\d{1,2})?$/.test(value.trim())) return Number(value.trim());
    return Number.NaN;
  }, z.number({ error: `${label}必须是最多两位小数的十进制数字` })
    .finite(`${label}必须是有限数字`)
    .min(min, `${label}不能小于 ${min}`)
    .max(max, `${label}不能大于 ${max}`))
    .refine((value) => {
      const normalized = String(value);
      return !/[eE]/.test(normalized) && (normalized.split('.')[1]?.length || 0) <= 2;
    }, `${label}最多保留两位小数`);
}

export const idSchema = z.preprocess((value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value.trim())) return Number(value.trim());
  return Number.NaN;
}, z.number({ error: 'ID 必须是正整数' }).int('ID 必须是正整数').positive('ID 必须是正整数').max(MAX_ID, 'ID 超出允许范围'));

export const moneySchema = decimalSchema('金额');
export const productPriceSchema = decimalSchema('产品价格', { min: 0, max: 1_000_000 });
export const withdrawalAmountSchema = decimalSchema('提现金额', { min: 100, max: 1_000_000_000 });

export const roleSchema = z.enum(['user', 'developer', 'admin', 'banned'], {
  error: '角色必须是 user、developer、admin 或 banned',
});
export const adminScopeSchema = z.literal('admin', { error: '管理范围参数必须为 admin' });
export const productStatusSchema = z.enum(['pending', 'active'], { error: '产品状态不合法' });
export const orderActionSchema = z.enum(['approve', 'reject'], { error: '订单操作不合法' });
export const withdrawalDecisionSchema = z.enum(['completed', 'rejected'], { error: '提现状态不合法' });

export const usernameSchema = trimmedText('用户名', 2, 50)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N}_. -]*$/u, '用户名只能包含文字、数字、空格、点、下划线和连字符');
export const emailSchema = z.string({ error: '邮箱必须是字符串' })
  .trim()
  .max(254, '邮箱不能超过 254 个字符')
  .email('邮箱格式不正确')
  .transform((value) => value.toLowerCase());
export const passwordSchema = z.string({ error: '密码必须是字符串' })
  .min(8, '密码长度必须为 8-128 个字符')
  .max(128, '密码长度必须为 8-128 个字符')
  .refine((value) => value.trim().length >= 8, '密码不能只包含空白字符');
export const loginPasswordSchema = z.string({ error: '密码必须是字符串' })
  .min(1, '请输入密码')
  .max(256, '登录密码不能超过 256 个字符')
  .refine((value) => value.trim().length > 0, '请输入密码');
export const verificationCodeSchema = z.string({ error: '验证码必须是字符串' })
  .trim()
  .regex(/^\d{6}$/, '验证码必须是 6 位数字');

export const idempotencyKeySchema = z.string({ error: '缺少或非法的 Idempotency-Key' })
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/, '缺少或非法的 Idempotency-Key');

const evmAddress = /^0x[a-fA-F0-9]{40}$/;
const tronAddress = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const bitcoinAddress = /^(?:[13][a-km-zA-HJ-NP-Z1-9]{25,61}|(?:bc1|tb1)[ac-hj-np-z02-9]{11,71})$/i;
const solanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const walletAddressSchema = z.string({ error: '钱包地址必须是字符串' })
  .trim()
  .min(10, '钱包地址格式不正确')
  .max(128, '钱包地址不能超过 128 个字符')
  .refine(
    (value) => (evmAddress.test(value) && !/^0x0{40}$/i.test(value)) || tronAddress.test(value) || bitcoinAddress.test(value) || solanaAddress.test(value),
    '钱包地址格式不正确，仅支持 EVM、TRON、BTC 或 Solana 地址',
  );

const optionalWalletAddress = z.union([z.literal(''), walletAddressSchema]);
const optionalEmail = z.string({ error: '邮箱必须是字符串' })
  .trim()
  .max(254, '邮箱不能超过 254 个字符')
  .refine((value) => value === '' || z.string().email().safeParse(value).success, '邮箱格式不正确')
  .transform((value) => value.toLowerCase());
const optionalUrl = z.union([
  z.literal(''),
  z.string().trim().max(500, '链接不能超过 500 个字符').url('链接格式不正确')
    .refine((value) => /^https?:\/\//i.test(value), '链接只允许 HTTP 或 HTTPS'),
]);
const optionalUploadUrl = z.union([
  z.literal(''),
  z.string().trim().max(300, '上传路径过长').regex(SAFE_UPLOAD_URL_PATTERN, '上传路径格式不正确'),
  z.null(),
]);

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  code: verificationCodeSchema,
}).strict();

export const loginSchema = z.object({
  account: trimmedText('账号', 2, 254),
  password: loginPasswordSchema,
}).strict();

export const passwordResetSchema = z.object({
  action: z.literal('reset_password').optional(),
  email: emailSchema,
  code: verificationCodeSchema,
  newPassword: passwordSchema,
}).strict();
export const sendCodeSchema = z.object({
  toEmail: emailSchema,
  type: z.enum(['register', 'reset'], { error: '验证码用途不合法' }).default('register'),
}).strict();

const productBaseShape = {
  title: trimmedText('策略名称', 1, 120),
  description: optionalText('策略描述', 10_000),
  price: productPriceSchema.default(0),
  winRate: optionalText('胜率', 50),
  drawdown: optionalText('回撤', 50),
  pairs: optionalText('交易品种', 100),
  eaTypes: z.array(trimmedText('策略类型', 1, 50)).max(12, '策略类型不能超过 12 项').default([])
    .transform((items) => [...new Set(items)]),
  logo_url: optionalUploadUrl.optional(),
  file_url: optionalUploadUrl.optional(),
  metrics: z.object({
    initialDeposit: z.coerce.number({ error: '初始资金必须是数字' }).finite().min(1, '初始资金必须至少为 1').max(1_000_000_000, '初始资金超出范围'),
    netProfit: z.coerce.number({ error: '净利润必须是数字' }).finite().min(-1_000_000_000, '净利润超出范围').max(1_000_000_000, '净利润超出范围'),
    profitFactor: z.coerce.number({ error: 'Profit Factor 必须是数字' }).finite().min(0, 'Profit Factor 不能为负数').max(1_000, 'Profit Factor 超出范围'),
    sharpeRatio: z.coerce.number({ error: 'Sharpe Ratio 必须是数字' }).finite().min(-100, 'Sharpe Ratio 超出范围').max(100, 'Sharpe Ratio 超出范围'),
    maxDrawdownPercent: z.coerce.number({ error: '最大回撤必须是数字' }).finite().min(0, '最大回撤不能为负数').max(100, '最大回撤不能超过 100%'),
    recoveryFactor: z.coerce.number({ error: 'Recovery Factor 必须是数字' }).finite().min(-1_000, 'Recovery Factor 超出范围').max(1_000, 'Recovery Factor 超出范围'),
    winRatePercent: z.coerce.number({ error: '胜率必须是数字' }).finite().min(0, '胜率不能为负数').max(100, '胜率不能超过 100%'),
    totalTrades: z.coerce.number({ error: '交易次数必须是整数' }).int('交易次数必须是整数').min(1, '交易次数必须至少为 1').max(10_000_000, '交易次数超出范围'),
    equityCurve: z.array(z.object({
      date: z.iso.date({ error: '净值曲线日期必须使用 YYYY-MM-DD' }),
      value: z.coerce.number({ error: '净值必须是数字' }).finite().min(0, '净值不能为负数').max(10_000_000_000, '净值超出范围'),
    }).strict()).min(2, '净值曲线至少需要 2 个点').max(2_000, '净值曲线不能超过 2000 个点'),
    drawdownCurve: z.array(z.object({
      date: z.iso.date({ error: '回撤曲线日期必须使用 YYYY-MM-DD' }),
      percent: z.coerce.number({ error: '回撤百分比必须是数字' }).finite().min(0, '回撤不能为负数').max(100, '回撤不能超过 100%'),
    }).strict()).min(2, '回撤曲线至少需要 2 个点').max(2_000, '回撤曲线不能超过 2000 个点'),
    monthlyReturns: z.array(z.object({
      month: z.string({ error: '月份必须是字符串' }).regex(/^\d{4}-(?:0[1-9]|1[0-2])$/, '月份必须使用 YYYY-MM'),
      percent: z.coerce.number({ error: '月度收益必须是数字' }).finite().min(-100, '月度收益不能低于 -100%').max(10_000, '月度收益超出范围'),
    }).strict()).min(1, '至少需要 1 个月度收益').max(240, '月度收益不能超过 240 个月'),
  }).strict().superRefine((metrics, context) => {
    const requireAscending = (items, key, path, label) => {
      for (let index = 1; index < items.length; index += 1) {
        if (items[index][key] <= items[index - 1][key]) {
          context.addIssue({ code: 'custom', path: [path, index, key], message: `${label}必须按时间严格递增且不能重复` });
          break;
        }
      }
    };
    requireAscending(metrics.equityCurve, 'date', 'equityCurve', '净值曲线日期');
    requireAscending(metrics.drawdownCurve, 'date', 'drawdownCurve', '回撤曲线日期');
    requireAscending(metrics.monthlyReturns, 'month', 'monthlyReturns', '月度收益月份');
  }),
  evidenceIds: z.array(idSchema).min(3, '必须上传设置、统计和净值曲线三类 MT5 证据').max(4, '证据文件不能超过 4 个').refine((ids) => new Set(ids).size === ids.length, '证据 ID 不能重复'),
  reportId: idSchema,
  version: z.string().trim().regex(/^[0-9]+(?:\.[0-9]+){1,3}(?:-[0-9A-Za-z.-]+)?$/, '版本号格式示例：1.0.0').max(40).optional(),
  releaseNotes: optionalText('版本更新日志', 5_000).optional(),
  upgradePolicy: z.enum(['all_existing','new_purchases_only'], { error:'版本权益策略不合法' }).optional(),
  trialEnabled:z.boolean({error:'试用开关必须是布尔值'}).optional(),
  trialDays:z.coerce.number().int().min(1).max(30).optional(),
};

export const createProductSchema = z.object(productBaseShape).strict().superRefine((value, context) => {
  if (!value.file_url || !String(value.file_url).startsWith('/private/eas/')) {
    context.addIssue({ code: 'custom', path: ['file_url'], message: '必须提供有效的私有 EA 上传路径' });
  }
  if (!value.version) context.addIssue({ code:'custom',path:['version'],message:'必须填写初始版本号' });
  if (!value.releaseNotes || value.releaseNotes.length < 3) context.addIssue({ code:'custom',path:['releaseNotes'],message:'初始版本说明至少 3 个字符' });
  if (!value.upgradePolicy) context.addIssue({ code:'custom',path:['upgradePolicy'],message:'必须选择版本权益策略' });
});
export const updateProductSchema = z.object({ id: idSchema, ...productBaseShape }).strict();
export const reviewProductSchema = z.object({ id: idSchema, status: productStatusSchema }).strict();
export const productPatchSchema = z.union([reviewProductSchema, updateProductSchema]);

export const createVersionSchema = z.object({
  productId:idSchema,
  fileUrl:optionalUploadUrl.refine(value=>typeof value==='string'&&value.startsWith('/private/eas/'),'必须提供私有 EA 上传路径'),
  version:z.string().trim().regex(/^[0-9]+(?:\.[0-9]+){1,3}(?:-[0-9A-Za-z.-]+)?$/,'版本号格式示例：1.1.0').max(40),
  releaseNotes:trimmedText('版本更新日志',3,5_000),
  upgradePolicy:z.enum(['all_existing','new_purchases_only'],{error:'版本权益策略不合法'}),
}).strict();
export const reviewVersionSchema=z.discriminatedUnion('decision',[
  z.object({id:idSchema,decision:z.literal('approve')}).strict(),
  z.object({id:idSchema,decision:z.literal('reject'),reason:trimmedText('拒绝原因',5,500)}).strict(),
  z.object({id:idSchema,decision:z.literal('retire'),reason:trimmedText('下架原因',5,500)}).strict(),
]);

const licenseBindingTypeSchema=z.enum(['trading_account','device'],{error:'绑定类型不合法'});
const tradingAccountSchema=z.string().trim().regex(/^\d{4,32}$/,'MT4/MT5 账号必须为 4–32 位数字');
const deviceFingerprintSchema=trimmedText('设备指纹',16,256);
export const licenseActionSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('start_trial'),productId:idSchema}).strict(),
  z.object({action:z.literal('bind'),licenseId:idSchema,bindingType:licenseBindingTypeSchema,value:z.string().trim().min(4).max(256)}).strict().superRefine((data,ctx)=>{const schema=data.bindingType==='trading_account'?tradingAccountSchema:deviceFingerprintSchema;const parsed=schema.safeParse(data.value);if(!parsed.success)for(const issue of parsed.error.issues)ctx.addIssue({...issue,path:['value',...issue.path]});}),
]);
export const licenseTokenSchema=z.object({licenseId:idSchema,tradingAccount:tradingAccountSchema,deviceFingerprint:deviceFingerprintSchema}).strict();
export const licenseVerifySchema=z.object({token:z.string().trim().min(40).max(4096),tradingAccount:tradingAccountSchema,deviceFingerprint:deviceFingerprintSchema}).strict();
export const revokeLicenseSchema=z.object({licenseId:idSchema,reason:trimmedText('撤销原因',5,500)}).strict();
export const socialActionSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('favorite'),productId:idSchema,enabled:z.boolean()}).strict(),
  z.object({action:z.literal('follow'),developerUserId:idSchema,enabled:z.boolean()}).strict(),
  z.object({action:z.literal('rate'),productId:idSchema,rating:z.coerce.number().int().min(1).max(5),reviewText:z.string().trim().max(1000,'评价不能超过 1000 个字符').default('')}).strict(),
]);
export const marketQuerySchema=z.object({
  market:z.literal('1'),q:z.string().trim().max(100,'搜索词不能超过 100 个字符').default(''),
  pair:z.string().trim().max(40).default(''),type:z.string().trim().max(40).default(''),
  verification:z.enum(['','unverified','screenshot_reviewed','report_verified','reproducible_backtest','platform_rerun','live_verified']).default(''),
  maxDrawdown:z.preprocess(value=>value===''||value===undefined?null:value,z.coerce.number().finite().min(0).max(100).nullable()).default(null),
  maxPrice:z.preprocess(value=>value===''||value===undefined?null:value,z.coerce.number().finite().min(0).max(1_000_000).nullable()).default(null),
  page:z.coerce.number().int().min(1).max(100000).default(1),pageSize:z.coerce.number().int().min(4).max(48).default(12),
}).strict();
export const reportTargetSchema=z.enum(['product','post','comment']);
export const reportReasonSchema=z.enum(['spam','fraud','abuse','copyright','dangerous','other']);
export const createReportSchema=z.object({targetType:reportTargetSchema,targetId:idSchema,reason:reportReasonSchema,details:z.string().trim().max(1000,'举报说明不能超过 1000 个字符').default('')}).strict();
export const resolveReportSchema=z.object({id:idSchema,decision:z.enum(['dismiss','confirm']),note:trimmedText('处置说明',5,1000)}).strict();
export const forumSortSchema=z.enum(['latest','hot','discussed']);

export const evidenceTypeSchema = z.enum(['settings', 'statistics', 'chart', 'analysis'], { error: '证据类型不合法' });
export const evidenceReviewSchema = z.object({
  id: idSchema,
  status: z.enum(['approved', 'rejected'], { error: '证据审核状态不合法' }),
  rejectionReason: z.string().trim().max(500, '拒绝原因不能超过 500 字').default(''),
  correctedExtraction: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
}).strict().superRefine((value, context) => {
  if (value.status === 'rejected' && !value.rejectionReason) context.addIssue({ code: 'custom', path: ['rejectionReason'], message: '拒绝证据时必须填写原因' });
});

const sha256Schema = z.string().trim().regex(/^[a-fA-F0-9]{64}$/, 'SHA-256 必须是 64 位十六进制摘要').transform(value=>value.toLowerCase());
const verificationLevelSchema = z.enum(['reproducible_backtest','platform_rerun','live_verified'], { error:'认证等级不合法' });
const reproducibleEvidenceSchema = z.object({
  parameterFileSha256: sha256Schema,
  dataset: trimmedText('历史数据集', 2, 200),
  terminalBuild: trimmedText('MT5 终端版本', 1, 100),
  testRange: trimmedText('回测区间', 7, 100),
}).strict();
const rerunEvidenceSchema = reproducibleEvidenceSchema.extend({
  runId: trimmedText('平台复跑编号', 6, 120),
  resultSha256: sha256Schema,
  environment: trimmedText('复跑环境', 3, 500),
  rerunAt: z.iso.datetime({ error:'复跑时间必须使用 ISO 8601' }),
}).strict();
const liveEvidenceSchema = z.object({
  provider: trimmedText('实盘数据提供方', 2, 120),
  accountMasked: z.string().trim().regex(/^[A-Za-z0-9*._-]{4,64}$/, '账户标识必须脱敏'),
  accessMode: z.literal('read_only', { error:'实盘验证只能使用只读连接' }),
  observedDays: z.coerce.number().int().min(30,'实盘观察至少 30 天').max(3650),
  lastCheckedDate: z.iso.date({ error:'最后核验日期必须使用 YYYY-MM-DD' }),
  maxDrawdownPercent: z.coerce.number().finite().min(0).max(100),
}).strict();
export const verificationReviewSchema = z.discriminatedUnion('action', [
  z.object({ action:z.literal('approve'),productId:idSchema,level:verificationLevelSchema,evidence:z.union([reproducibleEvidenceSchema,rerunEvidenceSchema,liveEvidenceSchema]) }).strict().superRefine((value,ctx)=>{
    const schema=value.level==='reproducible_backtest'?reproducibleEvidenceSchema:value.level==='platform_rerun'?rerunEvidenceSchema:liveEvidenceSchema;
    const parsed=schema.safeParse(value.evidence); if(!parsed.success) for(const issue of parsed.error.issues) ctx.addIssue({ ...issue,path:['evidence',...issue.path] });
  }),
  z.object({ action:z.literal('revoke'),productId:idSchema,reason:trimmedText('撤销原因',5,500) }).strict(),
]);

export const createPostSchema = z.object({
  title: trimmedText('帖子标题', 1, 200),
  content: trimmedText('帖子内容', 1, 20_000),
  category: trimmedText('帖子分类', 1, 80),
}).strict();
export const categorySchema = trimmedText('帖子分类', 1, 80);
export const pinSchema = z.object({ id: idSchema, is_pinned: z.boolean({ error: '置顶状态必须是布尔值' }) }).strict();
export const createCommentSchema = z.object({
  postId: idSchema,
  content: trimmedText('评论内容', 1, 5_000),
}).strict();

export const createOrderSchema = z.object({ productId: idSchema }).strict();
export const reviewOrderSchema = z.object({ orderId: idSchema, action: orderActionSchema }).strict();
export const createWithdrawalSchema = z.object({
  address: walletAddressSchema,
  amount: z.preprocess((value) => value === '' || value === null ? undefined : value, withdrawalAmountSchema.optional()),
}).strict();
export const reviewWithdrawalSchema = z.object({ id: idSchema, status: withdrawalDecisionSchema }).strict();

export const changeRoleSchema = z.object({ id: idSchema, newRole: roleSchema }).strict();
export const changeBalanceSchema = z.object({ id: idSchema, manualBalance: moneySchema }).strict();
export const adminResetPasswordSchema = z.object({ id: idSchema, newPassword: passwordSchema }).strict();
export const deniedUpgradeSchema = z.object({ upgradeRole: z.literal(true), username: usernameSchema.optional() }).strict();
export const updateProfileSchema = z.object({
  newUsername: usernameSchema,
  avatar_url: optionalUploadUrl.optional(),
  password: z.union([z.literal(''), passwordSchema]).optional(),
}).strict();
export const userPatchSchema = z.object({
  id: idSchema.optional(),
  newRole: roleSchema.optional(),
  manualBalance: moneySchema.optional(),
  newPassword: passwordSchema.optional(),
  upgradeRole: z.literal(true).optional(),
  username: usernameSchema.optional(),
  newUsername: usernameSchema.optional(),
  avatar_url: optionalUploadUrl.optional(),
  password: z.union([z.literal(''), passwordSchema]).optional(),
}).strict().superRefine((value, context) => {
  const operations = [value.newRole, value.manualBalance, value.newPassword, value.upgradeRole, value.newUsername]
    .filter((item) => item !== undefined).length;
  if (operations !== 1) {
    context.addIssue({ code: 'custom', message: '必须且只能提交一种用户操作' });
    return;
  }
  if ((value.newRole !== undefined || value.manualBalance !== undefined || value.newPassword !== undefined) && value.id === undefined) {
    context.addIssue({ code: 'custom', path: ['id'], message: '管理员操作必须提供用户 ID' });
  }
  if (value.newUsername === undefined && (value.avatar_url !== undefined || value.password !== undefined)) {
    context.addIssue({ code: 'custom', path: ['newUsername'], message: '修改资料必须提供新用户名' });
  }
});

export const settingsSchema = z.object({
  siteName: optionalText('网站名称', 100).optional(),
  primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, '主题色必须是 6 位十六进制颜色').optional(),
  contactEmail: optionalEmail.optional(),
  usdtAddress: z.union([z.literal(''), z.string().trim().regex(tronAddress, 'USDT 地址必须是有效的 TRON 地址')]).optional(),
  btcAddress: z.union([z.literal(''), z.string().trim().regex(bitcoinAddress, 'BTC 地址格式不正确')]).optional(),
  ethAddress: z.union([z.literal(''), z.string().trim().regex(evmAddress, 'ETH 地址格式不正确')]).optional(),
  smtpHost: z.string().trim().max(253, 'SMTP 主机不能超过 253 个字符').regex(/^[A-Za-z0-9.-]*$/, 'SMTP 主机格式不正确').optional(),
  smtpUser: z.string().trim().max(254, 'SMTP 账号不能超过 254 个字符').optional(),
  smtpPass: z.string().max(512, 'SMTP 密码不能超过 512 个字符').optional(),
  broker1Name: optionalText('经纪商名称', 100).optional(),
  broker1Desc: optionalText('经纪商说明', 500).optional(),
  broker1Link: optionalUrl.optional(),
  broker2Name: optionalText('经纪商名称', 100).optional(),
  broker2Desc: optionalText('经纪商说明', 500).optional(),
  broker2Link: optionalUrl.optional(),
  broker3Name: optionalText('经纪商名称', 100).optional(),
  broker3Desc: optionalText('经纪商说明', 500).optional(),
  broker3Link: optionalUrl.optional(),
  forumCategories: z.string().trim().max(1_000, '论坛分类配置不能超过 1000 个字符').refine((value) => {
    const categories = value.split(',').map((item) => item.trim()).filter(Boolean);
    return categories.length <= 50 && categories.every((item) => item.length <= 80);
  }, '论坛分类最多 50 项，每项不能超过 80 个字符').optional(),
}).strict().refine((value) => Object.keys(value).length > 0, '至少提交一个设置字段');

export const uploadMetadataSchema = z.object({
  name: trimmedText('文件名', 1, 255),
  size: z.number().int('文件大小不合法').nonnegative('文件大小不合法').max(20 * 1024 * 1024, '文件不能超过 20MB'),
  type: z.string().max(100, 'MIME 类型过长'),
}).strict();

export const auditQuerySchema = z.object({
  eventType: z.string().trim().min(1, '事件类型不能为空').max(100, '事件类型过长').optional(),
  outcome: z.enum(['success', 'failure', 'blocked'], { error: '审计结果不合法' }).optional(),
  userId: idSchema.optional(),
  before: idSchema.optional(),
  limit: z.preprocess((value) => value === undefined ? 50 : value, z.union([
    z.number(),
    z.string().trim().regex(/^[1-9]\d*$/, '分页数量必须是正整数').transform(Number),
  ]).pipe(z.number().int().min(1).max(200))).default(50),
}).strict();

export function validate(schema, input) {
  return schema.safeParse(input);
}

export async function parseJson(request, schema) {
  let body;
  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      response: NextResponse.json({
        success: false,
        code: 'INVALID_JSON',
        message: '请求体必须是合法 JSON',
      }, { status: 400 }),
    };
  }

  const result = schema.safeParse(body);
  if (result.success) return result;
  return { success: false, response: validationErrorResponse(result.error) };
}

export function validationErrorResponse(error) {
  const flattenedIssues = [];
  const collectIssues = (issues, parentPath = []) => {
    for (const issue of issues) {
      const issuePath = [...parentPath, ...(issue.path || [])];
      if (issue.code === 'invalid_union' && Array.isArray(issue.errors)) {
        for (const branch of issue.errors) collectIssues(branch, issuePath);
      } else {
        flattenedIssues.push({ ...issue, path: issuePath });
      }
    }
  };
  collectIssues(error.issues);

  const fields = {};
  for (const issue of flattenedIssues) {
    const key = issue.path.length ? issue.path.join('.') : '_root';
    const message = issue.code === 'unrecognized_keys' ? '包含不支持的请求字段' : issue.message;
    if (!fields[key] || fields[key] === 'Invalid input') {
      fields[key] = message;
    }
  }
  const message = Object.values(fields)[0] || '请求参数不合法';
  return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message, fields }, { status: 400 });
}
