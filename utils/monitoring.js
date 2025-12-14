// utils/monitoring.js
/**
 * CENTRALIZED SENTRY MONITORING - Benew Admin
 *
 * Wrapper simplifié autour de Sentry pour:
 * - Cohérence des breadcrumbs et tags
 * - Faciliter la maintenance
 * - Possibilité de changer de provider facilement
 * - Meilleure lisibilité du code
 *
 * Usage:
 * ```javascript
 * import { trackAuth, trackError, trackDatabase } from '@/utils/monitoring';
 *
 * trackAuth('login_started', { email: sanitizedEmail });
 * trackError(error, 'login', 'validation');
 * trackDatabase('templates_fetched', { count: 10 });
 * ```
 */

import * as Sentry from '@sentry/nextjs';

// ===== TYPES DE NIVEAUX =====
const LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  FATAL: 'fatal',
};

// ===== CATÉGORIES DE BREADCRUMBS =====
const CATEGORIES = {
  AUTH: 'auth',
  DATABASE: 'database',
  API: 'api',
  UI: 'ui',
  UPLOAD: 'upload',
  VALIDATION: 'validation',
  FORM: 'form',
  NAVIGATION: 'navigation',
};

// ===== HELPERS GÉNÉRIQUES =====

/**
 * Ajouter un breadcrumb Sentry
 * @param {string} category - Catégorie du breadcrumb
 * @param {string} message - Message descriptif
 * @param {string} level - Niveau (debug, info, warning, error)
 * @param {Object} data - Données additionnelles
 */
export const trackBreadcrumb = (
  category,
  message,
  level = LEVELS.INFO,
  data = {},
) => {
  Sentry.addBreadcrumb({
    category,
    message,
    level,
    data,
    timestamp: Date.now() / 1000, // Sentry format
  });
};

/**
 * Capturer une erreur avec contexte
 * @param {Error} error - L'erreur à capturer
 * @param {string} component - Nom du composant/route
 * @param {string} action - Action qui a causé l'erreur
 * @param {Object} extra - Données extra
 * @param {string} level - Niveau de sévérité
 */
export const trackError = (
  error,
  component,
  action = 'unknown',
  extra = {},
  level = LEVELS.ERROR,
) => {
  Sentry.withScope((scope) => {
    // Tags pour filtrage dans Sentry
    scope.setTag('component', component);
    scope.setTag('action', action);
    scope.setLevel(level);

    // Context additionnel
    if (Object.keys(extra).length > 0) {
      scope.setContext('additional_info', extra);
    }

    // Capturer l'exception
    Sentry.captureException(error);
  });
};

/**
 * Capturer un message informatif
 * @param {string} message - Message à capturer
 * @param {string} component - Nom du composant
 * @param {Object} context - Contexte additionnel
 * @param {string} level - Niveau
 */
export const trackMessage = (
  message,
  component,
  context = {},
  level = LEVELS.INFO,
) => {
  Sentry.withScope((scope) => {
    scope.setTag('component', component);
    scope.setLevel(level);

    if (Object.keys(context).length > 0) {
      scope.setContext('message_context', context);
    }

    Sentry.captureMessage(message);
  });
};

// ===== HELPERS SPÉCIFIQUES PAR DOMAINE =====

/**
 * Tracker événements d'authentification
 * @param {string} action - Action (login_started, login_success, etc.)
 * @param {Object} data - Données (sans informations sensibles)
 * @param {string} level - Niveau
 */
export const trackAuth = (action, data = {}, level = LEVELS.INFO) => {
  trackBreadcrumb(CATEGORIES.AUTH, `Auth: ${action}`, level, data);
};

/**
 * Tracker événements de base de données
 * @param {string} action - Action (query_executed, fetch_success, etc.)
 * @param {Object} data - Données (count, durationMs, etc.)
 * @param {string} level - Niveau
 */
export const trackDatabase = (action, data = {}, level = LEVELS.INFO) => {
  trackBreadcrumb(CATEGORIES.DATABASE, `Database: ${action}`, level, data);
};

/**
 * Tracker appels API
 * @param {string} action - Action (request_sent, response_received, etc.)
 * @param {Object} data - Données (url, method, status, etc.)
 * @param {string} level - Niveau
 */
export const trackAPI = (action, data = {}, level = LEVELS.INFO) => {
  trackBreadcrumb(CATEGORIES.API, `API: ${action}`, level, data);
};

/**
 * Tracker événements UI
 * @param {string} action - Action (button_clicked, modal_opened, etc.)
 * @param {Object} data - Données
 * @param {string} level - Niveau
 */
export const trackUI = (action, data = {}, level = LEVELS.INFO) => {
  trackBreadcrumb(CATEGORIES.UI, `UI: ${action}`, level, data);
};

/**
 * Tracker uploads de fichiers
 * @param {string} action - Action (upload_started, upload_success, etc.)
 * @param {Object} data - Données (fileId, size, etc.)
 * @param {string} level - Niveau
 */
export const trackUpload = (action, data = {}, level = LEVELS.INFO) => {
  trackBreadcrumb(CATEGORIES.UPLOAD, `Upload: ${action}`, level, data);
};

/**
 * Tracker validations de formulaires
 * @param {string} action - Action (validation_started, validation_failed, etc.)
 * @param {Object} data - Données (errors, fieldCount, etc.)
 * @param {string} level - Niveau
 */
export const trackValidation = (action, data = {}, level = LEVELS.INFO) => {
  trackBreadcrumb(CATEGORIES.VALIDATION, `Validation: ${action}`, level, data);
};

/**
 * Tracker soumissions de formulaires
 * @param {string} action - Action (form_submitted, form_success, etc.)
 * @param {Object} data - Données
 * @param {string} level - Niveau
 */
export const trackForm = (action, data = {}, level = LEVELS.INFO) => {
  trackBreadcrumb(CATEGORIES.FORM, `Form: ${action}`, level, data);
};

/**
 * Tracker navigation
 * @param {string} action - Action (page_visited, navigation_started, etc.)
 * @param {Object} data - Données (path, query, etc.)
 * @param {string} level - Niveau
 */
export const trackNavigation = (action, data = {}, level = LEVELS.INFO) => {
  trackBreadcrumb(CATEGORIES.NAVIGATION, `Navigation: ${action}`, level, data);
};

// ===== HELPERS POUR ERREURS SPÉCIFIQUES =====

/**
 * Tracker erreur d'authentification
 * @param {Error} error - L'erreur
 * @param {string} action - Action (login, register, etc.)
 * @param {Object} extra - Données extra
 */
export const trackAuthError = (error, action, extra = {}) => {
  trackError(error, 'auth', action, extra, LEVELS.ERROR);
};

/**
 * Tracker erreur de base de données
 * @param {Error} error - L'erreur
 * @param {string} action - Action (query, connection, etc.)
 * @param {Object} extra - Données extra
 */
export const trackDatabaseError = (error, action, extra = {}) => {
  trackError(error, 'database', action, extra, LEVELS.ERROR);
};

/**
 * Tracker erreur API
 * @param {Error} error - L'erreur
 * @param {string} endpoint - Endpoint appelé
 * @param {Object} extra - Données extra
 */
export const trackAPIError = (error, endpoint, extra = {}) => {
  trackError(error, 'api', endpoint, extra, LEVELS.ERROR);
};

/**
 * Tracker erreur de validation
 * @param {Error} error - L'erreur
 * @param {string} formName - Nom du formulaire
 * @param {Object} extra - Données extra (errors object)
 */
export const trackValidationError = (error, formName, extra = {}) => {
  trackError(error, 'validation', formName, extra, LEVELS.WARNING);
};

/**
 * Tracker erreur d'upload
 * @param {Error} error - L'erreur
 * @param {string} action - Action (cloudinary, signature, etc.)
 * @param {Object} extra - Données extra
 */
export const trackUploadError = (error, action, extra = {}) => {
  trackError(error, 'upload', action, extra, LEVELS.ERROR);
};

// ===== HELPERS POUR PERFORMANCE =====

/**
 * Tracker performance d'une opération
 * @param {string} operation - Nom de l'opération
 * @param {number} durationMs - Durée en millisecondes
 * @param {Object} data - Données additionnelles
 */
export const trackPerformance = (operation, durationMs, data = {}) => {
  const level = durationMs > 3000 ? LEVELS.WARNING : LEVELS.INFO;

  trackBreadcrumb('performance', `Performance: ${operation}`, level, {
    durationMs,
    slow: durationMs > 3000,
    ...data,
  });
};

// ===== EXPORTS NOMMÉS =====

export { LEVELS, CATEGORIES };

// ===== EXPORT PAR DÉFAUT =====

export default {
  // Génériques
  trackBreadcrumb,
  trackError,
  trackMessage,

  // Par domaine
  trackAuth,
  trackDatabase,
  trackAPI,
  trackUI,
  trackUpload,
  trackValidation,
  trackForm,
  trackNavigation,

  // Erreurs spécifiques
  trackAuthError,
  trackDatabaseError,
  trackAPIError,
  trackValidationError,
  trackUploadError,

  // Performance
  trackPerformance,

  // Constantes
  LEVELS,
  CATEGORIES,
};

/**
 * ============================================================================
 * EXEMPLES D'UTILISATION
 * ============================================================================
 *
 * // 1. Routes API
 * import { trackDatabase, trackDatabaseError, trackAPI } from '@/utils/monitoring';
 *
 * trackDatabase('templates_fetch_started');
 * try {
 *   const result = await query('SELECT * FROM templates');
 *   trackDatabase('templates_fetched', { count: result.rows.length });
 * } catch (error) {
 *   trackDatabaseError(error, 'templates_fetch', { query: 'SELECT templates' });
 * }
 *
 * // 2. Client Components
 * import { trackAuth, trackAuthError, trackForm } from '@/utils/monitoring';
 *
 * trackAuth('login_attempt_started');
 * const { data, error } = await signIn.email(...);
 * if (error) {
 *   trackAuthError(error, 'login', { status: error.status });
 * } else {
 *   trackAuth('login_success');
 * }
 *
 * // 3. Upload
 * import { trackUpload, trackUploadError } from '@/utils/monitoring';
 *
 * const handleUploadSuccess = (result) => {
 *   trackUpload('image_uploaded', { publicId: result.info.public_id });
 * };
 *
 * const handleUploadError = (error) => {
 *   trackUploadError(error, 'cloudinary_upload');
 * };
 *
 * // 4. Validation
 * import { trackValidation, trackValidationError } from '@/utils/monitoring';
 *
 * try {
 *   await schema.validate(data);
 *   trackValidation('validation_success', { fields: Object.keys(data) });
 * } catch (validationError) {
 *   trackValidationError(validationError, 'template_form', {
 *     errors: validationError.inner?.map(e => e.path)
 *   });
 * }
 *
 * // 5. Performance
 * import { trackPerformance } from '@/utils/monitoring';
 *
 * const startTime = Date.now();
 * await someSlowOperation();
 * trackPerformance('slow_operation', Date.now() - startTime, { itemCount: 100 });
 *
 * ============================================================================
 */
