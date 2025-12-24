// app/dashboard/templates/[id]/page.jsx - UPDATED WITH notFound()
import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getClient } from '@/backend/dbConnect';
import EditTemplate from '@/ui/pages/templates/EditTemplate';
import { templateIdSchema, cleanUUID } from '@/utils/schemas/templateSchema';
import logger from '@/utils/logger';
import {
  trackAuth,
  trackDatabase,
  trackDatabaseError,
  trackValidation,
} from '@/utils/monitoring';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Edit Template | Benew Admin',
  description: 'Edit template details',
  robots: 'noindex, nofollow',
};

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
      logger.warn('Unauthenticated access to edit template page');

      trackAuth(
        'unauthenticated_access',
        {
          page: 'edit_template',
        },
        'warning',
      );

      return null;
    }

    return session;
  } catch (error) {
    logger.error('Auth check failed', { error: error.message });

    trackDatabaseError(error, 'auth_check');

    return null;
  }
}

/**
 * Récupère un template depuis la base de données
 * @param {string} templateId - UUID du template
 * @returns {Promise<Object|null>} Template ou null si non trouvé
 */
async function getTemplateFromDatabase(templateId) {
  let client;
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  logger.info('Template fetch by ID started', {
    requestId,
    templateId,
  });

  trackDatabase('template_fetch_started', {
    requestId,
    templateId,
  });

  try {
    // ===== 1. VALIDATION ID =====
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

      trackValidation(
        'template_id_validation_failed',
        {
          providedId: templateId,
        },
        'warning',
      );

      // ✅ Retourne null pour déclencher notFound()
      return null;
    }

    // ===== 2. NETTOYAGE UUID =====
    const cleanedTemplateId = cleanUUID(templateId);
    if (!cleanedTemplateId) {
      logger.warn('Template ID cleaning failed', {
        requestId,
        providedId: templateId,
      });

      // ✅ Retourne null pour déclencher notFound()
      return null;
    }

    // ===== 3. CONNEXION DB =====
    try {
      client = await getClient();
    } catch (dbConnectionError) {
      logger.error('DB connection failed during template fetch', {
        error: dbConnectionError.message,
        requestId,
        templateId: cleanedTemplateId,
      });

      trackDatabaseError(dbConnectionError, 'db_connection', {
        requestId,
        templateId: cleanedTemplateId,
      });

      // ✅ Erreur connexion DB → error.jsx (pas notFound)
      throw dbConnectionError;
    }

    // ===== 4. QUERY TEMPLATE =====
    let result;
    try {
      const templateQuery = `
        SELECT 
          template_id,
          template_name,
          template_images,
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

      trackDatabaseError(queryError, 'query_failed', {
        requestId,
        templateId: cleanedTemplateId,
      });

      await client.cleanup();

      // ✅ Erreur SQL → error.jsx (pas notFound)
      throw queryError;
    }

    // ===== 5. VÉRIFICATION RÉSULTAT =====
    if (result.rows.length === 0) {
      logger.warn('Template not found in database', {
        requestId,
        templateId: cleanedTemplateId,
      });

      trackDatabase(
        'template_not_found',
        {
          templateId: cleanedTemplateId,
        },
        'warning',
      );

      await client.cleanup();

      // ✅ Template inexistant → notFound()
      return null;
    }

    // ===== 6. SANITIZATION =====
    const template = result.rows[0];
    const sanitizedTemplate = {
      template_id: template.template_id,
      template_name: template.template_name || '[No Name]',
      template_images: template.template_images || [],
      template_has_web: Boolean(template.template_has_web),
      template_has_mobile: Boolean(template.template_has_mobile),
      template_added: template.template_added,
      sales_count: parseInt(template.sales_count, 10) || 0,
      is_active: Boolean(template.is_active),
      updated_at: template.updated_at,
    };

    const responseTime = Date.now() - startTime;

    logger.info('Template fetch successful', {
      templateId: cleanedTemplateId,
      templateName: sanitizedTemplate.template_name,
      responseTimeMs: responseTime,
      requestId,
    });

    trackDatabase('template_fetch_completed', {
      templateId: cleanedTemplateId,
      templateName: sanitizedTemplate.template_name,
      responseTimeMs: responseTime,
    });

    await client.cleanup();

    return sanitizedTemplate;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Global template fetch error', {
      error: error.message,
      responseTimeMs: responseTime,
      requestId,
      templateId,
    });

    trackDatabaseError(error, 'template_fetch', {
      requestId,
      templateId,
      responseTimeMs: responseTime,
      critical: 'true',
    });

    if (client) await client.cleanup();

    // ✅ Erreur générale → error.jsx
    throw error;
  }
}

/**
 * Page de modification d'un template
 */
export default async function EditTemplatePage({ params }) {
  try {
    // ===== 1. RÉCUPÉRATION ID =====
    const { id } = await params;

    // ===== 2. VÉRIFICATION AUTH =====
    const session = await checkAuth();

    if (!session) {
      redirect('/login');
    }

    // ===== 3. RÉCUPÉRATION TEMPLATE =====
    const template = await getTemplateFromDatabase(id);

    // ✅ Si null → déclencher not-found.jsx
    if (!template) {
      logger.info('Template not found, triggering notFound()', {
        templateId: id,
        userId: session.user?.id,
      });

      notFound();
    }

    // ===== 4. RENDER =====
    logger.info('Template edit page rendering', {
      templateId: template.template_id,
      templateName: template.template_name,
      userId: session.user?.id,
    });

    return <EditTemplate template={template} />;
  } catch (error) {
    // ✅ Gestion des redirects Next.js
    if (
      error.message?.includes('NEXT_REDIRECT') ||
      error.message?.includes('NEXT_NOT_FOUND')
    ) {
      throw error;
    }

    // ✅ Toute autre erreur → error.jsx
    logger.error('Template edit page error', {
      error: error.message,
      stack: error.stack,
    });

    trackDatabaseError(error, 'page_render', {
      critical: 'true',
    });

    // Re-throw pour déclencher error.jsx
    throw error;
  }
}
