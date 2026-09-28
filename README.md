This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

> **正式上线前必读：** 当前付费能力已主动关闭，真实支付核验尚未接入。发布前必须完成并签署 [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md)。P0-001 至 P0-006 的最新复核见 [reports/NQ-P0-001-006-REAUDIT.md](reports/NQ-P0-001-006-REAUDIT.md)。

## Getting Started

Copy .env.example to .env.local and set JWT_SECRET to a random value of at
least 32 characters. Production builds and servers intentionally fail without
this setting so sessions can never fall back to a public, hard-coded key.

Production also requires an authenticated reverse proxy and an explicit
single-instance SQLite topology. Configure it according to
[DEPLOYMENT_SECURITY.md](DEPLOYMENT_SECURITY.md); production build/start fail
when the proxy trust boundary or rate-limit topology is missing or unsupported.

Audit logs are protected by a keyed integrity chain and controlled retention.
Configure key backup, rotation, verification, and archive handling according to
[AUDIT_INTEGRITY.md](AUDIT_INTEGRITY.md) before deployment.

Uploads use decoded image normalization, compiled-EA format gates, quotas,
expiry cleanup, and a fail-closed production malware scanner. Deployment and
scanner requirements are documented in [UPLOAD_SECURITY.md](UPLOAD_SECURITY.md).

All state-changing API requests are protected by an explicit Origin boundary.
Configure browser origins, credentialed CORS, and optional automation access as
described in [CSRF_SECURITY.md](CSRF_SECURITY.md).

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
