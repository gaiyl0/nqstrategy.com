# Nexus Quant 真实支付接入教程

> 编写日期：2026-09-28  
> 当前项目状态：真实付费能力仍然关闭。本教程是未来实施方案，不代表支付已经接入或允许收款。

## 1. 先选择接入模式

优先选择在经营地区合规、能提供服务端创建订单、签名 Webhook、支付状态查询、退款/争议处理和结算对账的支付服务商。不要从“用户填写 TXID”开始，也不要让管理员凭截图点“已支付”。

可选模式：

1. **托管支付服务商（推荐首版）**：服务商生成收款会话/地址并发送签名 Webhook；Nexus Quant 再通过服务商 API 查询并确认。运维和链重组处理压力较小。
2. **自建链上监听**：自有节点或受控 RPC 读取指定链、代币合约、地址、金额、区块和确认数。必须处理重组、代币精度、假币合约、地址归集、节点分叉和漏块补扫，适合已有区块链运维能力的团队。

正式选择服务商前，确认其在你的公司注册地、用户所在地和目标币种/网络上允许该业务，并完成 KYC/KYB、税务、消费者退款和反洗钱流程。技术验收不能代替法律与支付服务商合规确认。

## 2. 安全原则

OWASP 的第三方支付网关指南要求价格和商品由服务端重新计算，只信任经过签名并由服务端再次查询确认的支付结果，核对金额、币种和订单 ID，并让重复回调只能履约一次：

- https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Payment_Gateway_Integration_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html

Nexus Quant 必须坚持：

- 当前用户来自 HttpOnly Session；
- 商品、价格、收款币种和分成比例来自数据库；
- 浏览器只提交 `productId`，不能提交可信金额、作者或收款地址；
- “支付成功页面”和用户跳转参数永远不能发放资产；
- 只有经过签名验证、时间窗验证和服务端二次查询的 Webhook 才能推进支付；
- 授权、创作者收入和订单 `paid` 必须在同一数据库事务中只执行一次；
- 少付、错币、错链、过期、重复转账、超付和链重组不能自动当作正常支付。

## 3. 环境变量

选定服务商后增加服务端变量，名称按实际服务商调整：

```dotenv
PAYMENTS_ENABLED=0
PAYMENT_PROVIDER=<provider-name>
PAYMENT_API_BASE=https://api.provider.example
PAYMENT_API_KEY=<secret-manager>
PAYMENT_WEBHOOK_SECRET=<secret-manager>
PAYMENT_ALLOWED_ASSET=USDT
PAYMENT_ALLOWED_NETWORK=TRON
PAYMENT_REQUIRED_CONFIRMATIONS=<provider-or-chain-policy>
PAYMENT_CHECKOUT_TTL_SECONDS=1800
# 固定商业规则：创作者 80%，平台 20%。不得从浏览器或后台表单读取。
CREATOR_REVENUE_BPS=8000
PLATFORM_FEE_BPS=2000
```

`PAYMENTS_ENABLED` 必须默认 `0`。构建前端时不能使用 `NEXT_PUBLIC_PAYMENT_API_KEY`。API Key、Webhook Secret、钱包私钥或助记词绝不能进入应用数据库、Git、日志、浏览器或普通备份。

当前商业规则固定为：每笔已确认的商品实收金额先以最小单位结算，**80% 计入创作者可提现收入，20% 计入平台佣金**。金额出现不可整除的最小单位时，余数计入平台，确保创作者收入和平台佣金之和始终精确等于用户实付金额。代码基线见 `lib/revenue-split.mjs`，未来结算事务必须调用该服务端函数，不能接受客户端、商品表单或管理员请求传入的比例。

应用服务器不应保存热钱包私钥。若业务必须签名链上交易，应使用受限的钱包服务、HSM/MPC 或独立签名系统，并设置金额、地址和每日额度策略。

## 4. 数据模型

新增正式迁移，不修改旧迁移。建议表结构：

```sql
CREATE TABLE payment_intents (
  id INTEGER PRIMARY KEY,
  intent_key TEXT NOT NULL UNIQUE,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  provider_intent_id TEXT NOT NULL UNIQUE,
  expected_amount_minor INTEGER NOT NULL CHECK(expected_amount_minor > 0),
  asset TEXT NOT NULL,
  network TEXT NOT NULL,
  destination_address TEXT,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN (
    'created','pending','confirming','paid','expired',
    'underpaid','overpaid','wrong_asset','wrong_network',
    'refunding','refunded','reversed','manual_review','failed'
  )),
  paid_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE payment_events (
  id INTEGER PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  provider_intent_id TEXT,
  event_type TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  signature_valid INTEGER NOT NULL CHECK(signature_valid IN (0,1)),
  received_at INTEGER NOT NULL,
  processed_at INTEGER,
  processing_result TEXT,
  UNIQUE(provider, provider_event_id)
);

CREATE TABLE payment_transfers (
  id INTEGER PRIMARY KEY,
  payment_intent_id INTEGER NOT NULL REFERENCES payment_intents(id) ON DELETE RESTRICT,
  chain_id TEXT NOT NULL,
  asset_contract TEXT NOT NULL,
  txid TEXT NOT NULL,
  log_index INTEGER NOT NULL DEFAULT 0,
  destination_address TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  block_number INTEGER,
  confirmations INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  UNIQUE(chain_id, txid, log_index)
);
```

金额使用最小单位整数，不使用浮点数。`wallet_transactions` 增加支付销售、平台佣金、创作者分成、退款和链重组冲正类型，每条都绑定订单、支付意图和稳定业务键。

## 5. 创建支付意图

新增 `POST /api/payments/intents`：

1. 读取服务端 Session；
2. 用 `productId` 查询已上架商品；
3. 从数据库读取价格和作者，不接受客户端金额；
4. 拒绝免费商品、自己的商品、已拥有商品和不可售商品；
5. 生成随机 `intent_key` 和服务端幂等键；
6. 在本地事务中创建 `pending` 订单与 payment intent；
7. 使用幂等键调用服务商创建支付；
8. 保存 `provider_intent_id`、资产、网络、服务商收款地址和过期时间；
9. 只向浏览器返回显示支付所需的非敏感字段。

如果调用服务商超时，不要立即创建第二笔。先用本地幂等键查询服务商结果，确认不存在后才能重试。

## 6. Webhook 处理

新增独立路径，例如 `POST /api/payments/webhooks/<provider>`。不要应用浏览器 Session 或普通 CSRF，而要实施服务商专用验证：

1. 在解析 JSON 前读取原始请求体；
2. 从固定 Header 读取签名和服务商时间戳；
3. 使用官方算法和 `PAYMENT_WEBHOOK_SECRET` 验签；
4. 限制请求体大小和时间偏差；
5. 对 `provider_event_id` 建唯一约束；
6. 保存 payload SHA-256，不在普通日志保存完整敏感 payload；
7. 用 `provider_intent_id` 调用服务商查询 API；
8. 核对商户账户、订单 ID、金额、资产、网络、目标地址、状态、确认数和过期时间；
9. 在一个 `BEGIN IMMEDIATE` 事务中条件更新；
10. 重复事件返回 2xx，但不重复发放。

核心条件更新应类似：

```sql
UPDATE payment_intents
SET status = 'paid', paid_at = ?, updated_at = ?
WHERE id = ? AND status IN ('created','pending','confirming');
```

只有 `changes === 1` 的请求可以继续履约。然后在同一事务中：

- 把订单更新为 `completed/paid`；
- 创建或确认用户产品权益；
- 以 `calculateRevenueSplit(amountMinor)` 写入创作者销售收入（80%）；
- 写入平台佣金（20%）；
- 写入账本签名链；
- 记录审计日志。

任何一步失败都回滚整个事务。

## 7. TXID 与链上模式

如果采用自建链上监听，不能只检查“TXID 存在”。必须核对：

- 允许的 chain ID；
- 固定的代币合约地址；
- Transfer 事件的 `from`、`to` 和金额；
- 代币 decimals；
- 区块是否仍在主链；
- 达到要求的确认数；
- `txid + logIndex` 尚未用于其他订单；
- 转账发生时间在支付意图有效期内；
- 目标地址属于该支付意图；
- 金额策略明确处理少付与超付。

用户提交 TXID只能触发“查询/重新检查”，不能直接改变订单状态。后台补扫任务必须能发现漏掉的 Webhook 和链重组，并用冲正流水恢复账本一致性。

## 8. 退款、争议和链重组

退款不能删除原流水。处理流程：

```text
paid -> refund_requested -> refunding -> refunded
paid -> disputed -> reversed/manual_review
paid -> reorg_detected -> confirming/manual_review -> paid/reversed
```

每次状态变化使用条件更新，退款事件 ID、服务商退款 ID和冲正业务键均建立唯一约束。已经下载的数字资产如何撤销许可证、是否允许继续使用、退款窗口与消费者告知必须在上线前形成明确条款。

## 9. 管理后台

管理员只能：

- 查看服务端已核验的金额、币种、网络、确认数和事件；
- 对异常订单标记人工复核；
- 发起受控退款流程；
- 查看对账差异。

管理员不能通过按钮把未核验订单直接改为 `paid`，不能手工输入创作者余额，也不能绕过唯一约束。高风险操作要求二次验证、独立审计事件和操作原因。

## 10. 测试清单

服务商沙箱和本地伪造事件至少覆盖：

- 空 TXID、随机 TXID、其他链 TXID；
- 错误合约、错误币种、错误网络、错误地址；
- 金额被客户端篡改；
- 少付、超付和分次支付；
- 过期后到账；
- Webhook 签名错误、旧时间戳和修改一字节 payload；
- 同一事件并发 20 次；
- 不同事件同时确认同一订单；
- 相同 TXID 绑定两个订单；
- 服务商 API 超时、500和限流；
- Webhook 先于浏览器回跳、晚于回跳或完全缺失；
- 退款重复回调；
- 链重组后重新确认或冲正；
- 数据库事务中途失败；
- 资产发放成功但响应丢失后的重试；
- 创作者分成、平台佣金和用户权益只写一次；
- 每日对账发现缺单、多单和金额差异。

验收必须证明：任何空/伪造 TXID、浏览器回跳、重复回调和管理员普通操作都不能获得资产或触发结算。

## 11. 上线顺序

1. 在独立分支实现数据迁移和服务商适配器；
2. 保持 `PAYMENTS_ENABLED=0`；
3. 完成单元、HTTP、并发、沙箱和故障注入测试；
4. 安全审查 Webhook 原始体验签、状态机和唯一约束；
5. 在预发布环境用服务商沙箱跑完整支付、重复回调、退款和对账；
6. 完成法律、税务、KYC/KYB、退款政策和用户条款确认；
7. 配置生产 Secret、IP/域名 allowlist（服务商支持时）、告警与每日对账；
8. 小额真实交易验证到账、授权、账本、分成和退款；
9. 项目所有者审阅证据并签字；
10. 最后才把生产 `PAYMENTS_ENABLED` 改为 `1`。

启用后也不要删除免费模式的失败关闭逻辑。支付服务商不可用、签名配置缺失、对账异常或账本校验失败时，应自动停止新付费订单和资产发放。

## 12. Nexus Quant 实施任务建议

未来真实付费任务组按以下顺序执行：

1. `PAY-001`：服务商选型、合规范围和威胁模型；
2. `PAY-002`：payment intents/events/transfers 迁移与约束；
3. `PAY-003`：服务端创建支付意图；
4. `PAY-004`：原始体验签 Webhook 与服务端二次查询；
5. `PAY-005`：订单、权益、平台佣金和创作者分成原子结算；
6. `PAY-006`：退款、争议、过期、少付、超付和链重组；
7. `PAY-007`：对账、补扫、告警与管理后台；
8. `PAY-008`：并发、重放、故障注入与沙箱回归；
9. `PAY-009`：小额生产验证和所有者上线签字。

在 `PAY-009` 完成前，NQ-P0-008 的“关闭真实付费”仍是正确生产状态。

## 13. 虚拟币首发渠道：从选择到上线的操作步骤

建议首发只开放一种稳定币和一种网络，例如由你选定的 USDT 或 USDC 网络。不要一开始同时开放多个代币、多个链和人工收款地址；每增加一个网络，都会增加代币合约校验、确认数、少付/超付和退款支持成本。

### 第一步：选定服务商和经营范围

优先选用能为商户创建付款订单、提供签名回调、可查询订单状态、支持退款/对账，并明确允许你的公司注册地和目标用户地区使用的托管支付服务。首发可以评估 Binance Pay Merchant、Coinbase Payment Acceptance 或在你的经营地区合规的同类商户服务；这不是默认推荐或合规结论，必须以服务商的地域准入、KYC/KYB 和你的法律/税务意见为准。

- Binance Pay 的商户 API 使用 HTTPS、请求与回调签名校验，并要求带时间戳、随机数和商户证书标识；其官方文档说明签名和状态判断不能省略：[Binance Pay API 通用规则](https://developers.binance.com/en/docs/products/binance-pay-merchant/api-common)。
- Coinbase 的 Payment Acceptance API 提供支付创建、捕获、退款、Webhook 事件和事件查询能力，可作为“托管支付 + 服务端回调”的产品形态参考：[Coinbase Payment Acceptance](https://docs.cdp.coinbase.com/api-reference/payment-acceptance/overview)。

注册商户账户前，完成服务商要求的企业验证、受益人、银行/结算账户、网站域名、退款规则和业务说明。不要使用个人交易所账号、个人钱包地址或个人 API Key 直接收取平台商品款。

### 第二步：明确首发支付规则

在代码前写下并由业务负责人确认：

1. 支持的币种、网络、代币合约地址和小数位；
2. 支付意图有效期，例如 30 分钟；
3. 所需确认数；
4. 少付、超付、分次付款、过期到账和错误网络一律进入人工复核，首发不自动履约；
5. 退款窗口、退款币种/网络、手续费承担方和已下载 EA 的许可证处理；
6. 用户支付金额与美元定价之间的汇率来源、报价锁定时间和汇率精度；
7. 创作者 80%、平台 20% 的计算基础是用户实际确认支付的商品金额，税费、网络手续费、服务商手续费和优惠券如何处理必须单独写清。

### 第三步：在服务商后台配置回调和密钥

1. 创建**只用于支付接入**的 API 凭据，限制 IP（服务商支持时）和权限；
2. 在 Secret 管理中保存 API Key、Webhook Secret、商户 ID、证书序列号等，绝不放到前端或 Git；
3. 配置 HTTPS 回调地址，例如 `https://你的域名/api/payments/webhooks/<provider>`；
4. 配置失败重试通知、事件日志保留和退款权限；
5. 保存服务商的签名算法、时间窗、重试策略、幂等字段和订单查询 API 文档链接；
6. 在预发布域名先登记沙箱回调，生产域名仅在沙箱验证完成后登记。

### 第四步：实现并测试支付适配器

按 PAY-002 至 PAY-008 的顺序实现，不要跳到前端支付二维码：

1. 迁移新增 `payment_intents`、`payment_events`、`payment_transfers`、退款与对账表；
2. `POST /api/payments/intents` 仅接收 `productId` 和幂等键；服务端创建订单和服务商付款意图；
3. 页面只显示服务端返回的二维码/跳转地址、金额、资产、网络和到期时间；
4. Webhook 使用原始请求体验签，立即记录事件摘要；
5. 调用服务商订单查询 API 二次确认金额、币种、网络、商户订单号、状态和确认数；
6. 条件更新支付状态，只有第一个成功处理的事件才能发许可证与写账本；
7. 订单事务里调用 80/20 分成函数，分别写入创作者收入和平台佣金；
8. 每日比较服务商结算报表、本地支付事件、订单、许可证和账本；不一致即告警并关闭新付费订单。

### 第五步：沙箱和小额真实验证

先在预发布环境分别测试成功、取消、过期、重复回调、签名错误、少付、超付、错误网络、退款、网络超时和数据库中途失败。沙箱全部通过后，只用可承受损失的小额生产交易验证一次完整链路。验证人员应保存支付服务商事件 ID、应用订单 ID、支付意图 ID、账本业务键、许可证 ID 和对账结果。

只有 PAY-009 通过并由项目所有者签字后，才允许把 `PAYMENTS_ENABLED` 改为 `1`。

## 14. 微信支付和支付宝的预留方式

微信支付和支付宝不应通过“显示个人收款码”接入。应预留为与虚拟币相同的支付提供方适配器，统一进入 Payment Intent、签名回调、二次订单查询、退款和 80/20 结算。

未来适配器接口应至少包含：

```text
createIntent(serverOrder) -> providerIntent
verifyWebhook(rawBody, headers) -> verifiedEvent
queryIntent(providerIntentId) -> authoritativePaymentState
requestRefund(paymentIntent, amountMinor) -> providerRefund
```

为微信支付和支付宝分别准备：商户号/应用 ID、API v3 或应用私钥、平台证书/公钥、通知地址、订单查询权限、退款权限和测试商户环境。它们与虚拟币共用以下不变规则：

- 前端回跳页不履约；
- Webhook 必须验签且由服务端查询二次确认；
- 服务商交易号和回调事件号必须唯一；
- 退款/撤销只能通过受控状态机；
- 成功付款在同一事务内发放许可证、写创作者 80% 和平台 20% 账本；
- 渠道手续费、税费和换汇成本应作为独立会计字段，不能悄悄从创作者 80% 中扣除。

### 后台配置边界

管理员后台的“支付渠道配置”页面只保存可审核的非敏感信息：商户号、AppID、签约主体、通知 URL、网关和微信支付平台证书序列号。它显示下列服务器 Secret 是否存在，但绝不接收、读取或回传私钥、API v3 Key、平台证书或支付宝公钥：

```text
WECHAT_PAY_API_V3_KEY
WECHAT_PAY_MERCHANT_PRIVATE_KEY
WECHAT_PAY_PLATFORM_CERTIFICATE
ALIPAY_APP_PRIVATE_KEY
ALIPAY_PUBLIC_KEY
```

将上述值仅写入服务器 `/etc/nexus-quant/nexus.env` 或等效 Secret 管理器，设置后重启应用进程。后台“保存为待接入渠道”开关只标记资料准备状态；它不是、也不能成为真实收款开关。

只有在公司主体、商户资质、用户地区和相应渠道规则都允许时，才启动 `wechat_pay` 或 `alipay` 适配器。首发虚拟币渠道完成稳定运行与对账后，再逐一增加法币渠道，避免三套支付系统同时上线造成无法排查的财务差异。
