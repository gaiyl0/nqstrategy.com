# Nexus Quant 最新更新日志与执行顺序

最后更新：2026-09-28  
当前状态：P0、P1、P2、NQ-DOC-001 与 P3-001 已完成；P3-002 至 P3-004 待处理
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
feature/p3-001-eslint
```

最近功能提交：

```text
7987c36 feat: resolve frontend lint baseline
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
- 22 个 `test:*` 脚本全部通过；
- 文档链接、状态分类、命令引用和旧文案专项检查共 55 个断言通过；
- 全仓 ESLint 以退出码 0 完成，0 errors / 0 warnings；
- Git 仓库已经建立；
- SQLite 当前只允许单实例部署；
- 真实付费入口保持关闭。

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

### P3-002：拆分 `app/page.js`

问题：首页 Client Component 同时承担路由、认证、市场、论坛、上传、订单、授权和个人中心，维护和测试成本过高。

验收标准：按业务边界拆分组件和 hooks，保持现有用户行为，生产构建和关键回归通过，单个文件不再承担全部应用状态。

### P3-003：图片和加载性能优化

问题：关键页面仍有原生 `<img>` 和不统一的加载行为。

验收标准：适用图片使用 Next.js `Image` 或明确等效方案，尺寸、alt、懒加载、私有图片鉴权和远程域名配置正确，不泄露私有证据 URL。

### P3-004：CI、远程 Git、备份恢复和部署文档

验收标准：

- 配置远程 Git 仓库和受保护主分支；
- CI 执行 lint、生产构建、迁移验证和测试；
- README 覆盖环境变量、开发、构建、迁移、部署和故障排查；
- 数据库与私有文件有加密、异地、定期备份；
- 完成并记录恢复演练；
- Secret 不进入 Git、构建日志或备份明文。

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
6. **P3-002：拆分 `app/page.js`**；
7. **P3-003：图片和加载性能优化**；
8. **P3-004：CI、远程 Git、备份恢复和部署文档**；
9. **真实付费任务组：仅在项目所有者决定启用真实资金时启动**。

## 当前下一项

```text
P3-002：拆分 `app/page.js`
状态：尚未开始，等待项目所有者确认启动
```

## 更新记录

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
