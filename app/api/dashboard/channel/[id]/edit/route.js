// app/api/dashboard/channel/[id]/edit/route.js
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import cloudinary from '@/backend/cloudinary';
import { getClient } from '@/backend/dbConnect';
import { applyRateLimit } from '@/backend/rateLimiter';
import { videoUpdateSchema, videoIdSchema } from '@/utils/schemas/videoSchema';
import { sanitizeVideoInputsStrict } from '@/utils/sanitizers/sanitizeVideoInputs';
import logger from '@/utils/logger';
import {
  trackAuth,
  trackDatabase,
  trackDatabaseError,
  trackValidation,
} from '@/utils/monitoring';

export const dynamic = 'force-dynamic';

const editVideoRateLimit = applyRateLimit('CONTENT_API', {
  windowMs: 2 * 60 * 1000,
  max: 15,
  message:
    'Trop de tentatives de modification de vidéos. Veuillez réessayer dans quelques minutes.',
  prefix: 'edit_video',
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
  const { id } = await params;

  logger.info('Edit video API called', { requestId, videoId: id });

  try {
    // ===== 1. VALIDATION ID =====
    try {
      await videoIdSchema.validate({ id }, { abortEarly: false });
    } catch (idValidationError) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Invalid video ID', {
        requestId,
        videoId: id,
        error: idValidationError.message,
      });

      trackValidation('invalid_video_id_edit', { videoId: id }, 'warning');

      return NextResponse.json(
        {
          error: 'Invalid video ID format',
          details: idValidationError.inner?.map((err) => err.message) || [
            idValidationError.message,
          ],
        },
        { status: 400, headers: header },
      );
    }

    // ===== 2. NETTOYAGE UUID =====
    const cleanedVideoId = id?.toString().trim();
    if (!cleanedVideoId) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Video ID cleaning failed', { requestId, providedId: id });

      return NextResponse.json(
        { error: 'Invalid video ID format' },
        { status: 400, headers: header },
      );
    }

    // ===== 3. RATE LIMITING =====
    const rateLimitResponse = await editVideoRateLimit(request);
    if (rateLimitResponse) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Edit video rate limit exceeded', {
        requestId,
        videoId: cleanedVideoId,
      });

      trackDatabase('edit_video_rate_limit_exceeded', {}, 'warning');

      const rateLimitBody = await rateLimitResponse.json();
      return NextResponse.json(rateLimitBody, {
        status: 429,
        headers: header,
      });
    }

    // ===== 4. AUTHENTIFICATION =====
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Unauthenticated edit video attempt', {
        requestId,
        videoId: cleanedVideoId,
      });

      trackAuth('unauthenticated_edit_video', {}, 'warning');

      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: header },
      );
    }

    // ===== 5. CONNEXION DB =====
    try {
      client = await getClient();
    } catch (dbError) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.error('Database connection failed', {
        error: dbError.message,
        requestId,
        videoId: cleanedVideoId,
      });

      trackDatabaseError(dbError, 'db_connection_edit_video', { requestId });

      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 503, headers: header },
      );
    }

    // ===== 6. PARSE BODY =====
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
        videoId: cleanedVideoId,
      });

      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400, headers: header },
      );
    }

    const {
      title,
      description,
      category,
      level,
      tags,
      durationSeconds,
      seriesName,
      seriesOrder,
      relatedApplicationId,
      relatedTemplateId,
      isActive,
      // IDs Cloudinary (nouveaux uploadés)
      cloudinaryId,
      thumbnailId,
      // Anciens IDs pour supprimer de Cloudinary si remplacés
      oldCloudinaryId,
      oldThumbnailId,
    } = body;

    // ===== 7. SANITIZATION =====
    const dataToSanitize = {};
    if (title !== undefined) dataToSanitize.title = title;
    if (description !== undefined) dataToSanitize.description = description;
    if (category !== undefined) dataToSanitize.category = category;
    if (seriesName !== undefined) dataToSanitize.seriesName = seriesName;

    const sanitizedInputs = sanitizeVideoInputsStrict(dataToSanitize);

    const finalData = {
      ...sanitizedInputs,
      level,
      tags,
      durationSeconds,
      seriesOrder,
      relatedApplicationId,
      relatedTemplateId,
      isActive,
      cloudinaryId,
      thumbnailId,
    };

    // ===== 8. VALIDATION YUP =====
    try {
      const dataToValidate = Object.fromEntries(
        Object.entries({
          title: finalData.title,
          description: finalData.description,
          category: finalData.category,
          level: finalData.level,
          tags: finalData.tags,
          durationSeconds: finalData.durationSeconds,
          seriesName: finalData.seriesName,
          seriesOrder: finalData.seriesOrder,
          isActive: finalData.isActive,
          // eslint-disable-next-line no-unused-vars
        }).filter(([_, value]) => value !== undefined),
      );

      await videoUpdateSchema.validate(dataToValidate, { abortEarly: false });
    } catch (validationError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Video validation failed', {
        errors: validationError.inner?.length || 0,
        requestId,
        videoId: cleanedVideoId,
      });

      trackValidation(
        'video_validation_failed_edit',
        { errors: validationError.inner?.map((e) => e.path) },
        'warning',
      );

      const errors = {};
      validationError.inner.forEach((error) => {
        errors[error.path] = error.message;
      });

      return NextResponse.json({ errors }, { status: 400, headers: header });
    }

    // ===== 9. SUPPRESSION CLOUDINARY ANCIENS ASSETS =====
    // Si une nouvelle vidéo a été uploadée, supprimer l'ancienne
    if (cloudinaryId && oldCloudinaryId && cloudinaryId !== oldCloudinaryId) {
      try {
        await cloudinary.uploader.destroy(oldCloudinaryId, {
          resource_type: 'video',
        });
      } catch (deleteError) {
        logger.warn('Error deleting old video from Cloudinary', {
          requestId,
          videoId: cleanedVideoId,
          publicId: oldCloudinaryId,
          error: deleteError.message,
        });
      }
    }

    // Si une nouvelle thumbnail a été uploadée, supprimer l'ancienne
    if (thumbnailId && oldThumbnailId && thumbnailId !== oldThumbnailId) {
      try {
        await cloudinary.uploader.destroy(oldThumbnailId, {
          resource_type: 'image',
        });
      } catch (deleteError) {
        logger.warn('Error deleting old thumbnail from Cloudinary', {
          requestId,
          videoId: cleanedVideoId,
          publicId: oldThumbnailId,
          error: deleteError.message,
        });
      }
    }

    // Si la thumbnail a été supprimée sans remplacement
    if (oldThumbnailId && thumbnailId === null && !cloudinaryId) {
      try {
        await cloudinary.uploader.destroy(oldThumbnailId, {
          resource_type: 'image',
        });
      } catch (deleteError) {
        logger.warn('Error deleting removed thumbnail from Cloudinary', {
          requestId,
          videoId: cleanedVideoId,
          publicId: oldThumbnailId,
          error: deleteError.message,
        });
      }
    }

    // ===== 10. MISE À JOUR EN BASE =====
    let result;
    try {
      const updateFields = [];
      const updateValues = [];
      let p = 1;

      if (finalData.title !== undefined) {
        updateFields.push(`video_title = $${p++}`);
        updateValues.push(finalData.title);
      }
      if (finalData.description !== undefined) {
        updateFields.push(`video_description = $${p++}`);
        updateValues.push(finalData.description || null);
      }
      if (cloudinaryId !== undefined) {
        updateFields.push(`video_cloudinary_id = $${p++}`);
        updateValues.push(cloudinaryId);
      }
      if (thumbnailId !== undefined) {
        updateFields.push(`video_thumbnail_id = $${p++}`);
        updateValues.push(thumbnailId || null);
      }
      if (finalData.category !== undefined) {
        updateFields.push(`video_category = $${p++}`);
        updateValues.push(finalData.category);
      }
      if (finalData.level !== undefined) {
        updateFields.push(`video_level = $${p++}`);
        updateValues.push(parseInt(finalData.level));
      }
      if (finalData.tags !== undefined) {
        updateFields.push(`video_tags = $${p++}`);
        updateValues.push(finalData.tags || []);
      }
      if (finalData.durationSeconds !== undefined) {
        updateFields.push(`video_duration_seconds = $${p++}`);
        updateValues.push(
          finalData.durationSeconds
            ? parseInt(finalData.durationSeconds)
            : null,
        );
      }
      if (finalData.seriesName !== undefined) {
        updateFields.push(`series_name = $${p++}`);
        updateValues.push(finalData.seriesName || null);
      }
      if (finalData.seriesOrder !== undefined) {
        updateFields.push(`series_order = $${p++}`);
        updateValues.push(
          finalData.seriesOrder ? parseInt(finalData.seriesOrder) : null,
        );
      }
      if (relatedApplicationId !== undefined) {
        updateFields.push(`related_application_id = $${p++}`);
        updateValues.push(relatedApplicationId || null);
      }
      if (relatedTemplateId !== undefined) {
        updateFields.push(`related_template_id = $${p++}`);
        updateValues.push(relatedTemplateId || null);
      }
      if (finalData.isActive !== undefined) {
        updateFields.push(`is_active = $${p++}`);
        updateValues.push(Boolean(finalData.isActive));
      }

      // updated_at
      updateFields.push(`updated_at = $${p++}`);
      updateValues.push(new Date().toISOString());

      // WHERE
      updateValues.push(cleanedVideoId);

      if (updateFields.length === 1) {
        // Seul updated_at — rien à faire
        await client.cleanup();
        const responseTime = Date.now() - startTime;
        const header = createResponseHeaders(requestId, responseTime);
        return NextResponse.json(
          { error: 'No fields to update' },
          { status: 400, headers: header },
        );
      }

      const queryText = `
        UPDATE catalog.channel_videos
        SET ${updateFields.join(', ')}
        WHERE video_id = $${p}
        RETURNING *
      `;

      result = await client.query(queryText, updateValues);

      if (result.rows.length === 0) {
        await client.cleanup();
        const responseTime = Date.now() - startTime;
        const header = createResponseHeaders(requestId, responseTime);

        logger.warn('Video not found for update', {
          requestId,
          videoId: cleanedVideoId,
        });

        trackValidation('video_not_found_update', {}, 'warning');

        return NextResponse.json(
          { message: 'Video not found' },
          { status: 404, headers: header },
        );
      }
    } catch (updateError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.error('Video update error', {
        error: updateError.message,
        requestId,
        videoId: cleanedVideoId,
      });

      trackDatabaseError(updateError, 'video_update', { requestId });

      return NextResponse.json(
        {
          error: 'Failed to update video',
          message: updateError.message,
        },
        { status: 500, headers: header },
      );
    }

    // ===== 11. RÉPONSE =====
    const updatedVideo = result.rows[0];
    const sanitizedVideo = {
      video_id: updatedVideo.video_id,
      video_title: updatedVideo.video_title || '',
      video_description: updatedVideo.video_description || null,
      video_cloudinary_id: updatedVideo.video_cloudinary_id,
      video_thumbnail_id: updatedVideo.video_thumbnail_id || null,
      video_category: updatedVideo.video_category || 'tutorial',
      video_level: parseInt(updatedVideo.video_level) || 1,
      video_tags: updatedVideo.video_tags || [],
      video_duration_seconds: updatedVideo.video_duration_seconds
        ? parseInt(updatedVideo.video_duration_seconds)
        : null,
      views_count: parseInt(updatedVideo.views_count) || 0,
      series_name: updatedVideo.series_name || null,
      series_order: updatedVideo.series_order
        ? parseInt(updatedVideo.series_order)
        : null,
      related_application_id: updatedVideo.related_application_id || null,
      related_template_id: updatedVideo.related_template_id || null,
      is_active: Boolean(updatedVideo.is_active),
      created_at: updatedVideo.created_at,
      updated_at: updatedVideo.updated_at,
    };

    const responseTime = Date.now() - startTime;

    logger.info('Video updated successfully', {
      videoId: cleanedVideoId,
      title: sanitizedVideo.video_title,
      durationMs: responseTime,
      userId: session.user.id,
      requestId,
    });

    trackDatabase('video_updated_successfully', {
      videoId: cleanedVideoId,
      title: sanitizedVideo.video_title,
      userId: session.user.id,
    });

    await client.cleanup();

    const header = createResponseHeaders(requestId, responseTime);

    return NextResponse.json(
      {
        success: true,
        message: 'Video updated successfully',
        video: sanitizedVideo,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200, headers: header },
    );
  } catch (error) {
    if (client) await client.cleanup();

    const responseTime = Date.now() - startTime;
    const header = createResponseHeaders(requestId, responseTime);

    logger.error('Global edit video error', {
      error: error.message,
      requestId,
      videoId: id,
    });

    trackDatabaseError(error, 'edit_video_global', {
      requestId,
      durationMs: responseTime,
      critical: 'true',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to update video',
        requestId,
      },
      { status: 500, headers: header },
    );
  }
}
