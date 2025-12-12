// lib/auth.js - VERSION CORRIGÉE AVEC MAPPING COMPLET
import { betterAuth } from 'better-auth';
import { getPool } from '@/backend/dbConnect';

console.log('[Better Auth] Initializing with shared database pool');

export const auth = betterAuth({
  // ===== DATABASE =====
  database: getPool(),

  // ===== AUTHENTICATION =====
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },

  // ===== SESSION =====
  session: {
    expiresIn: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  // ===== USER MODEL =====
  user: {
    // ⚠️ IMPORTANT : Ne pas mapper les champs ici si vos colonnes
    // sont déjà en camelCase dans la base de données
    // Supprimez la section fields: {} si vos colonnes sont en camelCase

    additionalFields: {
      phone: {
        type: 'string',
        required: false,
      },
      birthdate: {
        type: 'date',
        required: false,
      },
    },
  },

  // ===== SECURITY =====
  trustedOrigins: [
    'http://localhost:3000',
    process.env.BETTER_AUTH_URL || '',
    process.env.NEXT_PUBLIC_SITE_URL || '',
  ].filter(Boolean),

  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    cookiePrefix: 'better-auth',
  },

  rateLimit: {
    enabled: false,
  },
});
