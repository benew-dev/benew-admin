// ============================================================================
// INSTRUMENTATION NEXT.JS 15 + SENTRY 10.29.0 - VERSION CORRIGÉE
// ============================================================================
// Application: Admin Dashboard (5 utilisateurs/jour)
// Optimisé: Décembre 2025
// FIX: Import Sentry correct pour captureRequestError
// ============================================================================

import * as Sentry from '@sentry/nextjs';

/**
 * Register hook - Charge la config Sentry serveur
 */
export async function register() {
  // Import configuration serveur Node.js uniquement
  // Edge runtime supprimé car non utilisé dans une app admin classique
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  // Note: Edge runtime configuration supprimée
  // Décommenter si vous utilisez Edge Middleware/Functions:
  // if (process.env.NEXT_RUNTIME === 'edge') {
  //   await import('./sentry.edge.config');
  // }
}

// ============================================================================
// NOTES
// ============================================================================
//
// CHANGEMENTS vs version buggée:
// - ✅ Import Sentry ajouté en ligne 8
// - ✅ captureRequestError fonctionne maintenant
//
// Edge runtime est nécessaire UNIQUEMENT si vous utilisez:
// - Vercel Edge Functions
// - Cloudflare Workers
// - Edge Middleware avec logique complexe
//
// Pour une app admin avec 5 users/jour = Non nécessaire
//
// ============================================================================

/**
 * Hook Next.js 15 - Capture des erreurs de requête serveur
 * ✅ FIX: Import Sentry maintenant présent en ligne 8
 */
export const onRequestError = Sentry.captureRequestError;
