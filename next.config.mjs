import { withSentryConfig } from '@sentry/nextjs';

// ============================================================================
// CONFIGURATION NEXT.JS 15.5.7 OPTIMISÉE
// ============================================================================
// Application: Admin Dashboard (5 utilisateurs/jour max)
// Philosophie: Simplicité, sécurité, performance via defaults Next.js
// Date: Décembre 2025
// ============================================================================

// ===== VALIDATION ENVIRONNEMENT =====
const validateEnv = () => {
  const requiredVars = [
    'NEXT_PUBLIC_SITE_URL',
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
    'NEXT_PUBLIC_CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'USER_NAME',
    'HOST_NAME',
    'DB_NAME',
    'DB_PASSWORD',
    'PORT_NUMBER',
    'NEXT_PUBLIC_SENTRY_DSN',
  ];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0 && process.env.NODE_ENV === 'production') {
    throw new Error(
      `Production build failed: Missing required environment variables: ${missingVars.join(
        ', ',
      )}`,
    );
  }
};

validateEnv();

// ===== HELPERS POUR HEADERS =====
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'same-origin';

// Headers de sécurité globaux (appliqués partout)
const getSecurityHeaders = () => [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
  {
    key: 'Permissions-Policy',
    value: 'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
  },
];

// Headers pour mutations sensibles (add/edit/delete)
const getMutationHeaders = () => [
  ...getSecurityHeaders(),
  { key: 'Access-Control-Allow-Origin', value: SITE_URL },
  { key: 'Access-Control-Allow-Methods', value: 'POST, PUT, DELETE, OPTIONS' },
  {
    key: 'Access-Control-Allow-Headers',
    value: 'Content-Type, Authorization, X-Requested-With',
  },
  {
    key: 'Cache-Control',
    value: 'no-store, no-cache, must-revalidate, max-age=0',
  },
  { key: 'Pragma', value: 'no-cache' },
  { key: 'Expires', value: '0' },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'none'; connect-src 'self'",
  },
];

// Headers pour authentification Better Auth
const getAuthHeaders = () => [
  ...getSecurityHeaders(),
  { key: 'Access-Control-Allow-Origin', value: SITE_URL },
  { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
  {
    key: 'Access-Control-Allow-Headers',
    value: 'Content-Type, Authorization, X-Requested-With, Cookie',
  },
  { key: 'Access-Control-Allow-Credentials', value: 'true' },
  {
    key: 'Cache-Control',
    value: 'no-store, no-cache, must-revalidate, max-age=0',
  },
  {
    key: 'Content-Security-Policy',
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
  },
];

// Headers pour assets statiques
const getStaticAssetHeaders = () => [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
  { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
];

// Headers pour signatures Cloudinary
const getCloudinaryHeaders = () => [
  ...getSecurityHeaders(),
  { key: 'Access-Control-Allow-Origin', value: SITE_URL },
  { key: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
  {
    key: 'Cache-Control',
    value: 'no-store, no-cache, must-revalidate, max-age=0',
  },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  {
    key: 'Content-Security-Policy',
    value:
      "script-src https://upload-widget.cloudinary.com; connect-src 'self' https://api.cloudinary.com https://upload-widget.cloudinary.com",
  },
];

// ===== CONFIGURATION PRINCIPALE =====
const nextConfig = {
  // Désactiver header Next.js
  poweredByHeader: false,

  // Configuration images Cloudinary
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Utiliser Turbopack (recommandé Next.js 15.5+)
  // Activer avec: npm run dev -- --turbopack
  // Note: Webpack sera utilisé si pas de flag --turbopack

  // Configuration Headers HTTP
  async headers() {
    return [
      // ===== 1. ROUTES BETTER AUTH (Priorité Haute) =====
      {
        source: '/api/auth/callback/credentials',
        headers: getAuthHeaders(),
      },
      {
        source: '/api/auth/session',
        headers: getAuthHeaders(),
      },
      {
        source: '/api/auth/:path*',
        headers: getAuthHeaders(),
      },

      // ===== 2. INSCRIPTION =====
      {
        source: '/api/register',
        headers: [
          ...getMutationHeaders(),
          { key: 'X-Data-Sensitivity', value: 'high' },
          { key: 'X-PII-Processing', value: 'true' },
        ],
      },

      // ===== 3. MUTATIONS DASHBOARD - CORRIGÉ =====
      // Pattern 1: Actions "add"
      {
        source:
          '/api/dashboard/:entity(templates|applications|platforms|blog)/add',
        headers: getMutationHeaders(),
      },
      // Pattern 2: Actions "edit"
      {
        source:
          '/api/dashboard/:entity(templates|applications|platforms|blog)/:id/edit',
        headers: getMutationHeaders(),
      },
      // Pattern 3: Actions "delete"
      {
        source:
          '/api/dashboard/:entity(templates|applications|platforms|blog)/:id/delete',
        headers: getMutationHeaders(),
      },

      // ===== 4. SIGNATURES CLOUDINARY =====
      {
        source:
          '/api/dashboard/:entity(templates|applications|blog)/add/sign-image',
        headers: getCloudinaryHeaders(),
      },

      // ===== 5. ASSETS STATIQUES =====
      {
        source: '/_next/static/:path*',
        headers: getStaticAssetHeaders(),
      },
      {
        source: '/:path*\\.(woff|woff2|eot|ttf|otf)',
        headers: [
          ...getStaticAssetHeaders(),
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/:path*\\.(jpg|jpeg|png|gif|webp|svg|ico)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=3600',
          },
        ],
      },
    ];
  },

  // Output standalone pour déploiement (production uniquement)
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,

  // Logging optimisé
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },
};

// ===== CONFIGURATION SENTRY (Simplifiée) =====
const sentryOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Options essentielles uniquement
  silent: process.env.NODE_ENV === 'production',
  hideSourceMaps: true,
  widenClientFileUpload: true,

  // Désactiver en dev ou si pas de token
  dryRun:
    process.env.NODE_ENV !== 'production' || !process.env.SENTRY_AUTH_TOKEN,
};

// ===== EXPORT AVEC SENTRY =====
export default withSentryConfig(nextConfig, sentryOptions);

// ============================================================================
// NOTES DE CORRECTION - VERCEL DEPLOYMENT FIX
// ============================================================================
//
// PROBLÈME RÉSOLU:
// - Pattern complexe avec groupes de capture imbriqués non supporté par Next.js
// - Ancien: `:action(add|[^/]+/(edit|delete))` ❌
// - Cause: Groupe `(edit|delete)` imbriqué dans `[^/]+/`
//
// SOLUTION APPLIQUÉE:
// - Séparation en 3 patterns simples au lieu d'1 pattern complexe
// - Pattern 1: `/api/dashboard/:entity/add` ✅
// - Pattern 2: `/api/dashboard/:entity/:id/edit` ✅
// - Pattern 3: `/api/dashboard/:entity/:id/delete` ✅
//
// COUVERTURE IDENTIQUE:
// - Avant: 1 pattern couvrait add, edit, delete
// - Après: 3 patterns couvrent add, edit, delete
// - Même fonctionnalité, compatible Vercel ✅
//
// ROUTES COUVERTES:
// ✅ /api/dashboard/templates/add
// ✅ /api/dashboard/templates/123/edit
// ✅ /api/dashboard/templates/123/delete
// ✅ /api/dashboard/applications/add
// ✅ /api/dashboard/applications/456/edit
// ✅ /api/dashboard/applications/456/delete
// ✅ /api/dashboard/platforms/add
// ✅ /api/dashboard/platforms/789/edit
// ✅ /api/dashboard/platforms/789/delete
// ✅ /api/dashboard/blog/add
// ✅ /api/dashboard/blog/abc/edit
// ✅ /api/dashboard/blog/abc/delete
//
// ============================================================================
