# Nexus Quant 最新更新日志与执行顺序

最后更新：2026-09-29
当前状态：P0、P1、P2、NQ-DOC-001 与 P3-001 至 P3-003 已完成；P3-004 已连接远程 Git，生产现场项待执行；UI-DESIGN-006 已按确认视觉稿完成，等待项目所有者验收
真实资金状态：**禁止上线，付费能力继续关闭**

## 本日志的维护规则

本文件是 Nexus Quant 唯一的任务进度与更新日志。旧的分项更新日志、旧版 P0–P3 复核日志和过时项目备忘已经删除，后续不再为每个任务创建独立进度日志。

每完成一次更新或修复，必须在同一次提交前完成以下动作：

1. 更新本文件的“已完成任务”“未完成任务”“当前验证基线”和“下一执行项”；
2. 记录任务 ID、完成日期、主要改动、验收结果、测试结果和提交号；
3. 执行 `npm run log:sync`；
4. 确认桌面副本 `C:\Users\Administrator\Desktop\NEXUS_QUANT_UPDATE_LOG.md` 与项目文件一致；
5. 任务报告直接追加到本日志，不再创建 `reports/NQ-*.md`。

操作、安全和部署专题文档继续独立保留，例如 `GO_LIVE_CHECKLIST.md`、`DATABASE_MIGRATIONS.md`、`AUDIT_INTEGRITY.md`、`CSRF_SECURITY.md`、`DEPLOYMENT_SECURITY.md`、`UPLOAD_SECURITY.md` 和 `WALLET_LEDGER.md`。这些是操作规范，不属于更新日志。

## 当前验证基线

当前 Git 分支：

```text
feature/ui-redesign
```

最近功能提交：

```text
9e411df feat: redesign the profile asset dashboard
```

数据库迁移状态：

```text
current=3/3
pending=none
quick_check=ok
foreign_key_violations=0
```

工程验证状态：

- Next.js 16.3.5 生产构建通过；
- 26 个 `test:*` 脚本全部通过；
- 文档链接、状态分类、命令引用和旧文案专项检查共 55 个断言通过；
- 全仓 ESLint 以退出码 0 完成，0 errors / 0 warnings；
- Git 仓库已经建立；
- 远程仓库 `https://github.com/gaiyl0/eashop.git` 已连接，`feature/p3-004-release-engineering` 已推送；
- SQLite 当前只允许单实例部署；
- 真实付费入口保持关闭。

## 全站 UI 改造（进行中）

| ID | 内容 | 状态 |
|---|---|---|
| UI-DESIGN-001 | 设计令牌与基础组件 | ✅ 已完成 |
| UI-DESIGN-002 | 替换原生 `alert` / `confirm` / `prompt` 与统一反馈 | ✅ 已完成 |
| UI-DESIGN-003 | 重构首页 | ✅ 已完成 |
| UI-DESIGN-004 | 重构策略市场 | ✅ 已按确认视觉稿返工，等待验收 |
| UI-DESIGN-005 | 重构个人中心 | ✅ 已按确认视觉稿完成，等待验收 |
| UI-DESIGN-006 | 重构开发者社区 | ✅ 已按确认视觉稿完成，等待验收 |
| UI-DESIGN-007 | 重构后台管理与增加运营视图 | 🟡 下一项 |
| UI-DESIGN-008 | 中英文、桌面/平板/手机、可访问性与视觉验收 | ⏳ 待执行 |

数据展示约束：首页策略图表只读取站内已解析并通过审核的 MT5 报告/证据；没有合格产品时显示空状态。顶部行情属于独立数据源任务，未接入有授权的实时/延迟行情前不显示虚构价格；未建立持续实盘同步时不标记“实盘运行中”。

## P0：已完成

P0-001 至 P0-010 已达到各自安全验收标准。

| ID | 已完成内容 | 验收结论 |
|---|---|---|
| NQ-P0-001 | 强制高熵 `JWT_SECRET`，移除默认密钥，按会话版本失效旧 Session | 缺少生产密钥时启动失败；旧密钥、伪造 Cookie 和旧版本 Session 无效 |
| NQ-P0-002 | products/posts/comments 写接口使用服务端 Session、RBAC 和资源所有权 | 匿名写入 401；非所有者 403；管理员动作只允许 admin |
| NQ-P0-003 | 作者、文件路径和产品状态由服务端绑定 | 客户端伪造 author、role、file URL 和 status 不生效 |
| NQ-P0-004 | 修复路径穿越并将 EA 放入私有存储 | 下载只允许已授权用户访问已绑定私有文件；公开路径和穿越路径拒绝 |
| NQ-P0-005 | 移除明文密码兼容和 pass-the-hash | 密码使用版本化 scrypt；未知旧格式作废并要求重置 |
| NQ-P0-006 | 禁止普通用户自助升级 developer | 只有管理员可以授予开发者权限 |
| NQ-P0-007 | 统一提现路由为 `/api/withdraw` | 提交、审批、拒绝退款和重复审批链路通过；旧错拼路由不存在 |
| NQ-P0-008 | 真实支付核验完成前关闭付费能力 | 空/任意 TXID、管理员免检和人工批准不能发放资产或结算 |
| NQ-P0-009 | 用户匿名化注销和稳定 `user_id` | 删除与同名重注册不会继承订单、产品、收入、帖子、评论、上传或提现 |
| NQ-P0-010 | 订单和提现使用条件更新、唯一约束和幂等键 | 并发或重复审批只有一个请求改变状态；退款最多一次 |

P0 的“完成”不代表真实支付系统已经完成。NQ-P0-008 的完成方式是主动关闭付费能力，真实支付任务组仍是上线阻断项。

## P1：已完成

| ID | 已完成内容 | 验收结论 |
|---|---|---|
| NQ-P1-001 | Zod 服务端统一输入校验 | 金额、ID、角色、状态、文本长度、邮箱、钱包地址、上传元数据和设置字段已覆盖 |
| NQ-P1-002 | 高风险接口持久化分层限流与审计 | 登录、注册、验证码、上传、订单、提现及管理审批已接入 |
| NQ-P1-003 | 验证码安全存储和原子消费 | CSPRNG、HMAC 摘要、用途、过期、尝试次数和原子消费已实现 |
| NQ-P1-004 | 生产代理信任边界和限流拓扑 | 共享密钥认证代理来源；SQLite 限流拒绝多实例配置 |
| NQ-P1-005 | 审计日志完整性和归档 | HMAC 链、签名链头、普通写保护和签名归档已实现 |
| NQ-P1-006 | 账号和邮箱枚举防护 | 登录、验证码发送和密码重置使用统一公开响应与主要计算成本 |
| NQ-P1-007 | 上传内容验证、配额和孤儿回收 | 图片解码重编码、EX4/EX5 文件头、摘要去重、原子配额和扫描失败关闭已实现 |
| NQ-P1-008 | CSRF、Origin 和凭证化 CORS | 全部 API 写方法统一经过 Next.js Proxy 安全边界 |
| NQ-P1-009 | 不可变钱包账本 | 管理调账、提现冻结和驳回退款进入按用户签名的链式账本 |
| NQ-P1-010 | 正式数据库迁移系统 | 连续版本、SHA-256、事务、并发锁、迁移前备份、生产失败关闭和恢复流程已实现 |
| NQ-P1-011 | 核心关系外键和删除约束 | 补齐评论到帖子、订单到产品外键；孤儿数据失败关闭；明确 CASCADE/RESTRICT/SET NULL |
| NQ-P1-012 | 用户表 Schema 收敛 | 邮箱、密码、角色、布尔值、余额、会话和大小写不敏感唯一性约束统一；实际用户逐字段保留 |
| NQ-P1-013 | 主动改密二次身份确认 | 修改密码必须验证当前密码；双层限流、签名审计、条件更新和会话版本撤销已通过真实 HTTP 回归 |
| NQ-P1-014 | 统一前端 API 客户端和失败提示 | 非 2xx、`success:false`、网络及响应格式错误统一阻止成功流程；管理失败、下载、multipart 和取消请求边界通过回归 |
| NQ-P1-015 | 全 API 错误泄漏审计 | 24 个路由、51 个 HTTP 方法统一异常边界；未知错误只返回通用 500 与请求 ID，脱敏诊断仅进入签名审计 |

### P1 已完成但需要部署现场验收

以下项目的代码基线已经完成，但不能用本机测试代替生产环境验收：

- 反向代理、防火墙、HTTPS 和源站不可绕过；
- 外部恶意文件扫描服务和告警；
- 审计归档复制到外部不可变存储；
- SMTP 真实验证码投递、SPF、DKIM 和 DMARC；
- 数据库、私有 EA、报告、证据和 Secret 的完整备份恢复演练。

## P2：已完成

| ID | 已完成内容 | 验收结论 |
|---|---|---|
| NQ-P2-001 | 策略指标矩阵、净值曲线、回撤曲线和月度收益 | 结构化展示、审核边界和风险披露已实现 |
| NQ-P2-001A | MT5 截图证据包 | 原图私有保存、SHA-256、去元数据预览、OCR/人工复核和管理员逐项审核已实现 |
| NQ-P2-001B | MT5 HTML 报告解析 | 八项指标、交易曲线、锁定回填、私有报告和防篡改已实现 |
| NQ-P2-002 | Nexus Verification | 六级可信度、有效期、撤销和历史记录已实现 |
| NQ-P2-003 | EA 多版本和购买权益继承 | 不可变摘要、更新日志、审核、当前版本和下载审计已实现 |
| NQ-P2-004 | 试用及永久授权 | 服务器到期、账号/设备 HMAC 绑定、换绑限制、撤销和短期令牌已实现 |
| NQ-P2-005 | 策略并排对比 | 2–4 项对比、审核指标边界、组合筛选和 URL 分享恢复已实现 |
| NQ-P2-006 | 收藏、关注和可信评分 | 永久授权用户评分、公开聚合和个人清单已实现 |
| NQ-P2-007 | 市场搜索、筛选和分页 | 多字段搜索、标签/指标筛选、分页上限和 URL 恢复已实现 |
| NQ-P2-008 | 社区举报、审核和排序 | 待处理唯一约束、管理员处置、限流审计、热门排序和浏览去重已实现 |
| NQ-P2-009 | 产品独立页和分享 SEO | 稳定 slug、`/market/[slug]`、动态 metadata、结构化数据和 sitemap 已实现 |

P2 仍需在生产环境联调外部 OCR、真实 EA 客户端许可证验证、分享爬虫、移动设备和大数据量性能，但当前没有已知未通过的 P2 核心代码验收项。

## 明确未完成

### P3-004：CI、远程 Git、备份恢复和部署文档（进行中）

已完成：GitHub Actions 工作流、统一测试入口、健康检查、一致性备份/恢复工具、部署/监控/恢复手册、真实支付教程、本机隔离恢复演练，以及远程仓库连接和功能分支首次推送。

仍需外部与生产现场完成：

- 在远程仓库把 Actions `verify` 设置为 `main` 的 required status check，并启用 PR、审批、禁止强推和禁止删除；
- 在目标服务器配置 systemd、Nginx、HTTPS、防火墙、监控和告警；
- 配置加密异地备份、对象锁/版本控制、保留策略和定时任务；
- 在真实数据规模上完成生产恢复演练并测量 RPO/RTO。

验收标准：以上外部与现场证据补齐后，P3-004 才能标记完成。Secret 不得进入 Git、CI 日志或明文备份。

## 真实付费任务组：暂不启动

只有项目所有者明确决定启用真实资金时才启动。本组完成并重新安全验收前，禁止恢复付费入口。

必须实现：

- 服务端 Payment Intent；
- 可信支付服务商回调或自有链上节点核验；
- TXID、链 ID、代币合约、目标地址、金额、确认数和时限校验；
- 支付事件 ID、TXID 和订单结算唯一约束；
- 支付回调签名、重放防护和并发幂等；
- 只有服务端确认 `paid` 后才发放授权和创作者收入；
- 平台佣金、创作者分成、退款和链重组进入 `wallet_transactions`；
- 少付、超付、重复转账、错误网络、过期、退款和人工异常流程；
- 支付密钥、Webhook Secret、钱包和节点凭据进入受控 Secret 管理；
- 全链路对账与重复回调、伪造 TXID、错误金额、退款、链重组回归；
- 所有者正式上线签字和生产证据。

## 固定执行顺序

除非项目所有者明确调整，后续按以下顺序执行，每项完成后更新本日志并等待确认：

1. ✅ **NQ-P1-013：主动改密要求当前密码或二次验证**；
2. ✅ **NQ-P1-014：统一前端 API 客户端和失败提示**；
3. ✅ **NQ-P1-015：全 API 错误泄漏审计**；
4. ✅ **NQ-DOC-001：收敛状态和上线文档中的过时内容**；
5. ✅ **P3-001：修复剩余 ESLint errors**；
6. ✅ **P3-002：拆分 `app/page.js`**；
7. ✅ **P3-003：图片和加载性能优化**；
8. 🟡 **P3-004：远程 Git 和功能分支已完成，分支保护与生产现场项待执行**；
9. **真实付费任务组：仅在项目所有者决定启用真实资金时启动**。

## 当前下一项

```text
UI-DESIGN-007：按已确认的视觉系统重构后台管理并增加运营视图
状态：UI-DESIGN-006 已完成并等待项目所有者验收；未确认前不启动 UI-DESIGN-007
```

## 更新记录

### 2026-09-29：UI-DESIGN-006 开发者社区重构

状态：**已按 `ChatGPT 图像 2026年9月29日 00_49_19.png` 完成，等待项目所有者验收**
提交：`d42c9ff feat: redesign the developer community`

原问题：社区仍使用简单的版块侧栏和纵向帖子卡片，没有参考稿中的内容层级、社区入口、置顶内容、作者与版块信息；帖子列表、详情、评论和发帖页也没有共用已经建立的设计系统。参考稿同时包含固定排行和全站统计示例，当前接口并不提供这些可靠的全站聚合数据，直接照抄会形成虚假活跃度。

完成内容：

- 将桌面社区重构为左侧版块导航、中间置顶内容与讨论流、右侧作者/版块/统计的三栏结构；窄屏自动隐藏辅助栏，保留主内容和全部操作；
- 使用当前置顶帖子或当前结果第一篇帖子生成社区焦点卡，标题、正文、作者、日期、浏览和回复均来自真实接口数据；
- 保留最新、热门、讨论最多三种服务端排序；热门排序继续明确说明去重浏览、有效评论、置顶权重和时间衰减口径；
- 增加当前已加载结果的本地搜索，支持标题、正文、作者和版块；搜索不会伪装成全站查询；
- 本页活跃作者按当前接口结果的发帖数与回复数计算，热门版块按当前结果帖子数计算；右侧统计明确标注“当前列表”，并说明不代表全站累计值；
- 没有复制参考稿中的固定作者分数、12.4K 帖子、25 万浏览等示例数字，也没有使用随机数制造活跃度；
- 统一帖子卡、详情、评论和发帖表单到 `Panel`、`Badge`、`Button`、`Field`、`Tabs` 与 `EmptyState`；
- 保留登录拦截、发帖、详情浏览、回复、举报以及管理员置顶/取消置顶/删除帖子和评论功能；
- 新增社区视觉回归断言，锁定 `ForumNavigation`、`CommunityHero`、`PostCard`、`CommunityAside`，并禁止随机数据和参考图示例总数回归。

验收结果：全仓 ESLint 0 errors / 0 warnings；26 个 `test:*` 脚本全部通过；Next.js 16.3.5 生产构建、TypeScript、8/8 静态页面与全部动态 API 路由收集通过；`git diff --check` 通过。第一次构建因测试代理 Secret 少于项目要求的 32 字符被配置校验正确拒绝，改用符合长度的构建专用 Secret 后构建通过；没有放宽生产安全规则。

验收结论：UI-DESIGN-006 达标。社区视觉层级已接近确认稿，现有社区操作完整保留，所有排行与统计都有真实数据来源及范围说明。下一项为 UI-DESIGN-007 后台管理与运营视图重构，需项目所有者确认后启动。

### 2026-09-29：UI-DESIGN-005 个人中心重构

状态：**已按 `ChatGPT 图像 2026年9月29日 00_42_28.png` 完成，等待项目所有者验收**

提交：`9e411df feat: redesign the profile asset dashboard`

问题与验收标准：旧个人中心由多个松散大卡片组成，资产、许可证、收藏、关注、发布策略和安全设置缺少统一层级。验收要求为：按确认设计稿建立左侧导航、身份区、安全状态、四项概览、分区标签、资产表和绑定抽屉；保留下载、许可绑定、短期令牌、发布策略、版本、收藏、关注、评分、修改密码和提现现有业务边界。

完成内容：新页面包含与市场一致的左侧导航、用户头像/角色/加入日期、邮箱与改密安全卡、可用余额、已购策略、有效许可证与近期到期统计。内容按“我的资产 / 我的策略 / 许可证 / 关注收藏 / 账户安全”分区。资产表展示服务器订单、版本、许可状态、脱敏绑定、日期与下载；许可证抽屉对应设计稿的右侧抽屉，但只允许 MT4/MT5 数字账号和 EA 设备指纹，不接收交易密码或交易所 API Key/API Secret。

真实数据边界：设计稿中的人民币余额、累计收益、收益率、运行中策略数、到期天数、模拟动态和收益曲线没有照抄。页面只读取真实用户余额、已完成订单、许可证、社交清单和发布产品。由于当前 API 不提供连续且可审核的资产收益时间序列，该区域显示明确空态，不生成假曲线。

验收结果：ESLint 0 errors / 0 warnings；26/26 测试脚本通过；UI 专项测试保护个人中心导航、资产表、许可证、绑定抽屉、无假收益和禁止收集交易所密钥；Next.js 16.3.5 生产构建、TypeScript、8/8 静态页和全部动态路由通过。

下一项：等待项目所有者验收 UI-DESIGN-005；确认后启动 UI-DESIGN-006 开发者社区重构。

### 2026-09-29：UI-DESIGN-004 策略市场重构

状态：**已按项目所有者重新提供的策略市场视觉稿返工完成，等待验收**

提交：`15d9be7 feat: redesign the verified strategy market`；`a63f22a feat: match the strategy market reference layout`

问题与验收标准：旧市场卡片层级弱，仍展示旧的文本胜率和回撤，缺少对审核证据、真实净值曲线、加载/空/失败状态和付费关闭状态的一致表达。验收要求为：保留搜索、组合筛选、分页、2–4 项对比和详情跳转；卡片只在同时存在 MT5 报告与已审核指标时展示结构化数据和净值曲线；无审核数据显示明确空态；网络失败可真正重试；真实付费继续关闭。

完成内容：市场页统一到新的网格背景、面板、徽章、按钮、骨架屏和空态组件；策略卡新增 Nexus Verification 等级、已审核净值曲线、Profit Factor、Sharpe Ratio 和最大回撤；曲线仅使用 API 返回的 `metrics.equityCurve`，且必须同时具备 `metrics.reviewedAt` 和 `report`；不合格产品显示“暂无可公开的已审核净值曲线”；付费策略明示“付费暂未开放”；修复市场查询失败后的重试按钮，现在会发起新请求。

返工内容：根据 `ChatGPT 图像 2026年9月29日 00_41_57.png` 重建市场构图。桌面端现在包含左侧纵向导航、市场标题与真实统计概览、站内搜索、四组结构化筛选、密集策略卡片、审核净值曲线、四项风险/交易指标、认证标签以及宽屏右侧固定对比栏。在较小桌面屏幕上右侧对比栏收敛为底部悬浮操作条，中等屏幕卡片为两列，宽屏为三列，手机为单列。市场列表已从原详情组件中拆分为 `StrategyMarketCatalog.js`，避免继续扩大 `MarketView.js`。

数据边界：视觉稿里的 BTC/ETH 行情、1,428 款策略、实盘 186 天、模拟收益、模拟评分和人民币订阅价都没有照抄。顶部统计来自当前产品、开发者、关注者与认证数据；收益率由已审核 MT5 报告的 `netProfit / initialDeposit` 计算；未审核产品显示空曲线和破折号；价格保留美元目录值并明示付费未开放。

验收结果：已在本地真实页面打开市场并确认左侧导航、统计卡、搜索、筛选、策略卡与真实 TianWei MT5 曲线正常渲染；ESLint 以 0 errors / 0 warnings 通过；数据库迁移并发用例单独复核通过；26/26 测试脚本通过；Next.js 16.3.5 生产构建、TypeScript、8/8 静态页与全部动态路由通过。

下一步：等待项目所有者验收 UI-DESIGN-004；确认后再按既定顺序启动 UI-DESIGN-005 个人中心重构。

### 2026-09-29：UI-DESIGN-003 首页重构

状态：**已完成，等待项目所有者验收**

提交：`3d58bc2 feat: redesign the verified strategy homepage`

完成内容：用“让可信的量化策略被看见”重构首屏；新增真实策略历史净值/回撤面板、精选认证策略、Nexus Verification 四步流程、开发者生态真实统计与最新社区研究；移除旧首页旋转球体、大量发光与装饰动画。首页只选择“已上架 + MT5 原始报告 + 指标已审核 + report_verified 或更高等级”产品；无合格数据显示空状态，不生成随机曲线。顶部未加入任何写死的行情报价，亦未把历史回测标记为实盘。

验收：首页实测 HTTP 200，响应包含新标题且不含伪行情；26/26 测试通过；ESLint 0 errors / 0 warnings；Next.js 16.3.5 生产构建、TypeScript、8/8 静态页和全部动态路由通过。

下一项：UI-DESIGN-004 重构策略市场；验收要求为专业筛选、认证与风险指标卡片、比较工作区、加载/空/失败状态使用新设计系统，并继续禁止真实付费。

### 2026-09-29：UI-DESIGN-002 统一弹窗、输入与危险确认

状态：**已完成，等待项目所有者验收**

提交：`0d9d085 feat: replace native browser dialogs`

原问题：用户端、策略市场和后台使用浏览器原生 `prompt`/`confirm`，导致白色方块与站点视觉脱节；操作影响、字段说明、输入校验、键盘焦点和移动端尺寸无法统一控制。

完成内容：

- 在根布局接入全站 `InteractionProvider`，用户页、市场和后台共用同一组深色 Dialog、Field、Notice 和 Button；
- 新增 Promise 化 `confirmAction`、`requestInput` 和 `showValue`，业务处理可等待用户确认或取消，取消不会继续发起 API 请求；
- 输入交互支持单行、多行、选项、初始值、必填、最小/最大长度、自定义校验、说明和字段错误；
- 许可证交易账号、设备指纹绑定和临时令牌签发改为受控表单；账号限定 4–32 位数字，指纹至少 16 字符；
- 浏览器拒绝剪贴板时，令牌使用站内只读对话框显示，不再回退到原生白色 `prompt`；
- 策略评分改为星级选择和评论输入两步交互，保留永久授权的服务端限制；
- 帖子/评论举报改为受控原因选项和最多 1000 字说明；
- 策略、帖子、评论和用户删除均改为危险确认弹窗，明确显示操作对象、影响与不可逆性；
- 后台 OCR 校正、认证证据、撤销、版本审核、许可证撤销、举报处置、角色变更、提现审批和订单驳回全部迁移到站内交互；
- JSON 输入在提交前完成客户端语法检查；提现和订单确认保留原有服务端条件更新、幂等键和账本保护；
- 为 UI 专项测试增加源码递归扫描，`app` 和 `lib` 中重新出现 `alert`/`confirm`/`prompt` 将直接失败。

验收结果：

```text
原生浏览器弹窗静态扫描：0 处
UI 专项测试：通过
完整回归：26/26 test scripts passed
ESLint：0 errors / 0 warnings
Next.js 16.3.5 生产构建：通过
静态页生成：8/8
```

下一项问题与验收标准：UI-DESIGN-003 将按确认的首页视觉稿重构首页。验收要求为首屏、精选策略、验证流程、开发者生态和社区内容共用新设计系统；策略图表只使用站内已审核 MT5 数据，无合格数据时显示空状态；顶部行情未接入合法数据源前不显示伪实时报价；桌面与移动布局通过检查。

### 2026-09-29：UI-DESIGN-001 设计令牌与基础组件

状态：**已完成，等待项目所有者验收**

提交：`e63e32c feat: add Nexus Quant UI foundation`

原问题：页面大量直接组合 Tailwind 颜色、边框、圆角和阴影，没有全站设计令牌；按钮、表单、状态标签、空状态、对话框和抽屉缺少统一实现，后续分页改造容易再次出现风格分裂。

完成内容：

- 在 `app/globals.css` 建立背景、面板、边框、文字、品牌色、语义色、圆角、阴影和焦点环设计令牌；
- 增加全局深色背景、可选网格表面、表格数字排版、键盘焦点和 `prefers-reduced-motion` 无障碍策略；
- 新增 `Button`、`Panel`、`Badge`、`Field`、`Tabs`、`EmptyState`、`Skeleton` 和 `Notice` 基础组件；
- 新增可共用 `Dialog` 与 `Drawer`，实现遮罩、Escape 关闭、背景滚动锁定、初始焦点、Tab 焦点循环和关闭后焦点恢复；
- 表单组件统一 label、必填状态、辅助说明、字段错误和 `aria-describedby`/`aria-invalid`；
- 新增 `test:ui-design`，防止设计令牌、核心组件、Dialog 语义、Escape 交互和减少动画策略回归。

验收结果：

```text
UI 设计系统专项测试：通过
完整回归：26/26 test scripts passed
ESLint：0 errors / 0 warnings
Next.js 16.3.5 生产构建：通过
静态页生成：8/8
```

测试中数据库并发迁移用例曾在两个进程同时设置 SQLite pragma 时瞬时返回一次 `SQLITE_BUSY`；单独复跑通过，随后完整 26 套回归通过，未修改数据库代码。

下一项问题与验收标准：UI-DESIGN-002 将清点并替换用户端和管理端的原生 `alert`、`confirm` 和 `prompt`。验收要求为项目源码不再使用这三类原生白色弹框；危险操作包含影响说明和明确二次确认；输入弹窗具备 label、校验、加载和错误状态；键盘焦点、Escape 关闭与读屏语义通过自动检查。

### 2026-09-29：页面白屏回归修复与远程 Git 接入

状态：**代码修复和远程分支推送已完成**

功能提交：`11d3ace fix: restore extracted view callbacks`

远程合并提交：`d5256a7 Merge remote-tracking branch 'origin/main' into feature/p3-004-release-engineering`

原问题与根因：P3-002 拆分页面后，`ProfileView` 的父组件仍传入不存在的 `handleDownload`，子组件却直接调用未声明的 `handleSecureDownload`、`handleLicenseBind`、`handleLicenseToken` 和 `showToast`，导致首页渲染时发生 `ReferenceError` 并白屏。同类检查又发现 `ForumView` 缺失 `products`、置顶和举报回调，以及首页残留的 `setToastMsg` 调用；这些会在进入论坛详情或初始资产请求失败时引发新的运行时错误。

完成内容：

- `ProfileView` 改为显式接收并使用实际的安全下载、许可证绑定、令牌签发和 Toast 回调；删除虚假的 `handleDownload` 别名；
- `ForumView` 显式接收产品列表、帖子/评论置顶与举报回调，父组件同步传入；
- 初始资产加载失败改为调用 `useToast()` 提供的 `showToast`；
- ESLint 新增 JavaScript `no-undef` 强制规则和明确的浏览器/Node 全局变量集，后续未声明识别符直接阻断验证；
- 结构回归增加 Profile 和 Forum 必需属性、旧别名和旧 Toast setter 不得回归的断言；
- 清理损坏的 `.next` 可再生缓存后重启，首页实测 HTTP 200、响应 52,659 字节，`/api/health` 实测 HTTP 200 且状态为 `ready`；
- 连接 `origin=https://github.com/gaiyl0/eashop.git`，读取到远程 `main` 仅有一个 README 初始提交；不改写远程历史，先推送功能分支，再把远程初始提交合入功能分支，保留项目完整 README，使两条历史具有共同祖先并可创建 PR。

验收结果：

```text
首页：HTTP 200，不含 Runtime ReferenceError/handleDownload is not defined
健康接口：HTTP 200，status=ready
全部测试：25/25 test scripts passed
ESLint：0 errors / 0 warnings
Next.js 16.3.5 生产构建：通过，8/8 静态页生成，全部动态路由收集通过
Git 远程：origin 已配置，feature/p3-004-release-engineering 已推送并跟踪远程
```

未完成项：GitHub `main` 的 Pull Request/required check/审批/禁止强推与删除保护规则尚未在账户侧配置；目标服务器部署、监控、异地备份与生产恢复演练仍待执行。P3-004 因此保持“进行中”。

### 2026-09-28：P3-004 本地发布工程、恢复演练与支付教程

状态：**本地工程已完成；P3-004 尚未最终关闭**
提交：`d236891 feat: add release engineering and recovery tooling`

原问题：仓库没有 Git remote 和 CI；缺少统一执行全部测试的命令、健康检查、一致性资产备份、清单哈希、隔离恢复工具、生产部署/监控/故障手册和真实支付实施教程。迁移系统会备份数据库，但不能单独恢复私有 EA、MT5 报告、证据、公开上传和审计归档，也没有实际全链路恢复记录。

完成内容：

- 新增 `.github/workflows/ci.yml`：只读仓库权限、并发取消、Pull Request/main/merge queue 触发、Node 24、`npm ci`、隔离数据库迁移、lint、全部测试、迁移完整性校验和生产构建；
- 新增 `npm run test:all`，跨 Windows/Linux 顺序执行当前所有 25 个 `test:*` 脚本；
- 新增 `/api/health`，执行数据库就绪检查、禁止缓存并使用统一 API 异常边界；API 审计基线更新为 25 个路由、132 个断言；
- 新增 `backup:create`、`backup:verify`、`backup:restore` 和 `backup:drill`：使用 SQLite 在线备份 API，收集数据库、私有存储、公开上传和审计归档，生成逐文件 SHA-256 清单，拒绝软链接、路径穿越、非空覆盖、文件篡改、数据库损坏、外键违规和迁移历史不一致；
- Secret 明确排除在普通备份之外，恢复时必须从独立 Secret Manager 注入原审计与账本密钥；
- 新增 `GIT_CI.md`、`PRODUCTION_RUNBOOK.md` 和 `BACKUP_RECOVERY.md`；
- 新增 `REAL_PAYMENT_INTEGRATION.md`，覆盖服务商/自建链选择、Payment Intent、数据模型、原始体验签 Webhook、服务端二次查询、条件更新、幂等结算、账本、TXID/链上核验、退款/争议/链重组、对账、测试和上线顺序；桌面副本为 `NEXUS_QUANT_REAL_PAYMENT_INTEGRATION.md`；
- 新增 `test:release-engineering`，自动复核 CI 命令、权限、健康端点、备份保护、运维文档、支付教程，并实际执行一次临时备份和恢复后清理。

恢复演练：第一次恢复发现资产映射丢失 `storage/` 层级，数据库与账本通过但审计归档路径失败；修正后重新创建全新 bundle。最终 bundle 包含 26 个文件，自动创建与恢复约 2.9 秒；恢复数据库为 3/3 迁移、`quick_check=ok`、外键违规 0；注入独立保存的原密钥后，2 笔钱包流水和 97 条审计日志签名链全部有效。本机耗时不能作为生产 RTO，生产仍需在真实数据规模和异地存储上重新测量。

完整验证：25 个 `test:*` 脚本全部通过；文档测试扩展到 15 个文件、78 个断言；API 审计 25 个路由、132 个断言；全仓 ESLint 0 errors / 0 warnings；Next.js 16.3.5 生产构建、TypeScript、8/8 静态页面和全部动态 API 路由收集通过；`git diff --check` 通过。

未完成原因与下一步：远程 URL 已于 2026-09-29 配置，功能分支已推送；详见上方最新记录。还需在 GitHub 账户侧设置 `main` 分支保护。目标服务器尚未提供，因此不能伪造 systemd、Nginx、HTTPS、监控、异地加密备份和生产恢复证据。P3-004 在这些证据完成前保持“进行中”。

### 2026-09-28：P3-003 图片和加载性能优化

状态：**已完成，等待项目所有者验收**
提交：`2f50cb9 perf: harden image loading and previews`

原问题：应用虽然已经没有原生 `<img>`，但市场列表、市场详情和分享页仍对公开产品 Logo 使用 `unoptimized`，无法使用 Next.js 图片优化；分享页和 MT5 证据预览缺少响应式 `sizes`；头像弹窗在渲染期间调用 `URL.createObjectURL`，每次重新渲染都可能创建新的 Blob URL，且没有统一释放；头像与 Logo 文件选择器允许超出服务端实际支持范围的图片类型；证据预览响应缺少同源、禁止嗅探和 Referrer 防护；图片策略没有自动化回归检查。

完成内容：

- 盘点 42 个应用源码文件中的全部图片入口，确认没有遗留原生 `<img>`；
- 公开产品 Logo 保持内部 `/uploads/...` 来源并启用 Next.js 图片优化，移除市场列表、详情和分享页的无必要 `unoptimized`；
- 为产品分享页响应式图片补充 `sizes`，移动端按内容宽度、桌面端按 180px 选择资源；
- 为 MT5 审核预览补充响应式 `sizes`，同时保留 `unoptimized`：Next.js 优化器不会转发访问控制请求头，该接口也明确使用 `private, no-store`，直接加载才能保持权限和缓存边界；
- 将头像文件选择与预览提取为 `AvatarPicker`，只在文件选择时创建 Blob URL，更换文件和弹窗卸载时调用 `URL.revokeObjectURL`；
- 头像和产品 Logo 文件选择器收敛为 PNG、JPEG、WebP，与服务端内容验证白名单一致；
- MT5 证据 GET 只读取去元数据 PNG 预览，不读取原始截图，并增加 `Content-Disposition: inline`、`Cross-Origin-Resource-Policy: same-origin`、`Referrer-Policy: no-referrer` 和 `X-Content-Type-Options: nosniff`；
- 保持远程图片来源关闭：`next.config.mjs` 没有 `remotePatterns` 或宽泛域名配置，数据库字段也只接受受控内部上传路径；
- 没有对任何图片设置不必要的首屏预加载；非首屏图片继续使用 Next.js 默认懒加载；
- 新增 `test:image-policy`，检查原生图片、Blob 生命周期、上传 MIME、公开图片优化、响应式尺寸、私有证据直连、响应头和远程来源策略。

隐私边界：MT5 原始截图继续保存在 `storage/private/evidence`，GET 接口只返回去元数据预览。未通过审核或未绑定到正常产品的预览仍要求所有者或管理员 Session；已审核并上架产品的预览按产品证据披露规则公开。EA 文件和 MT5 HTML 原始报告没有变成图片资源，也没有迁入公开目录。

验收结果：

```text
应用源码检查：42 个文件
原生 <img>：0
公开产品图：Next.js 优化已启用
头像 Blob URL：替换和卸载时释放
远程图片来源：关闭
图片策略自动化测试：通过
全仓 ESLint：0 errors / 0 warnings
```

完整验证：原有 23 个 `test:*` 脚本与新增 `test:image-policy` 全部通过，共 24 个；Next.js 16.3.5 生产构建、TypeScript、8/8 静态页面和全部动态 API 路由收集通过；`git diff --check` 通过。生产构建使用完成 3/3 迁移的独立临时数据库，构建完成后临时数据库与相关文件已清理。

验收结论：P3-003 达标。图片加载、Blob 生命周期、私有证据访问和远程来源边界均有代码与自动化检查。下一项为 P3-004，本任务没有提前配置远程 Git、CI 或生产备份恢复。

### 2026-09-28：P3-002 拆分 `app/page.js`

状态：**已完成，等待项目所有者验收**
提交：`fc94f26 refactor: split app page responsibilities`

原问题：`app/page.js` 有 1,031 行、106,740 字节，同时承担导航头、语言与路由状态、认证弹窗、策略发布、社区、个人中心、提现和版本弹窗的渲染与状态编排。视图、外壳状态和 API 操作集中在一个 Client Component，修改任一业务区块都需要进入同一个大文件，增加冲突和回归风险。

完成内容：

- 提取 `AppHeader`，独立承载品牌导航、语言切换、用户菜单和后台入口；
- 提取 `UploadView`，独立承载开发者身份提示、EA 文件、MT5 HTML 报告、截图证据、自动指标和发布表单；
- 提取 `ForumView`，独立承载版块、排序、帖子列表、帖子详情、评论和发帖表单；
- 提取 `ProfileView`，独立承载用户资料、订单、许可证、社交资产、创作者收益和已发布策略；
- 提取 `AppOverlays`，独立承载版本提交、资料修改、提现、登录、注册、找回密码和全局提示；
- 新增 `useAppShell`，将语言外部存储订阅、页面路由持久化和全局 API 错误提示迁出页面控制器；
- `app/page.js` 保留服务端请求、业务操作和跨视图编排，由 1,031 行、106,740 字节缩减为 441 行、36,340 字节；
- 新增 `test:frontend-structure`，限制 `app/page.js` 不得超过 600 行，并断言五个组件边界和外壳 hooks 持续存在，防止业务 JSX 回流；
- 没有改变 API 路径、请求体、权限判断、订单/授权行为、发布证据要求或真实付费关闭状态。

验收结果：

```text
app/page.js：1,031 行 -> 441 行
app/page.js：106,740 字节 -> 36,340 字节
提取组件边界：5
提取外壳 hooks：3
新增结构回归：通过
全仓 ESLint：0 errors / 0 warnings
```

完整验证：原有 22 个 `test:*` 脚本与新增 `test:frontend-structure` 全部通过，共 23 个；Next.js 16.3.5 生产构建、TypeScript、8/8 静态页面和全部动态 API 路由收集通过；`git diff --check` 通过。生产构建使用独立临时数据库，先执行 3/3 数据库迁移后成功，临时数据库与迁移备份均已清理。

验收结论：P3-002 达标。页面不再承担全部视图和外壳状态，结构测试会阻止主要业务边界重新集中。下一项为 P3-003 图片和加载性能优化，本任务没有提前启动该项。

### 2026-09-28：P3-001 全仓 ESLint 清零

状态：**已完成，等待项目所有者验收**
提交：`7987c36 feat: resolve frontend lint baseline`

原问题：全仓 ESLint 有 4 个 errors 和 26 个 warnings。4 个错误集中在 `app/page.js` 的 effect 内同步更新状态；warnings 涉及原生 `<img>`、缺失 alt、Hook 依赖和内部页面使用整页跳转。持续保留这些问题会降低后续组件拆分与性能优化的可信度，也会使 CI 无法把 lint 作为硬门槛。

完成内容：

- 使用 `useSyncExternalStore` 管理语言本地存储订阅，删除 effect 内同步读取并更新语言状态；
- 将初始路由恢复改为可清理的异步调度，避免 effect 内同步状态更新；
- 移除仅用于首屏挂载判断的 `isMounted` 状态；
- 重构当前用户资产加载，在 effect 内直接启动并发请求，以 Promise 完成结果更新状态，依赖项收敛到稳定的用户 ID；
- 修复管理页初始化 effect 的 `router` 依赖；
- 将内部管理页导航改为 Next.js `router.push`；
- 将本次发现的原生 `<img>` 替换为 Next.js `Image`，补齐尺寸和可访问的 alt；本地 Blob 头像预览明确使用 `unoptimized`；
- 移除前端以 `Date.now()` 拼接的缓存破坏参数，保留现有 `cache: 'no-store'` 请求语义；
- 没有新增 ESLint 禁用规则，也没有通过忽略文件隐藏问题；
- 按 Next.js 16.3.5 本地文档复核 `Image`、`useRouter`、链接导航、Server/Client Components 和 `use client` 边界后实施修改。

验收结果：

```text
变更前：4 errors, 26 warnings
变更后：0 errors, 0 warnings
npm run lint：退出码 0
```

完整验证：22 个 `test:*` 脚本全部通过；Next.js 16.3.5 生产构建、TypeScript、8/8 静态页面与全部动态 API 路由收集通过；`git diff --check` 通过。

验收结论：P3-001 达标。全仓 lint 已可作为后续提交和 CI 的硬门槛。下一项为 P3-002，需按业务边界拆分 `app/page.js`，本任务没有提前启动该项。

### 2026-09-28：NQ-DOC-001 状态和上线文档收敛

状态：**已完成，等待项目所有者验收**
提交：`23f3531 docs: converge release status and runbooks`

原问题：README 仍保留 create-next-app 的 Vercel 推荐，与当前只支持“受信代理 + 单实例 Next.js + 本地 SQLite”的部署边界冲突；上线清单仍把已经完成的限流、验证码、CSRF 和上传安全列为待办，并记录旧的 11 个 ESLint errors；各安全专题文档没有明确区分代码完成与生产现场验收，容易把本机测试误当作已经上线。

完成内容：

- 重写 README，删除模板化 Vercel/Serverless 推荐，明确当前技术栈、单实例 SQLite、受信反向代理、私有资产和真实付费关闭边界；
- README 增加 P0/P1/P2/P3/真实支付状态表、本地开发、迁移、验证命令和安全运维文档索引；
- 重构 `GO_LIVE_CHECKLIST.md`，明确分为“已完成代码基线”“代码完成但生产未确认”“仍未完成工程项”“免费模式上线条件”“真实支付硬性阻断”五类；
- 把 Session、密码、RBAC、稳定 user_id、订单/提现幂等、Zod、限流审计、验证码、CSRF、上传安全、迁移、账本、API 错误隔离和前端 API 客户端标记为当前代码已完成；
- 把生产 Secret、管理员重置、HTTPS/代理/防火墙、Origin、恶意文件扫描、SMTP、OCR、EA 客户端、定时任务、不可变归档、备份恢复、生产迁移、浏览器和性能列为现场未确认；
- 把当前 ESLint、页面拆分、图片性能、CI、远程 Git、部署与恢复文档保留为 P3 未完成项；
- 免费模式与真实支付分别设置签字条件；免费模式仍不得展示付款入口或允许管理员绕过支付，真实支付仍要求 Payment Intent、可信核验、账本、异常流程、对账与生产签字；
- 为 `DEPLOYMENT_SECURITY.md`、`CSRF_SECURITY.md`、`UPLOAD_SECURITY.md`、`AUDIT_INTEGRITY.md`、`DATABASE_MIGRATIONS.md` 和 `WALLET_LEDGER.md` 增加日期化状态说明，逐份分开代码状态与生产证据状态；
- 保留 `NEXUS_QUANT_UPDATE_LOG.md` 为唯一任务进度来源，专题文档只承担操作规范和现场验收；
- 新增 `tests/documentation-convergence.mjs` 与 `test:docs`，防止本地链接、npm 命令、状态分类、Vercel 冲突、旧 11 errors 文案和已完成安全任务再次回归。

文档专项验证：

```text
11 Markdown files checked
55 assertions passed
broken local links: 0
missing npm scripts: 0
outdated completed-security TODO phrases: 0
```

完整验证：22 个 `test:*` 脚本全部通过；文档测试文件定向 ESLint 退出码 0；`git diff --check` 通过；Next.js 16.3.5 生产构建、TypeScript、8/8 静态页面和全部动态 API 路由收集通过。全仓 ESLint 的 4 个既有 errors 和 26 个 warnings 没有因文档任务变化，下一项 P3-001 专门处理。

验收结论：README、上线清单与六份专题安全文档已经使用同一状态口径；已完成代码、部署未确认和未完成项清楚分离；失效链接和命令引用已加入自动检查；免费部署与真实资金上线的条件不再混淆。下一项为 P3-001。

### 2026-09-28：NQ-P1-015 全 API 错误泄漏审计

状态：**已完成，等待项目所有者验收**
提交：`a7701df feat: contain api exception details`

原问题：既有路由多数已经使用受控业务错误文案，但错误防护依赖各处理函数内部的局部 `try/catch`。鉴权、限流、输入解析之前的异常可能绕过局部保护；不同 Route Handler 的未知 500 没有统一响应结构和请求关联 ID；管理员审计 API 还会原样返回完整性与健康对象，失败时可能暴露内部错误文本，新加入的异常诊断也可能随审计列表返回浏览器。

接口与风险清单：

- 认证与账号：`/api/auth/login`、`/api/auth/me`、`/api/auth/register`、`/api/auth/register/password`、`/api/send-code`、`/api/users`；
- 交易与资产：`/api/orders`、`/api/withdraw`、`/api/download`、`/api/licenses`、`/api/licenses/token`、`/api/licenses/verify`；
- 产品与证据：`/api/products`、`/api/upload`、`/api/strategy-report`、`/api/evidence`、`/api/versions`、`/api/verifications`；
- 社区：`/api/posts`、`/api/comments`、`/api/social`、`/api/reports`；
- 管理与配置：`/api/settings`、`/api/audit`。

共计 24 个 Route Handler 文件、51 个 GET/POST/PATCH/DELETE 方法，全部纳入静态清单和统一边界。风险类型覆盖 SQL/约束错误、文件绝对路径、上传与第三方服务异常、堆栈、密码/验证码/令牌/Secret、未经处理的非 Error 抛出值和无效 Route Handler 返回值。

完成内容：

- 新增 `lib/api-errors.js`，提供所有 Route Handler 共用的 `withApiErrors()` 最外层异常边界；
- 24 个 API 路由的 51 个 HTTP 方法全部由私有 Handler 改为包装后导出，鉴权、限流、解析、数据库和业务逻辑任意位置的未捕获异常都会被安全边界接管；
- 未知异常统一返回 HTTP 500、`success:false`、稳定代码 `INTERNAL_ERROR`、通用文案“服务暂时异常，请稍后重试”和 UUID 请求 ID；
- 请求 ID同时进入 JSON、`X-Request-ID` 响应头和服务端签名审计；所有成功及业务错误响应在缺少关联 ID 时也由边界补齐；
- 未知异常响应设置 `Cache-Control: no-store`，避免错误内容被缓存；
- 异常名称、稳定错误类型、脱敏诊断和堆栈 SHA-256 摘要写入 `api.internal_error` HMAC 签名审计记录，不把原始堆栈写入响应；
- 诊断脱敏会移除密码、令牌、Secret、验证码值、Windows/Unix 绝对路径和 SQL 字符串字面量；
- 移除 Route Handler 中包含原始异常对象的 `console.error`，避免未签名日志保存路径、SQL、堆栈或敏感值；控制台只保留请求 ID、方法和路由用于关联；
- 修正举报处理：仅映射明确的 `REPORT_NOT_FOUND` 与 `TARGET_NOT_FOUND` 为安全 404，未知异常交给统一 500 边界，不再误报为业务冲突；
- 修复新发现的 `/api/audit` 泄漏点：完整性和健康信息改为公开安全视图，不返回内部错误、链头哈希、密钥标识或 `lastError`；`api.internal_error` 记录通过管理 API读取时也会删除诊断文本和堆栈摘要；
- 将 `lib/security.js` 的 ESM 导入补齐扩展名，支持独立运行错误注入回归，同时保持 Next.js 构建兼容；
- 新增 `tests/api-error-boundary.mjs` 和 `tests/api-error-audit.mjs`，登记 `test:api-errors` 与 `test:api-error-audit`。

错误注入与静态审计：

```text
API error boundary: 22 assertions passed
API route error audit: 24 routes, 128 assertions passed
合计：150 assertions passed
```

专项测试证明 SQL 文本、Windows 路径、密码值、令牌值和堆栈不进入响应；响应请求 ID 与审计请求 ID一致；审计诊断完成脱敏；内部异常记录进入追加写保护的 HMAC 签名链；篡改检查保持有效；所有路由均无裸导出 Handler、无原始异常响应、无包含异常对象的 `console.error`；审计管理 API 不返回内部诊断。

完整验证：21 个 `test:*` 脚本全部通过；任务修改范围定向 ESLint 退出码 0；Next.js 16.3.5 生产构建、TypeScript、8/8 静态页面及全部动态 API 路由收集通过。全仓 ESLint 仍为 4 个既有 errors 和 26 个 warnings，继续由 P3-001 处理。

验收结论：预期业务错误继续使用稳定 4xx 与安全文案；所有未知异常由统一边界返回通用 500 和请求 ID；SQL、路径、堆栈及敏感凭据不会出现在响应或未签名控制台日志；脱敏诊断只保存在服务器签名审计链，并且管理员 API 也不回传诊断详情。下一项为 NQ-DOC-001。

### 2026-09-28：NQ-P1-014 统一前端 API 客户端和失败提示

状态：**已完成，等待项目所有者验收**
提交：`104f25a feat: unify frontend api error handling`

原问题：主页、市场和后台直接调用原生 `fetch`，错误处理方式不一致。后台保存设置、重置密码、调整角色和删除用户等写操作可能不检查 HTTP 或业务失败就显示成功；部分登录、资料、资产列表错误被空 `catch` 吞掉；验证码 JSON 请求缺少 `Content-Type`。

完成内容：

- 新增 `lib/api-client.js`，统一封装浏览器请求并提供结构化 `ApiError`；
- 非 2xx 和 HTTP 200 下的 `success:false` 都抛出错误，后续成功提示与本地状态更新不会执行；
- 为 401、403、409、422、429 和 500+ 定义一致的安全回退文案，同时保留服务端受控文案、错误代码、请求关联 ID 和 `Retry-After`；
- 网络异常转换为 `NETWORK_ERROR`，`AbortError` 原样保留，使取消请求不会被误报为网络故障；
- `apiJson` 统一 JSON 序列化和响应类型校验，支持 204/205 空响应，并拒绝非 JSON 与损坏 JSON；
- 成功的二进制下载不克隆或预读响应体，避免大 EA 文件产生额外内存副本；multipart 上传不强行设置 Content-Type，由浏览器生成 boundary；
- `app/page.js`、`app/admin/page.js` 和 `MarketView.js` 的原生 `fetch()` 已全部收口到 `apiFetch()`；静态审计确认三个入口没有残留原生调用；
- 页面和后台增加异步事件失败兜底提示，原先静默吞掉的登录、资料、订单、许可证、社交数据和删除失败现在可见；
- 后台保存配置使用 `try/catch/finally`，只有服务端确认后显示成功，失败显示原因并恢复按钮状态；其余管理写操作发生 API 错误时也在成功提示前中止；
- 注册、登录、找回密码、验证码、提现和资料更新统一使用安全错误文案；两个验证码请求补齐 JSON Content-Type；
- 新增 `tests/api-client.mjs` 与 `tests/frontend-api-usage.mjs`，并登记 `test:api-client`、`test:frontend-api`。

专项回归：

```text
API client: 27 assertions passed
Frontend API usage: 9 assertions passed
覆盖：JSON、204、success:false、403、429、非 JSON、网络失败、AbortError、二进制下载、请求序列化、管理写失败不进入成功分支、原生 fetch 零残留
```

完整验证：19 个 `test:*` 脚本全部通过；Next.js 16.3.5 生产构建、TypeScript、8/8 静态页面和所有动态 API 路由收集通过。全仓 ESLint 当前报告 4 个既有 errors 和 26 个 warnings，本任务没有新增错误，剩余项继续由 P3-001 处理。

验收结论：关键前后台请求已统一检查传输层和业务层结果；服务端拒绝、冲突、限流、异常响应或网络故障均不能继续执行成功提示或写后状态更新，达到本任务验收标准。下一项为 NQ-P1-015。

### 2026-09-28：NQ-P1-013 主动改密二次身份确认

状态：**已完成，等待项目所有者验收**
提交：`296d8c2 feat: require current password for profile changes`

原问题：个人资料接口允许持有有效 Session 的请求直接设置新密码，不要求当前密码。Session 被窃取后，攻击者可以借此接管长期凭据。

完成内容：

- 资料修改 Schema 在提交新密码时强制要求 `currentPassword`；
- 没有新密码时拒绝多余的当前密码字段，缩小敏感数据传输范围；
- 服务端从数据库读取当前密码摘要并使用既有 scrypt/bcrypt 兼容验证函数校验；
- 当前密码错误返回受控 401，不改变用户名、头像、密码或会话版本；
- 增加来源 IP 每 15 分钟 10 次、用户每 15 分钟 5 次的双层持久化限流；
- 错误、成功、账户状态冲突和限流写入 `auth.profile_password_change` 签名审计；
- 密码更新使用旧密码摘要与旧 `session_version` 作为条件，两个并发请求最多一个成功；
- 成功后 `session_version + 1`，原 Cookie 和其他设备旧 Session 失效；
- 当前请求签发新 HttpOnly Cookie，用户无需因正常改密立即退出当前页面；
- 个人资料弹窗新增当前密码字段和浏览器 `autocomplete` 语义，关闭或成功后清除内存中的密码值；
- 邮箱找回密码和管理员强制重置保持独立流程；
- 修复迁移 003 收紧角色枚举后，匿名化注销仍写入废弃 `deleted` 角色的问题；注销用户现在使用允许的 `banned` 角色并继续依赖 `deleted_at` 隔离。

专项生产 HTTP 回归：26 项断言通过，覆盖缺失当前密码、错误当前密码、原 Session 保持、成功改密、新 Cookie、旧 Cookie 失效、旧密码拒绝、新密码登录、重放拒绝、并发 `200/409` 单一获胜、失败次数限流 `401×5 -> 429` 以及审计原因。

```text
raceStatuses: [200, 409]
rateLimitStatuses: [401, 401, 401, 401, 401, 429]
auditReasons:
  ACCOUNT_STATE_CONFLICT: 1
  CURRENT_PASSWORD_INVALID: 6
  PASSWORD_CHANGED: 2
  RATE_LIMITED: 1
```

完整验证：17 个 `test:*` 脚本全部通过；Next.js 16.3.5 生产构建、TypeScript、8/8 静态页面与动态路由收集通过；本任务服务端和测试文件定向 ESLint 通过。

验收结论：主动改密现在要求重新证明当前密码，成功后旧 Session 全部失效，并发、重放、暴力尝试和审计边界达到本任务标准。下一项为 NQ-P1-014。

### 2026-09-28：更新日志收敛

- 删除分散的 P0、P1、P2 单项更新日志；
- 删除过时的 P0–P3 总复核日志和项目进度备忘；
- 建立本文件作为唯一进度来源；
- 汇总 P0-001 至 P0-010、P1-001 至 P1-012、P2-001 至 P2-009 的当前完成状态；
- 明确部署未确认项和真实支付阻断项；
- 固定后续任务顺序；
- 增加桌面同步命令与维护规则。
