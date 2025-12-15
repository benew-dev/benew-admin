// app/dashboard/applications/[id]/edit/page.jsx
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

  try {
    // Validation de l'ID
    try {
      await applicationIdSchema.validate(
        { id: applicationId },
        { abortEarly: false },
      );
    } catch (validationError) {
      logger.warn('Invalid application ID for edit', {
        applicationId,
        error: validationError.message,
      });
      return null;
    }

    // Nettoyer l'UUID
    const cleanedApplicationId = cleanUUID(applicationId);
    if (!cleanedApplicationId) {
      logger.warn('Application ID cleaning failed', { applicationId });
      return null;
    }

    // Connexion DB
    client = await getClient();

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

    const result = await client.query(applicationQuery, [cleanedApplicationId]);

    if (result.rows.length === 0) {
      logger.warn('Application not found for edit', {
        applicationId: cleanedApplicationId,
      });
      await client.cleanup();
      return null;
    }

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

    logger.info('Application fetched for edit', {
      applicationId: cleanedApplicationId,
      name: sanitizedApplication.application_name,
      durationMs: responseTime,
    });

    trackDatabase('application_fetched_for_edit', {
      applicationId: cleanedApplicationId,
      durationMs: responseTime,
    });

    await client.cleanup();
    return sanitizedApplication;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Error fetching application for edit', {
      error: error.message,
      applicationId,
      durationMs: responseTime,
    });

    trackDatabaseError(error, 'application_fetch_for_edit', {
      applicationId,
      durationMs: responseTime,
    });

    if (client) await client.cleanup();
    return null;
  }
}

/**
 * Server Component - Page Edit Application
 */
export default async function EditApplicationPage({ params }) {
  try {
    // Attendre les paramètres (Next.js 15)
    const { id } = await params;

    // Vérification session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      trackAuth('unauthenticated_edit_application_access', {}, 'warning');
      redirect('/login');
    }

    // Récupération de l'application
    const application = await getApplicationForEditFromDatabase(id);

    if (!application) {
      notFound();
    }

    logger.info('Edit application page rendered', {
      applicationId: application.application_id,
      userId: session.user.id,
    });

    return <EditApplication application={application} />;
  } catch (error) {
    logger.error('Edit application page error', {
      error: error.message,
    });

    trackDatabaseError(error, 'edit_application_page_render');

    notFound();
  }
}

export const metadata = {
  title: 'Edit Application | Benew Admin',
  robots: 'noindex, nofollow',
};
