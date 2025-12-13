// middleware.js - BENEW ADMIN (5 users/day) - INSPIRÉ DE BS-CLIENT-BETTER-AUTH
import { NextResponse } from 'next/server';

// ===== CONFIGURATION =====

// Routes publiques (pas de vérification auth)
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/'];

// ✅ CORRECTION: Nom du cookie basé sur la config Better Auth
// Better Auth utilise par défaut "better-auth.session_token" sans prefix
const SESSION_COOKIE = 'better-auth.session_token';

// Logs debug (désactivé en production)
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DEBUG = process.env.NEXT_PUBLIC_DEBUG === 'true';

// Cache pour optimisation (évite de re-calculer les chemins publics)
const pathCache = new Map();

// ===== MIDDLEWARE =====

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Debug logs (seulement en dev)
  if (!IS_PRODUCTION && DEBUG) {
    console.log('[Middleware] Path:', pathname);
    console.log('[Middleware] Cookies:', request.cookies.getAll());
  }

  // 1. Ignorer assets statiques (performance)
  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  // 2. Ignorer API Better Auth (éviter boucle infinie)
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // 3. Vérification rapide avec cache
  if (pathCache.has(pathname)) {
    const cached = pathCache.get(pathname);
    if (cached === 'public') {
      return NextResponse.next();
    }
  }

  // 4. Routes publiques - pas de vérification auth
  const isPublic = PUBLIC_PATHS.some((publicPath) =>
    publicPath === '/' ? pathname === '/' : pathname.startsWith(publicPath),
  );

  if (isPublic) {
    pathCache.set(pathname, 'public');
    return NextResponse.next();
  }

  // 5. Vérifier présence cookie session (optimistic check)
  // Note: La validation complète se fait côté serveur dans layout.jsx
  const sessionCookie = request.cookies.get(SESSION_COOKIE);

  if (!IS_PRODUCTION && DEBUG) {
    console.log(
      '[Middleware] Session cookie:',
      sessionCookie?.value ? 'EXISTS' : 'MISSING',
    );
  }

  if (!sessionCookie) {
    // Pas de cookie - rediriger vers login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);

    if (!IS_PRODUCTION && DEBUG) {
      console.log('[Middleware] Redirecting to login:', loginUrl.toString());
    }

    return NextResponse.redirect(loginUrl);
  }

  // 6. Cookie existe - permettre l'accès
  // La validation complète de la session se fait dans le layout du dashboard
  return NextResponse.next();
}

// ===== CONFIGURATION MATCHER =====

export const config = {
  matcher: [
    /*
     * Match toutes les routes sauf :
     * - /api/auth/* (routes Better Auth)
     * - _next/static (fichiers statiques)
     * - _next/image (optimisation images)
     * - favicon.ico
     * - fichiers publics (images, fonts)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
};
