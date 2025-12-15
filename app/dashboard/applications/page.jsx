// app/dashboard/applications/page.jsx
import ApplicationsList from '@/ui/pages/applications/ApplicationsList';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getClient } from '@/backend/dbConnect';
import logger from '@/utils/logger';
import {
  trackAuth,
  trackDatabase,
  trackDatabaseError,
} from '@/utils/monitoring';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

/**
 * Récupérer les applications depuis la base de données
 */
async function getApplicationsFromDatabase() {
  let client;
  const startTime = Date.now();

  try {
    client = await getClient();

    const applicationsQuery = `
      SELECT 
        application_id, 
        application_name, 
        application_images,
        application_category, 
        application_fee, 
        application_rent, 
        application_link, 
        application_level,
        is_active,
        created_at,
        sales_count,
        updated_at
      FROM catalog.applications
      ORDER BY created_at DESC
    `;

    const result = await client.query(applicationsQuery);

    if (!result || !Array.isArray(result.rows)) {
      logger.warn('Invalid data structure from applications query');
      await client.cleanup();
      return [];
    }

    const applications = result.rows.map((app) => ({
      application_id: app.application_id,
      application_name: app.application_name || '[No Name]',
      application_images: app.application_images || [],
      application_category: app.application_category || 'web',
      application_fee: parseFloat(app.application_fee) || 0,
      application_rent: parseFloat(app.application_rent) || 0,
      application_link: app.application_link,
      application_level: app.application_level || 1,
      is_active: Boolean(app.is_active),
      sales_count: parseInt(app.sales_count) || 0,
      created_at: app.created_at,
      updated_at: app.updated_at,
    }));

    const responseTime = Date.now() - startTime;

    logger.info('Applications fetched successfully', {
      count: applications.length,
      durationMs: responseTime,
    });

    trackDatabase('applications_fetched', {
      count: applications.length,
      durationMs: responseTime,
    });

    await client.cleanup();
    return applications;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Error fetching applications', {
      error: error.message,
      durationMs: responseTime,
    });

    trackDatabaseError(error, 'applications_fetch', {
      durationMs: responseTime,
    });

    if (client) await client.cleanup();
    return [];
  }
}

/**
 * Server Component - Page Applications
 */
export default async function ApplicationsPage() {
  try {
    // Vérification session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      trackAuth('unauthenticated_applications_access', {}, 'warning');
      redirect('/login');
    }

    // Récupération des applications
    const applications = await getApplicationsFromDatabase();

    logger.info('Applications page rendered', {
      count: applications.length,
      userId: session.user.id,
    });

    return <ApplicationsList data={applications} />;
  } catch (error) {
    logger.error('Applications page error', {
      error: error.message,
    });

    trackDatabaseError(error, 'applications_page_render');

    // Fallback avec données vides
    return <ApplicationsList data={[]} />;
  }
}

export const metadata = {
  title: 'Applications | Benew Admin',
  robots: 'noindex, nofollow',
};
