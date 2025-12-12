// lib/auth.js
import { betterAuth } from 'better-auth';
import { getPool } from '@/backend/dbConnect';

console.log('[Better Auth] Initializing with shared database pool');

export const auth = betterAuth({
  // ===== DATABASE =====
  database: getPool(),

  // ✅ AJOUTER baseURL pour production
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000',

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
    'https://benew-admin.vercel.app', // ✅ Ajouter votre domaine Vercel
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
