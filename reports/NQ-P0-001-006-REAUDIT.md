# NQ-P0-001 至 NQ-P0-006 重新审查报告

复核日期：2026-09-22  
复核结论：6 项全部达到原验收标准  
复核环境：Next.js 16.3.5 生产构建，Node.js v24.21.0，SQLite `data.db`

## 状态总览

| ID | 结果 | 验收结论 |
|---|---|---|
| NQ-P0-001 | ✅ 完成 | 生产环境缺少 32 字符以上 `JWT_SECRET` 时启动失败；旧默认密钥、伪造签名和旧会话版本均不能恢复身份。 |
| NQ-P0-002 | ✅ 完成 | products/posts/comments 写接口均使用服务端 Session；匿名写入为 401，非所有者操作为 403，审核和置顶只允许管理员。 |
| NQ-P0-003 | ✅ 完成 | 作者由 Session 绑定，产品初始状态固定为 `pending`，EA/图片 URL 必须对应当前用户未占用的上传记录；公开产品列表不返回 `file_url`。 |
| NQ-P0-004 | ✅ 完成 | EA 只从私有目录经下载接口下发；路径格式、上传记录和真实目标目录均校验；旧公开 EA URL 和私有静态 URL 都返回 404。 |
| NQ-P0-005 | ✅ 完成 | 明文/未知格式不参与密码比对，哈希文本不能冒充密码；数据库遗留密码已迁移或强制作废，当前没有明文或未知格式。 |
| NQ-P0-006 | ✅ 完成 | 普通用户不能自助升级 developer，也不能上传 EA；只有管理员授予 developer 后才获得上传权限。 |

## NQ-P0-001：生产 Session 密钥

实现证据：

- `next.config.mjs` 在 production 下检查 `JWT_SECRET`，缺失或短于 32 字符立即抛错。
- `lib/auth.js` 不再包含固定默认密钥。开发环境未配置密钥时只生成当前进程内的随机临时密钥。
- Session 只保存 `id`、`session_version` 和过期时间，并用 HMAC-SHA256 签名。
- 每次读取 Session 都重新查询用户，并比对数据库中的 `session_version`。

运行验收：

- 无 `JWT_SECRET` 导入生产配置：进程退出码 1，错误为 `JWT_SECRET must be configured...`。
- 使用本次测试密钥签名的 Cookie：身份恢复成功。
- 使用旧源码默认值 `nexus-secret-key-2026` 签名的 Cookie：身份恢复失败。
- 使用错误 `session_version` 的正确签名 Cookie：身份恢复失败。

## NQ-P0-002：products/posts/comments 授权

实现证据：

- 三组写接口都调用 `getSessionUser()`，不读取客户端自报用户名或角色作为授权依据。
- 产品创建只允许 developer/admin；产品编辑和删除检查所有者，管理员可管理全量产品。
- 产品状态审核、帖子置顶、评论置顶只允许 admin。
- 帖子和评论删除只允许作者本人或 admin。
- 管理员产品列表不能再通过匿名 `?role=admin` 获取。

运行验收：

- 匿名创建产品、帖子、评论：全部 401。
- 匿名读取管理员产品列表：403。
- 非所有者编辑/删除产品、帖子或评论：全部 403。
- 非管理员审核产品、置顶帖子和评论：全部 403。
- 管理员审核产品、置顶帖子和评论：全部成功。

## NQ-P0-003：可信字段服务端绑定

实现证据：

- 产品 `author`/`author_user_id`、帖子作者和评论作者均取自当前 Session。
- 产品创建状态固定写入 `pending`；客户端提交 `status: active` 不会生效。
- 产品 `file_url` 与 `logo_url` 必须匹配 `uploads` 表中当前用户、正确类型且尚未绑定产品的记录。
- 上传记录通过事务绑定产品，防止同一个文件被重复认领。
- 对外产品列表显式选择公开字段，不返回 EA 私有路径。

运行验收：

- 伪造 admin 作者创建产品、帖子、评论：数据库仍记录真实登录用户。
- 伪造 `active` 状态创建产品：数据库状态为 `pending`。
- 任意私有路径和其他用户上传记录：产品创建均返回 400。
- 公开产品查询：响应中不存在 `file_url`。

## NQ-P0-004：EA 私有存储与下载边界

实现证据：

- EA 上传写入 `storage/private/eas`，URL 只作为数据库内部标识。
- 下载只接受 `/private/eas/<安全文件名>` 格式。
- 下载前同时校验产品权限、`uploads` 归属关系和 `attached_product_id`。
- `path.resolve` 后要求目标文件父目录严格等于私有根目录。
- `public/uploads` 当前仅保留站点图标；历史 EA 已迁至私有目录。

运行验收：

- 产品作者经 `/api/download` 下载：200，内容匹配。
- 无订单的其他开发者下载：403。
- 直接访问 `/private/eas/<文件>`：404。
- 历史公开 EA URL：404。
- 产品记录写入 `/private/eas/../../README.md` 后请求下载：410，没有读取项目文件。

## NQ-P0-005：密码格式和遗留迁移

本次复核发现并补齐了最后一个数据层缺口：代码已经拒绝未知格式，但生产数据库仍有 1 条未知格式密码和 1 条旧版 `salt:key` scrypt 记录。

本次修复：

- 在 `users` 增加 `password_reset_required` 标记。
- 增加一次性迁移 `migration_password_format_v1`。
- 旧版 `salt:key` scrypt 无损转换为 `scrypt$<salt>$<key>`，无需知道用户明文密码。
- 未知/疑似明文格式替换为不可知的随机 scrypt 哈希，递增 `session_version` 并要求邮箱验证码重置。
- 强制重置、邮箱重置和用户主动改密后清除重置标记。
- 被强制重置的账户不能恢复旧 Session。
- 匿名化注销账户也写入有效 scrypt 随机哈希，避免重新引入未知格式。

数据影响：

- 用户 ID 1 `Hansan Jafferye` 的旧未知格式密码已作废，`password_reset_required = 1`。下次登录必须通过绑定邮箱验证码设置新密码。
- 用户 ID 6 `jiuwu` 的旧版 scrypt 已无损升级，不要求重置。
- 当前全部用户密码字段均为受支持的 `scrypt$...` 格式；未知/明文格式数量为 0。

运行验收：

- 提交数据库中的完整哈希文本作为密码：401。
- 正常 scrypt 密码：登录成功。
- 合法旧 bcrypt 测试记录：登录成功后自动升级为 scrypt。
- 已作废遗留密码：403，并返回 `PASSWORD_RESET_REQUIRED`。

迁移前数据库备份：`backups/data-before-p0-001-006-reaudit-20260922.db`。

## NQ-P0-006：开发者审批

实现证据：

- `upgradeRole` 自助升级入口固定返回 403。
- 角色变更必须由 admin Session 调用 `/api/users`，且只能写入允许的角色枚举。
- `/api/upload` 和 `/api/products` 都在服务端要求 developer/admin。
- 前端对普通用户显示管理员审核提示，不再把普通用户展示为开发者。

运行验收：

- 普通用户请求 `upgradeRole`：403。
- 普通用户上传 EA：403。
- 管理员将用户角色改为 developer：200。
- 同一用户获得管理员批准后上传 EA：200。

## 综合验证

- 安全接口回归：42/42 断言通过。
- `npm run build`：通过，生成 3 个页面和 14 个动态 API 路由。
- `npm ls --depth=0`：通过。
- `npm audit --omit=dev`：0 个已知漏洞。
- SQLite `quick_check`：`ok`。
- SQLite `foreign_key_check`：0 条异常。
- 回归产生的临时用户、产品、帖子、评论、上传记录和文件已全部清理。
- `npm run lint`：仍失败，11 errors、29 warnings。这属于 P3 工程质量事项，不影响本报告六项安全验收，但应在发布前修复并纳入 CI。

## 仍需保留的上线阻断

P0-001 至 P0-006 完成不代表可以启用真实收款。付费下单仍按 NQ-P0-008 的策略关闭；正式上线前必须执行项目根目录的 `GO_LIVE_CHECKLIST.md`。如果要销售付费 EA，真实支付核验、链上确认、回调幂等、不可变账本、退款和对账未完成前，不得恢复付费入口。

