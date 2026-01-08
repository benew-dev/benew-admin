// app/api/dashboard/templates/[id]/delete/route.js
import { NextResponse } from 'next/server';
import cloudinary from '@/backend/cloudinary';
import { getClient } from '@/backend/dbConnect';
import { getAuthenticatedUser } from '@/lib/auth-utils';
import { applyRateLimit } from '@/backend/rateLimiter';
import logger from '@/utils/logger';
import {
  trackAPI,
  trackAuth,
  trackDatabase,
  trackDatabaseError,
  trackValidation,
} from '@/utils/monitoring';

export const dynamic = 'force-dynamic';

const deleteTemplateRateLimit = applyRateLimit('CONTENT_API', {
  windowMs: 5 * 60 * 1000,
  max: 10,
  message:
    'Trop de tentatives de suppression de templates. Veuillez réessayer dans quelques minutes.',
  prefix: 'delete_template',
});

function isValidUUID(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
}

function createResponseHeaders(requestId, responseTime, templateId) {
  return {
    'X-Request-ID': requestId,
    'X-Response-Time': `${responseTime}ms`,
    'X-Resource-ID': templateId,
  };
}

export async function DELETE(request, { params }) {
  let client;
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  const { id } = await params;

  logger.info('Delete template API called', {
    requestId,
    templateId: id,
  });

  trackAPI('delete_template_started', {
    requestId,
    templateId: id,
  });

  try {
    if (!isValidUUID(id)) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime, id);

      logger.warn('Invalid template ID format', {
        templateId: id,
        requestId,
      });

      trackValidation(
        'invalid_template_id',
        {
          templateId: id,
        },
        'warning',
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid template ID format',
          message: 'This template does not exist',
        },
        { status: 400, headers },
      );
    }

    const rateLimitResponse = await deleteTemplateRateLimit(request);

    if (rateLimitResponse) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime, id);

      logger.warn('Rate limit exceeded', {
        requestId,
        templateId: id,
      });

      trackAPI(
        'rate_limit_exceeded',
        {
          templateId: id,
        },
        'warning',
      );

      const rateLimitBody = await rateLimitResponse.json();
      return NextResponse.json(rateLimitBody, {
        status: 429,
        headers: headers,
      });
    }

    const user = await getAuthenticatedUser();

    if (!user) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime, id);

      logger.warn('Unauthenticated delete attempt', {
        requestId,
        templateId: id,
      });

      trackAuth(
        'unauthenticated_delete_attempt',
        {
          templateId: id,
        },
        'warning',
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          message: 'Please log in to continue',
        },
        { status: 401, headers },
      );
    }

    logger.info('User authenticated for template deletion', {
      requestId,
      userId: user.id,
      templateId: id,
    });

    try {
      client = await getClient();
    } catch (dbError) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime, id);

      logger.error('Database connection failed', {
        error: dbError.message,
        requestId,
        templateId: id,
      });

      trackDatabaseError(dbError, 'db_connection', {
        requestId,
        templateId: id,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Database connection failed',
        },
        { status: 503, headers },
      );
    }

    let template;
    try {
      const checkResult = await client.query(
        'SELECT template_id, template_name, template_images, is_active FROM catalog.templates WHERE template_id = $1',
        [id],
      );

      if (checkResult.rows.length === 0) {
        await client.cleanup();

        const responseTime = Date.now() - startTime;
        const headers = createResponseHeaders(requestId, responseTime, id);

        logger.warn('Template not found', {
          requestId,
          templateId: id,
        });

        trackDatabase(
          'template_not_found',
          {
            templateId: id,
          },
          'warning',
        );

        return NextResponse.json(
          {
            success: false,
            message: 'This template does not exist',
          },
          { status: 404, headers },
        );
      }

      template = checkResult.rows[0];

      if (template.is_active === true) {
        await client.cleanup();

        const responseTime = Date.now() - startTime;
        const headers = createResponseHeaders(requestId, responseTime, id);

        logger.warn('Attempted to delete active template', {
          requestId,
          templateId: id,
          templateName: template.template_name,
        });

        trackValidation(
          'delete_active_template_attempt',
          {
            templateId: id,
            templateName: template.template_name,
          },
          'warning',
        );

        return NextResponse.json(
          {
            success: false,
            message:
              'Cannot delete active template. Please deactivate it first.',
            error: 'Template is currently active',
          },
          { status: 400, headers },
        );
      }
    } catch (checkError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime, id);

      logger.error('Template check error', {
        error: checkError.message,
        requestId,
        templateId: id,
      });

      trackDatabaseError(checkError, 'template_check', {
        requestId,
        templateId: id,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to verify template status',
          message: 'Something went wrong! Please try again',
        },
        { status: 500, headers },
      );
    }

    let deleteResult;
    try {
      deleteResult = await client.query(
        `DELETE FROM catalog.templates 
         WHERE template_id = $1 
         AND is_active = false 
         AND (sales_count = 0 OR sales_count IS NULL)
         RETURNING template_name, template_images`,
        [id],
      );

      if (deleteResult.rowCount === 0) {
        await client.cleanup();

        const responseTime = Date.now() - startTime;
        const headers = createResponseHeaders(requestId, responseTime, id);

        logger.error('Template deletion failed - no rows affected', {
          requestId,
          templateId: id,
        });

        trackDatabase(
          'template_deletion_failed',
          {
            templateId: id,
          },
          'error',
        );

        return NextResponse.json(
          {
            success: false,
            message:
              'Template could not be deleted. It may be active or have sales.',
            error: 'Deletion condition not met',
          },
          { status: 400, headers },
        );
      }
    } catch (deleteError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime, id);

      logger.error('Template deletion error', {
        error: deleteError.message,
        requestId,
        templateId: id,
      });

      trackDatabaseError(deleteError, 'deletion', {
        requestId,
        templateId: id,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete template from database',
          message: 'Something went wrong! Please try again',
        },
        { status: 500, headers },
      );
    }

    const deletedTemplate = deleteResult.rows[0];

    if (
      deletedTemplate.template_images &&
      Array.isArray(deletedTemplate.template_images)
    ) {
      deletedTemplate.template_images.forEach((imageId) => {
        cloudinary.uploader
          .destroy(imageId)
          .then(() => {
            logger.info('Cloudinary image deleted', {
              imageId,
              requestId,
            });
          })
          .catch((cloudError) => {
            logger.warn('Failed to delete Cloudinary image', {
              imageId,
              error: cloudError.message,
              requestId,
            });

            trackDatabaseError(cloudError, 'cloudinary_delete', {
              requestId,
              templateId: id,
              imageId,
            });
          });
      });
    }

    await client.cleanup();

    const responseTime = Date.now() - startTime;
    const headers = createResponseHeaders(requestId, responseTime, id);

    logger.info('Template deleted successfully', {
      templateId: id,
      templateName: deletedTemplate.template_name,
      imagesDeleted: deletedTemplate.template_images?.length || 0,
      responseTimeMs: responseTime,
      userId: user.id,
      requestId,
    });

    trackDatabase('template_deleted_successfully', {
      templateId: id,
      templateName: deletedTemplate.template_name,
      userId: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Template and associated images deleted successfully',
        template: {
          id: id,
          name: deletedTemplate.template_name,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200, headers },
    );
  } catch (error) {
    if (client) await client.cleanup();

    const responseTime = Date.now() - startTime;
    const headers = createResponseHeaders(requestId, responseTime, id);

    logger.error('Global delete template error', {
      error: error.message,
      requestId,
      templateId: id,
    });

    trackDatabaseError(error, 'delete_template', {
      requestId,
      templateId: id,
      responseTimeMs: responseTime,
      critical: 'true',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Something went wrong! Please try again',
        requestId,
      },
      { status: 500, headers },
    );
  }
}
