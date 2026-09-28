<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Nexus Quant update log

`NEXUS_QUANT_UPDATE_LOG.md` is the single source of truth for task status and repair order. Every completed update or fix must update that file in the same change, then run `npm run log:sync` and verify the desktop copy at `C:\Users\Administrator\Desktop\NEXUS_QUANT_UPDATE_LOG.md`. Do not create new per-task progress reports under `reports/`.
