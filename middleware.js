// middleware.js
import { NextResponse } from 'next/server';

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;

  // Routes publiques (pas de vérification)
  const publicPaths = ['/login', '/register', '/forgot-password', '/'];
  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // Routes protégées : vérifier le cookie de session Better Auth
  // ⚠️ Better Auth utilise par défaut le nom 'better-auth.session_token'
  const sessionToken = request.cookies.get('better-auth.session_token');

  if (!sessionToken) {
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
