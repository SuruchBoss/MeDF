import path from 'node:path';
import type { NextConfig } from 'next';

// Dependencies are hoisted to the workspace root, so both Turbopack and the
// output file tracer need the monorepo root rather than this package.
const workspaceRoot = path.join(import.meta.dirname, '..', '..');

const nextConfig: NextConfig = {
  // `standalone` produces a self-contained server bundle, which is what the
  // Electron (Windows) build ships and launches as a child process.
  output: 'standalone',
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
  reactStrictMode: true,
  poweredByHeader: false,
  // The export route reads the bundled Thai fonts from `public/fonts` at
  // runtime, so they must survive output tracing.
  outputFileTracingIncludes: {
    '/api/documents/[id]/export': ['./public/fonts/*.ttf'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Members' documents must never be framed by another site.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
