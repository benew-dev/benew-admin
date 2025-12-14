// app/dashboard/templates/page.jsx
// ============================================================================
// TEMPLATES PAGE - Server Component
// ============================================================================
// Application: Admin Dashboard (5 utilisateurs/jour)
// Optimisé: Décembre 2025
// Philosophie: Simple, sécurisé, performant
// ============================================================================

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { query } from '@/backend/dbConnect';
import { auth } from '@/lib/auth';
import ListTemplates from '@/ui/pages/templates/ListTemplates';
import logger from '@/utils/logger';
import * as Sentry from '@sentry/nextjs';

// ===== CONFIGURATION =====

// Revalidation : 0 = désactive le cache statique (toujours fresh data)
export const revalidate = 0;
export const dynamic = 'force-dynamic';

// Metadata
export const metadata = {
  title: 'Templates | Benew Admin',
  description: 'Gérer les templates disponibles',
  robots: 'noindex, nofollow',
};

// ===== HELPER FUNCTIONS =====

/**
 * Récupère les templates depuis PostgreSQL
 * @returns {Promise<Array>} Liste des templates ou []
 */
async function getTemplates() {
  const startTime = Date.now();

  try {
    // Query optimisée : SELECT uniquement les colonnes nécessaires
    const result = await query(`
      SELECT 
        template_id,
        template_name,
        template_image,
        template_has_web,
        template_has_mobile,
        template_added,
        sales_count,
        is_active,
        updated_at
      FROM catalog.templates
      ORDER BY template_added DESC
    `);

    const duration = Date.now() - startTime;

    logger.info('Templates fetched successfully', {
      count: result.rows.length,
      durationMs: duration,
      component: 'templates_page',
    });

    // Breadcrumb Sentry pour debugging
    Sentry.addBreadcrumb({
      category: 'database',
      message: 'Templates fetched',
      level: 'info',
      data: {
        count: result.rows.length,
        durationMs: duration,
      },
    });

    // Sanitize data (sécurité défensive)
    return result.rows.map((template) => ({
      template_id: template.template_id,
      template_name: template.template_name || '[No Name]',
      template_image: template.template_image || null,
      template_has_web: Boolean(template.template_has_web),
      template_has_mobile: Boolean(template.template_has_mobile),
      template_added: template.template_added,
      sales_count: parseInt(template.sales_count, 10) || 0,
      is_active: Boolean(template.is_active),
      updated_at: template.updated_at,
    }));
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Failed to fetch templates', {
      error: error.message,
      durationMs: duration,
      component: 'templates_page',
      postgresCode: error.code,
    });

    // Capturer dans Sentry
    Sentry.captureException(error, {
      tags: {
        component: 'templates_page',
        action: 'fetch_templates',
        error_category: 'database',
      },
      extra: {
        durationMs: duration,
        postgresCode: error.code,
      },
    });

    // Retourner tableau vide plutôt que crash
    // L'utilisateur verra "No templates found"
    return [];
  }
}

/**
 * Vérifie l'authentification utilisateur
 * @returns {Promise<Object|null>} Session ou null
 */
async function checkAuth() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      logger.warn('Unauthenticated access attempt to templates page', {
        component: 'templates_page',
      });

      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Unauthenticated access attempt',
        level: 'warning',
      });

      return null;
    }

    logger.info('User authenticated for templates page', {
      userId: session.user.id,
      component: 'templates_page',
    });

    return session;
  } catch (error) {
    logger.error('Auth check failed', {
      error: error.message,
      component: 'templates_page',
    });

    Sentry.captureException(error, {
      tags: {
        component: 'templates_page',
        action: 'auth_check',
      },
    });

    return null;
  }
}

// ===== MAIN PAGE COMPONENT =====

/**
 * Templates Page - Server Component
 */
export default async function TemplatesPage() {
  try {
    // 1. Vérifier l'authentification
    const session = await checkAuth();

    if (!session) {
      redirect('/login');
    }

    // 2. Récupérer les templates
    const templates = await getTemplates();

    logger.info('Templates page rendering', {
      templateCount: templates.length,
      userId: session.user.id,
      component: 'templates_page',
    });

    // 3. Render
    return <ListTemplates data={templates} />;
  } catch (error) {
    // Gestion erreur globale (ex: redirect throws)
    if (error.message?.includes('NEXT_REDIRECT')) {
      throw error; // Laisser Next.js gérer la redirection
    }

    logger.error('Templates page error', {
      error: error.message,
      component: 'templates_page',
    });

    Sentry.captureException(error, {
      tags: {
        component: 'templates_page',
        action: 'page_render',
        critical: 'true',
      },
    });

    // Afficher page vide plutôt que crash
    return <ListTemplates data={[]} />;
  }
}
