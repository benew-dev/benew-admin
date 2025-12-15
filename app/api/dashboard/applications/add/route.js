// app/api/dashboard/applications/add/route.js
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getClient } from '@/backend/dbConnect';
import { applyRateLimit } from '@/backend/rateLimiter';
import { sanitizeApplicationInputsStrict } from '@/utils/sanitizers/sanitizeApplicationInputs';
import { applicationAddingSchema } from '@/utils/schemas/applicationSchema';
import logger from '@/utils/logger';
import {
  trackAuth,
  trackDatabase,
  trackDatabaseError,
  trackValidation,
} from '@/utils/monitoring';

export const dynamic = 'force-dynamic';

const addApplicationRateLimit = applyRateLimit('CONTENT_API', {
  windowMs: 5 * 60 * 1000,
  max: 8,
  message:
    "Trop de tentatives d'ajout d'applications. Veuillez réessayer dans quelques minutes.",
  prefix: 'add_application',
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

  logger.info('Add application API called', { requestId });

  try {
    // Rate limiting
    const rateLimitResponse = await addApplicationRateLimit(request);
    if (rateLimitResponse) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime);

      logger.warn('Add application rate limit exceeded', { requestId });

      trackDatabase('rate_limit_exceeded', {}, 'warning');

      const rateLimitBody = await rateLimitResponse.json();
      return NextResponse.json(rateLimitBody, { status: 429, headers });
    }

    // Authentification
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime);

      logger.warn('Unauthenticated add application attempt', { requestId });

      trackAuth('unauthenticated_add_application', {}, 'warning');

      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers },
      );
    }

    // Parse body
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

      trackDatabaseError(parseError, 'json_parse', { requestId });

      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400, headers },
      );
    }

    const {
      name,
      link,
      admin,
      description,
      category,
      fee,
      rent,
      imageUrls,
      templateId,
      level,
    } = body;

    // Sanitization
    const sanitizedInputs = sanitizeApplicationInputsStrict({
      name,
      link,
      admin,
      description,
      category,
      fee,
      rent,
      imageUrls,
      templateId,
      level,
    });

    const {
      name: sanitizedName,
      link: sanitizedLink,
      admin: sanitizedAdmin,
      description: sanitizedDescription,
      category: sanitizedCategory,
      fee: sanitizedFee,
      rent: sanitizedRent,
      imageUrls: sanitizedImageUrls,
      templateId: sanitizedTemplateId,
      level: sanitizedLevel,
    } = sanitizedInputs;

    // Validation Yup
    try {
      await applicationAddingSchema.validate(
        {
          name: sanitizedName,
          link: sanitizedLink,
          admin: sanitizedAdmin,
          description: sanitizedDescription,
          category: sanitizedCategory,
          fee: sanitizedFee,
          rent: sanitizedRent,
          imageUrls: sanitizedImageUrls,
          templateId: sanitizedTemplateId,
          level: sanitizedLevel,
        },
        { abortEarly: false },
      );
    } catch (validationError) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime);

      logger.warn('Application validation failed', {
        errors: validationError.inner?.length || 0,
        requestId,
      });

      trackValidation(
        'application_validation_failed',
        {
          errors: validationError.inner?.map((e) => e.path),
        },
        'warning',
      );

      const errors = {};
      validationError.inner.forEach((error) => {
        errors[error.path] = error.message;
      });

      return NextResponse.json({ errors }, { status: 400, headers });
    }

    // Validation champs requis
    if (
      !sanitizedName ||
      !sanitizedLink ||
      !sanitizedAdmin ||
      !sanitizedFee ||
      sanitizedRent === undefined ||
      !sanitizedImageUrls?.length ||
      !sanitizedTemplateId ||
      !sanitizedLevel
    ) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime);

      logger.warn('Missing required fields', { requestId });

      trackValidation('missing_required_fields', {}, 'warning');

      return NextResponse.json(
        { message: 'All required fields must be provided' },
        { status: 400, headers },
      );
    }

    // Connexion DB
    try {
      client = await getClient();
    } catch (dbError) {
      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime);

      logger.error('Database connection failed', {
        error: dbError.message,
        requestId,
      });

      trackDatabaseError(dbError, 'db_connection', { requestId });

      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 503, headers },
      );
    }

    // Insertion
    let result;
    try {
      const queryText = `
        INSERT INTO catalog.applications (
          application_name,
          application_link,
          application_admin_link,
          application_description,
          application_category,
          application_fee,
          application_rent,
          application_images,
          application_template_id,
          application_level
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING application_id
      `;

      const values = [
        sanitizedName,
        sanitizedLink,
        sanitizedAdmin,
        sanitizedDescription || null,
        sanitizedCategory,
        sanitizedFee,
        sanitizedRent,
        sanitizedImageUrls,
        sanitizedTemplateId,
        sanitizedLevel,
      ];

      result = await client.query(queryText, values);
    } catch (insertError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const headers = createResponseHeaders(requestId, responseTime);

      logger.error('Application insertion failed', {
        error: insertError.message,
        requestId,
      });

      trackDatabaseError(insertError, 'insertion', { requestId });

      return NextResponse.json(
        { error: 'Failed to add application to database' },
        { status: 500, headers },
      );
    }

    const newApplicationId = result.rows[0].application_id;
    const responseTime = Date.now() - startTime;

    logger.info('Application added successfully', {
      applicationId: newApplicationId,
      name: sanitizedName,
      category: sanitizedCategory,
      durationMs: responseTime,
      userId: session.user.id,
      requestId,
    });

    trackDatabase('application_added_successfully', {
      applicationId: newApplicationId,
      name: sanitizedName,
      category: sanitizedCategory,
      userId: session.user.id,
    });

    await client.cleanup();

    const headers = createResponseHeaders(requestId, responseTime);

    return NextResponse.json(
      {
        message: 'Application added successfully',
        applicationId: newApplicationId,
        success: true,
        data: {
          application_id: newApplicationId,
          application_name: sanitizedName,
          application_category: sanitizedCategory,
          application_fee: sanitizedFee,
          application_rent: sanitizedRent,
        },
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

    logger.error('Global add application error', {
      error: error.message,
      requestId,
    });

    trackDatabaseError(error, 'add_application', {
      requestId,
      durationMs: responseTime,
      critical: 'true',
    });

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to add application',
        success: false,
        requestId,
      },
      { status: 500, headers },
    );
  }
}
