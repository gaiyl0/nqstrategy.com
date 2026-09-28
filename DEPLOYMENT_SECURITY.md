# Nexus Quant 生产入口与限流部署基线

> **状态（2026-09-28）：** 代理信任、生产配置校验、持久化限流和单实例失败关闭已通过代码测试；HTTPS、反向代理、防火墙、源站隔离和重启持续性仍需在目标服务器现场验证。多实例与 Serverless 仍不受支持。

当前应用使用 SQLite 保存业务数据、审计日志和限流桶。经过本轮复核，唯一受支持的生产拓扑是：

```text
Internet -> TLS edge/reverse proxy -> one Next.js instance -> one local data.db
```

应用实例必须只允许可信代理访问。代理必须覆盖客户端提交的来源 IP 头，并注入只有代理和应用知道的 `X-Nexus-Proxy-Secret`。应用只有在共享密钥正确、来源头只包含一个有效 IPv4/IPv6 地址时才信任该 IP。

## 必需环境变量

```dotenv
TRUSTED_PROXY_MODE=nginx
TRUSTED_PROXY_SHARED_SECRET=<至少 32 个随机字符>
RATE_LIMIT_BACKEND=sqlite
DEPLOYMENT_TOPOLOGY=single-instance
```

生成代理共享密钥：

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

`TRUSTED_PROXY_MODE` 可取：

| 值 | 应用读取的来源头 | 入口要求 |
|---|---|---|
| `nginx` | `X-Real-IP` | Nginx 覆盖该头并注入共享密钥。 |
| `cloudflare` | `CF-Connecting-IP` | 必须通过受控 Worker/源站规则注入共享密钥，并禁止绕过 Cloudflare 直连源站。 |
| `forwarded` | `X-Forwarded-For` | 自有代理必须把该头重写为单一客户端 IP，不允许保留逗号分隔链。 |

当前版本不接受 `vercel` 模式。SQLite 文件、上传资产和限流桶都不适合无共享磁盘的弹性多实例或 Serverless 环境。

## Nginx 示例

将共享密钥放在只对 Nginx 管理员可读的配置或密钥注入文件中，不要提交到项目仓库。

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For "";
    proxy_set_header X-Nexus-Proxy-Secret "<与应用环境变量相同的随机密钥>";
}
```

同时使用防火墙或私有网络确保 3000 端口不能从互联网直接访问。共享密钥用于验证请求确实经过受控代理，防火墙用于减少密钥泄漏后的风险，两者都需要配置。

## 失败行为

- 生产环境缺少代理模式、共享密钥、限流后端或拓扑声明时，`next build` 和 `next start` 会失败。
- 声明多实例或非 SQLite 限流后端时，当前版本拒绝启动，防止部署人员误以为限流已经跨实例生效。
- 运行时缺少共享密钥、密钥错误、来源头错误或包含多个 IP 时，应用不会使用声称的 IP。所有此类请求进入同一个失败关闭来源桶，因此不断更换伪造 IP 不能绕过 IP 限流。
- 审计元数据记录 `sourceTrusted` 和失败原因，不记录代理共享密钥或原始 IP。

## 上线验证

1. 从正常公网入口访问登录接口，确认审计记录为 `sourceTrusted: true`。
2. 从源站本机或未带共享密钥的通道请求，确认审计记录为 `proxy_auth_failed`，并确认反复改变伪造 IP 仍命中同一个限流桶。
3. 确认应用端口在公网扫描中不可达。
4. 确认只运行一个应用实例，并且监控/编排配置不会自动扩容。
5. 重启应用后复测限流桶仍然生效。
6. 轮换共享密钥时先更新代理，再在短维护窗口更新应用并重启；轮换结束后撤销旧密钥。

## 扩展到多实例

在增加第二个实例前，必须先实现共享限流后端，例如 Redis 或 PostgreSQL，并满足：

- 所有实例对同一个限流键执行原子递增和统一过期。
- 并发请求不会超过配置阈值。
- 任一实例重启不会清空限流状态。
- 共享存储不可用时采用明确的失败关闭或降级策略并触发告警。
- 完成跨至少两个实例的相同来源、相同账号和相同用户限流回归。

达到这些条件后才能增加新的 `RATE_LIMIT_BACKEND` 实现，并把 `DEPLOYMENT_TOPOLOGY` 改为多实例。
