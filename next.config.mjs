import { validateDeploymentSecurity } from './lib/deployment-security.mjs';
import { validateAuditConfig } from './lib/audit-config.mjs';
import { validateCsrfConfig } from './lib/csrf-config.mjs';
import { validateLedgerConfig } from './lib/ledger-config.mjs';
import { validateLicenseConfig } from './lib/license-config.mjs';

/** @type {import('next').NextConfig} */
if (process.env.NODE_ENV === "production" && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error("JWT_SECRET must be configured with at least 32 characters in production");
}
if (process.env.NODE_ENV === 'production') {
  validateDeploymentSecurity(process.env);
  validateAuditConfig(process.env);
  validateCsrfConfig(process.env);
  validateLedgerConfig(process.env);
  validateLicenseConfig(process.env);
}

const nextConfig = {
  async headers() {
    // Cache only bundled public artwork; authenticated APIs and private uploads remain uncached.
    return [{source:'/images/editorial/:path*',headers:[{key:'Cache-Control',value:'public, max-age=86400, stale-while-revalidate=604800'}]}];
  },
  allowedDevOrigins: ['127.0.0.1'],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
