// @chimerai component=SentryInstrumentation version=1.0
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Automatically capture all unhandled server-side errors (Next.js 15.3+)
export const onRequestError = Sentry.captureRequestError;
