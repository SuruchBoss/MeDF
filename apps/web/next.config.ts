import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * One app, exported as files.
 *
 * There is no server left to run (docs/PRODUCT_DIRECTION.md §4), so every
 * page is prerendered and served by whatever hosts the folder. That also
 * means no `headers()` — a static host sends its own, and GitHub Pages does
 * not let us configure them. The security headers that block framing and
 * sniffing moved out with the server; nothing here holds a member's data, so
 * what they protected is no longer at stake.
 */

// Dependencies are hoisted to the workspace root, so both Turbopack and the
// output file tracer need the monorepo root rather than this package.
const workspaceRoot = path.join(import.meta.dirname, '..', '..');

// Pages serves the site from https://<user>.github.io/<repo>/, so every URL
// needs that prefix. Override with NEXT_PUBLIC_BASE_PATH='' for a root deploy.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  // Pages resolves `/try/` to `try/index.html`; without the trailing slash it
  // would depend on the host's extensionless-URL behaviour.
  trailingSlash: true,
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  env: {
    // Read by `lib/base-path.ts` for URLs we build by hand (fonts, pdf worker).
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
