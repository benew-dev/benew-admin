// app/dashboard/channel/add/page.jsx
import AddVideo from '@/ui/pages/channel/AddVideo';
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
 * Récupérer les applications actives (pour lier une vidéo à une app)
 */
async function getApplicationsFromDatabase() {
  let client;
  const startTime = Date.now();

  try {
    client = await getClient();

    const query = `
      SELECT
        application_id,
        application_name,
        application_category
      FROM catalog.applications
      WHERE is_active = true
      ORDER BY application_name ASC
    `;

    const result = await client.query(query);

    if (!result || !Array.isArray(result.rows)) {
      await client.cleanup();
      return [];
    }

    const applications = result.rows.map((app) => ({
      application_id: app.application_id,
      application_name: app.application_name || '[No Name]',
      application_category: app.application_category || 'web',
    }));

    const responseTime = Date.now() - startTime;

    logger.info('Applications fetched for add video', {
      count: applications.length,
      durationMs: responseTime,
    });

    trackDatabase('applications_fetched_for_add_video', {
      count: applications.length,
      durationMs: responseTime,
    });

    await client.cleanup();
    return applications;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Error fetching applications for add video', {
      error: error.message,
      durationMs: responseTime,
    });

    trackDatabaseError(error, 'applications_fetch_add_video', {
      durationMs: responseTime,
    });

    if (client) await client.cleanup();
    return [];
  }
}

/**
 * Récupérer les templates actifs (pour lier une vidéo à un template)
 */
async function getTemplatesFromDatabase() {
  let client;
  const startTime = Date.now();

  try {
    client = await getClient();

    const query = `
      SELECT
        template_id,
        template_name
      FROM catalog.templates
      WHERE is_active = true
      ORDER BY template_name ASC
    `;

    const result = await client.query(query);

    if (!result || !Array.isArray(result.rows)) {
      await client.cleanup();
      return [];
    }

    const templates = result.rows.map((t) => ({
      template_id: t.template_id,
      template_name: t.template_name || '[No Name]',
    }));

    const responseTime = Date.now() - startTime;

    logger.info('Templates fetched for add video', {
      count: templates.length,
      durationMs: responseTime,
    });

    trackDatabase('templates_fetched_for_add_video', {
      count: templates.length,
      durationMs: responseTime,
    });

    await client.cleanup();
    return templates;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Error fetching templates for add video', {
      error: error.message,
      durationMs: responseTime,
    });

    trackDatabaseError(error, 'templates_fetch_add_video', {
      durationMs: responseTime,
    });

    if (client) await client.cleanup();
    return [];
  }
}

/**
 * Server Component - Page Add Video
 */
export default async function AddVideoPage() {
  try {
    // Vérification session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      trackAuth('unauthenticated_add_video_access', {}, 'warning');
      redirect('/login');
    }

    // Récupération des données en parallèle
    const [applications, templates] = await Promise.all([
      getApplicationsFromDatabase(),
      getTemplatesFromDatabase(),
    ]);

    logger.info('Add video page rendered', {
      applicationsCount: applications.length,
      templatesCount: templates.length,
      userId: session.user.id,
    });

    return <AddVideo applications={applications} templates={templates} />;
  } catch (error) {
    logger.error('Add video page error', {
      error: error.message,
    });

    trackDatabaseError(error, 'add_video_page_render');

    // Fallback avec données vides
    return <AddVideo applications={[]} templates={[]} />;
  }
}

export const metadata = {
  title: 'Add Video | Benew Admin',
  robots: 'noindex, nofollow',
};
