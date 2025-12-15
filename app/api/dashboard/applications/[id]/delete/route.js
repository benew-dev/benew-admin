// app/api/dashboard/applications/[id]/delete/route.js
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import cloudinary from '@/backend/cloudinary';
import { getClient } from '@/backend/dbConnect';
import { applyRateLimit } from '@/backend/rateLimiter';
import {
  applicationIdSchema,
  cleanUUID,
} from '@/utils/schemas/applicationSchema';
import logger from '@/utils/logger';
import {
  trackAuth,
  trackDatabase,
  trackDatabaseError,
  trackValidation,
} from '@/utils/monitoring';

export const dynamic = 'force-dynamic';

const deleteApplicationRateLimit = applyRateLimit('CONTENT_API', {
  windowMs: 10 * 60 * 1000,
  max: 5,
  message:
    "Trop de tentatives de suppression d'applications. Veuillez réessayer dans quelques minutes.",
  prefix: 'delete_application',
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
  let cloudinaryOperations = 0;

  logger.info('Delete application API called', {
    requestId,
    applicationId: id,
  });

  try {
    // Validation de l'ID
    try {
      await applicationIdSchema.validate({ id }, { abortEarly: false });
    } catch (idValidationError) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Invalid application ID', {
        requestId,
        applicationId: id,
        error: idValidationError.message,
      });

      trackValidation(
        'invalid_application_id',
        { applicationId: id },
        'warning',
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid application ID format',
          message: 'This application does not exist',
        },
        { status: 400, header },
      );
    }

    // Nettoyer l'UUID
    const cleanedApplicationId = cleanUUID(id);
    if (!cleanedApplicationId) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Application ID cleaning failed', {
        requestId,
        providedId: id,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid application ID format',
          message: 'This application does not exist',
        },
        { status: 400, header },
      );
    }

    // Rate limiting
    const rateLimitResponse = await deleteApplicationRateLimit(request);
    if (rateLimitResponse) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Delete rate limit exceeded', {
        requestId,
        applicationId: cleanedApplicationId,
      });

      trackDatabase('delete_rate_limit_exceeded', {}, 'warning');

      const rateLimitBody = await rateLimitResponse.json();
      return NextResponse.json(rateLimitBody, { status: 429, header });
    }

    // Authentification
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Unauthenticated delete attempt', {
        requestId,
        applicationId: cleanedApplicationId,
      });

      trackAuth('unauthenticated_delete_application', {}, 'warning');

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

      logger.error('Database connection failed', {
        error: dbError.message,
        requestId,
        applicationId: cleanedApplicationId,
      });

      trackDatabaseError(dbError, 'db_connection', { requestId });

      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 503, header },
      );
    }

    // Vérifier existence et état de l'application
    let applicationToDelete;
    try {
      const checkResult = await client.query(
        `SELECT 
          application_id, 
          application_name, 
          application_images, 
          is_active,
          sales_count
        FROM catalog.applications 
        WHERE application_id = $1`,
        [cleanedApplicationId],
      );

      if (checkResult.rows.length === 0) {
        await client.cleanup();

        const responseTime = Date.now() - startTime;
        const header = createResponseHeaders(requestId, responseTime);

        logger.warn('Application not found for deletion', {
          requestId,
          applicationId: cleanedApplicationId,
        });

        trackValidation('application_not_found_delete', {}, 'warning');

        return NextResponse.json(
          { success: false, message: 'This application does not exist' },
          { status: 404, header },
        );
      }

      applicationToDelete = checkResult.rows[0];

      // Vérifier que l'application est inactive
      if (applicationToDelete.is_active === true) {
        await client.cleanup();

        const responseTime = Date.now() - startTime;
        const header = createResponseHeaders(requestId, responseTime);

        logger.warn('Attempted to delete active application', {
          requestId,
          applicationId: cleanedApplicationId,
          name: applicationToDelete.application_name,
        });

        trackValidation(
          'delete_active_application_blocked',
          {
            applicationId: cleanedApplicationId,
          },
          'warning',
        );

        return NextResponse.json(
          {
            success: false,
            message:
              'Cannot delete active application. Please deactivate the application first.',
            error: 'Application is currently active',
          },
          { status: 400, header },
        );
      }

      // Vérifier s'il y a des ventes
      const salesCount = parseInt(applicationToDelete.sales_count) || 0;
      if (salesCount > 0) {
        await client.cleanup();

        const responseTime = Date.now() - startTime;
        const header = createResponseHeaders(requestId, responseTime);

        logger.warn('Attempted to delete application with sales', {
          requestId,
          applicationId: cleanedApplicationId,
          salesCount,
        });

        trackValidation(
          'delete_application_with_sales_blocked',
          {
            applicationId: cleanedApplicationId,
            salesCount,
          },
          'warning',
        );

        return NextResponse.json(
          {
            success: false,
            message:
              'Cannot delete application with existing sales. Please contact support for assistance.',
            error: 'Application has sales history',
          },
          { status: 400, header },
        );
      }
    } catch (checkError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.error('Application check error', {
        error: checkError.message,
        requestId,
        applicationId: cleanedApplicationId,
      });

      trackDatabaseError(checkError, 'application_check', { requestId });

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to verify application status',
          message: 'Something went wrong! Please try again',
        },
        { status: 500, header },
      );
    }

    // Suppression de l'application
    let deleteResult;
    try {
      deleteResult = await client.query(
        `DELETE FROM catalog.applications 
         WHERE application_id = $1 
         AND is_active = false 
         AND (sales_count = 0 OR sales_count IS NULL)
         RETURNING application_name, application_images`,
        [cleanedApplicationId],
      );

      if (deleteResult.rowCount === 0) {
        await client.cleanup();

        const responseTime = Date.now() - startTime;
        const header = createResponseHeaders(requestId, responseTime);

        logger.error('Deletion failed - no rows affected', {
          requestId,
          applicationId: cleanedApplicationId,
        });

        trackDatabaseError(new Error('No rows affected'), 'deletion_failed', {
          requestId,
        });

        return NextResponse.json(
          {
            success: false,
            message:
              'Application could not be deleted. It may be active, have sales, or already deleted.',
            error: 'Deletion conditions not met',
          },
          { status: 400, header },
        );
      }
    } catch (deleteError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.error('Application deletion error', {
        error: deleteError.message,
        requestId,
        applicationId: cleanedApplicationId,
      });

      trackDatabaseError(deleteError, 'deletion', { requestId });

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete application from database',
          message: 'Something went wrong! Please try again',
        },
        { status: 500, header },
      );
    }

    // Suppression des images Cloudinary
    const deletedApplication = deleteResult.rows[0];
    const cloudinaryImageIds =
      applicationToDelete.application_images ||
      deletedApplication.application_images ||
      [];

    let deletedImagesCount = 0;
    let failedImagesCount = 0;

    if (Array.isArray(cloudinaryImageIds) && cloudinaryImageIds.length > 0) {
      const deletePromises = cloudinaryImageIds.map(async (imageId) => {
        try {
          await cloudinary.uploader.destroy(imageId);
          deletedImagesCount++;
          cloudinaryOperations++;
        } catch (cloudError) {
          failedImagesCount++;
          logger.warn('Error deleting image from Cloudinary', {
            requestId,
            applicationId: cleanedApplicationId,
            imageId,
            error: cloudError.message,
          });
        }
      });

      await Promise.allSettled(deletePromises);
    }

    const responseTime = Date.now() - startTime;

    logger.info('Application deleted successfully', {
      applicationId: cleanedApplicationId,
      name: deletedApplication.application_name,
      totalImages: cloudinaryImageIds.length,
      deletedImages: deletedImagesCount,
      failedImages: failedImagesCount,
      durationMs: responseTime,
      userId: session.user.id,
      requestId,
    });

    trackDatabase('application_deleted_successfully', {
      applicationId: cleanedApplicationId,
      name: deletedApplication.application_name,
      userId: session.user.id,
      cloudinaryOperations,
    });

    await client.cleanup();

    const header = createResponseHeaders(requestId, responseTime);

    return NextResponse.json(
      {
        success: true,
        message: 'Application and associated images deleted successfully',
        application: {
          id: cleanedApplicationId,
          name: deletedApplication.application_name,
        },
        images: {
          total: cloudinaryImageIds.length,
          deleted: deletedImagesCount,
          failed: failedImagesCount,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200, header },
    );
  } catch (error) {
    if (client) await client.cleanup();

    const responseTime = Date.now() - startTime;
    const header = createResponseHeaders(requestId, responseTime);

    logger.error('Global delete application error', {
      error: error.message,
      requestId,
      applicationId: id,
    });

    trackDatabaseError(error, 'delete_application', {
      requestId,
      durationMs: responseTime,
      critical: 'true',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Something went wrong! Please try again',
        requestId,
      },
      { status: 500, header },
    );
  }
}
