/* eslint-disable no-unused-vars */
// app/api/dashboard/platforms/[id]/edit/route.js
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getClient } from '@/backend/dbConnect';
import { applyRateLimit } from '@/backend/rateLimiter';
import { sanitizePlatformUpdateInputsStrict } from '@/utils/sanitizers/sanitizePlatformInputs';
import {
  platformUpdateSchema,
  platformIdSchema,
  cleanUUID,
} from '@/utils/schemas/platformSchema';
import logger from '@/utils/logger';
import {
  trackAuth,
  trackDatabase,
  trackDatabaseError,
  trackValidation,
} from '@/utils/monitoring';

export const dynamic = 'force-dynamic';

const editPlatformRateLimit = applyRateLimit('CONTENT_API', {
  windowMs: 5 * 60 * 1000,
  max: 10,
  message:
    'Trop de tentatives de modification. Veuillez réessayer dans quelques minutes.',
  prefix: 'edit_platform',
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

  logger.info('Edit platform API called', { requestId, platformId: id });

  try {
    // Validation ID
    try {
      await platformIdSchema.validate({ id }, { abortEarly: false });
    } catch (idValidationError) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Invalid platform ID', { requestId, platformId: id });
      trackValidation(
        'invalid_platform_id_edit',
        { platformId: id },
        'warning',
      );

      return NextResponse.json(
        { error: 'Invalid platform ID format' },
        { status: 400, header },
      );
    }

    const cleanedPlatformId = cleanUUID(id);
    if (!cleanedPlatformId) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);
      return NextResponse.json(
        { error: 'Invalid platform ID format' },
        { status: 400, header },
      );
    }

    // Rate limiting
    const rateLimitResponse = await editPlatformRateLimit(request);
    if (rateLimitResponse) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Edit rate limit exceeded', {
        requestId,
        platformId: cleanedPlatformId,
      });
      trackDatabase('edit_platform_rate_limit_exceeded', {}, 'warning');

      const rateLimitBody = await rateLimitResponse.json();
      return NextResponse.json(rateLimitBody, { status: 429, header });
    }

    // Authentification
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Unauthenticated edit attempt', { requestId });
      trackAuth('unauthenticated_edit_platform', {}, 'warning');

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

      logger.error('DB connection failed', {
        error: dbError.message,
        requestId,
      });
      trackDatabaseError(dbError, 'db_connection_edit', { requestId });

      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 503, header },
      );
    }

    // Parsing body
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
      });
      trackValidation('json_parse_error_edit', {}, 'error');

      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400, header },
      );
    }

    const { platformName, accountName, accountNumber, isActive } = body;

    // Sanitization
    const dataToSanitize = {
      platformName,
      accountName,
      accountNumber,
      isActive,
    };
    const filteredDataToSanitize = Object.fromEntries(
      Object.entries(dataToSanitize).filter(
        ([_, value]) => value !== undefined,
      ),
    );

    const sanitizedInputs = sanitizePlatformUpdateInputsStrict(
      filteredDataToSanitize,
    );
    const {
      platformName: sanitizedPlatformName,
      accountName: sanitizedAccountName,
      accountNumber: sanitizedAccountNumber,
      isActive: sanitizedIsActive,
    } = sanitizedInputs;

    // Validation Yup
    try {
      const dataToValidate = Object.fromEntries(
        Object.entries({
          platformName: sanitizedPlatformName,
          accountName: sanitizedAccountName,
          accountNumber: sanitizedAccountNumber,
          isActive: sanitizedIsActive,
        }).filter(([_, value]) => value !== undefined),
      );

      await platformUpdateSchema.validate(dataToValidate, {
        abortEarly: false,
      });
    } catch (validationError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Validation failed', {
        errors: validationError.inner?.map((e) => e.path),
        requestId,
      });

      trackValidation(
        'platform_edit_validation_failed',
        {
          fields: validationError.inner?.map((e) => e.path),
        },
        'warning',
      );

      const errors = {};
      validationError.inner.forEach((error) => {
        errors[error.path] = error.message;
      });

      return NextResponse.json({ errors }, { status: 400, header });
    }

    // Mise à jour
    let result;
    try {
      const updateFields = [];
      const updateValues = [];
      let paramCounter = 1;

      if (sanitizedPlatformName !== undefined) {
        updateFields.push(`platform_name = $${paramCounter}`);
        updateValues.push(sanitizedPlatformName);
        paramCounter++;
      }

      if (sanitizedAccountName !== undefined) {
        updateFields.push(`account_name = $${paramCounter}`);
        updateValues.push(sanitizedAccountName);
        paramCounter++;
      }

      if (sanitizedAccountNumber !== undefined) {
        updateFields.push(`account_number = $${paramCounter}`);
        updateValues.push(sanitizedAccountNumber);
        paramCounter++;
      }

      if (sanitizedIsActive !== undefined) {
        updateFields.push(`is_active = $${paramCounter}`);
        updateValues.push(sanitizedIsActive);
        paramCounter++;
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(cleanedPlatformId);

      const queryText = `
        UPDATE admin.platforms 
        SET ${updateFields.join(', ')}
        WHERE platform_id = $${paramCounter}
        RETURNING platform_id, platform_name, account_name, account_number, is_active, created_at, updated_at
      `;

      result = await client.query(queryText, updateValues);

      if (result.rows.length === 0) {
        await client.cleanup();

        const responseTime = Date.now() - startTime;
        const header = createResponseHeaders(requestId, responseTime);

        logger.warn('Platform not found', {
          requestId,
          platformId: cleanedPlatformId,
        });
        trackValidation('platform_not_found_edit', {}, 'warning');

        return NextResponse.json(
          { message: 'Platform not found' },
          { status: 404, header },
        );
      }
    } catch (updateError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.error('Update error', { error: updateError.message, requestId });
      trackDatabaseError(updateError, 'platform_update', { requestId });

      return NextResponse.json(
        { error: 'Failed to update platform' },
        { status: 500, header },
      );
    }

    const updatedPlatform = result.rows[0];
    const responseTime = Date.now() - startTime;

    logger.info('Platform updated successfully', {
      platformId: cleanedPlatformId,
      name: updatedPlatform.platform_name,
      durationMs: responseTime,
      userId: session.user.id,
      requestId,
    });

    trackDatabase('platform_updated_successfully', {
      platformId: cleanedPlatformId,
      userId: session.user.id,
    });

    await client.cleanup();
    const header = createResponseHeaders(requestId, responseTime);

    // Masquer partiellement le numéro dans la réponse
    const responseData = {
      ...updatedPlatform,
      account_number: updatedPlatform.account_number
        ? `${updatedPlatform.account_number.slice(0, 3)}***${updatedPlatform.account_number.slice(-2)}`
        : '[No Number]',
    };

    return NextResponse.json(
      {
        success: true,
        message: 'Platform updated successfully',
        platform: responseData,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          security_note: 'Account number is partially masked for security',
        },
      },
      { status: 200, header },
    );
  } catch (error) {
    if (client) await client.cleanup();

    const responseTime = Date.now() - startTime;
    const header = createResponseHeaders(requestId, responseTime);

    logger.error('Global edit platform error', {
      error: error.message,
      requestId,
    });
    trackDatabaseError(error, 'edit_platform', { requestId, critical: 'true' });

    return NextResponse.json(
      { success: false, error: 'Internal server error', requestId },
      { status: 500, header },
    );
  }
}
