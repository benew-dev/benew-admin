// app/dashboard/templates/[id]/page.jsx
import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getClient } from '@/backend/dbConnect';
import EditTemplate from '@/ui/pages/templates/EditTemplate';
import { templateIdSchema, cleanUUID } from '@/utils/schemas/templateSchema';
import logger from '@/utils/logger';
import * as Sentry from '@sentry/nextjs';

// ===== CONFIGURATION =====
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Edit Template | Benew Admin',
  description: 'Edit template details',
  robots: 'noindex, nofollow',
};

// ===== HELPER FUNCTIONS =====

/**
 * Vérifie l'authentification utilisateur
 */
async function checkAuth() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      logger.warn('Unauthenticated access to edit template page');

      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Unauthenticated access to edit template',
        level: 'warning',
      });

      return null;
    }

    return session;
  } catch (error) {
    logger.error('Auth check failed', { error: error.message });

    Sentry.captureException(error, {
      tags: { component: 'edit_template_page', action: 'auth_check' },
    });

    return null;
  }
}

/**
 * Récupère un template depuis la base de données
 */
async function getTemplateFromDatabase(templateId) {
  let client;
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  logger.info('Template fetch by ID started', {
    requestId,
    templateId,
  });

  Sentry.addBreadcrumb({
    category: 'database',
    message: 'Get template by ID started',
    level: 'info',
    data: { requestId, templateId },
  });

  try {
    // 1. Validation ID avec Yup
    try {
      await templateIdSchema.validate(
        { id: templateId },
        { abortEarly: false },
      );
    } catch (validationError) {
      logger.warn('Template ID validation failed', {
        providedId: templateId,
        errors: validationError.inner?.map((e) => e.path),
        requestId,
      });

      Sentry.addBreadcrumb({
        category: 'validation',
        message: 'Template ID validation failed',
        level: 'warning',
        data: { providedId: templateId },
      });

      return null;
    }

    // 2. Nettoyer UUID
    const cleanedTemplateId = cleanUUID(templateId);
    if (!cleanedTemplateId) {
      logger.warn('Template ID cleaning failed', {
        requestId,
        providedId: templateId,
      });
      return null;
    }

    // 3. Connexion DB
    try {
      client = await getClient();
    } catch (dbConnectionError) {
      logger.error('DB connection failed during template fetch', {
        error: dbConnectionError.message,
        requestId,
        templateId: cleanedTemplateId,
      });

      Sentry.captureException(dbConnectionError, {
        tags: { component: 'edit_template_page', action: 'db_connection' },
        extra: { requestId, templateId: cleanedTemplateId },
      });

      return null;
    }

    // 4. Exécution requête (SANS template_color)
    let result;
    try {
      const templateQuery = `
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
        WHERE template_id = $1
      `;

      result = await client.query(templateQuery, [cleanedTemplateId]);
    } catch (queryError) {
      logger.error('Template fetch query error', {
        error: queryError.message,
        templateId: cleanedTemplateId,
        requestId,
      });

      Sentry.captureException(queryError, {
        tags: { component: 'edit_template_page', action: 'query_failed' },
        extra: { requestId, templateId: cleanedTemplateId },
      });

      await client.cleanup();
      return null;
    }

    // 5. Vérification existence
    if (result.rows.length === 0) {
      logger.warn('Template not found', {
        requestId,
        templateId: cleanedTemplateId,
      });

      Sentry.addBreadcrumb({
        category: 'database',
        message: 'Template not found',
        level: 'warning',
        data: { templateId: cleanedTemplateId },
      });

      await client.cleanup();
      return null;
    }

    // 6. Formatage données (SANS template_color)
    const template = result.rows[0];
    const sanitizedTemplate = {
      template_id: template.template_id,
      template_name: template.template_name || '[No Name]',
      template_image: template.template_image,
      template_has_web: Boolean(template.template_has_web),
      template_has_mobile: Boolean(template.template_has_mobile),
      template_added: template.template_added,
      sales_count: parseInt(template.sales_count) || 0,
      is_active: Boolean(template.is_active),
      updated_at: template.updated_at,
    };

    // 7. Succès
    const responseTime = Date.now() - startTime;

    logger.info('Template fetch successful', {
      templateId: cleanedTemplateId,
      templateName: sanitizedTemplate.template_name,
      responseTimeMs: responseTime,
      requestId,
    });

    Sentry.addBreadcrumb({
      category: 'database',
      message: 'Template fetch completed successfully',
      level: 'info',
      data: {
        templateId: cleanedTemplateId,
        templateName: sanitizedTemplate.template_name,
        responseTimeMs: responseTime,
      },
    });

    await client.cleanup();

    return sanitizedTemplate;
  } catch (error) {
    // Gestion globale des erreurs
    const responseTime = Date.now() - startTime;

    logger.error('Global template fetch error', {
      error: error.message,
      responseTimeMs: responseTime,
      requestId,
      templateId,
    });

    Sentry.captureException(error, {
      tags: { component: 'edit_template_page', critical: 'true' },
      extra: { requestId, templateId, responseTimeMs: responseTime },
    });

    if (client) await client.cleanup();

    return null;
  }
}

// ===== MAIN PAGE =====

export default async function EditTemplatePage({ params }) {
  try {
    // Attendre params (Next.js 15)
    const { id } = await params;

    // 1. Vérification auth
    const session = await checkAuth();

    if (!session) {
      redirect('/login');
    }

    // 2. Récupération template
    const template = await getTemplateFromDatabase(id);

    // 3. Vérification existence
    if (!template) {
      notFound();
    }

    // 4. Render
    logger.info('Template edit page rendering', {
      templateId: template.template_id,
      templateName: template.template_name,
      userId: session.user?.id,
    });

    return <EditTemplate template={template} />;
  } catch (error) {
    // Gestion redirect throws
    if (
      error.message?.includes('NEXT_REDIRECT') ||
      error.message?.includes('NEXT_NOT_FOUND')
    ) {
      throw error;
    }

    logger.error('Template edit page error', { error: error.message });

    Sentry.captureException(error, {
      tags: { component: 'edit_template_page', critical: 'true' },
    });

    notFound();
  }
}
