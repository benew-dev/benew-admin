// middleware.js - PRODUCTION-READY MINIMAL + SENTRY
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

// ===== CONFIGURATION =====

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/'];

const SESSION_COOKIE =
  process.env.NODE_ENV === 'production'
    ? '__Secure-better-auth.session_token'
    : 'better-auth.session_token';

// ===== MIDDLEWARE =====

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Ignorer assets statiques (performance)
  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  // ✅ Sentry: Tracer les requêtes middleware (breadcrumb)
  Sentry.addBreadcrumb({
    category: 'middleware',
    message: `Middleware check: ${pathname}`,
    level: 'debug',
    data: {
      pathname,
      method: request.method,
    },
  });

  try {
    // 1. Routes publiques - pas de vérification
    if (
      PUBLIC_PATHS.some((p) =>
        p === '/' ? pathname === '/' : pathname.startsWith(p),
      )
    ) {
      return NextResponse.next();
    }

    // 2. Vérifier présence cookie session (optimistic check)
    // Note: La validation complète se fait côté serveur dans les pages
    const sessionToken = request.cookies.get(SESSION_COOKIE);

    if (!sessionToken) {
      // ✅ Sentry: Logger la redirection (info, pas error)
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Unauthenticated access - redirecting to login',
        level: 'info',
        data: { pathname },
      });

      const url = new URL('/login', request.url);
      url.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(url);
    }

    // 3. Permettre l'accès
    return NextResponse.next();
  } catch (error) {
    // ✅ Sentry: Capturer les erreurs critiques
    Sentry.captureException(error, {
      tags: {
        component: 'middleware',
        pathname,
      },
      level: 'error',
    });

    // Fail-open: Rediriger vers login en cas d'erreur
    const url = new URL('/login', request.url);
    url.searchParams.set('error', 'middleware_error');
    return NextResponse.redirect(url);
  }
}

// ===== CONFIGURATION MATCHER =====

export const config = {
  matcher: [
    /*
     * Match toutes les routes sauf :
     * - _next/static (fichiers statiques)
     * - _next/image (optimisation images)
     * - favicon.ico
     * - fichiers publics (images, fonts)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
};
