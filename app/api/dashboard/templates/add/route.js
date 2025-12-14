// app/api/dashboard/templates/add/route.js
import { NextResponse } from 'next/server';
import { getClient } from '@/backend/dbConnect';
import { getAuthenticatedUser } from '@/lib/auth-utils';
import { applyRateLimit } from '@/backend/rateLimiter';
import { sanitizeTemplateInputsStrict } from '@/utils/sanitizers/sanitizeTemplateInputs';
import { templateAddingSchema } from '@/utils/schemas/templateSchema';
import logger from '@/utils/logger';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';

const addTemplateRateLimit = applyRateLimit('CONTENT_API', {
  windowMs: 5 * 60 * 1000,
  max: 10,
  message:
    "Trop de tentatives d'ajout de templates. Veuillez réessayer dans quelques minutes.",
  prefix: 'add_template',
});

function createResponseHeaders(requestId, responseTime) {
  return {
    'X-Request-ID': requestId,
    'X-Response-Time': `${responseTime}ms`,
  };
}

export async function POST(request) {
  let client;
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  logger.info('Add template API called', { requestId });

  Sentry.addBreadcrumb({
    category: 'api',
    message: 'Add template process started',
    level: 'info',
    data: { requestId },
  });

  try {
    const rateLimitResponse = await addTemplateRateLimit(request);

    if (rateLimitResponse) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime);

      logger.warn('Rate limit exceeded', { requestId });

      const rateLimitBody = await rateLimitResponse.json();
      return NextResponse.json(rateLimitBody, { status: 429, headers });
    }

    const user = await getAuthenticatedUser();

    if (!user) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime);

      logger.warn('Unauthenticated add attempt', { requestId });

      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          message: 'Please log in to continue',
        },
        { status: 401, headers },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime);

      logger.error('JSON parse error', {
        error: parseError.message,
        requestId,
      });

      Sentry.captureException(parseError, {
        tags: { component: 'add_template', action: 'json_parse' },
        extra: { requestId },
      });

      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400, headers },
      );
    }

    const {
      templateName,
      templateImageIds,
      templateHasWeb,
      templateHasMobile,
    } = body;

    const sanitizedInputs = sanitizeTemplateInputsStrict({
      templateName,
      templateImageIds,
      templateHasWeb,
      templateHasMobile,
    });

    const {
      templateName: sanitizedTemplateName,
      templateImageIds: sanitizedTemplateImageIds,
      templateHasWeb: sanitizedTemplateHasWeb,
      templateHasMobile: sanitizedTemplateHasMobile,
    } = sanitizedInputs;

    try {
      await templateAddingSchema.validate(
        {
          templateName: sanitizedTemplateName,
          templateImageIds: sanitizedTemplateImageIds,
          templateHasWeb: sanitizedTemplateHasWeb,
          templateHasMobile: sanitizedTemplateHasMobile,
        },
        { abortEarly: false },
      );
    } catch (validationError) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime);

      logger.warn('Validation failed', {
        errors: validationError.inner?.length || 0,
        requestId,
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

    if (
      !sanitizedTemplateName ||
      !sanitizedTemplateImageIds ||
      sanitizedTemplateImageIds.length === 0
    ) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime);

      logger.warn('Missing required fields', { requestId });

      return NextResponse.json(
        {
          success: false,
          message: 'Template name and at least one image are required',
        },
        { status: 400, headers },
      );
    }

    try {
      client = await getClient();
    } catch (dbError) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime);

      logger.error('DB connection failed', {
        error: dbError.message,
        requestId,
      });

      Sentry.captureException(dbError, {
        tags: { component: 'add_template', action: 'db_connection' },
        extra: { requestId },
      });

      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 503, headers },
      );
    }

    let result;
    try {
      const queryText = `
        INSERT INTO catalog.templates (
          template_name,
          template_images,
          template_has_web,
          template_has_mobile
        ) VALUES ($1, $2, $3, $4)
        RETURNING template_id
      `;

      const values = [
        sanitizedTemplateName,
        sanitizedTemplateImageIds,
        sanitizedTemplateHasWeb === undefined ? true : sanitizedTemplateHasWeb,
        sanitizedTemplateHasMobile === undefined
          ? false
          : sanitizedTemplateHasMobile,
      ];

      result = await client.query(queryText, values);
    } catch (insertError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime);

      logger.error('Template insertion failed', {
        error: insertError.message,
        requestId,
      });

      Sentry.captureException(insertError, {
        tags: { component: 'add_template', action: 'insertion' },
        extra: { requestId },
      });

      return NextResponse.json(
        { success: false, error: 'Failed to add template to database' },
        { status: 500, headers },
      );
    }

    await client.cleanup();

    const newTemplateId = result.rows[0].template_id;
    const responseTime = Date.now() - startTime;
    const headers = createResponseHeaders(requestId, responseTime);

    logger.info('Template added successfully', {
      templateId: newTemplateId,
      templateName: sanitizedTemplateName,
      imagesCount: sanitizedTemplateImageIds.length,
      responseTimeMs: responseTime,
      userId: user.id,
      requestId,
    });

    Sentry.addBreadcrumb({
      category: 'database',
      message: 'Template added successfully',
      level: 'info',
      data: {
        templateId: newTemplateId,
        templateName: sanitizedTemplateName,
        userId: user.id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Template added successfully',
        templateId: newTemplateId,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 201, headers },
    );
  } catch (error) {
    if (client) await client.cleanup();

    const responseTime = Date.now() - startTime;
    const headers = createResponseHeaders(requestId, responseTime);

    logger.error('Global add template error', {
      error: error.message,
      requestId,
    });

    Sentry.captureException(error, {
      tags: { component: 'add_template', critical: 'true' },
      extra: { requestId, responseTimeMs: responseTime },
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to add template',
        requestId,
      },
      { status: 500, headers },
    );
  }
}
