// lib/auth.ts - VERSION OPTIMALE
// Réutilise le Pool singleton de dbConnect.js au lieu de créer un nouveau Pool
import { betterAuth } from 'better-auth';
import { getPool } from '@/backend/dbConnect';

// ===== RÉUTILISATION POOL EXISTANT =====
// ✅ Avantage : 1 seul pool partagé entre Better Auth et votre app
// ✅ Économie : 5 connexions max au lieu de 10
// ✅ Cohérence : Même config, mêmes variables env, même lifecycle

console.log('[Better Auth] Initializing with shared database pool');

export const auth = betterAuth({
  // ===== DATABASE =====
  // ✅ Réutilise le pool singleton de dbConnect.js
  database: getPool(),

  // ===== AUTHENTICATION =====
  emailAndPassword: {
    enabled: true,
    // Auto sign-in après inscription
    autoSignIn: true,
    // Minimum password length (correspond à votre schema Yup)
    minPasswordLength: 8,
  },

  // ===== SESSION =====
  session: {
    // Durée de vie : 30 jours (comme votre config NextAuth)
    expiresIn: 30 * 24 * 60 * 60, // secondes
    // Rafraîchissement tous les jours
    updateAge: 24 * 60 * 60,

    // Cookie cache pour performances (RECOMMANDÉ)
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes sans DB query
    },
  },

  // ===== USER MODEL MAPPING =====
  // ⚠️ IMPORTANT: Adapter selon votre schéma PostgreSQL
  user: {
    // Si votre table est dans schéma "admin" : 'admin.users'
    // Si votre table est dans schéma "public" : 'users'
    modelName: 'admin.users', // ⚠️ Vérifier ceci !

    // ✅ SOLUTION: Transformer camelCase → snake_case
    // Better Auth utilise emailVerified, createdAt, etc. (camelCase)
    // PostgreSQL a email_verified, created_at, etc. (snake_case)
    fields: {
      emailVerified: 'email_verified',
      emailVerifiedAt: 'email_verified_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },

    // Champs additionnels personnalisés
    additionalFields: {
      phone: {
        type: 'string',
        required: false,
        fieldName: 'user_phone',
      },
      birthdate: {
        type: 'date',
        required: false,
        fieldName: 'user_birthdate',
      },
    },
  },

  // ===== ACCOUNT MODEL (OAuth future) =====
  account: {
    modelName: 'admin.accounts', // ⚠️ Adapter si schéma différent
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

  // Rate limiting désactivé (vous utilisez rateLimiter.js)
  rateLimit: {
    enabled: false,
  },
});

// ============================================================================
// AVANTAGES DE CETTE APPROCHE
// ============================================================================
//
// ✅ 1. POOL UNIQUE PARTAGÉ
//    - Better Auth + votre app = 1 seul pool
//    - Max 5 connexions au lieu de 10
//    - Économie ressources PostgreSQL
//
// ✅ 2. CONFIGURATION CENTRALISÉE
//    - Toutes les variables env dans dbConnect.js
//    - 1 seul endroit à maintenir
//    - Pas de duplication config
//
// ✅ 3. LIFECYCLE COHÉRENT
//    - Pool créé une seule fois
//    - Cleanup automatique via dbConnect.js
//    - SIGTERM/SIGINT handlers partagés
//
// ✅ 4. DEBUGGING SIMPLIFIÉ
//    - Tous les logs DB passent par dbConnect.js
//    - 1 seul timestamp format
//    - Métriques centralisées
//
// ✅ 5. PERFORMANCES OPTIMALES
//    - Réutilisation connexions existantes
//    - Pas de overhead création pool
//    - Idle timeout partagé (30s)
//
// ============================================================================
// VARIABLES ENV REQUISES (Gérées par dbConnect.js)
// ============================================================================
//
// PostgreSQL (obligatoires) :
// - USER_NAME
// - HOST_NAME
// - DB_NAME
// - DB_PASSWORD
// - PORT_NUMBER
// - DB_CA (optionnel, pour SSL)
//
// Better Auth (obligatoires) :
// - BETTER_AUTH_SECRET
// - BETTER_AUTH_URL
// - NEXT_PUBLIC_SITE_URL
//
// Note : Si une variable manque, dbConnect.js throw une erreur au startup
//
// ============================================================================
// VÉRIFICATION SCHÉMA POSTGRESQL
// ============================================================================
//
// CRITIQUE : Vérifier que modelName correspond à votre vraie table !
//
// Option 1 : Schéma "admin" (probable dans votre cas)
//   user: { modelName: 'admin.users' }
//   account: { modelName: 'admin.accounts' }
//
// Option 2 : Schéma "public" (défaut PostgreSQL)
//   user: { modelName: 'users' }
//   account: { modelName: 'accounts' }
//
// Pour vérifier dans votre DB :
//   SELECT table_schema, table_name
//   FROM information_schema.tables
//   WHERE table_name IN ('users', 'accounts');
//
// ============================================================================
// TABLES BETTER AUTH (Auto-créées si manquantes)
// ============================================================================
//
// Better Auth créera automatiquement ces tables si elles n'existent pas :
//
// 1. sessions (gestion sessions)
// 2. accounts (OAuth providers - futur)
// 3. verification_tokens (email verification - futur)
//
// Note : La table "users" doit déjà exister avec vos colonnes personnalisées
//
// ============================================================================
// MIGRATION DEPUIS NEXTAUTH (Si applicable)
// ============================================================================
//
// Si vous migrez depuis NextAuth :
//
// 1. Mapping automatique des champs :
//    - NextAuth "id" → Better Auth "user_id"
//    - NextAuth "name" → Better Auth "user_name"
//    - NextAuth "email" → Better Auth "user_email"
//
// 2. Sessions existantes :
//    - NextAuth sessions invalides après migration
//    - Users devront se reconnecter une fois
//    - Pas de perte de données (comptes préservés)
//
// 3. OAuth accounts (si utilisé) :
//    - Better Auth créera nouvelle table "accounts"
//    - Migrer manuellement si comptes OAuth existants
//
// ============================================================================
