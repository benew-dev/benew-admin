// ============================================================================
// INSTRUMENTATION NEXT.JS 15 + SENTRY 10.29.0
// ============================================================================
// Application: Admin Dashboard (5 utilisateurs/jour)
// Optimisé: Décembre 2025
// ============================================================================

export async function register() {
  // Import configuration serveur Node.js uniquement
  // Edge runtime supprimé car non utilisé dans une app admin classique
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
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
// CHANGEMENTS vs ancienne version:
// - Edge config supprimée (250 lignes dupliquées inutiles)
// - Garde uniquement Node.js runtime pour app admin standard
//
// Edge runtime est nécessaire UNIQUEMENT si vous utilisez:
// - Vercel Edge Functions
// - Cloudflare Workers
// - Edge Middleware avec logique complexe
//
// Pour une app admin avec 5 users/jour = Non nécessaire
//
// ============================================================================
