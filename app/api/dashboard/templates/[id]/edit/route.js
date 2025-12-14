// app/api/dashboard/templates/[id]/edit/route.js
import { NextResponse } from 'next/server';
import cloudinary from '@/backend/cloudinary';
import { getClient } from '@/backend/dbConnect';
import { getAuthenticatedUser } from '@/lib/auth-utils';
import { applyRateLimit } from '@/backend/rateLimiter';
import { sanitizeTemplateInputsStrict } from '@/utils/sanitizers/sanitizeTemplateInputs';
import {
  templateUpdateSchema,
  templateIdSchema,
} from '@/utils/schemas/templateSchema';
import logger from '@/utils/logger';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';

// ===== RATE LIMITING =====
const editTemplateRateLimit = applyRateLimit('CONTENT_API', {
  windowMs: 2 * 60 * 1000,
  max: 20,
  message:
    'Trop de tentatives de modification de templates. Veuillez réessayer dans quelques minutes.',
  prefix: 'edit_template',
});

// ===== HELPER HEADERS =====
function createResponseHeaders(requestId, responseTime, templateId) {
  return {
    'X-Request-ID': requestId,
    'X-Response-Time': `${responseTime}ms`,
    'X-Resource-ID': templateId,
  };
}

// ===== MAIN HANDLER =====
export async function PUT(request, { params }) {
  let client;
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  const { id } = await params;

  logger.info('Edit template API called', {
    requestId,
    templateId: id,
  });

  Sentry.addBreadcrumb({
    category: 'api',
    message: 'Edit template process started',
    level: 'info',
    data: { requestId, templateId: id },
  });

  try {
    // ===== ÉTAPE 1: VALIDATION ID =====
    try {
      await templateIdSchema.validate({ id }, { abortEarly: false });
    } catch (idValidationError) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime, id);

      logger.warn('Invalid template ID', {
        templateId: id,
        errors: idValidationError.inner?.map((e) => e.message),
        requestId,
      });

      Sentry.addBreadcrumb({
        category: 'validation',
        message: 'Template ID validation failed',
        level: 'warning',
        data: { templateId: id },
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid template ID format',
          details: idValidationError.inner?.map((e) => e.message),
        },
        { status: 400, headers },
      );
    }

    // ===== ÉTAPE 2: RATE LIMITING =====
    const rateLimitResponse = await editTemplateRateLimit(request);

    if (rateLimitResponse) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime, id);

      logger.warn('Rate limit exceeded', { requestId, templateId: id });

      const rateLimitBody = await rateLimitResponse.json();
      return NextResponse.json(rateLimitBody, { status: 429, headers });
    }

    // ===== ÉTAPE 3: AUTHENTIFICATION =====
    const user = await getAuthenticatedUser();

    if (!user) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime, id);

      logger.warn('Unauthenticated edit attempt', {
        requestId,
        templateId: id,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          message: 'Please log in to continue',
        },
        { status: 401, headers },
      );
    }

    // ===== ÉTAPE 4: PARSING BODY =====
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime, id);

      logger.error('JSON parse error', {
        error: parseError.message,
        requestId,
        templateId: id,
      });

      Sentry.captureException(parseError, {
        tags: { component: 'edit_template', action: 'json_parse' },
        extra: { requestId, templateId: id },
      });

      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400, headers },
      );
    }

    const {
      templateName,
      templateImageId,
      templateHasWeb,
      templateHasMobile,
      isActive,
      oldImageId,
    } = body;

    // ===== ÉTAPE 5: SANITIZATION (sauf isActive et oldImageId) =====
    const dataToSanitize = {
      templateName,
      templateImageId,
      templateHasWeb,
      templateHasMobile,
    };

    const filteredDataToSanitize = Object.fromEntries(
      Object.entries(dataToSanitize).filter(
        // eslint-disable-next-line no-unused-vars
        ([_, value]) => value !== undefined,
      ),
    );

    const sanitizedInputs = sanitizeTemplateInputsStrict(
      filteredDataToSanitize,
    );

    const {
      templateName: sanitizedTemplateName,
      templateImageId: sanitizedTemplateImageId,
      templateHasWeb: sanitizedTemplateHasWeb,
      templateHasMobile: sanitizedTemplateHasMobile,
    } = sanitizedInputs;

    // ===== ÉTAPE 6: VALIDATION YUP =====
    try {
      const dataToValidate = Object.fromEntries(
        Object.entries({
          templateName: sanitizedTemplateName,
          templateImageId: sanitizedTemplateImageId,
          templateHasWeb: sanitizedTemplateHasWeb,
          templateHasMobile: sanitizedTemplateHasMobile,
          isActive,
          // eslint-disable-next-line no-unused-vars
        }).filter(([_, value]) => value !== undefined),
      );

      await templateUpdateSchema.validate(dataToValidate, {
        abortEarly: false,
      });
    } catch (validationError) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime, id);

      logger.warn('Validation failed', {
        errors: validationError.inner?.length || 0,
        requestId,
        templateId: id,
      });

      Sentry.addBreadcrumb({
        category: 'validation',
        message: 'Template validation failed',
        level: 'warning',
        data: {
          errors: validationError.inner?.map((e) => e.path),
        },
      });

      const errors = {};
      validationError.inner.forEach((error) => {
        errors[error.path] = error.message;
      });

      return NextResponse.json(
        { success: false, errors },
        { status: 400, headers },
      );
    }

    // ===== ÉTAPE 7: CONNEXION DB =====
    try {
      client = await getClient();
    } catch (dbError) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime, id);

      logger.error('DB connection failed', {
        error: dbError.message,
        requestId,
        templateId: id,
      });

      Sentry.captureException(dbError, {
        tags: { component: 'edit_template', action: 'db_connection' },
        extra: { requestId, templateId: id },
      });

      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 503, headers },
      );
    }

    // ===== ÉTAPE 8: GESTION IMAGE CLOUDINARY =====
    if (
      oldImageId &&
      sanitizedTemplateImageId &&
      oldImageId !== sanitizedTemplateImageId
    ) {
      // Suppression asynchrone (non-bloquante)
      cloudinary.uploader.destroy(oldImageId).catch((cloudError) => {
        logger.warn('Failed to delete old image from Cloudinary', {
          requestId,
          templateId: id,
          oldImageId,
          error: cloudError.message,
        });

        Sentry.captureException(cloudError, {
          level: 'warning',
          tags: { component: 'edit_template', action: 'cloudinary_delete' },
          extra: { requestId, templateId: id, oldImageId },
        });
      });
    }

    // ===== ÉTAPE 9: UPDATE DATABASE =====
    let result;
    try {
      const updateFields = [];
      const updateValues = [];
      let paramCounter = 1;

      if (sanitizedTemplateName !== undefined) {
        updateFields.push(`template_name = $${paramCounter}`);
        updateValues.push(sanitizedTemplateName);
        paramCounter++;
      }

      if (sanitizedTemplateImageId !== undefined) {
        updateFields.push(`template_image = $${paramCounter}`);
        updateValues.push(sanitizedTemplateImageId);
        paramCounter++;
      }

      if (sanitizedTemplateHasWeb !== undefined) {
        updateFields.push(`template_has_web = $${paramCounter}`);
        updateValues.push(sanitizedTemplateHasWeb);
        paramCounter++;
      }

      if (sanitizedTemplateHasMobile !== undefined) {
        updateFields.push(`template_has_mobile = $${paramCounter}`);
        updateValues.push(sanitizedTemplateHasMobile);
        paramCounter++;
      }

      if (isActive !== undefined) {
        updateFields.push(`is_active = $${paramCounter}`);
        updateValues.push(isActive);
        paramCounter++;
      }

      // Ajouter updated_at
      updateFields.push(`updated_at = NOW()`);

      updateValues.push(id);

      const queryText = `
        UPDATE catalog.templates 
        SET ${updateFields.join(', ')}
        WHERE template_id = $${paramCounter}
        RETURNING *
      `;

      result = await client.query(queryText, updateValues);

      if (result.rows.length === 0) {
        await client.cleanup();

        const responseTime = Date.now() - startTime;
        const headers = createResponseHeaders(requestId, responseTime, id);

        logger.warn('Template not found for update', {
          requestId,
          templateId: id,
        });

        Sentry.addBreadcrumb({
          category: 'database',
          message: 'Template not found',
          level: 'warning',
          data: { templateId: id },
        });

        return NextResponse.json(
          { success: false, message: 'Template not found' },
          { status: 404, headers },
        );
      }
    } catch (updateError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime, id);

      logger.error('Template update failed', {
        error: updateError.message,
        requestId,
        templateId: id,
      });

      Sentry.captureException(updateError, {
        tags: { component: 'edit_template', action: 'update' },
        extra: { requestId, templateId: id },
      });

      return NextResponse.json(
        { success: false, error: 'Failed to update template' },
        { status: 500, headers },
      );
    }

    // ===== ÉTAPE 10: SUCCÈS =====
    await client.cleanup();

    const updatedTemplate = result.rows[0];
    const responseTime = Date.now() - startTime;
    const headers = createResponseHeaders(requestId, responseTime, id);

    logger.info('Template updated successfully', {
      templateId: id,
      templateName: updatedTemplate.template_name,
      responseTimeMs: responseTime,
      userId: user.id,
      requestId,
    });

    Sentry.addBreadcrumb({
      category: 'database',
      message: 'Template updated successfully',
      level: 'info',
      data: {
        templateId: id,
        templateName: updatedTemplate.template_name,
        userId: user.id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Template updated successfully',
        template: updatedTemplate,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200, headers },
    );
  } catch (error) {
    // ===== GESTION GLOBALE DES ERREURS =====
    if (client) await client.cleanup();

    const responseTime = Date.now() - startTime;
    const headers = createResponseHeaders(requestId, responseTime, id);

    logger.error('Global edit template error', {
      error: error.message,
      requestId,
      templateId: id,
    });

    Sentry.captureException(error, {
      tags: { component: 'edit_template', critical: 'true' },
      extra: { requestId, templateId: id, responseTimeMs: responseTime },
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to update template',
        requestId,
      },
      { status: 500, headers },
    );
  }
}
