import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * The public demo: a fully static build of the landing page plus the
 * browser-only editor, published to GitHub Pages.
 *
 * It renders the very same components as the product (imported from
 * `apps/web/src` through the `@/*` alias), so the public page cannot drift from
 * what the app actually does. There are no API routes here, which is exactly
 * why it can be served as files.
 */

const workspaceRoot = path.join(import.meta.dirname, '..', '..');

// Pages serves the site from https://<user>.github.io/<repo>/, so every URL
// needs that prefix. Override with NEXT_PUBLIC_BASE_PATH='' for a root deploy.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/MeDF';

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
