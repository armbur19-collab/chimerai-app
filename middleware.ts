// @chimerai component=Middleware version=1.2
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/** Routes that require authentication */
const PROTECTED_PATHS = ['/dashboard', '/chat', '/admin', '/settings', '/api/models', '/api/conversations', '/api/admin', '/api/billing'];

/** Routes that are always public (no auth needed) */
const PUBLIC_PATHS = ['/auth', '/api/auth', '/api/v1/', '/_next', '/favicon.ico', '/widget'];

/** Merge CORS_ALLOWED_ORIGINS + WIDGET_ALLOWED_ORIGINS (legacy alias) */
function getAllowedOrigins(): string[] {
  const raw = [
    process.env.CORS_ALLOWED_ORIGINS || '',
    process.env.WIDGET_ALLOWED_ORIGINS || '',
  ].filter(Boolean).join(',');
  if (!raw) return ['*'];
  return raw.split(',').map(o => o.trim()).filter(Boolean);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- CORS for Widget/Public API Endpoints (/api/v1/*) ---
  if (pathname.startsWith('/api/v1/')) {
    const allowedOrigins = getAllowedOrigins();
    const origin = request.headers.get('origin') || '';

    // Preflight (OPTIONS) — respond directly without further processing
    if (request.method === 'OPTIONS') {
      const res = new NextResponse(null, { status: 204 });
      const allowOrigin = allowedOrigins.includes('*') ? '*' : (allowedOrigins.includes(origin) ? origin : '');
      if (allowOrigin) {
        res.headers.set('Access-Control-Allow-Origin', allowOrigin);
      }
      res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
      res.headers.set('Access-Control-Max-Age', '86400');
      return res;
    }

    // Actual request — add CORS headers
    const response = NextResponse.next();
    const allowOrigin = allowedOrigins.includes('*') ? '*' :
      (allowedOrigins.includes(origin) ? origin : '');
    if (allowOrigin) {
      response.headers.set('Access-Control-Allow-Origin', allowOrigin);
    }
    return response;
  }

  // --- Auth protection for protected routes ---
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));
  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p));

  if (!isPublic && isProtected) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      // API routes return 401, pages redirect to sign-in
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  // --- Standard security headers for all other routes ---
  const response = NextResponse.next();

  // X-Frame-Options — Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // X-Content-Type-Options — Prevent MIME sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // HSTS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
