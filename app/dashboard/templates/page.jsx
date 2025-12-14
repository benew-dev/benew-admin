// app/dashboard/templates/page.jsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { query } from '@/backend/dbConnect';
import { auth } from '@/lib/auth';
import ListTemplates from '@/ui/pages/templates/ListTemplates';
import logger from '@/utils/logger';
import {
  trackDatabase,
  trackDatabaseError,
  trackAuth,
} from '@/utils/monitoring';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Templates | Benew Admin',
  description: 'Gérer les templates disponibles',
  robots: 'noindex, nofollow',
};

async function getTemplates() {
  const startTime = Date.now();

  try {
    const result = await query(`
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
      ORDER BY template_added DESC
    `);

    const duration = Date.now() - startTime;

    logger.info('Templates fetched successfully', {
      count: result.rows.length,
      durationMs: duration,
      component: 'templates_page',
    });

    trackDatabase('templates_fetched', {
      count: result.rows.length,
      durationMs: duration,
    });

    return result.rows.map((template) => ({
      template_id: template.template_id,
      template_name: template.template_name || '[No Name]',
      template_images: template.template_images || [],
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

    trackDatabaseError(error, 'templates_fetch', {
      durationMs: duration,
      postgresCode: error.code,
    });

    return [];
  }
}

async function checkAuth() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      logger.warn('Unauthenticated access attempt to templates page', {
        component: 'templates_page',
      });

      trackAuth(
        'unauthenticated_access_attempt',
        {
          page: 'templates',
        },
        'warning',
      );

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

    trackDatabaseError(error, 'auth_check');

    return null;
  }
}

export default async function TemplatesPage() {
  try {
    const session = await checkAuth();

    if (!session) {
      redirect('/login');
    }

    const templates = await getTemplates();

    logger.info('Templates page rendering', {
      templateCount: templates.length,
      userId: session.user.id,
      component: 'templates_page',
    });

    return <ListTemplates data={templates} />;
  } catch (error) {
    if (error.message?.includes('NEXT_REDIRECT')) {
      throw error;
    }

    logger.error('Templates page error', {
      error: error.message,
      component: 'templates_page',
    });

    trackDatabaseError(error, 'page_render', {
      critical: 'true',
    });

    return <ListTemplates data={[]} />;
  }
}
