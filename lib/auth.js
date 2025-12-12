// lib/auth.js - VERSION CORRIGÉE
import { betterAuth } from 'better-auth';
import { getPool } from '@/backend/dbConnect';
import logger from '@/backend/logger';
import * as Sentry from '@sentry/nextjs';

export const auth = betterAuth({
  appName: 'Benew Admin',
  database: getPool(),

  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL,

  trustedOrigins: ['http://localhost:3000', 'https://benew-admin.vercel.app'],

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 jours
    updateAge: 60 * 60 * 24, // 1 jour
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // ❌ DÉSACTIVER rate limiting Better Auth
  rateLimit: {
    enabled: false,
  },

  advanced: {
    defaultCookieOptions: {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      path: '/',
    },
  },

  // ✅ Monitoring Sentry (GARDER)
  onError: (error, context) => {
    logger.error('Better Auth error', {
      component: 'better-auth',
      error: error.message,
      context: context?.type,
    });
    Sentry.captureException(error, {
      tags: { component: 'better-auth', context: context?.type },
    });
  },

  onSuccess: (event) => {
    if (['sign-up', 'sign-in', 'sign-out'].includes(event.type)) {
      logger.info(`Better Auth: ${event.type}`, { userId: event.user?.id });
      Sentry.addBreadcrumb({
        category: 'auth',
        message: `User ${event.type}`,
        data: { userId: event.user?.id },
      });
    }
  },

  // ⚠️ Hooks UNIQUEMENT si validation business spécifique (optionnel)
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          logger.info('Creating new user', { email: user.email });
          // Ajouter validation custom ici si nécessaire (blacklist domaines, etc.)
          return user;
        },
        after: async (user) => {
          logger.info('User created successfully', { userId: user.id });
          return user;
        },
      },
    },
  },
});

// ❌ RETIRER tous les wrappers validateRegistrationData, validateLoginData, etc.
// Better Auth fait déjà la validation serveur automatiquement
