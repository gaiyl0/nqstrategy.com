import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(target) : [target];
});

const appFiles = walk(path.join(root, 'app')).filter((file) => /\.(?:js|jsx|ts|tsx)$/.test(file));
const socialImagePath = path.join(root,'app','components','SocialImage.js');
const appSource = appFiles.filter(file=>file!==socialImagePath).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const socialImageSource = fs.readFileSync(socialImagePath,'utf8');
assert.match(socialImageSource,/from 'next\/og'/,'the raw image exception is only for server-side ImageResponse rendering');
assert.doesNotMatch(socialImageSource,/['"]use client['"]/,'share image renderer must never become a browser component');
const overlays = read('app/components/AppOverlays.js');
const detail = read('app/components/StrategyDetail.js');
const market = read('app/components/MarketView.js') + detail;
const metrics = read('app/components/StrategyMetrics.js');
const sharePage = read('app/market/[slug]/page.js');
const evidenceRoute = read('app/api/evidence/route.js');
const nextConfig = read('next.config.mjs');
const uploadView = read('app/components/UploadView.js');

assert.doesNotMatch(appSource, /<img\b/i, 'all application images must use next/image or an explicit non-image element');
assert.doesNotMatch(overlays, /<Image[^>]+src=\{URL\.createObjectURL/, 'Blob URLs must not be created during render');
assert.match(overlays, /URL\.revokeObjectURL\(previewUrlRef\.current\)/, 'avatar preview URLs must be revoked');
assert.match(overlays, /accept="image\/png,image\/jpeg,image\/webp"/, 'avatar input must match server image formats');
assert.match(uploadView, /accept="image\/png,image\/jpeg,image\/webp"/, 'product logo input must match server image formats');
assert.doesNotMatch(market, /<Image[^>]+unoptimized/, 'public market logos should use Next image optimization');
assert.match(sharePage, /PublicProductDetail/, 'share page must use the shared product detail composition');
assert.match(read('app/market/[slug]/PublicProductDetail.js'), /StrategyDetail/, 'public product details must reuse the logo sizing policy');
assert.match(detail, /sizes="80px"/, 'shared detail logos must declare their bounded rendered size');
assert.match(metrics, /item\.previewUrl[^>]+unoptimized/, 'access-controlled evidence previews must bypass the optimizer because it does not forward authorization headers');
assert.match(metrics, /sizes="\(max-width: 767px\) calc\(100vw - 2rem\), 50vw"/, 'evidence previews need responsive sizing');
assert.doesNotMatch(nextConfig, /remotePatterns|domains\s*:/, 'remote image origins must stay closed until an explicit allowlist is approved');
for (const header of ['private, no-store', 'same-origin', 'no-referrer', 'nosniff']) {
  assert.ok(evidenceRoute.includes(header), `evidence response is missing ${header}`);
}
const evidenceGet = evidenceRoute.slice(evidenceRoute.indexOf('async function GETHandler'), evidenceRoute.indexOf('async function PATCHHandler'));
assert.doesNotMatch(evidenceGet, /original_stored_name/, 'evidence GET must not serve the original evidence file');
assert.match(evidenceGet, /preview_stored_name/, 'evidence GET must serve only the sanitized preview file');

console.log(`Image policy tests passed: ${appFiles.length} application source files checked`);
