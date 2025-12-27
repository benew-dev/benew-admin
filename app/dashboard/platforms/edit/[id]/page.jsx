// app/dashboard/platforms/edit/[id]/page.jsx - UPDATED WITH notFound()
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

/**
 * Récupère une plateforme pour édition
 * @param {string} platformId - UUID de la plateforme
 * @returns {Promise<Object|null>} Plateforme ou null si non trouvée
 */
async function getPlatformForEdit(platformId) {
  let client;
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  logger.info('Fetching platform for edit', { requestId, platformId });

  try {
    // ===== 1. VALIDATION ID =====
    try {
      await platformIdSchema.validate(
        { id: platformId },
        { abortEarly: false },
      );
      // eslint-disable-next-line no-unused-vars
    } catch (validationError) {
      logger.warn('Invalid platform ID', { requestId, platformId });
      trackValidation('invalid_platform_id_page', { platformId }, 'warning');
      // ✅ Retourne null pour déclencher notFound()
      return null;
    }

    // ===== 2. NETTOYAGE UUID =====
    const cleanedPlatformId = cleanUUID(platformId);
    if (!cleanedPlatformId) {
      logger.warn('Failed to clean platform ID', { requestId, platformId });
      // ✅ Retourne null pour déclencher notFound()
      return null;
    }

    // ===== 3. CONNEXION DB =====
    try {
      client = await getClient();
    } catch (dbError) {
      logger.error('DB connection failed', {
        error: dbError.message,
        requestId,
      });
      trackDatabaseError(dbError, 'db_connection_page', { requestId });
      // ✅ Erreur connexion DB → error.jsx (pas notFound)
      throw dbError;
    }

    // ===== 4. QUERY PLATFORM =====
    let result;
    try {
      const platformQuery = `
        SELECT 
          platform_id,
          platform_name,
          account_name,
          account_number,
          is_cash_payment,
          description,
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
      // ✅ Erreur SQL → error.jsx (pas notFound)
      throw queryError;
    }

    // ===== 5. VÉRIFICATION RÉSULTAT =====
    if (result.rows.length === 0) {
      logger.warn('Platform not found in database', {
        requestId,
        platformId: cleanedPlatformId,
      });
      trackValidation('platform_not_found_page', {}, 'warning');
      await client.cleanup();
      // ✅ Plateforme inexistante → notFound()
      return null;
    }

    const platform = result.rows[0];
    const responseTime = Date.now() - startTime;

    logger.info('Platform fetched successfully', {
      platformId: cleanedPlatformId,
      name: platform.platform_name,
      isCashPayment: platform.is_cash_payment,
      durationMs: responseTime,
      requestId,
    });

    trackDatabase('platform_fetched_for_edit', {
      platformId: cleanedPlatformId,
    });

    await client.cleanup();

    // ===== 6. SANITIZATION =====
    return {
      platform_id: platform.platform_id,
      platform_name: platform.platform_name || '[No Name]',
      account_name: platform.account_name || null,
      account_number: platform.account_number || null,
      is_cash_payment: Boolean(platform.is_cash_payment),
      description: platform.description || null,
      created_at: platform.created_at,
      updated_at: platform.updated_at,
      is_active: Boolean(platform.is_active),
    };
  } catch (error) {
    logger.error('Global fetch error', { error: error.message, requestId });
    trackDatabaseError(error, 'platform_fetch_edit_global', { requestId });
    if (client) await client.cleanup();
    // ✅ Erreur générale → error.jsx
    throw error;
  }
}

/**
 * Page d'édition d'une plateforme
 */
export default async function EditPlatformPage({ params }) {
  try {
    // ===== 1. RÉCUPÉRATION ID =====
    const { id } = await params;

    // ===== 2. VÉRIFICATION AUTH =====
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      logger.warn('Unauthenticated access to edit page');
      trackAuth('unauthenticated_edit_page', {}, 'warning');
      redirect('/login');
    }

    // ===== 3. RÉCUPÉRATION PLATEFORME =====
    const platform = await getPlatformForEdit(id);

    // ✅ Si null → déclencher not-found.jsx
    if (!platform) {
      logger.info('Platform not found, triggering notFound()', {
        platformId: id,
        userId: session.user.id,
      });
      notFound();
    }

    // ===== 4. RENDER =====
    logger.info('Edit platform page rendering', {
      platformId: platform.platform_id,
      name: platform.platform_name,
      isCashPayment: platform.is_cash_payment,
      userId: session.user.id,
    });

    return <EditPlatform platform={platform} />;
  } catch (error) {
    // ✅ Gestion des redirects Next.js
    if (
      error.message?.includes('NEXT_REDIRECT') ||
      error.message?.includes('NEXT_NOT_FOUND')
    ) {
      throw error;
    }

    // ✅ Toute autre erreur → error.jsx
    logger.error('Edit platform page error', {
      error: error.message,
      stack: error.stack,
    });
    trackDatabaseError(error, 'edit_page_render', { critical: 'true' });

    // Re-throw pour déclencher error.jsx
    throw error;
  }
}
