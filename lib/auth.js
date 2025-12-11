// lib/auth.js - VERSION STANDARD (schéma public)
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
    expiresIn: 30 * 24 * 60 * 60, // 30 jours
    updateAge: 24 * 60 * 60, // Rafraîchir toutes les 24h
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // ===== USER MODEL =====
  user: {
    // Champs additionnels personnalisés
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

// ============================================================================
// CONFIGURATION STANDARD - SCHÉMA PUBLIC
// ============================================================================
//
// ✅ Better Auth créera automatiquement ces tables dans le schéma "public" :
//
// 1. public.user
//    - id (TEXT PRIMARY KEY)
//    - name (TEXT)
//    - email (TEXT UNIQUE)
//    - emailVerified (BOOLEAN)
//    - image (TEXT)
//    - createdAt (TIMESTAMP)
//    - updatedAt (TIMESTAMP)
//    - phone (TEXT) - votre champ personnalisé
//    - birthdate (DATE) - votre champ personnalisé
//
// 2. public.account
//    - id (TEXT PRIMARY KEY)
//    - userId (TEXT REFERENCES user(id))
//    - accountId (TEXT)
//    - providerId (TEXT)
//    - accessToken (TEXT)
//    - refreshToken (TEXT)
//    - idToken (TEXT)
//    - expiresAt (TIMESTAMP)
//    - password (TEXT) - hash pour email/password auth
//    - createdAt (TIMESTAMP)
//    - updatedAt (TIMESTAMP)
//
// 3. public.session
//    - id (TEXT PRIMARY KEY)
//    - userId (TEXT REFERENCES user(id))
//    - expiresAt (TIMESTAMP)
//    - token (TEXT UNIQUE)
//    - ipAddress (TEXT)
//    - userAgent (TEXT)
//    - createdAt (TIMESTAMP)
//    - updatedAt (TIMESTAMP)
//
// 4. public.verification (si email verification activée)
//    - id (TEXT PRIMARY KEY)
//    - identifier (TEXT)
//    - value (TEXT)
//    - expiresAt (TIMESTAMP)
//    - createdAt (TIMESTAMP)
//
// ============================================================================
// DÉMARRAGE
// ============================================================================
//
// 1. Supprimez toutes les tables admin si elles existent encore :
//    DROP TABLE IF EXISTS admin.sessions CASCADE;
//    DROP TABLE IF EXISTS admin.accounts CASCADE;
//    DROP TABLE IF EXISTS admin.users CASCADE;
//    DROP TABLE IF EXISTS admin.verification_tokens CASCADE;
//
// 2. Démarrez votre application :
//    npm run dev
//
// 3. Better Auth créera automatiquement toutes les tables au premier démarrage
//
// 4. Vérifiez que les tables sont créées :
//    SELECT table_name
//    FROM information_schema.tables
//    WHERE table_schema = 'public'
//      AND table_name IN ('user', 'account', 'session', 'verification')
//    ORDER BY table_name;
//
// ============================================================================
