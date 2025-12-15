// app/dashboard/applications/add/page.jsx
import AddApplication from '@/ui/pages/applications/AddApplication';
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
 * Récupérer les templates actifs depuis la base de données
 */
async function getTemplatesFromDatabase() {
  let client;
  const startTime = Date.now();

  try {
    client = await getClient();

    const templatesQuery = `
      SELECT 
        template_id, 
        template_name, 
        template_images, 
        template_has_web, 
        template_has_mobile,
        created_at,
        is_active
      FROM catalog.templates 
      WHERE is_active = true
      ORDER BY template_name ASC, created_at DESC
    `;

    const result = await client.query(templatesQuery);

    if (!result || !Array.isArray(result.rows)) {
      logger.warn('Invalid data structure from templates query');
      await client.cleanup();
      return [];
    }

    const templates = result.rows.map((template) => ({
      template_id: template.template_id,
      template_name: template.template_name || '[No Name]',
      template_images: template.template_images || [],
      template_has_web: Boolean(template.template_has_web),
      template_has_mobile: Boolean(template.template_has_mobile),
      created_at: template.created_at,
      is_active: Boolean(template.is_active),
    }));

    const responseTime = Date.now() - startTime;

    logger.info('Templates fetched successfully', {
      count: templates.length,
      durationMs: responseTime,
    });

    trackDatabase('templates_fetched_for_add_application', {
      count: templates.length,
      durationMs: responseTime,
    });

    await client.cleanup();
    return templates;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Error fetching templates', {
      error: error.message,
      durationMs: responseTime,
    });

    trackDatabaseError(error, 'templates_fetch_add_application', {
      durationMs: responseTime,
    });

    if (client) await client.cleanup();
    return [];
  }
}

/**
 * Server Component - Page Add Application
 */
export default async function AddApplicationPage() {
  try {
    // Vérification session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      trackAuth('unauthenticated_add_application_access', {}, 'warning');
      redirect('/login');
    }

    // Récupération des templates
    const templates = await getTemplatesFromDatabase();

    logger.info('Add application page rendered', {
      templatesCount: templates.length,
      userId: session.user.id,
    });

    return <AddApplication templates={templates} />;
  } catch (error) {
    logger.error('Add application page error', {
      error: error.message,
    });

    trackDatabaseError(error, 'add_application_page_render');

    // Fallback avec templates vides
    return <AddApplication templates={[]} />;
  }
}

export const metadata = {
  title: 'Add Application | Benew Admin',
  robots: 'noindex, nofollow',
};
