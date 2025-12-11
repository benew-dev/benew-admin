// lib/auth.ts
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

export const auth = betterAuth({
  // ===== DATABASE =====
  database: new Pool({
    connectionString: process.env.DBURL,
    // Options additionnelles si nécessaire
    ssl: process.env.DB_CA
      ? {
          require: true,
          rejectUnauthorized: true,
          ca: process.env.DB_CA,
        }
      : false,
  }),

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
      // Inclure données utilisateur dans cookie signé
      include: [
        'user.id',
        'user.name',
        'user.email',
        'user.image',
        'user.emailVerified',
        'user.createdAt',
        'user.updatedAt',
      ],
    },
  },

  // ===== USER MODEL MAPPING =====
  // Mapper vos colonnes admin.users vers Better Auth
  user: {
    // Table name dans votre DB
    modelName: 'admin.users', // Spécifier schéma admin

    // Mapping des champs
    fields: {
      id: 'user_id',
      name: 'user_name',
      email: 'user_email',
      emailVerified: 'user_email_verified', // À ajouter si vérification email
      image: 'user_image',
      createdAt: 'user_added',
      updatedAt: 'user_updated',
    },

    // Champs additionnels personnalisés
    additionalFields: {
      phone: {
        type: 'string',
        required: false,
        fieldName: 'user_phone', // Mapper vers user_phone
      },
      birthdate: {
        type: 'date',
        required: false,
        fieldName: 'user_birthdate', // Mapper vers user_birthdate
      },
    },
  },

  // ===== ACCOUNT MODEL MAPPING =====
  account: {
    modelName: 'admin.accounts', // Si vous voulez OAuth plus tard
    // Better Auth créera cette table automatiquement
  },

  // ===== SECURITY =====
  // Trusted origins (CORS)
  trustedOrigins: [
    'http://localhost:3000',
    process.env.BETTER_AUTH_URL || '',
    process.env.NEXT_PUBLIC_SITE_URL || '',
  ].filter(Boolean),

  // ===== ADVANCED =====
  advanced: {
    // Use custom schema for PostgreSQL
    useSecureCookies: process.env.NODE_ENV === 'production',
    cookiePrefix: 'better-auth',
  },

  // ===== RATE LIMITING (Optionnel - vous avez déjà le vôtre) =====
  rateLimit: {
    enabled: false, // Désactivé car vous utilisez votre rateLimiter.js
  },
});
