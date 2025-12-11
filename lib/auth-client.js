// lib/auth-client.ts
'use client';

import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
});

// Export hooks individuels pour faciliter imports
export const {
  useSession,
  signIn,
  signUp,
  signOut,
  getSession, // Pour appels programmatiques
} = authClient;
