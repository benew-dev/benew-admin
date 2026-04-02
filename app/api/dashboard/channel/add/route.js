// app/api/dashboard/channel/add/route.js
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getClient } from '@/backend/dbConnect';
import { applyRateLimit } from '@/backend/rateLimiter';
import { sanitizeVideoInputsStrict } from '@/utils/sanitizers/sanitizeVideoInputs';
import { videoAddingSchema } from '@/utils/schemas/videoSchema';
import logger from '@/utils/logger';
import {
  trackAuth,
  trackDatabase,
  trackDatabaseError,
  trackValidation,
} from '@/utils/monitoring';

export const dynamic = 'force-dynamic';

const addVideoRateLimit = applyRateLimit('CONTENT_API', {
  windowMs: 5 * 60 * 1000,
  max: 10,
  message:
    "Trop de tentatives d'ajout de vidéos. Veuillez réessayer dans quelques minutes.",
  prefix: 'add_video',
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

  logger.info('Add video API called', { requestId });

  try {
    // Rate limiting
    const rateLimitResponse = await addVideoRateLimit(request);
    if (rateLimitResponse) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Add video rate limit exceeded', { requestId });
      trackDatabase('rate_limit_exceeded', {}, 'warning');

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

      logger.warn('Unauthenticated add video attempt', { requestId });
      trackAuth('unauthenticated_add_video', {}, 'warning');

      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, header },
      );
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.error('JSON parse error', {
        error: parseError.message,
        requestId,
      });
      trackDatabaseError(parseError, 'json_parse', { requestId });

      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400, header },
      );
    }

    const {
      title,
      description,
      cloudinaryId,
      thumbnailId,
      category,
      tags,
      durationSeconds,
    } = body;

    // Sanitization
    const sanitizedInputs = sanitizeVideoInputsStrict({
      title,
      description,
      cloudinaryId,
      thumbnailId,
      category,
      tags,
      durationSeconds,
    });

    const {
      title: sanitizedTitle,
      description: sanitizedDescription,
      cloudinaryId: sanitizedCloudinaryId,
      thumbnailId: sanitizedThumbnailId,
      category: sanitizedCategory,
      tags: sanitizedTags,
      durationSeconds: sanitizedDurationSeconds,
    } = sanitizedInputs;

    // Validation Yup
    try {
      await videoAddingSchema.validate(
        {
          title: sanitizedTitle,
          description: sanitizedDescription,
          cloudinaryId: sanitizedCloudinaryId,
          thumbnailId: sanitizedThumbnailId,
          category: sanitizedCategory,
          tags: sanitizedTags,
          durationSeconds: sanitizedDurationSeconds,
        },
        { abortEarly: false },
      );
    } catch (validationError) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Video validation failed', {
        errors: validationError.inner?.length || 0,
        requestId,
      });

      trackValidation(
        'video_validation_failed',
        { errors: validationError.inner?.map((e) => e.path) },
        'warning',
      );

      const errors = {};
      validationError.inner.forEach((error) => {
        errors[error.path] = error.message;
      });

      return NextResponse.json({ errors }, { status: 400, header });
    }

    // Validation champs requis
    if (!sanitizedTitle || !sanitizedCloudinaryId) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Missing required fields', { requestId });
      trackValidation('missing_required_fields', {}, 'warning');

      return NextResponse.json(
        { message: 'All required fields must be provided' },
        { status: 400, header },
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
      trackDatabaseError(dbError, 'db_connection', { requestId });

      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 503, header },
      );
    }

    // Insertion
    let result;
    try {
      const queryText = `
        INSERT INTO catalog.channel_videos (
          video_title,
          video_description,
          video_cloudinary_id,
          video_thumbnail_id,
          video_category,
          video_tags,
          video_duration_seconds
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING video_id
      `;

      const values = [
        sanitizedTitle,
        sanitizedDescription || null,
        sanitizedCloudinaryId,
        sanitizedThumbnailId || null,
        sanitizedCategory || null,
        sanitizedTags || [],
        sanitizedDurationSeconds || null,
      ];

      result = await client.query(queryText, values);
    } catch (insertError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.error('Video insertion failed', {
        error: insertError.message,
        requestId,
      });
      trackDatabaseError(insertError, 'insertion', { requestId });

      return NextResponse.json(
        { error: 'Failed to add video to database' },
        { status: 500, header },
      );
    }

    const newVideoId = result.rows[0].video_id;
    const responseTime = Date.now() - startTime;

    logger.info('Video added successfully', {
      videoId: newVideoId,
      title: sanitizedTitle,
      durationMs: responseTime,
      userId: session.user.id,
      requestId,
    });

    trackDatabase('video_added_successfully', {
      videoId: newVideoId,
      title: sanitizedTitle,
      userId: session.user.id,
    });

    await client.cleanup();

    const header = createResponseHeaders(requestId, responseTime);

    return NextResponse.json(
      {
        message: 'Video added successfully',
        videoId: newVideoId,
        success: true,
        data: {
          video_id: newVideoId,
          video_title: sanitizedTitle,
          video_cloudinary_id: sanitizedCloudinaryId,
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

    logger.error('Global add video error', {
      error: error.message,
      requestId,
    });

    trackDatabaseError(error, 'add_video', {
      requestId,
      durationMs: responseTime,
      critical: 'true',
    });

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to add video',
        success: false,
        requestId,
      },
      { status: 500, header },
    );
  }
}
