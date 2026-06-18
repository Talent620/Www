/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    // Lint is run as a separate CI step; don't fail production builds on it.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Enforced only over HTTPS; harmless over plain HTTP in local dev.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // Conservative CSP. 'unsafe-inline' is required because the preview
          // renders the spec's design tokens as inline styles and Next injects
          // inline bootstrap scripts. Tightening script-src with per-request
          // nonces is tracked as decision item F6 in AUDIT.md.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              "frame-ancestors 'self'",
              "img-src 'self' data:",
              "font-src 'self' data:",
              "style-src 'self' 'unsafe-inline'",
              "script-src 'self' 'unsafe-inline'",
              "connect-src 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
