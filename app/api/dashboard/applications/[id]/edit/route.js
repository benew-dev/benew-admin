// app/api/dashboard/applications/[id]/edit/route.js
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import cloudinary from '@/backend/cloudinary';
import { getClient } from '@/backend/dbConnect';
import { applyRateLimit } from '@/backend/rateLimiter';
import {
  applicationUpdateSchema,
  applicationIdSchema,
  cleanUUID,
} from '@/utils/schemas/applicationSchema';
import { sanitizeApplicationUpdateInputsStrict } from '@/utils/sanitizers/sanitizeApplicationUpdateInputs';
import logger from '@/utils/logger';
import {
  trackAuth,
  trackDatabase,
  trackDatabaseError,
  trackValidation,
} from '@/utils/monitoring';

export const dynamic = 'force-dynamic';

const editApplicationRateLimit = applyRateLimit('CONTENT_API', {
  windowMs: 2 * 60 * 1000,
  max: 15,
  message:
    "Trop de tentatives de modification d'applications. Veuillez réessayer dans quelques minutes.",
  prefix: 'edit_application',
});

function createResponseHeaders(requestId, responseTime) {
  return {
    'X-Request-ID': requestId,
    'X-Response-Time': `${responseTime}ms`,
  };
}

export async function PUT(request, { params }) {
  let client;
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  const { id } = params;

  logger.info('Edit application API called', { requestId, applicationId: id });

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
        'invalid_application_id_edit',
        { applicationId: id },
        'warning',
      );

      return NextResponse.json(
        {
          error: 'Invalid application ID format',
          details: idValidationError.inner?.map((err) => err.message) || [
            idValidationError.message,
          ],
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
        { error: 'Invalid application ID format' },
        { status: 400, header },
      );
    }

    // Rate limiting
    const rateLimitResponse = await editApplicationRateLimit(request);
    if (rateLimitResponse) {
      const responseTime = Date.now() - startTime;
      // eslint-disable-next-line no-unused-vars
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Edit rate limit exceeded', {
        requestId,
        applicationId: cleanedApplicationId,
      });

      trackDatabase('edit_rate_limit_exceeded', {}, 'warning');

      return rateLimitResponse;
    }

    // Authentification
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Unauthenticated edit attempt', {
        requestId,
        applicationId: cleanedApplicationId,
      });

      trackAuth('unauthenticated_edit_application', {}, 'warning');

      return NextResponse.json(
        { error: 'Authentication required' },
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

      trackDatabaseError(dbError, 'db_connection_edit', { requestId });

      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 503, header },
      );
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.error('JSON parse error', {
        error: parseError.message,
        requestId,
        applicationId: cleanedApplicationId,
      });

      trackDatabaseError(parseError, 'json_parse_edit', { requestId });

      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400, header },
      );
    }

    const {
      name,
      link,
      admin,
      description,
      category,
      level,
      fee,
      rent,
      imageUrls,
      otherVersions,
      isActive,
      oldImageUrls,
    } = body;

    // Sanitization (exclure isActive et level)
    const dataToSanitize = {
      name,
      link,
      admin,
      description,
      category,
      fee,
      rent,
      imageUrls,
      otherVersions,
    };

    const filteredDataToSanitize = Object.fromEntries(
      Object.entries(dataToSanitize).filter(
        // eslint-disable-next-line no-unused-vars
        ([_, value]) => value !== undefined,
      ),
    );

    const sanitizedInputs = sanitizeApplicationUpdateInputsStrict(
      filteredDataToSanitize,
    );

    const finalData = {
      ...sanitizedInputs,
      level,
      isActive,
      oldImageUrls,
    };

    // Validation Yup
    try {
      const dataToValidate = Object.fromEntries(
        Object.entries({
          name: finalData.name,
          link: finalData.link,
          admin: finalData.admin,
          description: finalData.description,
          category: finalData.category,
          level: finalData.level,
          fee: finalData.fee,
          rent: finalData.rent,
          imageUrls: finalData.imageUrls,
          otherVersions: finalData.otherVersions,
          isActive: finalData.isActive,
          // eslint-disable-next-line no-unused-vars
        }).filter(([_, value]) => value !== undefined),
      );

      await applicationUpdateSchema.validate(dataToValidate, {
        abortEarly: false,
      });
    } catch (validationError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Application validation failed', {
        errors: validationError.inner?.length || 0,
        requestId,
        applicationId: cleanedApplicationId,
      });

      trackValidation(
        'application_validation_failed_edit',
        {
          errors: validationError.inner?.map((e) => e.path),
        },
        'warning',
      );

      const errors = {};
      validationError.inner.forEach((error) => {
        errors[error.path] = error.message;
      });

      return NextResponse.json({ errors }, { status: 400, header });
    }

    // Gestion images Cloudinary (suppression des anciennes)
    if (
      oldImageUrls &&
      Array.isArray(oldImageUrls) &&
      oldImageUrls.length > 0
    ) {
      const currentImages = finalData.imageUrls || [];
      const imagesToDelete = oldImageUrls.filter(
        (oldImg) => !currentImages.includes(oldImg),
      );

      if (imagesToDelete.length > 0) {
        const deletePromises = imagesToDelete.map(async (imageId) => {
          try {
            await cloudinary.uploader.destroy(imageId);
          } catch (deleteError) {
            logger.warn('Error deleting image from Cloudinary', {
              requestId,
              applicationId: cleanedApplicationId,
              imageId,
              error: deleteError.message,
            });
          }
        });

        await Promise.allSettled(deletePromises);
      }
    }

    // Mise à jour en base de données
    let result;
    try {
      const updateFields = [];
      const updateValues = [];
      let paramCounter = 1;

      if (finalData.name !== undefined) {
        updateFields.push(`application_name = $${paramCounter}`);
        updateValues.push(finalData.name);
        paramCounter++;
      }

      if (finalData.link !== undefined) {
        updateFields.push(`application_link = $${paramCounter}`);
        updateValues.push(finalData.link);
        paramCounter++;
      }

      if (finalData.admin !== undefined) {
        updateFields.push(`application_admin_link = $${paramCounter}`);
        updateValues.push(finalData.admin);
        paramCounter++;
      }

      if (finalData.description !== undefined) {
        updateFields.push(`application_description = $${paramCounter}`);
        updateValues.push(finalData.description);
        paramCounter++;
      }

      if (finalData.category !== undefined) {
        updateFields.push(`application_category = $${paramCounter}`);
        updateValues.push(finalData.category);
        paramCounter++;
      }

      if (level !== undefined) {
        updateFields.push(`application_level = $${paramCounter}`);
        updateValues.push(level);
        paramCounter++;
      }

      if (finalData.fee !== undefined) {
        updateFields.push(`application_fee = $${paramCounter}`);
        updateValues.push(finalData.fee);
        paramCounter++;
      }

      if (finalData.rent !== undefined) {
        updateFields.push(`application_rent = $${paramCounter}`);
        updateValues.push(finalData.rent);
        paramCounter++;
      }

      if (finalData.imageUrls !== undefined) {
        updateFields.push(`application_images = $${paramCounter}`);
        updateValues.push(finalData.imageUrls);
        paramCounter++;
      }

      if (finalData.otherVersions !== undefined) {
        updateFields.push(`application_other_versions = $${paramCounter}`);
        updateValues.push(finalData.otherVersions);
        paramCounter++;
      }

      if (isActive !== undefined) {
        updateFields.push(`is_active = $${paramCounter}`);
        updateValues.push(isActive);
        paramCounter++;
      }

      // updated_at
      updateFields.push(`updated_at = $${paramCounter}`);
      updateValues.push(new Date().toISOString());
      paramCounter++;

      // ID
      updateValues.push(cleanedApplicationId);

      const queryText = `
        UPDATE catalog.applications 
        SET ${updateFields.join(', ')}
        WHERE application_id = $${paramCounter}
        RETURNING *
      `;

      result = await client.query(queryText, updateValues);

      if (result.rows.length === 0) {
        await client.cleanup();

        const responseTime = Date.now() - startTime;
        const header = createResponseHeaders(requestId, responseTime);

        logger.warn('Application not found for update', {
          requestId,
          applicationId: cleanedApplicationId,
        });

        trackValidation('application_not_found_update', {}, 'warning');

        return NextResponse.json(
          { message: 'Application not found' },
          { status: 404, header },
        );
      }
    } catch (updateError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.error('Application update error', {
        error: updateError.message,
        requestId,
        applicationId: cleanedApplicationId,
      });

      trackDatabaseError(updateError, 'update', { requestId });

      return NextResponse.json(
        { error: 'Failed to update application', message: updateError.message },
        { status: 500, header },
      );
    }

    const updatedApplication = result.rows[0];
    const sanitizedApplication = {
      application_id: updatedApplication.application_id,
      application_name: updatedApplication.application_name || '',
      application_link: updatedApplication.application_link,
      application_admin_link: updatedApplication.application_admin_link,
      application_description: updatedApplication.application_description || '',
      application_category: updatedApplication.application_category || 'web',
      application_level: parseInt(updatedApplication.application_level) || 1,
      application_fee: parseFloat(updatedApplication.application_fee) || 0,
      application_rent: parseFloat(updatedApplication.application_rent) || 0,
      application_images: updatedApplication.application_images || [],
      application_other_versions:
        updatedApplication.application_other_versions || null,
      is_active: Boolean(updatedApplication.is_active),
      sales_count: parseInt(updatedApplication.sales_count) || 0,
      created_at: updatedApplication.created_at,
      updated_at: updatedApplication.updated_at,
    };

    const responseTime = Date.now() - startTime;

    logger.info('Application updated successfully', {
      applicationId: cleanedApplicationId,
      name: sanitizedApplication.application_name,
      durationMs: responseTime,
      userId: session.user.id,
      requestId,
    });

    trackDatabase('application_updated_successfully', {
      applicationId: cleanedApplicationId,
      name: sanitizedApplication.application_name,
      userId: session.user.id,
    });

    await client.cleanup();

    const header = createResponseHeaders(requestId, responseTime);

    return NextResponse.json(
      {
        success: true,
        message: 'Application updated successfully',
        application: sanitizedApplication,
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

    logger.error('Global edit application error', {
      error: error.message,
      requestId,
      applicationId: id,
    });

    trackDatabaseError(error, 'edit_application', {
      requestId,
      durationMs: responseTime,
      critical: 'true',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to update application',
        requestId,
      },
      { status: 500, header },
    );
  }
}
