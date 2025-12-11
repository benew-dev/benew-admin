// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;

  // Routes publiques (pas de vérification)
  const publicPaths = ['/login', '/register', '/forgot-password', '/'];
  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // Routes protégées : vérification optimiste du cookie
  const sessionCookie = getSessionCookie(request, {
    cookieName: 'session_token',
    cookiePrefix: 'better-auth',
  });

  // ⚠️ SECURITY WARNING : Cette vérification est OPTIMISTE uniquement
  // Elle NE valide PAS la session côté serveur
  // C'est pour rediriger rapidement les utilisateurs non authentifiés
  // La vraie validation DOIT être faite dans chaque page/route protégée

  if (!sessionCookie) {
    const url = new URL('/login', request.url);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    // Ajouter autres routes protégées
  ],
};
