// app/api/dashboard/platforms/[id]/delete/route.js
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getClient } from '@/backend/dbConnect';
import { applyRateLimit } from '@/backend/rateLimiter';
import { platformIdSchema, cleanUUID } from '@/utils/schemas/platformSchema';
import logger from '@/utils/logger';
import {
  trackAuth,
  trackDatabase,
  trackDatabaseError,
  trackValidation,
} from '@/utils/monitoring';

export const dynamic = 'force-dynamic';

const deletePlatformRateLimit = applyRateLimit('CONTENT_API', {
  windowMs: 5 * 60 * 1000,
  max: 8,
  message:
    'Trop de tentatives de suppression. Veuillez réessayer dans quelques minutes.',
  prefix: 'delete_platform',
});

function createResponseHeaders(requestId, responseTime) {
  return {
    'X-Request-ID': requestId,
    'X-Response-Time': `${responseTime}ms`,
  };
}

export async function DELETE(request, { params }) {
  let client;
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  const { id } = params;

  logger.info('Delete platform API called', { requestId, platformId: id });

  try {
    // Validation ID
    try {
      await platformIdSchema.validate({ id }, { abortEarly: false });
      // eslint-disable-next-line no-unused-vars
    } catch (idValidationError) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Invalid platform ID', { requestId, platformId: id });
      trackValidation(
        'invalid_platform_id_delete',
        { platformId: id },
        'warning',
      );

      return NextResponse.json(
        { success: false, error: 'Invalid platform ID format' },
        { status: 400, header },
      );
    }

    const cleanedPlatformId = cleanUUID(id);
    if (!cleanedPlatformId) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);
      return NextResponse.json(
        { success: false, error: 'Invalid platform ID format' },
        { status: 400, header },
      );
    }

    // Rate limiting
    const rateLimitResponse = await deletePlatformRateLimit(request);
    if (rateLimitResponse) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Delete rate limit exceeded', {
        requestId,
        platformId: cleanedPlatformId,
      });
      trackDatabase('delete_platform_rate_limit_exceeded', {}, 'warning');

      const rateLimitBody = await rateLimitResponse.json();
      return NextResponse.json(rateLimitBody, { status: 429, header });
    }

    // Authentification
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Unauthenticated delete attempt', { requestId });
      trackAuth('unauthenticated_delete_platform', {}, 'warning');

      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401, header },
      );
    }

    // Connexion DB
    try {
      client = await getClient();
    } catch (dbError) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.error('DB connection failed', {
        error: dbError.message,
        requestId,
      });
      trackDatabaseError(dbError, 'db_connection_delete', { requestId });

      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 503, header },
      );
    }

    // Vérifier existence et état
    let platformToDelete;
    try {
      const checkResult = await client.query(
        'SELECT platform_id, platform_name, is_active FROM admin.platforms WHERE platform_id = $1',
        [cleanedPlatformId],
      );

      if (checkResult.rows.length === 0) {
        await client.cleanup();

        const responseTime = Date.now() - startTime;
        const header = createResponseHeaders(requestId, responseTime);

        logger.warn('Platform not found', {
          requestId,
          platformId: cleanedPlatformId,
        });
        trackValidation('platform_not_found_delete', {}, 'warning');

        return NextResponse.json(
          { success: false, message: 'This platform does not exist' },
          { status: 404, header },
        );
      }

      platformToDelete = checkResult.rows[0];

      // Vérifier inactive
      if (platformToDelete.is_active === true) {
        await client.cleanup();

        const responseTime = Date.now() - startTime;
        const header = createResponseHeaders(requestId, responseTime);

        logger.warn('Attempted to delete active platform', {
          requestId,
          platformId: cleanedPlatformId,
        });

        trackValidation(
          'delete_active_platform_blocked',
          {
            platformId: cleanedPlatformId,
          },
          'warning',
        );

        return NextResponse.json(
          {
            success: false,
            message: 'Cannot delete active platform. Please deactivate first.',
            error: 'Platform is currently active',
          },
          { status: 400, header },
        );
      }
    } catch (checkError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.error('Platform check error', {
        error: checkError.message,
        requestId,
      });
      trackDatabaseError(checkError, 'platform_check', { requestId });

      return NextResponse.json(
        { success: false, error: 'Failed to verify platform status' },
        { status: 500, header },
      );
    }

    // Suppression
    let deleteResult;
    try {
      deleteResult = await client.query(
        `DELETE FROM admin.platforms 
         WHERE platform_id = $1 AND is_active = false 
         RETURNING platform_name`,
        [cleanedPlatformId],
      );

      if (deleteResult.rowCount === 0) {
        await client.cleanup();

        const responseTime = Date.now() - startTime;
        const header = createResponseHeaders(requestId, responseTime);

        logger.error('Deletion failed - no rows affected', { requestId });
        trackDatabaseError(new Error('No rows affected'), 'deletion_failed', {
          requestId,
        });

        return NextResponse.json(
          {
            success: false,
            message:
              'Platform could not be deleted. It may be active or already deleted.',
          },
          { status: 400, header },
        );
      }
    } catch (deleteError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.error('Platform deletion error', {
        error: deleteError.message,
        requestId,
      });
      trackDatabaseError(deleteError, 'deletion', { requestId });

      return NextResponse.json(
        { success: false, error: 'Failed to delete platform' },
        { status: 500, header },
      );
    }

    const deletedPlatform = deleteResult.rows[0];
    const responseTime = Date.now() - startTime;

    logger.info('Platform deleted successfully', {
      platformId: cleanedPlatformId,
      name: deletedPlatform.platform_name,
      durationMs: responseTime,
      userId: session.user.id,
      requestId,
    });

    trackDatabase('platform_deleted_successfully', {
      platformId: cleanedPlatformId,
      userId: session.user.id,
    });

    await client.cleanup();
    const header = createResponseHeaders(requestId, responseTime);

    return NextResponse.json(
      {
        success: true,
        message: 'Platform deleted successfully',
        platform: {
          id: cleanedPlatformId,
          name: deletedPlatform.platform_name,
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      { status: 200, header },
    );
  } catch (error) {
    if (client) await client.cleanup();

    const responseTime = Date.now() - startTime;
    const header = createResponseHeaders(requestId, responseTime);

    logger.error('Global delete platform error', {
      error: error.message,
      requestId,
    });
    trackDatabaseError(error, 'delete_platform', {
      requestId,
      critical: 'true',
    });

    return NextResponse.json(
      { success: false, error: 'Internal server error', requestId },
      { status: 500, header },
    );
  }
}
