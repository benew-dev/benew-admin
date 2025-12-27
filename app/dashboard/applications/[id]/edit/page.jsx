// app/dashboard/applications/[id]/edit/page.jsx - UPDATED WITH notFound()
import EditApplication from '@/ui/pages/applications/EditApplication';
import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getClient } from '@/backend/dbConnect';
import logger from '@/utils/logger';
import {
  trackAuth,
  trackDatabase,
  trackDatabaseError,
  trackValidation,
} from '@/utils/monitoring';
import {
  applicationIdSchema,
  cleanUUID,
} from '@/utils/schemas/applicationSchema';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

/**
 * Récupérer une application pour édition
 */
async function getApplicationForEditFromDatabase(applicationId) {
  let client;
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  logger.info('Fetching application for edit', { requestId, applicationId });

  try {
    // ===== 1. VALIDATION ID =====
    try {
      await applicationIdSchema.validate(
        { id: applicationId },
        { abortEarly: false },
      );
    } catch (validationError) {
      logger.warn('Invalid application ID for edit', {
        requestId,
        applicationId,
        errors: validationError.inner?.map((e) => e.path),
      });
      trackValidation(
        'invalid_application_id_edit',
        { applicationId },
        'warning',
      );
      // ✅ Retourne null pour déclencher notFound()
      return null;
    }

    // ===== 2. NETTOYAGE UUID =====
    const cleanedApplicationId = cleanUUID(applicationId);
    if (!cleanedApplicationId) {
      logger.warn('Application ID cleaning failed for edit', {
        requestId,
        applicationId,
      });
      // ✅ Retourne null pour déclencher notFound()
      return null;
    }

    // ===== 3. CONNEXION DB =====
    try {
      client = await getClient();
    } catch (dbConnectionError) {
      logger.error('DB connection failed during application fetch for edit', {
        error: dbConnectionError.message,
        requestId,
        applicationId: cleanedApplicationId,
      });
      trackDatabaseError(dbConnectionError, 'db_connection_edit_app', {
        requestId,
        applicationId: cleanedApplicationId,
      });
      // ✅ Erreur connexion DB → error.jsx (pas notFound)
      throw dbConnectionError;
    }

    // ===== 4. QUERY APPLICATION =====
    let result;
    try {
      const applicationQuery = `
        SELECT 
          application_id,
          application_name,
          application_link,
          application_admin_link,
          application_description,
          application_fee,
          application_rent,
          application_images,
          application_category,
          application_other_versions,
          application_level,
          created_at,
          sales_count,
          is_active,
          updated_at
        FROM catalog.applications 
        WHERE application_id = $1
      `;

      result = await client.query(applicationQuery, [cleanedApplicationId]);
    } catch (queryError) {
      logger.error('Query error fetching application for edit', {
        error: queryError.message,
        requestId,
        applicationId: cleanedApplicationId,
      });
      trackDatabaseError(queryError, 'query_application_for_edit', {
        requestId,
        applicationId: cleanedApplicationId,
      });
      await client.cleanup();
      // ✅ Erreur SQL → error.jsx (pas notFound)
      throw queryError;
    }

    // ===== 5. VÉRIFICATION RÉSULTAT =====
    if (result.rows.length === 0) {
      logger.warn('Application not found in database for edit', {
        requestId,
        applicationId: cleanedApplicationId,
      });
      trackDatabase(
        'application_not_found_edit',
        { applicationId: cleanedApplicationId },
        'warning',
      );
      await client.cleanup();
      // ✅ Application inexistante → notFound()
      return null;
    }

    // ===== 6. SANITIZATION =====
    const application = result.rows[0];
    const sanitizedApplication = {
      application_id: application.application_id,
      application_name: application.application_name || '',
      application_link: application.application_link || '',
      application_admin_link: application.application_admin_link || '',
      application_description: application.application_description || '',
      application_images: application.application_images || [],
      application_category: application.application_category || 'web',
      application_level: application.application_level || 1,
      application_other_versions: application.application_other_versions || [],
      application_fee: parseFloat(application.application_fee) || 0,
      application_rent: parseFloat(application.application_rent) || 0,
      created_at: application.created_at,
      sales_count: parseInt(application.sales_count) || 0,
      is_active: Boolean(application.is_active),
      updated_at: application.updated_at,
    };

    const responseTime = Date.now() - startTime;

    logger.info('Application fetched for edit successfully', {
      applicationId: cleanedApplicationId,
      name: sanitizedApplication.application_name,
      durationMs: responseTime,
      requestId,
    });

    trackDatabase('application_fetched_for_edit', {
      applicationId: cleanedApplicationId,
      durationMs: responseTime,
    });

    await client.cleanup();
    return sanitizedApplication;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Global error fetching application for edit', {
      error: error.message,
      applicationId,
      durationMs: responseTime,
      requestId,
    });

    trackDatabaseError(error, 'application_fetch_for_edit_global', {
      applicationId,
      durationMs: responseTime,
      requestId,
      critical: 'true',
    });

    if (client) await client.cleanup();
    // ✅ Erreur générale → error.jsx
    throw error;
  }
}

/**
 * Server Component - Page Edit Application
 */
export default async function EditApplicationPage({ params }) {
  try {
    // ===== 1. RÉCUPÉRATION ID =====
    const { id } = await params;

    // ===== 2. VÉRIFICATION AUTH =====
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      logger.warn('Unauthenticated access to edit application');
      trackAuth('unauthenticated_edit_application_access', {}, 'warning');
      redirect('/login');
    }

    // ===== 3. RÉCUPÉRATION APPLICATION =====
    const application = await getApplicationForEditFromDatabase(id);

    // ✅ Si null → déclencher not-found.jsx
    if (!application) {
      logger.info('Application not found for edit, triggering notFound()', {
        applicationId: id,
        userId: session.user.id,
      });
      notFound();
    }

    // ===== 4. RENDER =====
    logger.info('Edit application page rendered', {
      applicationId: application.application_id,
      applicationName: application.application_name,
      userId: session.user.id,
    });

    return <EditApplication application={application} />;
  } catch (error) {
    // ✅ Gestion des redirects Next.js
    if (
      error.message?.includes('NEXT_REDIRECT') ||
      error.message?.includes('NEXT_NOT_FOUND')
    ) {
      throw error;
    }

    // ✅ Toute autre erreur → error.jsx
    logger.error('Edit application page error', {
      error: error.message,
      stack: error.stack,
    });

    trackDatabaseError(error, 'edit_application_page_render', {
      critical: 'true',
    });

    // Re-throw pour déclencher error.jsx
    throw error;
  }
}

export const metadata = {
  title: 'Edit Application | Benew Admin',
  robots: 'noindex, nofollow',
};
