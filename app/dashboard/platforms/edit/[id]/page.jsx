// app/dashboard/platforms/edit/[id]/page.jsx
import EditPlatform from '@/ui/pages/platforms/EditPlatform';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getClient } from '@/backend/dbConnect';
import { redirect, notFound } from 'next/navigation';
import { platformIdSchema, cleanUUID } from '@/utils/schemas/platformSchema';
import logger from '@/utils/logger';
import {
  trackAuth,
  trackDatabase,
  trackDatabaseError,
  trackValidation,
} from '@/utils/monitoring';

export const dynamic = 'force-dynamic';

async function getPlatformForEdit(platformId) {
  let client;
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  logger.info('Fetching platform for edit', { requestId, platformId });

  try {
    // Validation ID
    try {
      await platformIdSchema.validate(
        { id: platformId },
        { abortEarly: false },
      );
      // eslint-disable-next-line no-unused-vars
    } catch (validationError) {
      logger.warn('Invalid platform ID', { requestId, platformId });
      trackValidation('invalid_platform_id_page', { platformId }, 'warning');
      return null;
    }

    const cleanedPlatformId = cleanUUID(platformId);
    if (!cleanedPlatformId) {
      logger.warn('Failed to clean platform ID', { requestId, platformId });
      return null;
    }

    // Connexion DB
    try {
      client = await getClient();
    } catch (dbError) {
      logger.error('DB connection failed', {
        error: dbError.message,
        requestId,
      });
      trackDatabaseError(dbError, 'db_connection_page', { requestId });
      return null;
    }

    // Requête SQL
    let result;
    try {
      const platformQuery = `
        SELECT 
          platform_id,
          platform_name,
          account_name,
          account_number,
          created_at,
          updated_at,
          is_active
        FROM admin.platforms 
        WHERE platform_id = $1
      `;

      result = await client.query(platformQuery, [cleanedPlatformId]);
    } catch (queryError) {
      logger.error('Query error', { error: queryError.message, requestId });
      trackDatabaseError(queryError, 'platform_fetch_edit', { requestId });
      await client.cleanup();
      return null;
    }

    // Vérifier existence
    if (result.rows.length === 0) {
      logger.warn('Platform not found', {
        requestId,
        platformId: cleanedPlatformId,
      });
      trackValidation('platform_not_found_page', {}, 'warning');
      await client.cleanup();
      return null;
    }

    const platform = result.rows[0];
    const responseTime = Date.now() - startTime;

    logger.info('Platform fetched successfully', {
      platformId: cleanedPlatformId,
      name: platform.platform_name,
      durationMs: responseTime,
      requestId,
    });

    trackDatabase('platform_fetched_for_edit', {
      platformId: cleanedPlatformId,
    });

    await client.cleanup();

    return {
      platform_id: platform.platform_id,
      platform_name: platform.platform_name || '[No Name]',
      account_name: platform.account_name || '[No Account Name]',
      account_number: platform.account_number || '[No Number]',
      created_at: platform.created_at,
      updated_at: platform.updated_at,
      is_active: Boolean(platform.is_active),
    };
  } catch (error) {
    logger.error('Global fetch error', { error: error.message, requestId });
    trackDatabaseError(error, 'platform_fetch_edit_global', { requestId });
    if (client) await client.cleanup();
    return null;
  }
}

export default async function EditPlatformPage({ params }) {
  try {
    const { id } = await params;

    // Vérifier authentification
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      logger.warn('Unauthenticated access to edit page');
      trackAuth('unauthenticated_edit_page', {}, 'warning');
      redirect('/login');
    }

    // Récupérer la plateforme
    const platform = await getPlatformForEdit(id);

    if (!platform) {
      notFound();
    }

    logger.info('Edit platform page rendering', {
      platformId: platform.platform_id,
      name: platform.platform_name,
      userId: session.user.id,
    });

    return <EditPlatform platform={platform} />;
  } catch (error) {
    logger.error('Edit platform page error', { error: error.message });
    trackDatabaseError(error, 'edit_page_render', { critical: 'true' });
    notFound();
  }
}
