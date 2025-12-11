// lib/auth.js - VERSION AVEC AUTO-CRÉATION TABLES DANS SCHÉMA ADMIN
import { betterAuth } from 'better-auth';
import { getPool } from '@/backend/dbConnect';

console.log('[Better Auth] Initializing with shared database pool');

export const auth = betterAuth({
  // ===== DATABASE =====
  database: getPool(),

  // ===== CONFIGURATION SCHÉMA PERSONNALISÉ =====
  // ✅ SOLUTION: Spécifier le schéma pour TOUTES les tables
  databaseOptions: {
    // Schéma par défaut pour toutes les tables Better Auth
    schema: 'admin',
  },

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

  // ===== USER MODEL MAPPING =====
  user: {
    // ⚠️ NE PAS inclure le schéma ici, juste le nom de table
    modelName: 'users', // pas 'admin.users'

    fields: {
      emailVerified: 'email_verified',
      emailVerifiedAt: 'email_verified_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },

    additionalFields: {
      phone: {
        type: 'string',
        required: false,
        fieldName: 'phone', // Mapping explicite
      },
      birthdate: {
        type: 'date',
        required: false,
        fieldName: 'birthdate', // Mapping explicite
      },
    },
  },

  // ===== ACCOUNT MODEL =====
  account: {
    modelName: 'accounts', // pas 'admin.accounts'

    // Champs avec snake_case
    fields: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      idToken: 'id_token',
      expiresAt: 'expires_at',
      userId: 'user_id',
      accountId: 'account_id',
      providerId: 'provider_id',
    },
  },

  // ===== SESSION MODEL =====
  // Better Auth créera admin.sessions automatiquement
  // avec les bonnes colonnes en snake_case

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
// CHANGEMENTS CLÉS
// ============================================================================
//
// ✅ 1. AJOUT databaseOptions.schema = 'admin'
//    - Indique à Better Auth d'utiliser le schéma 'admin' pour TOUTES les tables
//    - Better Auth créera automatiquement :
//      * admin.sessions
//      * admin.verification_tokens
//    - Utilisera les tables existantes :
//      * admin.users
//      * admin.accounts (si elle existe, sinon la créera)
//
// ✅ 2. SUPPRESSION du préfixe 'admin.' dans modelName
//    - modelName: 'users' au lieu de 'admin.users'
//    - Le schéma est déjà spécifié dans databaseOptions
//
// ✅ 3. MAPPING EXPLICITE des champs additionnels
//    - fieldName pour phone et birthdate
//    - Garantit le bon mapping avec votre table existante
//
// ============================================================================
// TABLES QUI SERONT CRÉÉES AUTOMATIQUEMENT
// ============================================================================
//
// Better Auth créera ces tables dans le schéma 'admin' :
//
// 1. admin.sessions
//    - id (TEXT PRIMARY KEY)
//    - user_id (TEXT REFERENCES admin.users(id))
//    - expires_at (TIMESTAMP)
//    - created_at (TIMESTAMP)
//    - updated_at (TIMESTAMP)
//
// 2. admin.verification_tokens (si email verification activée)
//    - id (TEXT PRIMARY KEY)
//    - identifier (TEXT)
//    - token (TEXT)
//    - expires_at (TIMESTAMP)
//
// 3. admin.accounts (si elle n'existe pas déjà)
//    - id (TEXT PRIMARY KEY)
//    - user_id (TEXT REFERENCES admin.users(id))
//    - account_id (TEXT)
//    - provider_id (TEXT)
//    - access_token (TEXT)
//    - refresh_token (TEXT)
//    - id_token (TEXT)
//    - expires_at (TIMESTAMP)
//    - password (TEXT) - pour email/password auth
//    - created_at (TIMESTAMP)
//    - updated_at (TIMESTAMP)
//
// ============================================================================
// VÉRIFICATION POST-DÉMARRAGE
// ============================================================================
//
// Après avoir démarré votre app, vérifiez que les tables sont créées :
//
// SELECT table_name
// FROM information_schema.tables
// WHERE table_schema = 'admin'
// ORDER BY table_name;
//
// Vous devriez voir :
// - accounts
// - sessions
// - users (déjà existante)
// - verification_tokens (si email verification)
//
// ============================================================================
