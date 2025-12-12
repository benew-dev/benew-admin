// utils/logger.js - VERSION SIMPLE (Console.log wrapper)
/**
 * SIMPLE LOGGER - Zero dependencies, Vercel compatible
 *
 * Pour application admin avec 5 utilisateurs/jour :
 * - ✅ Pas de dépendances externes
 * - ✅ Logs capturés automatiquement par Vercel
 * - ✅ Zero problèmes de build
 * - ✅ Parfaitement suffisant pour trafic faible
 * - ✅ Compatible Sentry (qui capture déjà les logs)
 *
 * Vercel capture automatiquement tous les console.* :
 * - console.log → Niveau INFO dans Vercel Dashboard
 * - console.warn → Niveau WARNING
 * - console.error → Niveau ERROR
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Helper pour formatter les logs en production
const formatLog = (level, message, meta = {}) => {
  if (isProduction) {
    // JSON structuré pour Vercel/Sentry
    return JSON.stringify({
      level,
      message,
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
      ...meta,
    });
  }

  // Format lisible en développement
  return `[${level.toUpperCase()}] ${message}${
    Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : ''
  }`;
};

const logger = {
  /**
   * Log niveau DEBUG (développement uniquement)
   */
  debug: (message, meta = {}) => {
    if (isDevelopment) {
      console.log(formatLog('debug', message, meta));
    }
  },

  /**
   * Log niveau INFO (informations générales)
   */
  info: (message, meta = {}) => {
    console.log(formatLog('info', message, meta));
  },

  /**
   * Log niveau WARN (avertissements non critiques)
   */
  warn: (message, meta = {}) => {
    console.warn(formatLog('warn', message, meta));
  },

  /**
   * Log niveau ERROR (erreurs critiques)
   */
  error: (message, meta = {}) => {
    console.error(formatLog('error', message, meta));
  },
};

export default logger;

/**
 * UTILISATION:
 *
 * import logger from '@/utils/logger';
 *
 * // Logs simples
 * logger.info('User logged in', { userId: 123, email: 'user@example.com' });
 * logger.error('Database error', { error: err.message, query: 'SELECT *' });
 * logger.warn('Rate limit approaching', { currentCount: 95, limit: 100 });
 *
 * // Development only
 * logger.debug('Request details', { headers: req.headers });
 *
 * VISUALISATION VERCEL:
 * 1. Va dans ton projet Vercel Dashboard
 * 2. Onglet "Logs" ou "Functions"
 * 3. Tous les console.* sont capturés automatiquement
 * 4. Filtres disponibles : INFO, WARNING, ERROR
 *
 * INTÉGRATION SENTRY:
 * - Sentry capture automatiquement console.error()
 * - Pas besoin de configuration supplémentaire
 * - Les meta sont inclus dans le context Sentry
 */
