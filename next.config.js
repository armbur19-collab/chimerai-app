// @chimerai component=NextConfig version=1.2
const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required for ESM-only server packages (e.g. otpauth used by MFA, qrcode)
  // OpenTelemetry packages must be external to avoid webpack "Critical dependency" warnings (Sentry v8)
  serverExternalPackages: ['otpauth', 'qrcode', '@opentelemetry/instrumentation', '@opentelemetry/instrumentation-http'],
  webpack: (config, { dev, isServer }) => {
    // Disable filesystem cache in dev to avoid Windows ENOENT race condition on .pack.gz files
    if (dev) {
      config.cache = false;
    }
    // Mark ESM-only server packages as externals so webpack doesn't try to bundle them
    if (isServer) {
      config.externals = [...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)), 'otpauth', 'qrcode'];
    }
    return config;
  },
};

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
});
