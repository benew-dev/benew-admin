// lib/auth-client.js - BENEW ADMIN - CORRIGÉ
'use client';

import { createAuthClient } from 'better-auth/react';
import * as Sentry from '@sentry/nextjs';

// ✅ CORRECTION: baseURL doit pointer vers votre domaine, pas bs-client-better-auth
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',

  // ✅ Intercepteurs Sentry (GARDER)
  fetchOptions: {
    onRequest: (context) => {
      Sentry.addBreadcrumb({
        category: 'auth.client',
        message: `Auth request: ${context.url}`,
        level: 'info',
      });
    },
    onError: (context) => {
      Sentry.captureException(context.error, {
        tags: {
          component: 'better-auth-client',
          status: context.error.status,
        },
      });
    },
    onSuccess: (context) => {
      Sentry.addBreadcrumb({
        category: 'auth.client',
        message: `Auth success: ${context.url}`,
        level: 'info',
      });
    },
  },
});

// ✅ Exporter les méthodes directement
export const { signIn, signUp, signOut, useSession, updateUser } = authClient;
