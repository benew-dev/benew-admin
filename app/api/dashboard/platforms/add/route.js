// app/api/dashboard/platforms/add/route.js
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getClient } from '@/backend/dbConnect';
import { applyRateLimit } from '@/backend/rateLimiter';
import { sanitizePlatformInputsStrict } from '@/utils/sanitizers/sanitizePlatformInputs';
import { platformAddingSchema } from '@/utils/schemas/platformSchema';
import logger from '@/utils/logger';
import {
  trackAuth,
  trackDatabase,
  trackDatabaseError,
  trackValidation,
} from '@/utils/monitoring';

export const dynamic = 'force-dynamic';

const addPlatformRateLimit = applyRateLimit('CONTENT_API', {
  windowMs: 10 * 60 * 1000,
  max: 5,
  message:
    "Trop de tentatives d'ajout de plateformes de paiement. Veuillez réessayer dans quelques minutes.",
  prefix: 'add_platform',
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

  logger.info('Add platform API called', { requestId });

  try {
    // Rate limiting
    const rateLimitResponse = await addPlatformRateLimit(request);
    if (rateLimitResponse) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Add platform rate limit exceeded', { requestId });
      trackDatabase('add_platform_rate_limit_exceeded', {}, 'warning');

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

      logger.warn('Unauthenticated add platform attempt', { requestId });
      trackAuth('unauthenticated_add_platform', {}, 'warning');

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
      });

      trackDatabaseError(dbError, 'db_connection_add_platform', { requestId });

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
      });

      trackDatabaseError(parseError, 'json_parse_add_platform', { requestId });

      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400, header },
      );
    }

    // ✅ MODIFIÉ : Extraire isCashPayment et description
    const {
      platformName,
      accountName,
      accountNumber,
      isCashPayment,
      description,
    } = body;

    // Sanitization
    const sanitizedInputs = sanitizePlatformInputsStrict({
      platformName,
      accountName,
      accountNumber,
      isCashPayment,
      description,
    });

    const {
      platformName: sanitizedPlatformName,
      accountName: sanitizedAccountName,
      accountNumber: sanitizedAccountNumber,
      isCashPayment: sanitizedIsCashPayment,
      description: sanitizedDescription,
    } = sanitizedInputs;

    // Validation Yup
    try {
      await platformAddingSchema.validate(
        {
          platformName: sanitizedPlatformName,
          accountName: sanitizedAccountName,
          accountNumber: sanitizedAccountNumber,
          isCashPayment: sanitizedIsCashPayment,
          description: sanitizedDescription,
        },
        { abortEarly: false },
      );
    } catch (validationError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Platform validation failed', {
        errors: validationError.inner?.length || 0,
        requestId,
      });

      trackValidation(
        'platform_validation_failed',
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

    // ✅ MODIFIÉ : Vérification champs requis (uniquement platformName)
    if (!sanitizedPlatformName) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Missing platform name after sanitization', { requestId });

      return NextResponse.json(
        { message: 'Platform name is required' },
        { status: 400, header },
      );
    }

    // ✅ MODIFIÉ : Vérification champs requis pour plateformes électroniques
    if (!sanitizedIsCashPayment) {
      if (!sanitizedAccountName || !sanitizedAccountNumber) {
        await client.cleanup();

        const responseTime = Date.now() - startTime;
        const header = createResponseHeaders(requestId, responseTime);

        logger.warn('Missing account info for electronic platform', {
          requestId,
        });

        return NextResponse.json(
          {
            message:
              'Account name and account number are required for electronic platforms',
          },
          { status: 400, header },
        );
      }
    }

    // Vérification unicité (nom de plateforme)
    try {
      const uniqueCheckQuery = `
        SELECT platform_id, platform_name 
        FROM admin.platforms 
        WHERE LOWER(platform_name) = LOWER($1)
      `;

      const existingPlatform = await client.query(uniqueCheckQuery, [
        sanitizedPlatformName,
      ]);

      if (existingPlatform.rows.length > 0) {
        await client.cleanup();

        const responseTime = Date.now() - startTime;
        const header = createResponseHeaders(requestId, responseTime);

        logger.warn('Platform uniqueness violation', {
          requestId,
          existingPlatformId: existingPlatform.rows[0].platform_id,
        });

        trackValidation('platform_uniqueness_violation', {}, 'warning');

        return NextResponse.json(
          {
            error: 'A platform with this name already exists',
            field: 'platformName',
          },
          { status: 409, header },
        );
      }
    } catch (uniqueCheckError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.error('Platform uniqueness check error', {
        error: uniqueCheckError.message,
        requestId,
      });

      trackDatabaseError(uniqueCheckError, 'uniqueness_check', { requestId });

      return NextResponse.json(
        { error: 'Failed to verify platform uniqueness' },
        { status: 500, header },
      );
    }

    // ✅ MODIFIÉ : Insertion avec is_cash_payment et description
    let result;
    try {
      const queryText = `
        INSERT INTO admin.platforms (
          platform_name,
          account_name,
          account_number,
          is_cash_payment,
          description
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING 
          platform_id, 
          platform_name, 
          account_name, 
          account_number, 
          is_cash_payment,
          description,
          created_at
      `;

      const values = [
        sanitizedPlatformName,
        sanitizedAccountName,
        sanitizedAccountNumber,
        sanitizedIsCashPayment,
        sanitizedDescription,
      ];

      result = await client.query(queryText, values);
    } catch (insertError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.error('Platform insertion error', {
        error: insertError.message,
        code: insertError.code,
        requestId,
      });

      trackDatabaseError(insertError, 'insertion', { requestId });

      // ✅ Gérer erreur de contrainte CHECK
      if (insertError.code === '23514') {
        return NextResponse.json(
          {
            error:
              'Validation error: Cash payment cannot have account information',
            message: 'Please verify your input and try again',
          },
          { status: 400, header },
        );
      }

      return NextResponse.json(
        { error: 'Failed to add platform to database' },
        { status: 500, header },
      );
    }

    const newPlatformData = result.rows[0];
    const responseTime = Date.now() - startTime;

    logger.info('Platform added successfully', {
      newPlatformId: newPlatformData.platform_id,
      platformName: sanitizedPlatformName,
      isCashPayment: sanitizedIsCashPayment,
      durationMs: responseTime,
      userId: session.user.id,
      requestId,
    });

    trackDatabase('platform_added_successfully', {
      newPlatformId: newPlatformData.platform_id,
      platformName: sanitizedPlatformName,
      isCashPayment: sanitizedIsCashPayment,
      userId: session.user.id,
    });

    await client.cleanup();

    const header = createResponseHeaders(requestId, responseTime);

    return NextResponse.json(
      {
        message: 'Platform added successfully',
        platform: {
          id: newPlatformData.platform_id,
          name: newPlatformData.platform_name,
          accountName: newPlatformData.account_name,
          accountNumber: newPlatformData.account_number,
          isCashPayment: newPlatformData.is_cash_payment,
          description: newPlatformData.description,
          createdAt: newPlatformData.created_at,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 201, header },
    );
  } catch (error) {
    if (client) await client.cleanup();

    const responseTime = Date.now() - startTime;
    const header = createResponseHeaders(requestId, responseTime);

    logger.error('Global add platform error', {
      error: error.message,
      requestId,
    });

    trackDatabaseError(error, 'add_platform', {
      requestId,
      durationMs: responseTime,
      critical: 'true',
    });

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to add platform',
        requestId,
      },
      { status: 500, header },
    );
  }
}
